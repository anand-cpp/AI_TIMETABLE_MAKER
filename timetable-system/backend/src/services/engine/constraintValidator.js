const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * Constraint Validator
 * Used during generation and after manual edits
 * Checks hard constraints on a given timetable grid state
 *
 * grid structure:
 * {
 *   [classId]: {
 *     [day]: {
 *       [period]: slotObject
 *     }
 *   }
 * }
 */

/**
 * Check all hard constraints on the full grid
 * Returns { valid: bool, violations: [] }
 */
const validateGrid = (grid, data) => {
  const violations = [];
  const {
    workingDays,
    periodsPerDayMap,
    breakPeriodsPerDayMap,
    settings,
    timeline,
    fridayTimeline,
    teacherMap,
  } = data;

  // Build teacher schedule map for conflict detection
  // teacherId -> { day -> [periods] }
  const teacherSchedule = {};

  // Build lab room schedule map for conflict detection
  // roomName -> { day -> [periods] }
  const labRoomSchedule = {};

  for (const [classId, dayMap] of Object.entries(grid)) {
    for (const [day, periodMap] of Object.entries(dayMap)) {
      const teachingPeriods = periodsPerDayMap[day] || [];
      const breakPeriods = breakPeriodsPerDayMap[day] || [];

      for (const [periodStr, slot] of Object.entries(periodMap)) {
        const period = Number(periodStr);

        if (!slot || slot.isEmpty || slot.isBreak) continue;

        // ── 1. Slot must not be in a break period ─────────────────────────
        if (breakPeriods.includes(period)) {
          violations.push({
            type: 'BREAK_SLOT_USED',
            message: `Class ${classId}: slot ${day} P${period} is a break period but has a subject assigned`,
            classId,
            day,
            period,
          });
        }

        // ── 2. Teacher double-booking check ───────────────────────────────
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
            violations.push({
              type: 'TEACHER_DOUBLE_BOOKED',
              message: `Teacher ${teacher?.name || teacherId} is double-booked on ${day} period ${period}`,
              teacherId,
              day,
              period,
            });
          } else {
            teacherSchedule[teacherId][day].push(period);
          }

          // ── 3. Teacher unavailability check ───────────────────────────
          const teacher = teacherMap[teacherId];
          if (teacher && teacher.unavailability) {
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

        // ── 4. Lab room conflict check ─────────────────────────────────
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
            violations.push({
              type: 'LAB_ROOM_CONFLICT',
              message: `Lab room '${room}' is used by multiple classes on ${day} period ${period}`,
              room,
              day,
              period,
            });
          } else {
            labRoomSchedule[room][day].push(period);
          }
        }
      }
    }

    // ── 5. Teacher daily period limit check ──────────────────────────────
    for (const teacherId of Object.keys(teacherSchedule)) {
      const teacher = teacherMap[teacherId];
      const dailyLimit = teacher?.maxPeriodsPerDay || settings.teacherDailyLimit || 5;

      for (const [day, periods] of Object.entries(teacherSchedule[teacherId] || {})) {
        if (periods.length > dailyLimit) {
          violations.push({
            type: 'TEACHER_DAILY_LIMIT_EXCEEDED',
            message: `Teacher ${teacher?.name || teacherId} has ${periods.length} periods on ${day}, exceeding limit of ${dailyLimit}`,
            teacherId,
            day,
            periodsCount: periods.length,
            limit: dailyLimit,
          });
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
};

/**
 * Check if a single slot placement is valid
 * Quick check used during slot placement loop
 */
const isSlotValid = (classId, day, period, slot, grid, data) => {
  const { periodsPerDayMap, breakPeriodsPerDayMap, teacherMap, settings } = data;

  const breakPeriods = breakPeriodsPerDayMap[day] || [];
  const teachingPeriods = periodsPerDayMap[day] || [];

  // Must be a teaching period
  if (!teachingPeriods.includes(period)) return false;

  // Must not be break
  if (breakPeriods.includes(period)) return false;

  // Class must not already have this slot filled
  if (grid[classId]?.[day]?.[period] && !grid[classId][day][period].isEmpty) {
    return false;
  }

  // Collect teacher IDs from slot
  const teacherIds = [];
  if (slot.teacherIds) slot.teacherIds.forEach((id) => teacherIds.push(id.toString()));
  if (slot.isBatchSplit) {
    if (slot.batch1?.teacherId) teacherIds.push(slot.batch1.teacherId.toString());
    if (slot.batch2?.teacherId) teacherIds.push(slot.batch2.teacherId.toString());
  }

  for (const teacherId of teacherIds) {
    const teacher = teacherMap[teacherId];
    if (!teacher) continue;

    // Teacher unavailability
    const isUnavailable = (teacher.unavailability || []).some(
      (u) => u.day === day && u.period === period
    );
    if (isUnavailable) return false;

    // Teacher already booked in this slot (check other classes)
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

    // Teacher daily limit
    const dailyLimit = teacher.maxPeriodsPerDay || settings.teacherDailyLimit || 5;
    let teacherPeriodsOnDay = 0;
    for (const [cId, dayMap] of Object.entries(grid)) {
      const existingSlot = dayMap[day]?.[period];
      // Count all periods this teacher has on this day
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
    if (teacherPeriodsOnDay >= dailyLimit) return false;
  }

  // Lab room conflict check
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

/**
 * Check if a consecutive lab block is valid
 * startPeriod to startPeriod + duration - 1 must all be valid
 */
const isLabBlockValid = (classId, day, startPeriod, duration, slot, grid, data) => {
  const { timeline, fridayTimeline, settings } = data;
  const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;

  // Check block doesn't cross break
  if (crossesBreak(startPeriod, duration, tl)) return false;

  // Check each period in block
  for (let p = startPeriod; p < startPeriod + duration; p++) {
    if (!isSlotValid(classId, day, p, slot, grid, data)) return false;
  }

  return true;
};

module.exports = {
  validateGrid,
  isSlotValid,
  isLabBlockValid,
};