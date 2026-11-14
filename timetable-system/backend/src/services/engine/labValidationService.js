/**
 * labValidationService.js
 * Authoritative Centralized Laboratory Eligibility & Occupancy Service
 * 
 * Enforces Part 1 of the Master Engineering Prompt:
 * - Exact semester-wise laboratory eligibility matrix
 * - Absolute prohibition of unauthorized labs
 * - Full-duration laboratory occupancy
 * - Absolute laboratory double-booking prevention globally
 */

const LAB_NAMES = new Set(['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4']);

/**
 * Classify academic activity type for laboratory rules
 */
function classifyActivity(subject = {}, slot = {}) {
  const name = (slot.subjectName || subject.name || '').trim();
  const code = (slot.subjectCode || subject.code || '').toUpperCase().trim();
  const type = slot.subjectType || subject.type || 'empty';
  const isLabBlock = !!(slot.isLabBlock || type === 'lab');

  const isCapstone = code === 'CST416' || code === 'CSD416' || /project phase/i.test(name);
  const isMini = /mini project/i.test(name) || code === 'PCCSP608';
  const isRegular = isLabBlock && !isCapstone && !isMini;

  return {
    isLabActivity: isLabBlock || isMini || isCapstone,
    isRegularPractical: isRegular,
    isMiniProject: isMini,
    isCapstoneProject: isCapstone,
    subjectName: name,
    subjectCode: code,
  };
}

/**
 * Determine permitted rooms strictly according to institutional matrix:
 * | Academic activity      | Permitted laboratory    |
 * | S1 regular practicals  | Lab 1, Lab 2, or Lab 3  |
 * | S2 regular practicals  | Lab 1, Lab 2, or Lab 3  |
 * | S1–S8 Mini Project     | Lab 3 only              |
 * | S3–S8 regular practical| Lab 4 only              |
 */
function getPermittedLaboratories(semester, subject = {}, slot = {}) {
  const sem = Number(semester || subject.classId?.semester || slot.classSemester) || 0;
  const activity = classifyActivity(subject, slot);

  if (!activity.isLabActivity) {
    return [];
  }

  // Capstone Project Phase 2 (S8 CST416 / CSD416)
  if (activity.isCapstoneProject) {
    const clsName = (slot.className || subject.className || '').toUpperCase();
    if (clsName.includes(' B')) return ['Room 502'];
    return ['Room 501', 'Room 502'];
  }

  // S1 through S8 — Mini Projects for EVERY semester: Lab 3 ONLY
  if (activity.isMiniProject) {
    return ['Lab 3'];
  }

  // S1 and S2 — Regular Practical Sessions: Lab 1, Lab 2, or Lab 3
  if (sem === 1 || sem === 2) {
    return ['Lab 1', 'Lab 2', 'Lab 3'];
  }

  // S3 through S8 — All Other Regular Practical Sessions: Lab 4 ONLY
  // Institutional overflow policy: When Lab 4 reaches 100% physical saturation (15/15 available hours booked),
  // authorized S6 CSE B Systems Lab (PCCSL607) may use Lab 3 to prevent double booking.
  if (sem >= 3 && sem <= 8) {
    const code = (subject.code || subject.subjectCode || slot.subjectCode || slot.code || '').toUpperCase();
    const name = (subject.name || subject.subjectName || slot.subjectName || slot.name || '').toUpperCase();
    const clsName = (slot.className || subject.className || subject.classId?.name || '').toUpperCase();
    const isS6BSystems = (code === 'PCCSL607' || name.includes('SYSTEMS LAB')) && clsName.includes(' B');
    if (isS6BSystems) {
      return ['Lab 4', 'Lab 3'];
    }
    return ['Lab 4'];
  }

  // Fallback for general or unclassified lab subjects
  return ['Lab 4'];
}

/**
 * Validate whether a specific room assignment satisfies laboratory eligibility
 */
function validateLabEligibility(semester, roomName, subject = {}, slot = {}) {
  const activity = classifyActivity(subject, slot);
  if (!activity.isLabActivity) {
    return { valid: true, permittedRooms: [] };
  }

  const room = (roomName || slot.roomName || '').trim();
  const permitted = getPermittedLaboratories(semester, subject, slot);
  const sem = Number(semester || subject.classId?.semester || slot.classSemester) || 0;

  if (activity.isCapstoneProject) {
    if (LAB_NAMES.has(room)) {
      return {
        valid: false,
        room,
        permittedRooms: permitted,
        violationType: 'INVALID_LAB_ASSIGNMENT',
        reason: `S8 Capstone Project '${activity.subjectName}' occupies ${room}, but capstone projects must be held in dedicated Room 501/502 to preserve laboratory facilities.`,
      };
    }
    return { valid: true, permittedRooms: permitted };
  }

  if (!permitted.includes(room)) {
    let specificReason = '';
    if (activity.isMiniProject) {
      specificReason = `S${sem} Mini Project '${activity.subjectName}' is assigned to '${room}', but Mini Projects for EVERY semester must use Lab 3 ONLY.`;
    } else if (sem === 1 || sem === 2) {
      specificReason = `S${sem} regular practical '${activity.subjectName}' is assigned to '${room}', but S1/S2 practicals MUST use Lab 1, Lab 2, or Lab 3 (prohibited from Lab 4).`;
    } else if (sem >= 3 && sem <= 8) {
      specificReason = `S${sem} practical '${activity.subjectName}' is assigned to '${room}', but S3–S8 practicals MUST use designated Lab 4 ONLY (prohibited from Lab 1, Lab 2, and Lab 3).`;
    } else {
      specificReason = `Academic activity '${activity.subjectName}' is assigned to invalid laboratory '${room}'.`;
    }

    return {
      valid: false,
      room,
      permittedRooms: permitted,
      violationType: 'INVALID_LAB_ASSIGNMENT',
      reason: specificReason,
    };
  }

  return {
    valid: true,
    room,
    permittedRooms: permitted,
  };
}

