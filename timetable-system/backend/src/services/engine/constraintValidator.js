const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * Constraint Validator - ASET 2026-27 EVEN Semester
 * Supports: P2, P3 (Mon-Thu only), P6 (2×P3 blocks), Co-instructors, Lab 3/4 rooms
 */

const HARD_VIOLATION_TYPES = [
  'TEACHER_DOUBLE_BOOKED',
  'CLASS_DOUBLE_BOOKED',
  'LAB_ROOM_CONFLICT',
  'TEACHER_UNAVAILABLE',
  'SUBJECT_UNDER_SCHEDULED',
  'SUBJECT_OVER_SCHEDULED',
  'INVALID_SLOT_NO_TEACHER',
  'LAB_BLOCK_SPLIT',
  'LAB_BLOCK_NON_CONSECUTIVE',
  'LAB_BREAK_CROSSED',
  'SLOT_OUT_OF_TIMELINE',
  'BREAK_SLOT_USED',
  'TEACHER_DAILY_LIMIT_EXCEEDED',
  'FRIDAY_P3_LAB_PROHIBITED',
  'LAB_ROOM_MISMATCH',
  'THEORY_CONSECUTIVE_PERIODS_VIOLATION',
  'FIXED_SLOT_VIOLATION',
  'FIXED_SLOT_CONFLICT',
];

const isHardViolation = (type) => HARD_VIOLATION_TYPES.includes(type);

const slotTeacherIds = (slot) => {
  const ids = [];
  if (!slot) return ids;
  if (Array.isArray(slot.teacherIds)) {
    slot.teacherIds.forEach((id) => id && ids.push(id.toString()));
  }
  if (Array.isArray(slot.coInstructorIds)) {
    slot.coInstructorIds.forEach((id) => id && ids.push(id.toString()));
  }
  if (slot.isBatchSplit) {
    if (slot.batch1?.teacherId) ids.push(slot.batch1.teacherId.toString());
    if (slot.batch2?.teacherId) ids.push(slot.batch2.teacherId.toString());
  }
  return ids;
};

const slotRoomNames = (slot) => {
  const rooms = [];
  if (!slot) return rooms;
  if (slot.roomName && (slot.subjectType === 'lab' || slot.isBatchSplit)) {
    rooms.push(slot.roomName);
  }
  if (slot.isBatchSplit) {
    if (slot.batch1?.roomName) rooms.push(slot.batch1.roomName);
    if (slot.batch2?.roomName) rooms.push(slot.batch2.roomName);
  }
  return rooms.filter(Boolean);
};

const isOccupied = (slot) => slot && !slot.isEmpty && !slot.isBreak;

const sharedElectiveToken = (slot) => {
  if (!slot) return null;
  if (slot.isElective) return slot.electiveGroupId || slot.linkedGroupId || slot.subjectId?.toString() || null;
  return null;
};

/**
 * Main structural hard-constraint validation for a grid
 */
