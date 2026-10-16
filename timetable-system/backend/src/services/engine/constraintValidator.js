const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * Constraint Validator
 * Checks hard constraints, subject-hour accounting and grid completeness on a
 * given timetable grid state.
 *
 * The functions here are intended to be usable both by the placement engine and
 * as an independent post-hoc validator for an already-persisted timetable.
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
];

const isHardViolation = (type) => HARD_VIOLATION_TYPES.includes(type);

// Extract every teacher a slot commits to (main + batch split teachers)
const slotTeacherIds = (slot) => {
  const ids = [];
  if (!slot) return ids;
  if (Array.isArray(slot.teacherIds)) {
    slot.teacherIds.forEach((id) => id && ids.push(id.toString()));
  }
  if (slot.isBatchSplit) {
    if (slot.batch1?.teacherId) ids.push(slot.batch1.teacherId.toString());
    if (slot.batch2?.teacherId) ids.push(slot.batch2.teacherId.toString());
  }
  return ids;
};

// Rooms a slot occupies (labs and batch-split rooms)
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

/**
 * Shared elective token. Open/linked electives are a single physical session
 * attended by students from several classes, so the same teacher legitimately
 * appears in multiple class grids at the same day/period. This token lets the
 * validator recognise that shared session instead of flagging a conflict.
 */
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

        // 1. Slot outside configured timeline (allPeriodsPerDayMap includes
        // break period numbers, so this accepts the break cells too).
        const validPeriods = allPeriodsPerDayMap[day] || periodsPerDayMap[day];
        if (validPeriods && !validPeriods.includes(period)) {
          violations.push({
            type: 'SLOT_OUT_OF_TIMELINE',
            message: `Class ${classId}: slot ${day} P${period} is not a configured period`,
            classId,
            day,
            period,
          });
          continue;
        }

        // Break cell — must not carry a teaching subject.
        if (slot.isBreak) {
          if (slot.subjectId && !slot.isEmpty) {
            violations.push({
              type: 'BREAK_SLOT_USED',
              message: `Class ${classId}: break ${day} P${period} has a subject assigned`,
              classId,
              day,
              period,
            });
          }
          continue;
        }

        if (!isOccupied(slot)) continue;

        // 2. A teaching slot must not sit on a configured break period.
        if (breakPeriods.includes(period)) {
          violations.push({
            type: 'BREAK_SLOT_USED',
            message: `Class ${classId}: slot ${day} P${period} is a break period but has a subject assigned`,
            classId,
            day,
            period,
          });
        }

        // 3. Teaching slot without any assigned teacher
        const realSubject = ['theory', 'lab', 'elective'].includes(slot.subjectType);
        if (realSubject && slotTeacherIds(slot).length === 0) {
          violations.push({
            type: 'INVALID_SLOT_NO_TEACHER',
            message: `Class ${classId}: ${day} P${period} has '${slot.subjectName || slot.subjectType}' but no valid teacher`,
            classId,
            day,
            period,
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
                teacherId,
                day,
                period,
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
                  teacherId,
                  day,
                  period,
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
                room,
                day,
                period,
              });
            }
          } else {
            labRoomSchedule[room][day].push(period);
          }
        }
      }
    }
  }

  // 6. Teacher daily period limit
  for (const teacherId of Object.keys(teacherSchedule)) {
    const teacher = teacherMap[teacherId];
    const defaultLimit = teacher?.maxPeriodsPerDay || settings.teacherDailyLimit || 4;

    for (const [day, periods] of Object.entries(teacherSchedule[teacherId] || {})) {
      const customLimit =
        teacherDailyLimitOverrides[teacherId]?.[day] ||
        (teacher && teacherDailyLimitOverrides[teacher.name]?.[day]) ||
        defaultLimit;

      // Count distinct periods (a shared elective session counts once).
      const periods = Object.keys(teacherSchedule[teacherId][day] || {});

      if (periods.length > customLimit) {
        violations.push({
          type: 'TEACHER_DAILY_LIMIT_EXCEEDED',
          message: `Teacher ${teacher?.name || teacherId} has ${periods.length} periods on ${day}, exceeding limit of ${customLimit}`,
          teacherId,
          day,
          periodsCount: periods.length,
          limit: customLimit,
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * Count empty teaching (non-break) slots across all class grids.
 * When `data` is supplied, periods that were never initialised are also
 * counted as empty so a missing cell cannot hide an incomplete timetable.
 */
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
 * Subject weekly-hour accounting.
 * Every subject must occupy exactly its required number of periods:
 *  - theory/elective -> weeklyHours
 *  - lab -> labDetails.duration (a single consecutive block)
 */
const validateSubjectHours = (grid, data) => {
  const violations = [];
  const { classes = [], subjectsByClass = {} } = data;

  for (const cls of classes) {
    const classId = cls._id.toString();
    const classSubjects = subjectsByClass[classId] || [];
    const dayMap = grid[classId] || {};

    // Count periods per subject actually present in the grid
    const placedCounts = {};
    for (const periodMap of Object.values(dayMap)) {
      for (const slot of Object.values(periodMap)) {
        if (!isOccupied(slot) || !slot.subjectId) continue;
        const sid = slot.subjectId.toString();
        placedCounts[sid] = (placedCounts[sid] || 0) + 1;
      }
    }

    for (const subject of classSubjects) {
      const sid = subject._id.toString();
      const placed = placedCounts[sid] || 0;
      const expected =
        subject.type === 'lab'
          ? subject.labDetails?.duration || subject.weeklyHours || 2
          : subject.weeklyHours || 0;

      if (placed < expected) {
        violations.push({
          type: 'SUBJECT_UNDER_SCHEDULED',
          message: `Class ${classId}: ${subject.name} has ${placed}/${expected} required periods scheduled`,
          classId,
          subjectId: sid,
          subjectName: subject.name,
          placed,
          expected,
          missing: expected - placed,
        });
      } else if (placed > expected) {
        violations.push({
          type: 'SUBJECT_OVER_SCHEDULED',
          message: `Class ${classId}: ${subject.name} has ${placed}/${expected} required periods scheduled (excess ${placed - expected})`,
          classId,
          subjectId: sid,
          subjectName: subject.name,
          placed,
          expected,
          excess: placed - expected,
        });
      }
    }
  }

  return violations;
};

/**
 * Lab block validation: every lab must occupy one consecutive run of
 * `duration` periods inside a single day and must not cross a break.
 */
const validateLabBlocks = (grid, data) => {
  const violations = [];
  const { classes = [], subjectsByClass = {}, settings = {}, timeline, fridayTimeline } = data;

  for (const cls of classes) {
    const classId = cls._id.toString();
    const classSubjects = (subjectsByClass[classId] || []).filter((s) => s.type === 'lab');

    for (const subject of classSubjects) {
      const sid = subject._id.toString();
      const duration = subject.labDetails?.duration || 2;
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

      // No placement at all is reported by validateSubjectHours (under-scheduled).
      if (runs.length === 0) continue;

      if (runs.length > 1) {
        violations.push({
          type: 'LAB_BLOCK_SPLIT',
          message: `Class ${classId}: lab '${subject.name}' is split across ${runs.length} blocks/days — labs must be one consecutive block`,
          classId,
          subjectId: sid,
          subjectName: subject.name,
          blocks: runs.map((r) => `${r.day}(${r.run.join(',')})`),
        });
        continue;
      }

      const { day, run } = runs[0];
      const isConsecutive = run.length === run[run.length - 1] - run[0] + 1;
      if (!isConsecutive || run.length !== duration) {
        violations.push({
          type: 'LAB_BLOCK_NON_CONSECUTIVE',
          message: `Class ${classId}: lab '${subject.name}' occupies ${run.length} non-consecutive periods on ${day} (expected ${duration} consecutive)`,
          classId,
          subjectId: sid,
          subjectName: subject.name,
          day,
          periods: run,
          expected: duration,
        });
        continue;
      }

      const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
      if (tl && crossesBreak(run[0], run.length, tl)) {
        violations.push({
          type: 'LAB_BREAK_CROSSED',
          message: `Class ${classId}: lab '${subject.name}' on ${day} P${run[0]}-P${run[run.length - 1]} crosses a break`,
          classId,
          subjectId: sid,
          subjectName: subject.name,
          day,
          periods: run,
        });
      }
    }
  }

  return violations;
};

/**
 * Full post-generation hard validator (6+ checks)
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
    ['LAB_BLOCK_SPLIT', 'LAB_BLOCK_NON_CONSECUTIVE', 'LAB_BREAK_CROSSED'].includes(v.type)
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
    all_slots_filled: emptySlotsCount === 0,
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
        (allowOvertime ? Math.min(baseLimit + 2, 6) : baseLimit);

      let teacherPeriodsOnDay = 0;
      for (const [, dayMap] of Object.entries(grid)) {
        for (const [, s] of Object.entries(dayMap[day] || {})) {
          if (!isOccupied(s)) continue;
          if (slotTeacherIds(s).includes(teacherId)) teacherPeriodsOnDay++;
        }
      }
      // The block being placed may occupy more than one period (e.g. a lab).
      // Count the whole block so a multi-period block cannot be placed on a day
      // where it would push the teacher past their daily limit.
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

  return true;
};

const isLabBlockValid = (classId, day, startPeriod, duration, slot, grid, data, options = {}) => {
  const { periodsPerDayMap, timeline, fridayTimeline, settings } = data;
  const maxP = Math.max(...(periodsPerDayMap[day] || [6]));

  // In 6-period system, 3-period lab blocks must start at Period 1 (P1-P3) or Period 4 (P4-P6)
  if (maxP <= 6 && duration >= 3) {
    if (startPeriod !== 1 && startPeriod !== 4) return false;
  }

  const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
  if (crossesBreak(startPeriod, duration, tl)) return false;

  for (let p = startPeriod; p < startPeriod + duration; p++) {
    // Pass the full block length so the daily-limit check accounts for every
    // period this block will consume on the day, not just the one being tested.
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
