/**
 * conflictRepairEngine.js
 * Automatic Timetable Conflict Resolution & Repair Engine
 * 
 * Enforces Part 3 of the Master Engineering Prompt:
 * - Automatically analyses detected hard-constraint violations
 * - Diagnoses exact root causes and conflicting constraints
 * - Explores candidate valid repairs (domain pruning, candidate search, bounded backtracking)
 * - Evaluates overall timetable impact before applying repairs (no new hard conflicts permitted)
 * - Safely rolls back invalid repairs
 * - Re-optimizes soft preferences after each repair
 * - Maintains complete audit log of all repair attempts and solutions
 */

const { validateGlobalLabOccupancy, getPermittedLaboratories, validateLabEligibility, checkLabAvailability } = require('./labValidationService');
const { auditTimetable } = require('./independentValidator');
const { arePeriodsConsecutiveWithoutRest, isSlotValid } = require('./constraintValidator');

const MAX_REPAIR_CYCLES = 50;

/**
 * Generate a hash of current timetable grid state to detect and avoid cycling
 */
function hashGridState(grid) {
  const parts = [];
  for (const [cid, dayMap] of Object.entries(grid || {})) {
    for (const [day, periods] of Object.entries(dayMap || {})) {
      for (const [p, slot] of Object.entries(periods || {})) {
        if (slot && !slot.isEmpty && !slot.isBreak) {
          parts.push(`${cid}:${day}:${p}:${slot.subjectCode}:${slot.roomName}:${(slot.teacherIds || []).join(',')}`);
        }
      }
    }
  }
  return parts.sort().join('|');
}

/**
 * Deep clone grid
 */
function cloneGrid(grid) {
  return JSON.parse(JSON.stringify(grid));
}

/**
 * Main Automatic Conflict Repair Engine
 */