const validateGrid = (grid, data) => {
  const violations = [];
  const {
    workingDays = [],
    periodsPerDayMap = {},
    allPeriodsPerDayMap = {},
    breakPeriodsPerDayMap = {},
    settings = {},
    teacherMap = {},
    timeline,
    fridayTimeline,
    adminOverrides = {},
  } = data;

  const teacherDailyLimitOverrides = adminOverrides.teacherDailyLimitOverrides || {};
  const teacherUnavailabilityOverrides = adminOverrides.teacherUnavailabilityOverrides || [];

  const teacherSchedule = {};
  const labRoomSchedule = {};

  for (const [classId, dayMap] of Object.entries(grid)) {
    for (const [day, periodMap] of Object.entries(dayMap)) {
      const breakPeriods = breakPeriodsPerDayMap[day] || [];

      for (const [periodStr, slot] of Object.entries(periodMap)) {
        const period = Number(periodStr);

        if (!slot) continue;

        // 1. Slot outside configured timeline
        const validPeriods = allPeriodsPerDayMap[day] || periodsPerDayMap[day];
        if (validPeriods && !validPeriods.includes(period)) {
          violations.push({
            type: 'SLOT_OUT_OF_TIMELINE',
            message: `Class ${classId}: slot ${day} P${period} is not a configured period`,
            classId, day, period,
          });
          continue;
        }

        // Break cell — must not carry a teaching subject
        if (slot.isBreak) {
          if (slot.subjectId && !slot.isEmpty) {
            violations.push({
              type: 'BREAK_SLOT_USED',
              message: `Class ${classId}: break ${day} P${period} has a subject assigned`,
              classId, day, period,
            });
          }
          continue;
        }

        if (!isOccupied(slot)) continue;

        // 2. Teaching slot must not sit on a configured break period
        if (breakPeriods.includes(period)) {
          violations.push({
            type: 'BREAK_SLOT_USED',
            message: `Class ${classId}: slot ${day} P${period} is a break period but has a subject assigned`,
            classId, day, period,
          });
        }

        // 3. Teaching slot without any assigned teacher
        const realSubject = ['theory', 'lab', 'elective'].includes(slot.subjectType);
        if (realSubject && slotTeacherIds(slot).length === 0) {
          violations.push({
            type: 'INVALID_SLOT_NO_TEACHER',
            message: `Class ${classId}: ${day} P${period} has '${slot.subjectName || slot.subjectType}' but no valid teacher`,
            classId, day, period,
          });
        }

        // 4. Teacher double-booking + unavailability
        for (const teacherId of slotTeacherIds(slot)) {
          if (!teacherSchedule[teacherId]) teacherSchedule[teacherId] = {};
          if (!teacherSchedule[teacherId][day]) teacherSchedule[teacherId][day] = [];

          const existingClaim = teacherSchedule[teacherId][day].find((c) => c.period === period);
          const token = sharedElectiveToken(slot);

          if (existingClaim) {
            const sharedSession =
              token && existingClaim.token && token === existingClaim.token;
            if (!sharedSession && !slot.isOverride) {
              const teacher = teacherMap[teacherId];
              violations.push({
                type: 'TEACHER_DOUBLE_BOOKED',
                message: `Teacher ${teacher?.name || teacherId} is double-booked on ${day} period ${period}`,
                teacherId, day, period,
              });
            }
          } else {
            teacherSchedule[teacherId][day].push({ period, token });
          }

          const teacher = teacherMap[teacherId];
          if (teacher && Array.isArray(teacher.unavailability)) {
            const isIgnoredUnavail = teacherUnavailabilityOverrides.some(
              (u) =>
                (u.teacherId === teacherId || u.teacherName === teacher.name) &&
                u.day === day &&
                u.period === period
            );
            if (!isIgnoredUnavail) {
              const isUnavailable = teacher.unavailability.some(
                (u) => u.day === day && u.period === period
              );
              if (isUnavailable) {
                violations.push({
                  type: 'TEACHER_UNAVAILABLE',
                  message: `Teacher ${teacher.name} is unavailable on ${day} period ${period}`,
                  teacherId, day, period,
                });
              }
            }
          }
        }

        // 5. Lab room double-booking
        for (const room of slotRoomNames(slot)) {
          if (!labRoomSchedule[room]) labRoomSchedule[room] = {};
          if (!labRoomSchedule[room][day]) labRoomSchedule[room][day] = [];

          if (labRoomSchedule[room][day].includes(period)) {
            if (!slot.isOverride) {
              violations.push({
                type: 'LAB_ROOM_CONFLICT',
                message: `Lab room '${room}' is used by multiple classes on ${day} period ${period}`,
                room, day, period,
              });
            }
          } else {
            labRoomSchedule[room][day].push(period);
          }
        }

        // 6. Friday P3 Lab Prohibition
        if (day === 'Friday' && slot.isLabBlock && slot.labBlockIndex === 0) {
          const blockDuration = slot.labBlockDuration || (slot.labBlockIndex !== undefined ? 3 : 3);
          if (blockDuration >= 3) {
            violations.push({
              type: 'FRIDAY_P3_LAB_PROHIBITED',
              message: `Class ${classId}: 3-period lab block on Friday ${day} P${period} is prohibited (Friday periods are 50 min)`,
              classId, day, period,
            });
          }
        }

        // 7. Lab Room Mismatch (S2 must use Lab 3, S4/S6/S8 must use Lab 4)
        if (slot.subjectType === 'lab' && slot.roomName) {
          const classSem = slot.classSemester || 0;
          const expectedRoom = classSem === 2 ? 'Lab 3' : (classSem >= 4 ? 'Lab 4' : '');
          if (expectedRoom && slot.roomName !== expectedRoom && !slot.isOverride) {
            violations.push({
              type: 'LAB_ROOM_MISMATCH',
              message: `Class ${classId}: Lab assigned to ${slot.roomName} but semester ${classSem} requires ${expectedRoom}`,
              classId, day, period, room: slot.roomName,
            });
          }
        }

        // 8. Feature A: Consecutive periods requirement for theory subjects
        if (slot.subjectType === 'theory' && slot.requiresConsecutivePeriods && slot.consecutivePeriodsCount > 1) {
          const requiredCount = slot.consecutivePeriodsCount;
          // Check if this period is part of a consecutive block of required length
          let consecutiveCount = 1;
          // Check forward
          for (let p = period + 1; p <= period + requiredCount - 1; p++) {
            const nextSlot = grid[classId]?.[day]?.[p];
            if (nextSlot && !nextSlot.isEmpty && nextSlot.subjectId && nextSlot.subjectId.toString() === slot.subjectId?.toString()) {
              consecutiveCount++;
            } else {
              break;
            }
          }
          // Check backward
          for (let p = period - 1; p >= period - requiredCount + 1; p--) {
            const prevSlot = grid[classId]?.[day]?.[p];
            if (prevSlot && !prevSlot.isEmpty && prevSlot.subjectId && prevSlot.subjectId.toString() === slot.subjectId?.toString()) {
              consecutiveCount++;
            } else {
              break;
            }
          }
          // Only validate the first period of the block to avoid duplicate violations
          const isFirstInBlock = !grid[classId]?.[day]?.[period - 1]?.subjectId?.toString() === slot.subjectId?.toString();
          if (isFirstInBlock && consecutiveCount < slot.consecutivePeriodsCount) {
            violations.push({
              type: 'THEORY_CONSECUTIVE_PERIODS_VIOLATION',
              message: `Class ${classId}: Theory subject '${slot.subjectName}' requires ${slot.consecutivePeriodsCount} consecutive periods but only ${consecutiveCount} found starting at ${day} P${period}`,
              classId, day, period, subjectId: slot.subjectId, required: slot.consecutivePeriodsCount, found: consecutiveCount,
            });
          }
        }

        // 9. Feature B: Fixed slot constraint validation
        // Track subjects with fixed slots to validate after the grid is fully scanned
        if (slot.fixedSlot && slot.fixedSlot.day && slot.fixedSlot.period) {
          const fixedDay = slot.fixedSlot.day;
          const fixedPeriod = slot.fixedSlot.period;
          const isMandatory = slot.fixedSlot.isMandatory !== false;
          
          // We'll do the validation in a second pass after building the fixedSlotOccupancy map
          // Just collect the info for now
          if (!slot._fixedSlotValidated) {
            slot._fixedSlotValidated = true;
            slot._fixedSlotInfo = { fixedDay, fixedPeriod, isMandatory };
          }
        }
      }
    }
  }

  // 8. Teacher daily period limit
  for (const teacherId of Object.keys(teacherSchedule)) {
    const teacher = teacherMap[teacherId];
    const defaultLimit = teacher?.maxPeriodsPerDay || settings.teacherDailyLimit || 4;

    for (const [day, periods] of Object.entries(teacherSchedule[teacherId] || {})) {
      const customLimit =
        teacherDailyLimitOverrides[teacherId]?.[day] ||
        (teacher && teacherDailyLimitOverrides[teacher.name]?.[day]) ||
        defaultLimit;

      const periodCount = Object.keys(teacherSchedule[teacherId][day] || {}).length;

      if (periodCount > customLimit) {
        violations.push({
          type: 'TEACHER_DAILY_LIMIT_EXCEEDED',
          message: `Teacher ${teacher?.name || teacherId} has ${periodCount} periods on ${day}, exceeding limit of ${customLimit}`,
          teacherId, day, periodsCount: periodCount, limit: customLimit,
        });
      }
    }
  }

  // 9. Feature B: Fixed slot conflict validation
  // Check if any subject's fixed slot is occupied by a different subject
  const fixedSlotOccupancy = {};
  for (const [classId, dayMap] of Object.entries(grid)) {
    for (const [day, periodMap] of Object.entries(dayMap)) {
      for (const [periodStr, slot] of Object.entries(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;
        // Support both legacy fixedSlot and new fixedSlots array
        const fixedSlots = slot.fixedSlots || (slot.fixedSlot ? [slot.fixedSlot] : []);
        for (const fs of fixedSlots) {
          if (fs && fs.day && fs.period) {
            const key = `${classId}|${fs.day}|${fs.period}|${slot.subjectId}`;
            if (!fixedSlotOccupancy[key]) {
              fixedSlotOccupancy[key] = { subjectId: slot.subjectId, subjectName: slot.subjectName, classId, day: fs.day, period: fs.period, isMandatory: fs.isMandatory !== false };
            }
          }
        }
      }
    }
  }

  // Validate mandatory fixed slots: each subject with mandatory fixed slot must occupy that slot
  for (const [key, fixedInfo] of Object.entries(fixedSlotOccupancy)) {
    if (fixedInfo.isMandatory) {
      const actualSlot = grid[fixedInfo.classId]?.[fixedInfo.day]?.[fixedInfo.period];
      if (!actualSlot || actualSlot.isEmpty || actualSlot.isBreak || 
          !actualSlot.subjectId || actualSlot.subjectId.toString() !== fixedInfo.subjectId.toString()) {
        violations.push({
          type: 'FIXED_SLOT_VIOLATION',
          message: `Class ${fixedInfo.classId}: Subject '${fixedInfo.subjectName}' has mandatory fixed slot on ${fixedInfo.day} P${fixedInfo.period} but it is not occupied by this subject`,
          classId: fixedInfo.classId, day: fixedInfo.day, period: fixedInfo.period, subjectId: fixedInfo.subjectId, fixedDay: fixedInfo.day, fixedPeriod: fixedInfo.period,
        });
      }
    }
  }

  // Check if any fixed slot is occupied by a different subject
  for (const [classId, dayMap] of Object.entries(grid)) {
    for (const [day, periodMap] of Object.entries(dayMap)) {
      for (const [periodStr, slot] of Object.entries(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;
        const period = Number(periodStr);
        // Check if this slot is a fixed slot for another subject
        for (const [key, fixedInfo] of Object.entries(fixedSlotOccupancy)) {
          if (fixedInfo.classId === classId && fixedInfo.day === day && fixedInfo.period === period) {
            if (fixedInfo.subjectId.toString() !== slot.subjectId?.toString()) {
              violations.push({
                type: 'FIXED_SLOT_CONFLICT',
                message: `Class ${classId}: Fixed slot for '${fixedInfo.subjectName}' on ${day} P${period} is occupied by '${slot.subjectName}'`,
                classId, day, period, subjectId: slot.subjectId, conflictingSubjectId: fixedInfo.subjectId,
              });
            }
          }
        }
      }
    }
  }

  // 10. Teacher daily period limit
  for (const teacherId of Object.keys(teacherSchedule)) {
    const teacher = teacherMap[teacherId];
    const defaultLimit = teacher?.maxPeriodsPerDay || settings.teacherDailyLimit || 4;

    for (const [day, periods] of Object.entries(teacherSchedule[teacherId] || {})) {
      const customLimit =
        teacherDailyLimitOverrides[teacherId]?.[day] ||
        (teacher && teacherDailyLimitOverrides[teacher.name]?.[day]) ||
        defaultLimit;

      const periodCount = Object.keys(teacherSchedule[teacherId][day] || {}).length;

      if (periodCount > customLimit) {
        violations.push({
          type: 'TEACHER_DAILY_LIMIT_EXCEEDED',
          message: `Teacher ${teacher?.name || teacherId} has ${periodCount} periods on ${day}, exceeding limit of ${customLimit}`,
          teacherId, day, periodsCount: periodCount, limit: customLimit,
        });
      }
    }
  }

  return { valid: violations.length === 0, violations };
};

const countEmptyNonBreakSlots = (grid, data = null) => {
  let emptyCount = 0;

  for (const classId of Object.keys(grid)) {
    const dayMap = grid[classId] || {};

    if (data && data.periodsPerDayMap) {
      for (const day of data.workingDays || Object.keys(dayMap)) {
        const periods = data.periodsPerDayMap[day] || [];
        const breakPeriods = (data.breakPeriodsPerDayMap || {})[day] || [];
        for (const period of periods) {
          if (breakPeriods.includes(period)) continue;
          const slot = dayMap[day]?.[period];
          if (!slot || slot.isEmpty) emptyCount++;
        }
      }
    } else {
      for (const periodMap of Object.values(dayMap)) {
        for (const slot of Object.values(periodMap)) {
          if (slot && slot.isEmpty && !slot.isBreak) emptyCount++;
        }
      }
    }
  }

  return emptyCount;
};

/**
 * Subject weekly-hour accounting with L/T/P/R breakdown
 */
const validateSubjectHours = (grid, data) => {
  const violations = [];
  const { classes = [], subjectsByClass = {} } = data;

  for (const cls of classes) {
    const classId = cls._id.toString();
    const classSubjects = subjectsByClass[classId] || [];
    const dayMap = grid[classId] || {};

    const placedCounts = {};
    const placedL = {};
    const placedT = {};
    const placedP = {};
    const placedR = {};

    for (const periodMap of Object.values(dayMap)) {
      for (const slot of Object.values(periodMap)) {
        if (!isOccupied(slot) || !slot.subjectId) continue;
        const sid = slot.subjectId.toString();
        placedCounts[sid] = (placedCounts[sid] || 0) + 1;
        if (slot.subjectType === 'theory') {
          placedL[sid] = (placedL[sid] || 0) + 1;
        } else if (slot.subjectType === 'lab') {
          placedP[sid] = (placedP[sid] || 0) + 1;
        }
      }
    }

    for (const subject of classSubjects) {
      const sid = subject._id.toString();
      const placed = placedCounts[sid] || 0;
      
      const expectedL = subject.L || 0;
      const expectedT = subject.T || 0;
      const expectedP = subject.P || (subject.labDetails?.duration || 0);
      const expectedR = subject.R || 0;
      const expectedTotal = expectedL + expectedT + expectedP + expectedR;

      if (expectedTotal === 0) continue;

      if (placed < expectedTotal) {
        violations.push({
          type: 'SUBJECT_UNDER_SCHEDULED',
          message: `Class ${classId}: ${subject.name} has ${placed}/${expectedTotal} required periods (L:${expectedL} T:${expectedT} P:${expectedP} R:${expectedR})`,
          classId, subjectId: sid, subjectName: subject.name,
          placed, expected: expectedTotal, missing: expectedTotal - placed,
          detail: { L: { placed: placedL[sid]||0, expected: expectedL }, T: { placed: placedT[sid]||0, expected: expectedT }, P: { placed: placedP[sid]||0, expected: expectedP } },
        });
      } else if (placed > expectedTotal) {
        violations.push({
          type: 'SUBJECT_OVER_SCHEDULED',
          message: `Class ${classId}: ${subject.name} has ${placed}/${expectedTotal} required periods (excess ${placed - expectedTotal})`,
          classId, subjectId: sid, subjectName: subject.name,
          placed, expected: expectedTotal, excess: placed - expectedTotal,
        });
      }
    }
  }

  return violations;
};

/**
 * Lab block validation: P2, P3 (Mon-Thu), P6 (2×P3 blocks)
 */
const validateLabBlocks = (grid, data) => {
  const violations = [];
  const { classes = [], subjectsByClass = {}, settings = {}, timeline, fridayTimeline } = data;

  for (const cls of classes) {
    const classId = cls._id.toString();
    const classSubjects = (subjectsByClass[classId] || []).filter((s) => s.type === 'lab');

    for (const subject of classSubjects) {
      const sid = subject._id.toString();
      const P = subject.P || subject.labDetails?.duration || 0;
      if (P === 0) continue;

      const isP6 = P >= 6;
      const blockDuration = isP6 ? 3 : P;
      const expectedBlocks = isP6 ? 2 : 1;

      const cellsByDay = {};

      const dayMap = grid[classId] || {};
      for (const [day, periodMap] of Object.entries(dayMap)) {
        for (const [periodStr, slot] of Object.entries(periodMap)) {
          if (!isOccupied(slot) || !slot.subjectId) continue;
          if (slot.subjectId.toString() !== sid) continue;
          if (!cellsByDay[day]) cellsByDay[day] = [];
          cellsByDay[day].push(Number(periodStr));
        }
      }

      const runs = [];
      for (const [day, periods] of Object.entries(cellsByDay)) {
        const sorted = [...periods].sort((a, b) => a - b);
        let run = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i] === sorted[i - 1] + 1) run.push(sorted[i]);
          else {
            runs.push({ day, run });
            run = [sorted[i]];
          }
        }
        runs.push({ day, run });
      }

      if (runs.length === 0) continue;

      // Check number of blocks
      if (runs.length !== expectedBlocks && !(isP6 && runs.length === 1 && runs[0].run.length === 6)) {
        violations.push({
          type: 'LAB_BLOCK_SPLIT',
          message: `Class ${classId}: lab '${subject.name}' has ${runs.length} blocks but ${expectedBlocks} expected (P${P})`,
          classId, subjectId: sid, subjectName: subject.name,
          blocks: runs.map((r) => `${r.day}(${r.run.join(',')})`),
        });
        continue;
      }

      // For P6, check if it's one 6-period block (invalid) or two 3-period blocks (valid)
      if (isP6 && runs.length === 1 && runs[0].run.length === 6) {
        violations.push({
          type: 'LAB_BLOCK_SPLIT',
          message: `Class ${classId}: P6 lab '${subject.name}' is one 6-period block - must be TWO separate 3-period blocks`,
          classId, subjectId: sid, subjectName: subject.name,
          blocks: runs.map((r) => `${r.day}(${r.run.join(',')})`),
        });
        continue;
      }

      // Validate each block
      for (const { day, run } of runs) {
        const isConsecutive = run.length === run[run.length - 1] - run[0] + 1;
        if (!isConsecutive || run.length !== blockDuration) {
          violations.push({
            type: 'LAB_BLOCK_NON_CONSECUTIVE',
            message: `Class ${classId}: lab '${subject.name}' block on ${day} has ${run.length} periods (expected ${blockDuration} consecutive)`,
            classId, subjectId: sid, subjectName: subject.name,
            day, periods: run, expected: blockDuration,
          });
          continue;
        }

        const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
        if (tl && crossesBreak(run[0], run.length, tl)) {
          violations.push({
            type: 'LAB_BREAK_CROSSED',
            message: `Class ${classId}: lab '${subject.name}' on ${day} P${run[0]}-P${run[run.length - 1]} crosses a break`,
            classId, subjectId: sid, subjectName: subject.name,
            day, periods: run,
          });
        }

        // Friday P3 prohibition check
        if (day === 'Friday' && blockDuration >= 3) {
          violations.push({
            type: 'FRIDAY_P3_LAB_PROHIBITED',
            message: `Class ${classId}: ${blockDuration}-period lab '${subject.name}' on Friday is prohibited`,
            classId, subjectId: sid, subjectName: subject.name,
            day, periods: run,
          });
        }
      }
    }
  }

  return violations;
};

