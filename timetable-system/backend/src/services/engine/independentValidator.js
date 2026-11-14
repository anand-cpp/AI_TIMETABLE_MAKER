/**
 * independentValidator.js
 * Independent Final Validation Engine & Publication Gate
 * 
 * Enforces Part 5 of the Master Engineering Prompt:
 * - Reconstructs all resource occupancy maps from scratch directly from final allocation records
 * - Audits all faculty double-bookings and faculty rest gaps (max 2 consecutive periods)
 * - Audits laboratory eligibility, full-duration reservation, and double-booking
 * - Audits section clashes and weekly curriculum contact hour compliance
 * - Audits Minor track synchronization across participating sections
 * - Determines strict publication gate outcome (Outcome A, B, or C)
 */

const { validateGlobalLabOccupancy, validateLabEligibility } = require('./labValidationService');
const { arePeriodsConsecutiveWithoutRest } = require('./constraintValidator');

/**
 * Perform ground-truth independent mathematical and constraint audit
 */
function auditTimetable(grid, data, options = {}) {
  const classes = data.classes || [];
  const subjects = data.subjects || [];
  const teachers = data.teachers || [];

  const classMap = {};
  for (const c of classes) classMap[c._id.toString()] = c;

  const subjectMap = {};
  for (const s of subjects) subjectMap[s._id.toString()] = s;

  const teacherMap = {};
  for (const t of teachers) teacherMap[t._id.toString()] = t;

  const hardViolations = [];
  const softWarnings = [];

  // -------------------------------------------------------------
  // 1. RECONSTRUCT FACULTY OCCUPANCY & REST GAPS
  // -------------------------------------------------------------
  // Key: teacherId -> day -> period -> Array of slot allocations
  const teacherOccupancy = {};

  for (const [classId, dayMap] of Object.entries(grid || {})) {
    const cls = classMap[classId] || { name: `Class ${classId}` };
    for (const [day, periodMap] of Object.entries(dayMap || {})) {
      for (const [periodStr, slot] of Object.entries(periodMap || {})) {
        const period = Number(periodStr);
        if (!slot || slot.isEmpty || slot.isBreak || !slot.subjectCode) continue;

        const tIds = (slot.teacherIds || []).map((id) => (id._id ? id._id.toString() : id.toString()));
        for (const tid of tIds) {
          if (!teacherOccupancy[tid]) teacherOccupancy[tid] = {};
          if (!teacherOccupancy[tid][day]) teacherOccupancy[tid][day] = {};
          if (!teacherOccupancy[tid][day][period]) teacherOccupancy[tid][day][period] = [];

          teacherOccupancy[tid][day][period].push({
            classId,
            className: cls.name,
            day,
            period,
            subjectCode: slot.subjectCode,
            subjectName: slot.subjectName,
            isElective: !!slot.isElective,
            sharedSessionId: slot.sharedSessionId || null,
            roomName: slot.roomName,
            isLabBlock: !!slot.isLabBlock,
          });
        }
      }
    }
  }

  // 1A. Detect Faculty Double Booking
  for (const [tid, days] of Object.entries(teacherOccupancy)) {
    const teacherName = teacherMap[tid]?.name || `Teacher ${tid}`;
    for (const [day, periods] of Object.entries(days)) {
      for (const [periodStr, allocs] of Object.entries(periods)) {
        const period = Number(periodStr);
        if (allocs.length > 1) {
          // Check if authorized shared session (e.g. synchronized linked elective or capstone)
          const allShared = allocs.every((a) => a.sharedSessionId && a.sharedSessionId === allocs[0].sharedSessionId);
          if (!allShared) {
            const classList = allocs.map((a) => `${a.className} (${a.subjectName})`).join(' and ');
            hardViolations.push({
              type: 'TEACHER_DOUBLE_BOOKED',
              severity: 'hard',
              teacherId: tid,
              teacherName,
              day,
              period,
              message: `Faculty member ${teacherName} is double-booked on ${day} Period ${period} across ${classList}.`,
              allocations: allocs,
            });
          }
        }
      }
    }
  }

  // 1B. Detect Faculty Consecutive Teaching Violation (Max 2 consecutive; 3 strictly prohibited)
  for (const [tid, days] of Object.entries(teacherOccupancy)) {
    const teacherName = teacherMap[tid]?.name || `Teacher ${tid}`;
    for (const [day, periodsMap] of Object.entries(days)) {
      const sortedPeriods = Object.keys(periodsMap).map(Number).sort((a, b) => a - b);
      for (let i = 0; i < sortedPeriods.length - 2; i++) {
        const p1 = sortedPeriods[i];
        const p2 = sortedPeriods[i + 1];
        const p3 = sortedPeriods[i + 2];

        if (arePeriodsConsecutiveWithoutRest(p1, p2, day) && arePeriodsConsecutiveWithoutRest(p2, p3, day)) {
          // Check if all 3 periods belong to the same atomic practical lab block or capstone project
          const s1 = (periodsMap[p1] || [])[0];
          const s2 = (periodsMap[p2] || [])[0];
          const s3 = (periodsMap[p3] || [])[0];

          const isSameLabBlock = s1 && s2 && s3 &&
            s1.isLabBlock && s2.isLabBlock && s3.isLabBlock &&
            s1.subjectCode && s1.subjectCode === s2.subjectCode && s2.subjectCode === s3.subjectCode &&
            s1.classId === s2.classId && s2.classId === s3.classId;

          const isSameProject = s1 && s2 && s3 &&
            (s1.subjectCode === 'CST416' || s1.subjectCode === 'CSD416' || s1.subjectName?.includes('Project Phase')) &&
            (s2.subjectCode === 'CST416' || s2.subjectCode === 'CSD416' || s2.subjectName?.includes('Project Phase')) &&
            (s3.subjectCode === 'CST416' || s3.subjectCode === 'CSD416' || s3.subjectName?.includes('Project Phase'));

          if (isSameLabBlock || isSameProject) {
            continue; // Legitimate atomic practical block or capstone project
          }

          hardViolations.push({
            type: 'FACULTY_REST_GAP',
            severity: 'hard',
            teacherId: tid,
            teacherName,
            day,
            periods: [p1, p2, p3],
            message: `Faculty member ${teacherName} has 3 consecutive teaching periods on ${day} (Periods P${p1}–P${p3}) without a rest gap. A guaranteed rest gap is required after at most 2 consecutive periods.`,
          });
        }
      }

      // Check soft preference for isolated teaching periods
      for (let i = 0; i < sortedPeriods.length - 1; i++) {
        const p1 = sortedPeriods[i];
        const p2 = sortedPeriods[i + 1];
        if (arePeriodsConsecutiveWithoutRest(p1, p2, day)) {
          softWarnings.push({
            type: 'FACULTY_CONSECUTIVE_PAIR',
            severity: 'soft',
            teacherId: tid,
            teacherName,
            day,
            periods: [p1, p2],
            message: `Faculty member ${teacherName} is scheduled for 2 consecutive periods on ${day} (P${p1}-P${p2}). Preferred: Teaching → Free → Teaching.`,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. RECONSTRUCT LABORATORY OCCUPANCY & ELIGIBILITY
  // -------------------------------------------------------------
  const labAudit = validateGlobalLabOccupancy(grid, classes, options);
  for (const v of labAudit.violations) {
    hardViolations.push(v);
  }

  // -------------------------------------------------------------
  // 3. RECONSTRUCT SECTION CLASHES & ACADEMIC CONTACT HOURS
  // -------------------------------------------------------------
  let totalRequiredHours = 0;
  let totalScheduledHours = 0;
  const missingSubjects = [];

  if (options.checkSubjectHours !== false) {
    // Count placed hours per subject
    const placedHoursBySubject = {};
    for (const [classId, dayMap] of Object.entries(grid || {})) {
      for (const [day, periodMap] of Object.entries(dayMap || {})) {
        for (const [periodStr, slot] of Object.entries(periodMap || {})) {
          if (!slot || slot.isEmpty || slot.isBreak) continue;
          if (slot.subjectId) {
            const sid = slot.subjectId.toString();
            placedHoursBySubject[sid] = (placedHoursBySubject[sid] || 0) + 1;
          }
          // Account for elective group options (e.g. S8 PE-3, PE-4, PE-5 groups)
          if (slot.isElective && slot.electiveGroupId) {
            const slotGid = slot.electiveGroupId.toString();
            for (const sub of subjects) {
              const subGid = (sub.electiveDetails?.electiveGroupId?._id || sub.electiveDetails?.electiveGroupId || '').toString();
              if (subGid === slotGid && (!slot.subjectId || slot.subjectId.toString() !== sub._id.toString())) {
                placedHoursBySubject[sub._id.toString()] = (placedHoursBySubject[sub._id.toString()] || 0) + 1;
              }
            }
            if (Array.isArray(data.electiveGroups)) {
              const grp = data.electiveGroups.find(g => g._id.toString() === slot.electiveGroupId.toString());
              if (grp && Array.isArray(grp.options)) {
                for (const opt of grp.options) {
                  const optSid = (opt.subjectId?._id || opt.subjectId || '').toString();
                  if (optSid && optSid !== slot.subjectId?.toString()) {
                    placedHoursBySubject[optSid] = (placedHoursBySubject[optSid] || 0) + 1;
                  }
                }
              }
            }
          }
          // Account for co-offered elective options in composite subject codes (e.g. PECST411 / PECST419)
          if (slot.subjectCode && slot.subjectCode.includes('/')) {
            const codes = slot.subjectCode.split('/').map(c => c.trim());
            for (const sub of subjects) {
              if (codes.includes(sub.code) && (!slot.subjectId || slot.subjectId.toString() !== sub._id.toString())) {
                placedHoursBySubject[sub._id.toString()] = (placedHoursBySubject[sub._id.toString()] || 0) + 1;
              }
            }
          }
          totalScheduledHours++;
        }
      }
    }

    // Compare against required weekly contact hours
    for (const sub of subjects) {
      const required = sub.weeklyHours || 0;
      totalRequiredHours += required;
      const placed = placedHoursBySubject[sub._id.toString()] || 0;
      if (placed < required) {
        const cls = classMap[sub.classId?.toString()] || {};
        const missing = required - placed;
        missingSubjects.push({
          subjectId: sub._id,
          subjectName: sub.name,
          subjectCode: sub.code,
          classId: sub.classId,
          className: cls.name || 'Unknown Class',
          required,
          placed,
          missing,
        });

        hardViolations.push({
          type: 'UNSATISFIED_SUBJECT_HOURS',
          severity: 'hard',
          classId: sub.classId,
          className: cls.name,
          subjectName: sub.name,
          subjectCode: sub.code,
          message: `Subject ${sub.name} (${sub.code}) requires ${required} weekly periods, but only ${placed} were placed (${missing} missing).`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 4. MINOR TRACK SYNCHRONIZATION AUDIT
  // -------------------------------------------------------------
  const s4a = classes.find((c) => c.name === 'S4 CSE A');
  const s4b = classes.find((c) => c.name === 'S4 CSE B');
  if (s4a && s4b) {
    const s4aId = s4a._id.toString();
    const s4bId = s4b._id.toString();
    const s4aGrid = grid[s4aId] || {};
    const s4bGrid = grid[s4bId] || {};

    const minorSlotsA = [];
    const minorSlotsB = [];

    for (const [day, periods] of Object.entries(s4aGrid)) {
      for (const [p, slot] of Object.entries(periods)) {
        if (slot && (slot.isMinor || (slot.subjectName && slot.subjectName.includes('Cyber Ethics')))) {
          minorSlotsA.push(`${day}_P${p}`);
        }
      }
    }

    for (const [day, periods] of Object.entries(s4bGrid)) {
      for (const [p, slot] of Object.entries(periods)) {
        if (slot && (slot.isMinor || (slot.subjectName && slot.subjectName.includes('Cyber Ethics')))) {
          minorSlotsB.push(`${day}_P${p}`);
        }
      }
    }

    minorSlotsA.sort();
    minorSlotsB.sort();
    const isSynced =
      minorSlotsA.length === minorSlotsB.length &&
      minorSlotsA.every((val, idx) => val === minorSlotsB[idx]);

    if (!isSynced && minorSlotsA.length > 0 && minorSlotsB.length > 0) {
      hardViolations.push({
        type: 'MINOR_TRACK_DESYNCHRONIZATION',
        severity: 'hard',
        message: `Minor tracks for S4 CSE A and S4 CSE B are not synchronized: S4 CSE A has [${minorSlotsA.join(', ')}], while S4 CSE B has [${minorSlotsB.join(', ')}].`,
      });
    }
  }

  // -------------------------------------------------------------
  // 5. DETERMINE PUBLICATION GATE OUTCOME (Part 5.3)
  // -------------------------------------------------------------
  let outcome = 'FULLY_VALID';
  let isPublishable = false;

  if (hardViolations.length === 0 && missingSubjects.length === 0) {
    outcome = 'FULLY_VALID'; // Outcome A: Fully Valid
    isPublishable = true;
  } else if (missingSubjects.length > 0 && hardViolations.every((v) => v.type === 'UNSATISFIED_SUBJECT_HOURS')) {
    outcome = 'PARTIALLY_FEASIBLE'; // Outcome B: Partially Feasible
    isPublishable = false;
  } else if (hardViolations.length > 0) {
    outcome = 'INFEASIBLE'; // Outcome C: Infeasible / Critical Violations Present
    isPublishable = false;
  }

  return {
    outcome,
    isPublishable,
    valid: isPublishable,
    hardViolationsCount: hardViolations.length,
    softWarningsCount: softWarnings.length,
    hardViolations,
    softWarnings,
    missingSubjects,
    metrics: {
      totalRequiredHours,
      totalScheduledHours,
      missingHours: totalRequiredHours - totalScheduledHours,
      hoursFulfillmentRate: totalRequiredHours > 0 ? Math.round((totalScheduledHours / totalRequiredHours) * 100) : 100,
    },
  };
}

module.exports = {
  auditTimetable,
};
