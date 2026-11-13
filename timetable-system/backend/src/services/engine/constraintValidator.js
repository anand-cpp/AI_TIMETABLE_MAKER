const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * Constraint Validator - ASET 2026-27 EVEN Semester
 * Supports: P2, P3 (Mon-Thu only), P6 (2×P3 blocks), Co-instructors, Lab 3/4 rooms
 */

const HARD_VIOLATION_TYPES = [
  'TEACHER_DOUBLE_BOOKED',
  'CLASS_DOUBLE_BOOKED',
  'LAB_ROOM_CONFLICT',
  'LAB_DOUBLE_BOOKING',
  'INVALID_LAB_ASSIGNMENT',
  'FACULTY_REST_GAP',
  'TEACHER_UNAVAILABLE',
  'SUBJECT_UNDER_SCHEDULED',
  'SUBJECT_OVER_SCHEDULED',
  'INVALID_SLOT_NO_TEACHER',
  'LAB_BLOCK_SPLIT',
  'LAB_BLOCK_NON_CONSECUTIVE',
  'LAB_BREAK_CROSSED',
  'SLOT_OUT_OF_TIMELINE',
  'BREAK_SLOT_USED',
  'FRIDAY_P3_LAB_PROHIBITED',
  'LAB_ROOM_MISMATCH',
  'THEORY_CONSECUTIVE_PERIODS_VIOLATION',
  'FIXED_SLOT_VIOLATION',
  'FIXED_SLOT_CONFLICT',
  'S6_OPEN_ELECTIVE_PROHIBITED_SLOT',
  'TEACHER_DAILY_LIMIT_EXCEEDED',
  'DAILY_SUBJECT_UNIQUENESS_VIOLATION',
  'ELECTIVE_DESYNCHRONIZATION',
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
  return [...new Set(ids)];
};

const slotRoomNames = (slot) => {
  const rooms = [];
  if (!slot || slot.isEmpty || slot.isBreak) return rooms;
  if (slot.roomName) {
    rooms.push(slot.roomName.trim());
  }
  if (slot.isBatchSplit) {
    if (slot.batch1?.roomName) rooms.push(slot.batch1.roomName.trim());
    if (slot.batch2?.roomName) rooms.push(slot.batch2.roomName.trim());
  }
  return rooms.filter(Boolean);
};

const isOccupied = (slot) => slot && !slot.isEmpty && !slot.isBreak;

// Authoritative check for Exception A: Phase 2 Project
const isPhase2Project = (slot) => {
  if (!slot || slot.isEmpty || slot.isBreak) return false;
  const code = (slot.subjectCode || '').toUpperCase();
  const name = (slot.subjectName || '').toLowerCase();
  return (
    code === 'CSD416' ||
    code === 'CST416' ||
    Boolean(slot.isSharedProject) ||
    (name.includes('project phase') && (name.includes('2') || name.includes('ii') || code.includes('416')))
  );
};

// Authoritative check for Exception B: Laboratory
const isLaboratory = (slot) => {
  if (!slot || slot.isEmpty || slot.isBreak) return false;
  return Boolean(
    slot.subjectType === 'lab' ||
    slot.isLabBlock ||
    (Array.isArray(slot.allowedLabs) && slot.allowedLabs.length > 0)
  );
};

// Authoritative check for Daily Subject Uniqueness Exemption
const isDailyUniquenessExempt = (slot) => {
  return isPhase2Project(slot) || isLaboratory(slot);
};