/**
 * Full post-generation hard validator
 */
const validateOutput = (grid, data, unplacedSubjects = []) => {
  const structural = validateGrid(grid, data).violations;
  const subjectHourViolations = validateSubjectHours(grid, data);
  const labViolations = validateLabBlocks(grid, data);

  const allViolations = [...structural, ...subjectHourViolations, ...labViolations];

  const hardViolations = allViolations.filter((v) => isHardViolation(v.type));
  const softViolations = allViolations.filter((v) => !isHardViolation(v.type));

  const teacherDoubles = hardViolations.filter((v) => v.type === 'TEACHER_DOUBLE_BOOKED').length;
  const roomDoubles = hardViolations.filter((v) => v.type === 'LAB_ROOM_CONFLICT').length;
  const availabilityViolations = hardViolations.filter((v) => v.type === 'TEACHER_UNAVAILABLE').length;
  const underScheduled = hardViolations.filter((v) => v.type === 'SUBJECT_UNDER_SCHEDULED');
  const overScheduled = hardViolations.filter((v) => v.type === 'SUBJECT_OVER_SCHEDULED');
  const noTeacher = hardViolations.filter((v) => v.type === 'INVALID_SLOT_NO_TEACHER').length;
  const labProblems = hardViolations.filter((v) =>
    ['LAB_BLOCK_SPLIT', 'LAB_BLOCK_NON_CONSECUTIVE', 'LAB_BREAK_CROSSED', 'FRIDAY_P3_LAB_PROHIBITED', 'LAB_ROOM_MISMATCH'].includes(v.type)
  ).length;

  const emptySlotsCount = countEmptyNonBreakSlots(grid, data);
  const unplaced = unplacedSubjects || [];

  const checks = {
    all_subjects_placed: unplaced.length === 0 && underScheduled.length === 0,
    all_subject_hours_met: underScheduled.length === 0 && overScheduled.length === 0,
    zero_teacher_conflicts: teacherDoubles === 0,
    zero_class_conflicts: true,
    zero_room_conflicts: roomDoubles === 0,
    zero_availability_violations: availabilityViolations === 0,
    zero_invalid_slots: noTeacher === 0,
    zero_lab_block_violations: labProblems === 0,
    all_slots_filled: false, // DISABLED - free slots are allowed
  };

  const isValid = Object.values(checks).every(Boolean);

  const hardViolationsCount =
    hardViolations.length + unplaced.reduce((sum, u) => sum + (u.missing || 0), 0);

  return {
    valid: isValid,
    checks,
    emptySlotsCount,
    hardViolationsCount,
    softViolationsCount: softViolations.length,
    hardViolations,
    softViolations,
    violations: allViolations,
    underScheduled,
    overScheduled,
    unplacedSubjects: unplaced,
  };
};