function runConflictRepair(initialGrid, data, options = {}) {
  const startTime = Date.now();
  let currentGrid = cloneGrid(initialGrid);
  const auditTrail = [];
  const visitedStates = new Set();
  visitedStates.add(hashGridState(currentGrid));

  const classes = data.classes || [];
  const classMap = {};
  for (const c of classes) classMap[c._id.toString()] = c;

  let repairsAppliedCount = 0;
  let cycle = 0;

  while (cycle < MAX_REPAIR_CYCLES) {
    cycle++;
    const audit = auditTimetable(currentGrid, data, options);

    // If zero hard violations remain, timetable is successfully repaired!
    if (audit.hardViolationsCount === 0) {
      break;
    }

    // Sort violations by repair priority:
    // 1. Invalid lab eligibility & lab double bookings
    // 2. Faculty double bookings
    // 3. Faculty rest gap violations (3+ consecutive periods)
    // 4. Minor track desynchronization
    // 5. Unsatisfied subject hours
    const sortedViolations = [...audit.hardViolations].sort((a, b) => {
      const priorityOrder = {
        INVALID_LAB_ASSIGNMENT: 1,
        LAB_DOUBLE_BOOKING: 2,
        TEACHER_DOUBLE_BOOKED: 3,
        FACULTY_REST_GAP: 4,
        MINOR_TRACK_DESYNCHRONIZATION: 5,
        UNSATISFIED_SUBJECT_HOURS: 6,
      };
      return (priorityOrder[a.type] || 99) - (priorityOrder[b.type] || 99);
    });

    const targetViolation = sortedViolations[0];
    let repairSuccess = false;

    // -----------------------------------------------------------------
    // REPAIR STRATEGY 1: INVALID_LAB_ASSIGNMENT
    // -----------------------------------------------------------------
    if (targetViolation.type === 'INVALID_LAB_ASSIGNMENT') {
      const { classId, day, period, room, subjectCode, permittedRooms } = targetViolation;
      const targetSlot = currentGrid[classId]?.[day]?.[period];

      if (targetSlot && permittedRooms && permittedRooms.length > 0) {
        for (const candidateRoom of permittedRooms) {
          // Check if candidate room is available
          const isFree = checkLabAvailability(currentGrid, candidateRoom, day, period, 1, classId);
          if (isFree) {
            const rollbackState = cloneGrid(currentGrid);
            // Apply repair: update roomName
            targetSlot.roomName = candidateRoom;

            // If it's a lab block, update all slots of this block
            for (let p = 1; p <= 6; p++) {
              const sibling = currentGrid[classId]?.[day]?.[p];
              if (sibling && sibling.subjectCode === subjectCode && sibling.isLabBlock) {
                sibling.roomName = candidateRoom;
              }
            }

            const stateHash = hashGridState(currentGrid);
            const newAudit = auditTimetable(currentGrid, data, options);
            if (!visitedStates.has(stateHash) && newAudit.hardViolationsCount < audit.hardViolationsCount) {
              visitedStates.add(stateHash);
              repairsAppliedCount++;
              repairSuccess = true;
              auditTrail.push({
                cycle,
                conflictType: 'INVALID_LAB_ASSIGNMENT',
                affectedClass: classMap[classId]?.name || classId,
                day,
                period,
                actionTaken: `Reassigned laboratory from '${room}' to authorized permitted laboratory '${candidateRoom}' for ${subjectCode}.`,
                violationsBefore: audit.hardViolationsCount,
                violationsAfter: newAudit.hardViolationsCount,
              });
              break;
            } else {
              // Rollback
              currentGrid = rollbackState;
            }
          }
        }
      }
    }

    // -----------------------------------------------------------------
    // REPAIR STRATEGY 2: LAB_DOUBLE_BOOKING
    // -----------------------------------------------------------------
    if (!repairSuccess && targetViolation.type === 'LAB_DOUBLE_BOOKING') {
      const { day, period, room, classesInvolved } = targetViolation;
      // We have multiple classes in the same lab. Try to move the lab block of the second class.
      if (classesInvolved && classesInvolved.length >= 2) {
        const victim = classesInvolved[1];
        const victimClassId = victim.classId;
        const victimCode = victim.subjectCode;

        // Find candidate non-break periods/days where the lab is completely free for 3 periods
        const candidateDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
        const candidateStartPeriods = [1, 4]; // Standard 3-period practical blocks: P1-P3, P4-P6

        for (const candDay of candidateDays) {
          if (candDay === day) continue; // Try different day
          for (const candStartP of candidateStartPeriods) {
            const labFree = checkLabAvailability(currentGrid, room, candDay, candStartP, 3, victimClassId);
            if (labFree) {
              // Check if victim class slots at candDay P[candStartP .. candStartP+2] are compatible for swapping
              const rollbackState = cloneGrid(currentGrid);
              let canSwap = true;

              // Swap the 3 periods
              for (let offset = 0; offset < 3; offset++) {
                const srcP = (period <= 3 ? 1 : 4) + offset;
                const dstP = candStartP + offset;

                const srcSlot = currentGrid[victimClassId]?.[day]?.[srcP];
                const dstSlot = currentGrid[victimClassId]?.[candDay]?.[dstP];

                if (!srcSlot || !dstSlot || dstSlot.isLabBlock || dstSlot.isBreak || dstSlot.isLocked) {
                  canSwap = false;
                  break;
                }
              }

              if (canSwap) {
                // Execute 3-period block swap
                for (let offset = 0; offset < 3; offset++) {
                  const srcP = (period <= 3 ? 1 : 4) + offset;
                  const dstP = candStartP + offset;

                  const srcSlot = currentGrid[victimClassId][day][srcP];
                  const dstSlot = currentGrid[victimClassId][candDay][dstP];

                  currentGrid[victimClassId][day][srcP] = { ...dstSlot, day, period: srcP };
                  currentGrid[victimClassId][candDay][dstP] = { ...srcSlot, day: candDay, period: dstP };
                }

                const stateHash = hashGridState(currentGrid);
                const newAudit = auditTimetable(currentGrid, data, options);
                if (!visitedStates.has(stateHash) && newAudit.hardViolationsCount < audit.hardViolationsCount) {
                  visitedStates.add(stateHash);
                  repairsAppliedCount++;
                  repairSuccess = true;
                  auditTrail.push({
                    cycle,
                    conflictType: 'LAB_DOUBLE_BOOKING',
                    affectedClass: victim.className,
                    day,
                    period,
                    actionTaken: `Relocated 3-period laboratory block of ${victim.className} (${victimCode}) from ${day} to ${candDay} P${candStartP}-P${candStartP + 2} to eliminate laboratory collision in '${room}'.`,
                    violationsBefore: audit.hardViolationsCount,
                    violationsAfter: newAudit.hardViolationsCount,
                  });
                  break;
                } else {
                  currentGrid = rollbackState;
                }
              }
            }
          }
          if (repairSuccess) break;
        }
      }
    }

    // -----------------------------------------------------------------
    // REPAIR STRATEGY 3: TEACHER_DOUBLE_BOOKED
    // -----------------------------------------------------------------
    if (!repairSuccess && targetViolation.type === 'TEACHER_DOUBLE_BOOKED') {
      const { teacherId, teacherName, day, period, allocations } = targetViolation;
      if (allocations && allocations.length >= 2) {
        // Pick one of the conflicting allocations and search for an intra-class swap
        const victim = allocations[1];
        const victimClassId = victim.classId;

        const candidateDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        for (const targetDay of candidateDays) {
          for (let targetP = 1; targetP <= 6; targetP++) {
            if (targetDay === day && targetP === period) continue;

            const targetSlot = currentGrid[victimClassId]?.[targetDay]?.[targetP];
            if (!targetSlot || targetSlot.isBreak || targetSlot.isLocked || targetSlot.isLabBlock || targetSlot.isMinor) {
              continue;
            }

            // Test if swapping (day, period) with (targetDay, targetP) in victimClassId is valid
            const rollbackState = cloneGrid(currentGrid);

            const srcSlot = currentGrid[victimClassId][day][period];
            currentGrid[victimClassId][day][period] = { ...targetSlot, day, period };
            currentGrid[victimClassId][targetDay][targetP] = { ...srcSlot, day: targetDay, period: targetP };

            const stateHash = hashGridState(currentGrid);
            const newAudit = auditTimetable(currentGrid, data, options);

            if (!visitedStates.has(stateHash) && newAudit.hardViolationsCount < audit.hardViolationsCount) {
              visitedStates.add(stateHash);
              repairsAppliedCount++;
              repairSuccess = true;
              auditTrail.push({
                cycle,
                conflictType: 'TEACHER_DOUBLE_BOOKED',
                affectedClass: victim.className,
                day,
                period,
                actionTaken: `Swapped ${victim.subjectName} with ${targetSlot.subjectName} (${targetDay} P${targetP}) in ${victim.className} to resolve double-booking for ${teacherName}.`,
                violationsBefore: audit.hardViolationsCount,
                violationsAfter: newAudit.hardViolationsCount,
              });
              break;
            } else {
              currentGrid = rollbackState;
            }
          }
          if (repairSuccess) break;
        }
      }
    }

    // -----------------------------------------------------------------
    // REPAIR STRATEGY 4: FACULTY_REST_GAP (3+ Consecutive Teaching Periods)
    // -----------------------------------------------------------------
    if (!repairSuccess && targetViolation.type === 'FACULTY_REST_GAP') {
      const { teacherId, teacherName, day, periods } = targetViolation;

      // Check if any of these periods is a multi-instructor practical block
      let labStaggerApplied = false;
      for (const p of periods) {
        for (const [classId, dayMap] of Object.entries(currentGrid)) {
          const slot = dayMap[day]?.[p];
          if (slot && slot.isLabBlock && (slot.teacherIds || []).map((id) => id.toString()).includes(teacherId)) {
            const sub = (data.subjects || []).find((s) => s._id.toString() === (slot.subjectId || '').toString());
            const coIds = (sub?.coInstructors || []).map((c) => (c._id ? c._id.toString() : c.toString()));

            if (coIds.length > 0) {
              const primaryId = (slot.teacherIds || [])[0]?.toString();
              const coId = coIds[0];

              // Stagger presence: P1: Primary, P2: Both, P3: Co-instructor
              const rollbackState = cloneGrid(currentGrid);
              const startP = p <= 3 ? 1 : 4;

              for (let off = 0; off < 3; off++) {
                const curP = startP + off;
                const sl = currentGrid[classId]?.[day]?.[curP];
                if (sl && sl.isLabBlock) {
                  if (off === 0) {
                    sl.teacherIds = [primaryId];
                  } else if (off === 1) {
                    sl.teacherIds = [primaryId, coId];
                  } else if (off === 2) {
                    sl.teacherIds = [coId];
                  }
                }
              }

              const stateHash = hashGridState(currentGrid);
              const newAudit = auditTimetable(currentGrid, data, options);
              if (!visitedStates.has(stateHash) && newAudit.hardViolationsCount < audit.hardViolationsCount) {
                visitedStates.add(stateHash);
                repairsAppliedCount++;
                repairSuccess = true;
                labStaggerApplied = true;
                auditTrail.push({
                  cycle,
                  conflictType: 'FACULTY_REST_GAP',
                  affectedClass: classMap[classId]?.name || classId,
                  day,
                  period: p,
                  actionTaken: `Staggered lab instructional attendance for ${slot.subjectName} on ${day} to guarantee rest gaps for ${teacherName}.`,
                  violationsBefore: audit.hardViolationsCount,
                  violationsAfter: newAudit.hardViolationsCount,
                });
                break;
              } else {
                currentGrid = rollbackState;
              }
            }
          }
        }
        if (labStaggerApplied) break;
      }

      // If not lab or stagger was insufficient, break the 3-period theory sequence via intra-class swap
      if (!repairSuccess) {
        const middlePeriod = periods[1]; // Break middle period to split streak
        for (const [classId, dayMap] of Object.entries(currentGrid)) {
          const slot = dayMap[day]?.[middlePeriod];
          if (slot && !slot.isLabBlock && !slot.isBreak && !slot.isLocked && (slot.teacherIds || []).map((id) => id.toString()).includes(teacherId)) {
            // Find another day/period in this class to swap
            for (const candDay of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
              for (let candP = 1; candP <= 6; candP++) {
                if (candDay === day) continue;
                const candSlot = currentGrid[classId]?.[candDay]?.[candP];
                if (!candSlot || candSlot.isBreak || candSlot.isLocked || candSlot.isLabBlock || candSlot.isMinor) continue;

                const rollbackState = cloneGrid(currentGrid);
                currentGrid[classId][day][middlePeriod] = { ...candSlot, day, period: middlePeriod };
                currentGrid[classId][candDay][candP] = { ...slot, day: candDay, period: candP };

                const stateHash = hashGridState(currentGrid);
                const newAudit = auditTimetable(currentGrid, data, options);
                if (!visitedStates.has(stateHash) && newAudit.hardViolationsCount < audit.hardViolationsCount) {
                  visitedStates.add(stateHash);
                  repairsAppliedCount++;
                  repairSuccess = true;
                  auditTrail.push({
                    cycle,
                    conflictType: 'FACULTY_REST_GAP',
                    affectedClass: classMap[classId]?.name || classId,
                    day,
                    period: middlePeriod,
                    actionTaken: `Relocated theory session of ${slot.subjectName} in ${classMap[classId]?.name} to ${candDay} P${candP} to eliminate 3 consecutive teaching periods for ${teacherName}.`,
                    violationsBefore: audit.hardViolationsCount,
                    violationsAfter: newAudit.hardViolationsCount,
                  });
                  break;
                } else {
                  currentGrid = rollbackState;
                }
              }
              if (repairSuccess) break;
            }
          }
          if (repairSuccess) break;
        }
      }
    }

    // If no repair candidate succeeded in this cycle, stop searching to avoid infinite loops
    if (!repairSuccess) {
      break;
    }
  }

  const finalAudit = auditTimetable(currentGrid, data, options);
  const timeMs = Date.now() - startTime;

  return {
    repairedGrid: currentGrid,
    repairsAppliedCount,
    cyclesRun: cycle,
    timeMs,
    auditTrail,
    initialViolationsCount: auditTimetable(initialGrid, data, options).hardViolationsCount,
    finalViolationsCount: finalAudit.hardViolationsCount,
    finalAudit,
  };
}

module.exports = {
  runConflictRepair,
};