const sharedElectiveToken = (slot) => {
  if (!slot || slot.isEmpty || slot.isBreak) return null;
  // Strict shared-session authorization:
  // 1. Explicit sharedSessionId linking participating classes
  if (slot.sharedSessionId) return String(slot.sharedSessionId);
  // 2. Synchronized elective group
  if (slot.isElective && slot.electiveGroupId) return 'SHARED_ELECTIVE_' + slot.electiveGroupId;
  // Synchronized Minor session
  if (slot.isMinor || slot.subjectType === 'minor') {
    return 'SHARED_MINOR_' + (slot.minorGroupId || (slot.day + '_P' + slot.period));
  }
  // 3. S8 Project Phase-2 authorized joint supervision on Thursday/Friday
  if ((slot.subjectCode === 'CST416' || slot.subjectCode === 'CSD416' || slot.isSharedProject) && (slot.day === 'Thursday' || slot.day === 'Friday')) {
    return 'SHARED_S8_PROJECT_' + (slot.day || '').toUpperCase().slice(0, 3) + '_P' + (slot.period || '');
  }
  // Ordinary theory/lab subjects NEVER qualify as shared sessions
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
        if (realSubject && slotTeacherIds(slot).length === 0 && !slot.isPendingFaculty && !slot.teacherNames?.includes('PENDING')) {
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
            if (existingClaim.classId !== classId && !sharedSession && !slot.isOverride) {
              const teacher = teacherMap[teacherId];
              violations.push({
                type: 'TEACHER_DOUBLE_BOOKED',
                message: `Teacher ${teacher?.name || teacherId} is double-booked on ${day} period ${period}`,
                teacherId, day, period,
              });
            }
          } else {
            teacherSchedule[teacherId][day].push({ period, classId, token, isLabBlock: slot.isLabBlock });
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
          if (!room.toLowerCase().startsWith('lab')) continue;
          if (!labRoomSchedule[room]) labRoomSchedule[room] = {};
          if (!labRoomSchedule[room][day]) labRoomSchedule[room][day] = [];

          if (labRoomSchedule[room][day].includes(period)) {
            if (!slot.isOverride) {
              violations.push({
                type: 'LAB_DOUBLE_BOOKING',
                code: 'LAB_DOUBLE_BOOKING',
                severity: 'hard',
                message: `Lab room '${room}' is double-booked by multiple classes on ${day} period ${period}`,
                room, day, period, classId,
              });
              violations.push({
                type: 'LAB_ROOM_CONFLICT',
                message: `Lab room '${room}' is used by multiple classes on ${day} period ${period}`,
                room, day, period, classId,
              });
            }
          } else {
            labRoomSchedule[room][day].push(period);
          }
        }

        // 6. Friday P3 Lab Prohibition (exempt full-day S8 Project Phase-2)
        const isS8ProjSlot = slot.subjectCode === 'CSD416' || slot.subjectCode === 'CST416' || slot.subjectName?.includes('Project Phase');
        if (day === 'Friday' && slot.isLabBlock && slot.labBlockIndex === 0 && !isS8ProjSlot) {
          const blockDuration = slot.labBlockDuration || 3;
          if (blockDuration >= 3) {
            violations.push({
              type: 'FRIDAY_P3_LAB_PROHIBITED',
              message: `Class ${classId}: 3-period lab block on Friday ${day} P${period} is prohibited (Friday periods are 50 min)`,
              classId, day, period,
            });
          }
        }

        // 7. Strict Laboratory Allocation Matrix
        const roomName = (slot.roomName || '').trim();
        if (roomName.toLowerCase().startsWith('lab')) {
          const classSem = slot.classSemester || data.classMap?.[classId]?.semester || 0;
          const isProjectPhase2 = slot.subjectCode?.includes('416') || slot.subjectName?.includes('Project Phase');

          if (classSem === 1 || classSem === 2) {
            // S1/S2 practicals: Lab 1, Lab 2, Lab 3 only. Prohibit Lab 4.
            if (roomName === 'Lab 4' && !slot.isOverride) {
              violations.push({
                type: 'INVALID_LAB_ASSIGNMENT',
                severity: 'hard',
                message: `Class ${classId} (Semester ${classSem}): '${slot.subjectName || slot.subjectCode}' is assigned to Lab 4, but S1/S2 practical sessions are restricted to Lab 1, Lab 2, or Lab 3`,
                classId, day, period, room: roomName, semester: classSem,
              });
            }
          } else if (classSem >= 3 && classSem <= 8) {
            if (isProjectPhase2) {
              // S8 Project Phase-2 takes place in classrooms, not exclusive Lab 1/2/3/4
              if (['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4'].includes(roomName) && !slot.isOverride) {
                violations.push({
                  type: 'INVALID_LAB_ASSIGNMENT',
                  severity: 'hard',
                  message: `Class ${classId} (Semester ${classSem}): Capstone Project '${slot.subjectName}' occupies ${roomName}, which is reserved for scheduled practical laboratory sessions`,
                  classId, day, period, room: roomName, semester: classSem,
                });
              }
            } else {
              // S3-S8 applicable practicals and Mini Projects MUST use Lab 4. Prohibit Lab 1, Lab 2, Lab 3.
              if (roomName !== 'Lab 4' && !slot.isOverride) {
                violations.push({
                  type: 'INVALID_LAB_ASSIGNMENT',
                  severity: 'hard',
                  message: `Class ${classId} (Semester ${classSem}): '${slot.subjectName || slot.subjectCode}' is assigned to ${roomName}, but all applicable practicals for S3–S8 must use designated Lab 4`,
                  classId, day, period, room: roomName, semester: classSem,
                });
              }
            }
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
      const hasProjectSession = (teacherSchedule[teacherId][day] || []).some(
        c => c.token === 'CST416_PROJECT_PHASE_2' || (typeof c.token === 'string' && c.token.startsWith('SHARED_S8_PROJECT_'))
      );
      const hasLabSession = (teacherSchedule[teacherId][day] || []).some(c => c.isLabBlock);
      const effectiveLimit = hasProjectSession ? Math.max(customLimit, 6) : (hasLabSession ? Math.max(customLimit, 5) : customLimit);

      if (periodCount > effectiveLimit) {
        violations.push({
          type: 'TEACHER_DAILY_LIMIT_EXCEEDED',
          message: `Teacher ${teacher?.name || teacherId} has ${periodCount} periods on ${day}, exceeding limit of ${customLimit}`,
          teacherId, day, periodsCount: periodCount, limit: customLimit,
        });
      }
    }
  }

  // 8B. Global Faculty Rest-Gap Enforcement: Max 2 consecutive teaching periods globally
  for (const [teacherId, daySchedule] of Object.entries(teacherSchedule)) {
    const teacher = teacherMap[teacherId];
    for (const [day, claims] of Object.entries(daySchedule || {})) {
      const distinctPeriods = [...new Set(claims.map((c) => c.period))].sort((a, b) => a - b);
      let run = [];
      for (const p of distinctPeriods) {
        if (run.length === 0 || p === run[run.length - 1] + 1) {
          run.push(p);
        } else {
          if (run.length > 2) {
            violations.push({
              type: 'FACULTY_REST_GAP',
              severity: 'hard',
              message: `Faculty member ${teacher?.name || teacherId} has ${run.length} consecutive teaching periods on ${day} (Periods P${run[0]}–P${run[run.length - 1]}) without a rest gap. A guaranteed rest gap is required after at most 2 consecutive periods.`,
              teacherId,
              teacherName: teacher?.name || teacherId,
              day,
              period: run[0],
              periods: [...run],
              consecutiveCount: run.length,
            });
          }
          run = [p];
        }
      }
      if (run.length > 2) {
        violations.push({
          type: 'FACULTY_REST_GAP',
          severity: 'hard',
          message: `Faculty member ${teacher?.name || teacherId} has ${run.length} consecutive teaching periods on ${day} (Periods P${run[0]}–P${run[run.length - 1]}) without a rest gap. A guaranteed rest gap is required after at most 2 consecutive periods.`,
          teacherId,
          teacherName: teacher?.name || teacherId,
          day,
          period: run[0],
          periods: [...run],
          consecutiveCount: run.length,
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

  
  // S6 Open Elective strict allowed periods validation:
  // ONLY Monday P3, Tuesday P3, Wednesday P3, Thursday P6 are allowed.
  const S6_OE_ALLOWED = new Set(['Monday|3', 'Tuesday|3', 'Wednesday|3', 'Thursday|6']);
  const classMap = data.classMap || {};
  for (const [classId, dayMap] of Object.entries(grid)) {
    const cls = classMap[classId];
    for (const [day, periodMap] of Object.entries(dayMap)) {
      for (const [periodStr, slot] of Object.entries(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;
        const period = Number(periodStr);
        const isS6 = cls?.semester === 6 || slot.className?.includes('S6');
        const isOpenElective = slot.isElective && (slot.subjectType === 'open' || slot.electiveType === 'open' || slot.isOpenElective);
        if (isS6 && isOpenElective) {
          const key = `${day}|${period}`;
          if (!S6_OE_ALLOWED.has(key)) {
            violations.push({
              type: 'S6_OPEN_ELECTIVE_PROHIBITED_SLOT',
              message: `Class ${cls?.name || classId}: S6 Open Elective '${slot.subjectName}' placed on ${day} P${period} is prohibited. Allowed slots are Monday P3, Tuesday P3, Wednesday P3, Thursday P6 only.`,
              classId,
              day,
              period,
            });
          }
        }
      }
    }
  }

  // Validate mandatory fixed slots from data.subjects
  if (data && Array.isArray(data.subjects)) {
    for (const subject of data.subjects) {
      const fixedSlots = (subject.fixedSlots || []).filter(fs => fs && fs.day && fs.period && fs.isMandatory !== false);
      const classId = subject.classId?._id ? subject.classId._id.toString() : (subject.classId?.toString() || '');
      if (!classId || !grid[classId]) continue;

      for (const fs of fixedSlots) {
        const actualSlot = grid[classId]?.[fs.day]?.[fs.period];
        const actualSubjectId = actualSlot?.subjectId?.toString();
        const expectedSubjectId = subject._id.toString();

        if (!actualSlot || actualSlot.isEmpty || actualSlot.isBreak || actualSubjectId !== expectedSubjectId) {
          violations.push({
            type: 'FIXED_SLOT_VIOLATION',
            message: `Class ${classId}: Subject '${subject.name}' (${subject.code}) has mandatory fixed slot on ${fs.day} P${fs.period} but it is ${!actualSlot || actualSlot.isEmpty ? 'empty' : 'occupied by ' + (actualSlot.subjectCode || actualSlot.subjectName)}`,
            classId,
            day: fs.day,
            period: fs.period,
            subjectId: subject._id,
            fixedDay: fs.day,
            fixedPeriod: fs.period,
          });
        }
      }
    }
  }

  
  // ── RULE 2 & 3: DAILY SUBJECT UNIQUENESS VALIDATION (Hard Constraint) ─────────
  for (const [classId, dayMap] of Object.entries(grid)) {
    const cls = classMap[classId];
    const className = cls?.name || `Class ${classId}`;

    for (const [day, periodMap] of Object.entries(dayMap)) {
      const subjectSlotsMap = {};

      for (const [periodStr, slot] of Object.entries(periodMap)) {
        if (!isOccupied(slot) || !slot.subjectId) continue;
        const period = Number(periodStr);

        // Check if exempt under Rule 3 (Exception A: Phase 2 Project, Exception B: Laboratory)
        if (isDailyUniquenessExempt(slot)) continue;

        // Authoritative identity: for electives, group by electiveGroupId / code; for minor, group by minor identity
        const subjectKey = (slot.isElective && (slot.electiveGroupId || slot.linkedGroupId))
          ? `ELECTIVE_${slot.electiveGroupId || slot.linkedGroupId}`
          : (slot.isMinor || slot.subjectType === 'minor')
          ? `MINOR_${slot.minorGroupId || ''}_${slot.minorSubjectCode || slot.subjectCode || 'SESSION'}`
          : (slot.subjectCode || slot.subjectName || slot.subjectId.toString());

        if (!subjectSlotsMap[subjectKey]) subjectSlotsMap[subjectKey] = [];
        subjectSlotsMap[subjectKey].push({ period, slot });
      }

      const isS8OrFullProjectClass = Boolean(cls?.semester === 8 || (cls?.name || '').includes('S8'));
      const availableDaysCount = isS8OrFullProjectClass ? 3 : 5;
      const maxAllowed = availableDaysCount >= 5 ? 1 : Math.ceil(4 / availableDaysCount);

      for (const [key, slots] of Object.entries(subjectSlotsMap)) {
        if (slots.length > maxAllowed) {
          const subName = slots[0].slot.subjectName || slots[0].slot.subjectCode || key;
          const periods = slots.map(s => s.period);
          violations.push({
            type: 'DAILY_SUBJECT_UNIQUENESS_VIOLATION',
            code: 'DAILY_SUBJECT_UNIQUENESS_VIOLATION',
            severity: 'hard',
            message: `${className} on ${day}: '${subName}' appears ${slots.length} times (periods ${periods.join(', ')}). Hard constraint: non-exempt subjects may appear only once per day.`,
            classId,
            className,
            day,
            subjectKey: key,
            periods,
            count: slots.length,
          });
        }
      }
    }
  }

  // ── RULE 1: ELECTIVE SYNCHRONIZATION ACROSS PAIRED CLASSES ───────────────────
  if (data.electiveGroups && Array.isArray(data.electiveGroups)) {
    for (const eg of data.electiveGroups) {
      if (!eg.isActive) continue;

      const sem = eg.semester;
      const sections = eg.sections || ['A', 'B'];
      const participatingClasses = (data.classes || []).filter(c => {
        if (c.semester !== sem) return false;
        if (sections.includes(c.section)) return true;
        if (sections.some(sec => c.name?.includes(sec))) return true;
        return false;
      });

      if (participatingClasses.length < 2) continue;

      const classPositions = {};
      for (const cls of participatingClasses) {
        const cid = cls._id.toString();
        classPositions[cid] = new Set();
        const dayMap = grid[cid] || {};
        for (const [day, periodMap] of Object.entries(dayMap)) {
          for (const [pStr, slot] of Object.entries(periodMap)) {
            if (!isOccupied(slot)) continue;
            const isMatch = (
              (slot.isElective && (slot.electiveGroupId === eg._id.toString() || slot.linkedGroupId === eg._id.toString())) ||
              (eg.options && eg.options.some(opt => {
                const optSid = opt.subjectId?._id ? opt.subjectId._id.toString() : opt.subjectId?.toString();
                return optSid && optSid === slot.subjectId?.toString();
              }))
            );
            if (isMatch) {
              classPositions[cid].add(`${day}|${pStr}`);
            }
          }
        }
      }

      const baseCid = participatingClasses[0]._id.toString();
      const baseName = participatingClasses[0].name;
      const baseSet = classPositions[baseCid] || new Set();

      for (let i = 1; i < participatingClasses.length; i++) {
        const otherCid = participatingClasses[i]._id.toString();
        const otherName = participatingClasses[i].name;
        const otherSet = classPositions[otherCid] || new Set();

        for (const pos of baseSet) {
          if (!otherSet.has(pos)) {
            const [day, p] = pos.split('|');
            violations.push({
              type: 'ELECTIVE_DESYNCHRONIZATION',
              code: 'ELECTIVE_DESYNCHRONIZATION',
              severity: 'hard',
              message: `Elective group '${eg.name}' desynchronization: ${baseName} has elective at ${day} P${p}, but ${otherName} does not.`,
              electiveGroupId: eg._id.toString(),
              groupName: eg.name,
              day,
              period: Number(p),
              missingInClass: otherName,
            });
          }
        }

        for (const pos of otherSet) {
          if (!baseSet.has(pos)) {
            const [day, p] = pos.split('|');
            violations.push({
              type: 'ELECTIVE_DESYNCHRONIZATION',
              code: 'ELECTIVE_DESYNCHRONIZATION',
              severity: 'hard',
              message: `Elective group '${eg.name}' desynchronization: ${otherName} has elective at ${day} P${p}, but ${baseName} does not.`,
              electiveGroupId: eg._id.toString(),
              groupName: eg.name,
              day,
              period: Number(p),
              missingInClass: baseName,
            });
          }
        }
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
        if (slot.isElective && (slot.electiveGroupId || slot.linkedGroupId)) {
          const egId = (slot.electiveGroupId || slot.linkedGroupId).toString();
          const eg = (data.electiveGroups || []).find((g) => g._id.toString() === egId);
          if (eg && Array.isArray(eg.options)) {
            for (const opt of eg.options) {
              const optSid = opt.subjectId?._id ? opt.subjectId._id.toString() : opt.subjectId?.toString();
              if (optSid) {
                placedCounts[optSid] = (placedCounts[optSid] || 0) + 1;
              }
            }
          }
          // Credit any subjects registered under this elective group
          for (const sub of (data.subjects || [])) {
            const subEgId = sub.electiveDetails?.electiveGroupId?._id
              ? sub.electiveDetails.electiveGroupId._id.toString()
              : (sub.electiveDetails?.electiveGroupId ? sub.electiveDetails.electiveGroupId.toString() : null);
            if (subEgId && subEgId === egId) {
              const subIdStr = sub._id.toString();
              placedCounts[subIdStr] = (placedCounts[subIdStr] || 0) + 1;
            }
          }
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
      let expectedTotal = (subject.weeklyHours !== undefined && subject.weeklyHours !== null && subject.weeklyHours > 0)
        ? subject.weeklyHours
        : (expectedL + expectedT + expectedP);

      if (expectedTotal === 0) continue;

      if (placed < expectedTotal) {
        violations.push({
          type: 'SUBJECT_UNDER_SCHEDULED',
          message: `Class ${classId}: ${subject.name} has ${placed}/${expectedTotal} required periods (L:${expectedL} T:${expectedT} P:${expectedP} R:${expectedR})`,
          classId, subjectId: sid, subjectName: subject.name,
          placed, expected: expectedTotal, missing: expectedTotal - placed,
          detail: { L: { placed: placedL[sid]||0, expected: expectedL }, T: { placed: placedT[sid]||0, expected: expectedT }, P: { placed: placedP[sid]||0, expected: expectedP } },
        });
      } else if (placed > expectedTotal && subject.type !== 'elective') {
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
      const isS8ProjSub = subject.code === 'CSD416' || subject.code === 'CST416' || subject.name?.includes('Project Phase');
      if (isS8ProjSub && runs.length > 0 && runs.every(r => r.run.length === 6)) {
        // Valid full-day project block (6 periods each day) as authorized for S8 Project Phase-2
        continue;
      }

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

        const isS8ProjSub = subject.code === 'CSD416' || subject.code === 'CST416' || subject.name?.includes('Project Phase');
        const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
        if (!isS8ProjSub && tl && crossesBreak(run[0], run.length, tl)) {
          violations.push({
            type: 'LAB_BREAK_CROSSED',
            message: `Class ${classId}: lab '${subject.name}' on ${day} P${run[0]}-P${run[run.length - 1]} crosses a break`,
            classId, subjectId: sid, subjectName: subject.name,
            day, periods: run,
          });
        }

        // Friday P3 prohibition check (exempt full-day S8 Project Phase-2)
        if (!isS8ProjSub && day === 'Friday' && blockDuration >= 3) {
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

  
  // Check Minor synchronization if minor groups exist
  let minorViolationsCount = 0;
  if (data.minorGroups && data.minorGroups.length > 0) {
    for (const mg of data.minorGroups) {
      if (!mg.isActive) continue;
      const targetClasses = (data.classes || []).filter(c => {
        if (c.semester !== mg.semester) return false;
        if (mg.departmentId && c.departmentId) {
          const d1 = (mg.departmentId._id || mg.departmentId).toString();
          const d2 = (c.departmentId._id || c.departmentId).toString();
          if (d1 !== d2) return false;
        }
        if (mg.sections && mg.sections.length > 0) {
          return mg.sections.includes(c.section);
        }
        return true;
      });
      if (targetClasses.length > 1) {
        const checkSlots = (mg.fixedSlots && mg.fixedSlots.length > 0) ? mg.fixedSlots : (mg.slots || []);
        for (const slotConfig of checkSlots) {
          const { day, period } = slotConfig;
          const class1 = targetClasses[0]._id.toString();
          const slot1 = grid[class1]?.[day]?.[period];
          for (let i = 1; i < targetClasses.length; i++) {
            const class2 = targetClasses[i]._id.toString();
            const slot2 = grid[class2]?.[day]?.[period];
            const s1Minor = slot1 && (slot1.isMinor || slot1.subjectType === 'minor');
            const s2Minor = slot2 && (slot2.isMinor || slot2.subjectType === 'minor');
            if (s1Minor !== s2Minor) {
              minorViolationsCount++;
              hardViolations.push({
                type: 'MINOR_DESYNCHRONIZATION',
                message: `Minor synchronization mismatch between ${targetClasses[0].name} and ${targetClasses[i].name} on ${day} Period ${period}`,
                day,
                period,
              });
            }
          }
        }
      }
    }
  }

  const checks = {
    all_subjects_placed: unplaced.length === 0 && underScheduled.length === 0,
    all_subject_hours_met: underScheduled.length === 0 && overScheduled.length === 0,
    zero_teacher_conflicts: teacherDoubles === 0,
    zero_class_conflicts: true,
    zero_room_conflicts: roomDoubles === 0,
    zero_availability_violations: availabilityViolations === 0,
    zero_invalid_slots: noTeacher === 0,
    zero_lab_block_violations: labProblems === 0,
    minor_slots_synchronized: minorViolationsCount === 0,
    zero_daily_subject_duplicates: hardViolations.filter(v => v.type === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION').length === 0,
    elective_groups_synchronized: hardViolations.filter(v => v.type === 'ELECTIVE_DESYNCHRONIZATION').length === 0,
    all_slots_filled: true, // DISABLED - free slots are allowed
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

  // Check Daily Subject Uniqueness (Rule 2 & Rule 3)
  if (!isDailyUniquenessExempt(slot) && grid[classId]?.[day]) {
    const targetKey = (slot.isElective && (slot.electiveGroupId || slot.linkedGroupId))
      ? `ELECTIVE_${slot.electiveGroupId || slot.linkedGroupId}`
      : (slot.subjectCode || slot.subjectName || (slot.subjectId ? slot.subjectId.toString() : null));

    if (targetKey) {
      for (const [pStr, existingSlot] of Object.entries(grid[classId][day])) {
        if (Number(pStr) === Number(period)) continue;
        if (!isOccupied(existingSlot)) continue;
        const existKey = (existingSlot.isElective && (existingSlot.electiveGroupId || existingSlot.linkedGroupId))
          ? `ELECTIVE_${existingSlot.electiveGroupId || existingSlot.linkedGroupId}`
          : (existingSlot.subjectCode || existingSlot.subjectName || (existingSlot.subjectId ? existingSlot.subjectId.toString() : null));

        if (existKey === targetKey && !isDailyUniquenessExempt(existingSlot)) {
          return false;
        }
      }
    }
  }

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
      if (slotTeacherIds(existingSlot).includes(teacherId)) {
        const token1 = sharedElectiveToken(slot);
        const token2 = sharedElectiveToken(existingSlot);
        if (!token1 || !token2 || token1 !== token2) return false;
      }
    }

    if (!ignoreDailyLimit) {
      const baseLimit = teacher.maxPeriodsPerDay || settings.teacherDailyLimit || 4;
      const customLimit =
        teacherDailyLimitOverrides[teacherId]?.[day] ||
        teacherDailyLimitOverrides[teacher.name]?.[day] ||
        baseLimit;

      const distinctPeriodsOnDay = new Set();
      for (const [, dayMap] of Object.entries(grid)) {
        for (const [pNum, s] of Object.entries(dayMap[day] || {})) {
          if (!isOccupied(s)) continue;
          if (slotTeacherIds(s).includes(teacherId)) distinctPeriodsOnDay.add(Number(pNum));
        }
      }
      const teacherPeriodsOnDay = distinctPeriodsOnDay.size;
      const isProjectSlot = slot.subjectCode === 'CST416' || slot.subjectName?.includes('Project Phase-2');
      const effectiveLimit = isProjectSlot ? Math.max(customLimit, 6) : customLimit;
      if (teacherPeriodsOnDay + additionalPeriods > effectiveLimit) return false;

      // Faculty Rest-Gap Hard Constraint: Every faculty member at most 2 consecutive teaching periods globally
      const candidatePeriods = new Set(distinctPeriodsOnDay);
      candidatePeriods.add(Number(period));
      const sortedPeriods = [...candidatePeriods].sort((a, b) => a - b);
      let curConsecutive = 0;
      let lastP = null;
      for (const cp of sortedPeriods) {
        if (lastP !== null && cp === lastP + 1) {
          curConsecutive++;
        } else {
          curConsecutive = 1;
        }
        lastP = cp;
        if (curConsecutive > 2) {
          return false;
        }
      }
    }
  }

  for (const room of slotRoomNames(slot)) {
    if (room.toLowerCase().startsWith('lab')) {
      const classSem = slot.classSemester || data.classMap?.[classId]?.semester || 0;
      const isProjectPhase2 = slot.subjectCode === 'CSD416' || slot.subjectCode === 'CST416' || slot.subjectName?.includes('Project Phase');
      if ((classSem === 1 || classSem === 2) && room === 'Lab 4') return false;
      if (classSem >= 3 && classSem <= 8 && !isProjectPhase2 && room !== 'Lab 4') return false;
      if (classSem >= 3 && classSem <= 8 && isProjectPhase2 && ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4'].includes(room)) return false;
    }

    for (const [otherClassId, dayMap] of Object.entries(grid)) {
      if (otherClassId === classId) continue;
      const existingSlot = dayMap[day]?.[period];
      if (!isOccupied(existingSlot)) continue;
      if (slotRoomNames(existingSlot).includes(room)) return false;
    }
  }

  // Friday P3 lab check (exempt full-day S8 Project Phase-2)
  const isS8ProjectValid = slot.subjectCode === 'CSD416' || slot.subjectCode === 'CST416' || slot.subjectName?.includes('Project Phase');
  if (slot.isLabBlock && slot.labBlockIndex === 0 && !isS8ProjectValid) {
    const blockDuration = slot.labBlockDuration || (slot.labBlockNumber !== undefined ? 3 : 3);
    if (day === 'Friday' && blockDuration >= 3) return false;
  }

  return true;
};

const isLabBlockValid = (classId, day, startPeriod, duration, slot, grid, data, options = {}) => {
  const { periodsPerDayMap, timeline, fridayTimeline, settings } = data;
  const maxP = Math.max(...(periodsPerDayMap[day] || [6]));

  // Friday P3 prohibition - EXCEPT for S8 Project Phase II (CSD416) which is explicitly required on Friday
  const isS8Project = slot.subjectCode === 'CSD416' || slot.subjectCode === 'CST416' || slot.subjectName?.includes('Project Phase');
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
  isPhase2Project,
  isLaboratory,
  isDailyUniquenessExempt,
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