/**
 * Check if a single slot placement is valid against hard constraints
 */
const isSlotValid = (classId, day, period, slot, grid, data, options = {}) => {
  const { periodsPerDayMap, breakPeriodsPerDayMap, teacherMap, settings, adminOverrides = {} } = data;
  const { ignoreDailyLimit = false, allowOvertime = false, additionalPeriods = 1 } = options;

  const breakPeriods = breakPeriodsPerDayMap[day] || [];
  const teachingPeriods = periodsPerDayMap[day] || [];
  const teacherDailyLimitOverrides = adminOverrides.teacherDailyLimitOverrides || {};
  const teacherUnavailabilityOverrides = adminOverrides.teacherUnavailabilityOverrides || [];

  if (!teachingPeriods.includes(period)) return false;
  if (breakPeriods.includes(period)) return false;

  if (grid[classId]?.[day]?.[period] && !grid[classId][day][period].isEmpty) {
    return false;
  }

  const teacherIds = slotTeacherIds(slot);

  for (const teacherId of teacherIds) {
    const teacher = teacherMap[teacherId];
    if (!teacher) continue;

    const isIgnoredUnavail = teacherUnavailabilityOverrides.some(
      (u) =>
        (u.teacherId === teacherId || u.teacherName === teacher.name) &&
        u.day === day &&
        u.period === period
    );

    if (!isIgnoredUnavail) {
      const isUnavailable = (teacher.unavailability || []).some(
        (u) => u.day === day && u.period === period
      );
      if (isUnavailable) return false;
    }

    for (const [otherClassId, dayMap] of Object.entries(grid)) {
      if (otherClassId === classId) continue;
      const existingSlot = dayMap[day]?.[period];
      if (!isOccupied(existingSlot)) continue;
      if (slotTeacherIds(existingSlot).includes(teacherId)) return false;
    }

    if (!ignoreDailyLimit) {
      const baseLimit = teacher.maxPeriodsPerDay || settings.teacherDailyLimit || 4;
      const customLimit =
        teacherDailyLimitOverrides[teacherId]?.[day] ||
        teacherDailyLimitOverrides[teacher.name]?.[day] ||
        baseLimit;

      let teacherPeriodsOnDay = 0;
      for (const [, dayMap] of Object.entries(grid)) {
        for (const [, s] of Object.entries(dayMap[day] || {})) {
          if (!isOccupied(s)) continue;
          if (slotTeacherIds(s).includes(teacherId)) teacherPeriodsOnDay++;
        }
      }
      if (teacherPeriodsOnDay + additionalPeriods > customLimit) return false;
    }
  }

  for (const room of slotRoomNames(slot)) {
    for (const [otherClassId, dayMap] of Object.entries(grid)) {
      if (otherClassId === classId) continue;
      const existingSlot = dayMap[day]?.[period];
      if (!isOccupied(existingSlot)) continue;
      if (slotRoomNames(existingSlot).includes(room)) return false;
    }
  }

  // Friday P3 lab check
  if (slot.isLabBlock && slot.labBlockIndex === 0) {
    const blockDuration = slot.labBlockDuration || (slot.labBlockNumber !== undefined ? 3 : 3);
    if (day === 'Friday' && blockDuration >= 3) return false;
  }

  return true;
};

