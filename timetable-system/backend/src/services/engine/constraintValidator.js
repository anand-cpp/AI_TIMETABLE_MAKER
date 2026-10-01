const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * Constraint Validator
 * Checks hard constraints & 100% grid slot utilization on a given timetable grid state
 */

const validateGrid = (grid, data) => {
  const violations = [];
  const {
    workingDays,
    periodsPerDayMap,
    breakPeriodsPerDayMap,
    settings,
    teacherMap,
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

        if (!slot || slot.isEmpty || slot.isBreak) continue;

        // 1. Break period check
        if (breakPeriods.includes(period)) {
          violations.push({
            type: 'BREAK_SLOT_USED',
            message: `Class ${classId}: slot ${day} P${period} is a break period but has a subject assigned`,
            classId,
            day,
            period,
          });
        }

        // 2. Teacher double-booking check
        const teacherIds = [];
        if (slot.teacherIds && slot.teacherIds.length > 0) {
          slot.teacherIds.forEach((id) => teacherIds.push(id.toString()));
        }
        if (slot.isBatchSplit) {
          if (slot.batch1?.teacherId) teacherIds.push(slot.batch1.teacherId.toString());
          if (slot.batch2?.teacherId) teacherIds.push(slot.batch2.teacherId.toString());
        }

        for (const teacherId of teacherIds) {
          if (!teacherSchedule[teacherId]) teacherSchedule[teacherId] = {};
          if (!teacherSchedule[teacherId][day]) teacherSchedule[teacherId][day] = [];

          if (teacherSchedule[teacherId][day].includes(period)) {
            const teacher = teacherMap[teacherId];
            if (!slot.isOverride) {
              violations.push({
                type: 'TEACHER_DOUBLE_BOOKED',
                message: `Teacher ${teacher?.name || teacherId} is double-booked on ${day} period ${period}`,
                teacherId,
                day,
                period,
              });
            }
          } else {
            teacherSchedule[teacherId][day].push(period);
          }

          // 3. Teacher unavailability check
          const teacher = teacherMap[teacherId];
          if (teacher && teacher.unavailability) {
            const isIgnoredUnavail = teacherUnavailabilityOverrides.some(
              (u) => (u.teacherId === teacherId || u.teacherName === teacher.name) && u.day === day && u.period === period
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

        // 4. Lab room conflict check
        const roomsToCheck = [];
        if (slot.roomName && slot.subjectType === 'lab') {
          roomsToCheck.push(slot.roomName);
        }
        if (slot.isBatchSplit) {
          if (slot.batch1?.roomName) roomsToCheck.push(slot.batch1.roomName);
          if (slot.batch2?.roomName) roomsToCheck.push(slot.batch2.roomName);
        }

        for (const room of roomsToCheck) {
          if (!room) continue;
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

  // 5. Teacher daily period limit check
  for (const teacherId of Object.keys(teacherSchedule)) {
    const teacher = teacherMap[teacherId];
    const defaultLimit = teacher?.maxPeriodsPerDay || settings.teacherDailyLimit || 5;

    for (const [day, periods] of Object.entries(teacherSchedule[teacherId] || {})) {
      const customLimit =
        teacherDailyLimitOverrides[teacherId]?.[day] ||
        (teacher && teacherDailyLimitOverrides[teacher.name]?.[day]) ||
        defaultLimit;

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
 * Count empty non-break slots across all class grids
 */
const countEmptyNonBreakSlots = (grid) => {
  let emptyCount = 0;
  for (const dayMap of Object.values(grid)) {
    for (const periodMap of Object.values(dayMap)) {
      for (const slot of Object.values(periodMap)) {
        if (slot && slot.isEmpty && !slot.isBreak) {
          emptyCount++;
        }
      }
    }
  }
  return emptyCount;
};

/**
 * 6-Check Post-Generation Hard Validator
 */
const validateOutput = (grid, data, unplacedSubjects = []) => {
  const validationRes = validateGrid(grid, data);

  const hardViolations = validationRes.violations.filter((v) =>
    ['TEACHER_DOUBLE_BOOKED', 'CLASS_DOUBLE_BOOKED', 'LAB_ROOM_CONFLICT', 'TEACHER_UNAVAILABLE'].includes(v.type)
  );

  const softViolations = validationRes.violations.filter((v) =>
    !['TEACHER_DOUBLE_BOOKED', 'CLASS_DOUBLE_BOOKED', 'LAB_ROOM_CONFLICT', 'TEACHER_UNAVAILABLE'].includes(v.type)
  );

  const teacherDoubles = hardViolations.filter((v) => v.type === 'TEACHER_DOUBLE_BOOKED').length;
  const roomDoubles = hardViolations.filter((v) => v.type === 'LAB_ROOM_CONFLICT').length;
  const availabilityViolations = hardViolations.filter((v) => v.type === 'TEACHER_UNAVAILABLE').length;
  const emptySlotsCount = countEmptyNonBreakSlots(grid);

  const checks = {
    all_subjects_placed: unplacedSubjects.length === 0,
    zero_teacher_conflicts: teacherDoubles === 0,
    zero_class_conflicts: true,
    zero_room_conflicts: roomDoubles === 0,
    zero_availability_violations: availabilityViolations === 0,
    all_slots_filled: emptySlotsCount === 0,
  };

  const isValid = Object.values(checks).every(Boolean);

  return {
    valid: isValid,
    checks,
    emptySlotsCount,
    hardViolationsCount: hardViolations.length + unplacedSubjects.length,
    softViolationsCount: softViolations.length,
    hardViolations,
    softViolations,
    violations: validationRes.violations,
  };
};

/**
 * Check if a single slot placement is valid
 */
const isSlotValid = (classId, day, period, slot, grid, data, options = {}) => {
  const { periodsPerDayMap, breakPeriodsPerDayMap, teacherMap, settings, adminOverrides = {} } = data;
  const { ignoreDailyLimit = false, allowOvertime = false } = options;

  const breakPeriods = breakPeriodsPerDayMap[day] || [];
  const teachingPeriods = periodsPerDayMap[day] || [];
  const teacherDailyLimitOverrides = adminOverrides.teacherDailyLimitOverrides || {};
  const teacherUnavailabilityOverrides = adminOverrides.teacherUnavailabilityOverrides || [];

  if (!teachingPeriods.includes(period)) return false;
  if (breakPeriods.includes(period)) return false;

  if (grid[classId]?.[day]?.[period] && !grid[classId][day][period].isEmpty) {
    return false;
  }

  const teacherIds = [];
  if (slot.teacherIds) slot.teacherIds.forEach((id) => teacherIds.push(id.toString()));
  if (slot.isBatchSplit) {
    if (slot.batch1?.teacherId) teacherIds.push(slot.batch1.teacherId.toString());
    if (slot.batch2?.teacherId) teacherIds.push(slot.batch2.teacherId.toString());
  }

  for (const teacherId of teacherIds) {
    const teacher = teacherMap[teacherId];
    if (!teacher) continue;

    const isIgnoredUnavail = teacherUnavailabilityOverrides.some(
      (u) => (u.teacherId === teacherId || u.teacherName === teacher.name) && u.day === day && u.period === period
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
      if (!existingSlot || existingSlot.isEmpty) continue;

      const existingTeacherIds = [];
      if (existingSlot.teacherIds) {
        existingSlot.teacherIds.forEach((id) => existingTeacherIds.push(id.toString()));
      }
      if (existingSlot.isBatchSplit) {
        if (existingSlot.batch1?.teacherId) existingTeacherIds.push(existingSlot.batch1.teacherId.toString());
        if (existingSlot.batch2?.teacherId) existingTeacherIds.push(existingSlot.batch2.teacherId.toString());
      }

      if (existingTeacherIds.includes(teacherId)) return false;
    }

    if (!ignoreDailyLimit) {
      const baseLimit = teacher.maxPeriodsPerDay || settings.teacherDailyLimit || 5;
      const customLimit =
        teacherDailyLimitOverrides[teacherId]?.[day] ||
        teacherDailyLimitOverrides[teacher.name]?.[day] ||
        (allowOvertime ? Math.min(baseLimit + 2, 6) : baseLimit);

      let teacherPeriodsOnDay = 0;
      for (const [cId, dayMap] of Object.entries(grid)) {
        for (const [pStr, s] of Object.entries(dayMap[day] || {})) {
          if (!s || s.isEmpty) continue;
          const tIds = [];
          if (s.teacherIds) s.teacherIds.forEach((id) => tIds.push(id.toString()));
          if (s.isBatchSplit) {
            if (s.batch1?.teacherId) tIds.push(s.batch1.teacherId.toString());
            if (s.batch2?.teacherId) tIds.push(s.batch2.teacherId.toString());
          }
          if (tIds.includes(teacherId)) teacherPeriodsOnDay++;
        }
      }
      if (teacherPeriodsOnDay >= customLimit) return false;
    }
  }

  const roomsToCheck = [];
  if (slot.roomName && slot.subjectType === 'lab') roomsToCheck.push(slot.roomName);
  if (slot.isBatchSplit) {
    if (slot.batch1?.roomName) roomsToCheck.push(slot.batch1.roomName);
    if (slot.batch2?.roomName) roomsToCheck.push(slot.batch2.roomName);
  }

  for (const room of roomsToCheck) {
    if (!room) continue;
    for (const [otherClassId, dayMap] of Object.entries(grid)) {
      if (otherClassId === classId) continue;
      const existingSlot = dayMap[day]?.[period];
      if (!existingSlot || existingSlot.isEmpty) continue;

      const existingRooms = [];
      if (existingSlot.roomName) existingRooms.push(existingSlot.roomName);
      if (existingSlot.isBatchSplit) {
        if (existingSlot.batch1?.roomName) existingRooms.push(existingSlot.batch1.roomName);
        if (existingSlot.batch2?.roomName) existingRooms.push(existingSlot.batch2.roomName);
      }

      if (existingRooms.includes(room)) return false;
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
    if (!isSlotValid(classId, day, p, slot, grid, data, options)) return false;
  }

  return true;
};

module.exports = {
  validateGrid,
  validateOutput,
  countEmptyNonBreakSlots,
  isSlotValid,
  isLabBlockValid,
};