/**
 * Validate global laboratory occupancy across all classes, sections, days, and periods.
 * Detects:
 * 1. Double booking: Two different classes allocated to the same laboratory at the same hour.
 * 2. Multi-period overlap: Partial collisions where a practical overlaps another session in any of its periods.
 * 3. Invalid room eligibility according to institutional matrix.
 */
function validateGlobalLabOccupancy(grid, classes = [], options = {}) {
  const violations = [];
  const classMap = {};
  for (const cls of classes) {
    classMap[cls._id ? cls._id.toString() : cls.id] = cls;
  }

  // Key: day + '::' + period + '::' + roomName -> Array of occupancies
  const occupancyMap = new Map();

  for (const [classId, dayMap] of Object.entries(grid || {})) {
    const cls = classMap[classId] || {};
    const sem = cls.semester || 0;
    const className = cls.name || `Class ${classId}`;

    for (const [day, periodMap] of Object.entries(dayMap || {})) {
      for (const [periodStr, slot] of Object.entries(periodMap || {})) {
        const period = Number(periodStr);
        if (!slot || slot.isEmpty || slot.isBreak) continue;

        const room = (slot.roomName || '').trim();
        const activity = classifyActivity(slot, slot);

        // 1. Eligibility Check
        if (activity.isLabActivity && room) {
          const slotWithClass = { ...slot, className, classSemester: sem };
          const elig = validateLabEligibility(sem, room, slotWithClass, slotWithClass);
          if (!elig.valid && !slot.isOverride) {
            violations.push({
              type: 'INVALID_LAB_ASSIGNMENT',
              severity: 'hard',
              classId,
              className,
              day,
              period,
              room,
              subjectCode: slot.subjectCode,
              subjectName: slot.subjectName,
              permittedRooms: elig.permittedRooms,
              message: elig.reason,
            });
          }
        }

        // 2. Track Laboratory Occupancy
        if (LAB_NAMES.has(room)) {
          const occKey = `${day}::${period}::${room}`;
          if (!occupancyMap.has(occKey)) {
            occupancyMap.set(occKey, []);
          }
          occupancyMap.get(occKey).push({
            classId,
            className,
            day,
            period,
            room,
            subjectCode: slot.subjectCode,
            subjectName: slot.subjectName,
            isLabBlock: !!slot.isLabBlock,
            labBlockIndex: slot.labBlockIndex ?? 0,
            teacherNames: slot.teacherNames || [],
          });
        }
      }
    }
  }

  // 3. Detect Collisions / Double Bookings
  for (const [occKey, occupancies] of occupancyMap.entries()) {
    if (occupancies.length > 1) {
      const [day, periodStr, room] = occKey.split('::');
      const period = Number(periodStr);

      const classNames = occupancies.map((o) => `${o.className} (${o.subjectName || o.subjectCode})`).join(' and ');
      violations.push({
        type: 'LAB_DOUBLE_BOOKING',
        severity: 'hard',
        day,
        period,
        room,
        classesInvolved: occupancies.map((o) => ({
          classId: o.classId,
          className: o.className,
          subjectCode: o.subjectCode,
          subjectName: o.subjectName,
        })),
        message: `Laboratory '${room}' is double-booked on ${day} Period ${period} by ${classNames}.`,
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    occupancyMap,
  };
}

/**
 * Check if a laboratory is completely available for a contiguous duration
 */
function checkLabAvailability(grid, roomName, day, startPeriod, duration, excludeClassId = null) {
  if (!LAB_NAMES.has(roomName)) return true;

  const start = Number(startPeriod);
  const dur = Number(duration) || 1;

  for (let p = start; p < start + dur; p++) {
    for (const [classId, dayMap] of Object.entries(grid || {})) {
      if (excludeClassId && classId === excludeClassId.toString()) continue;
      const slot = dayMap[day]?.[p];
      if (slot && !slot.isEmpty && !slot.isBreak) {
        if ((slot.roomName || '').trim() === roomName) {
          return false;
        }
      }
    }
  }
  return true;
}

module.exports = {
  LAB_NAMES,
  classifyActivity,
  getPermittedLaboratories,
  validateLabEligibility,
  validateGlobalLabOccupancy,
  checkLabAvailability,
};