const isLabBlockValid = (classId, day, startPeriod, duration, slot, grid, data, options = {}) => {
  const { periodsPerDayMap, timeline, fridayTimeline, settings } = data;
  const maxP = Math.max(...(periodsPerDayMap[day] || [6]));

  // Friday P3 prohibition - EXCEPT for S8 Project Phase II (CSD416) which is explicitly required on Friday
  const isS8Project = slot.subjectCode === 'CSD416';
  if (day === 'Friday' && duration >= 3 && !isS8Project) return false;

  // In 6-period system, 3-period lab blocks must start at Period 1 (P1-P3) or Period 4 (P4-P6)
  if (maxP <= 6 && duration >= 3) {
    if (startPeriod !== 1 && startPeriod !== 4) return false;
  }

  const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
  if (crossesBreak(startPeriod, duration, tl)) return false;

  for (let p = startPeriod; p < startPeriod + duration; p++) {
    if (!isSlotValid(classId, day, p, slot, grid, data, { ...options, additionalPeriods: duration })) {
      return false;
    }
  }

  return true;
};

module.exports = {
  validateGrid,
  validateOutput,
  countEmptyNonBreakSlots,
  validateSubjectHours,
  validateLabBlocks,
  isSlotValid,
  isLabBlockValid,
  slotTeacherIds,
  isHardViolation,
  HARD_VIOLATION_TYPES,
};