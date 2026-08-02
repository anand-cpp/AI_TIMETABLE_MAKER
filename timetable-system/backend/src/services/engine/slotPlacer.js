const { isSlotValid, isLabBlockValid } = require('./constraintValidator');
const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * Slot Placer
 * Places subjects into the grid one by one
 * Respects hard constraints and soft preferences
 */

// ── Initialize empty grid ──────────────────────────────────────────────────────
const initializeGrid = (classes, workingDays, allPeriodsPerDayMap, breakPeriodsPerDayMap) => {
  const grid = {};

  for (const cls of classes) {
    const classId = cls._id.toString();
    grid[classId] = {};

    for (const day of workingDays) {
      grid[classId][day] = {};
      const allPeriods = allPeriodsPerDayMap[day] || [];
      const breakPeriods = breakPeriodsPerDayMap[day] || [];

      for (const period of allPeriods) {
        if (breakPeriods.includes(period)) {
          grid[classId][day][period] = {
            day,
            period,
            isBreak: true,
            isEmpty: false,
            subjectType: 'break',
            subjectName: 'Break',
            subjectCode: '',
            teacherIds: [],
            teacherNames: [],
            roomName: '',
            isLocked: false,
            isLabBlock: false,
            labBlockIndex: 0,
            isBatchSplit: false,
            isElective: false,
            electiveGroupId: '',
            notes: '',
          };
        } else {
          grid[classId][day][period] = {
            day,
            period,
            isBreak: false,
            isEmpty: true,
            subjectType: 'empty',
            subjectId: null,
            subjectName: '',
            subjectCode: '',
            teacherIds: [],
            teacherNames: [],
            roomName: '',
            isLocked: false,
            isLabBlock: false,
            labBlockIndex: 0,
            isBatchSplit: false,
            isElective: false,
            electiveGroupId: '',
            notes: '',
          };
        }
      }
    }
  }

  return grid;
};

// ── Shuffle array (Fisher-Yates) ───────────────────────────────────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ── Score a slot for soft preferences ─────────────────────────────────────────
// Lower score = more preferred
const scoreSlotPreference = (day, period, subject, periodsPerDayMap) => {
  let score = 0;
  const dayPeriods = periodsPerDayMap[day] || [];
  const totalPeriods = dayPeriods.length;
  const periodIndex = dayPeriods.indexOf(period);

  // Morning preference for labs
  if (subject.type === 'lab' && subject.labDetails?.morningPreference) {
    // Prefer first half of day
    if (periodIndex > totalPeriods / 2) score += 10;
  }

  // Spread subjects across the week (prefer not Monday for everything)
  // This is a mild bias - actual spreading done by quality scorer
  if (day === 'Monday' && periodIndex === 0) score += 2;

  return score;
};

// ── Place a theory subject ─────────────────────────────────────────────────────
const placeTheorySubject = (subject, classId, grid, data, randomize = false) => {
  const { workingDays, periodsPerDayMap } = data;
  const placed = [];
  let remaining = subject.weeklyHours || 0;

  // Get teacher info
  const teacherIds = (subject.teachers || []).map((t) =>
    t._id ? t._id.toString() : t.toString()
  );
  const teacherNames = (subject.teachers || []).map((t) => t.name || '');

  // Build candidate slots
  let candidates = [];
  for (const day of workingDays) {
    for (const period of periodsPerDayMap[day] || []) {
      candidates.push({ day, period });
    }
  }

  // Sort by preference score or randomize
  if (randomize) {
    candidates = shuffle(candidates);
  } else {
    candidates.sort(
      (a, b) =>
        scoreSlotPreference(a.day, a.period, subject, periodsPerDayMap) -
        scoreSlotPreference(b.day, b.period, subject, periodsPerDayMap)
    );
  }

  const slotData = {
    subjectId: subject._id.toString(),
    subjectName: subject.name,
    subjectCode: subject.code,
    subjectType: 'theory',
    teacherIds,
    teacherNames,
    roomName: '',
    isEmpty: false,
    isBreak: false,
    isLabBlock: false,
    labBlockIndex: 0,
    isBatchSplit: false,
    isElective: false,
    electiveGroupId: '',
    isLocked: false,
    notes: '',
  };

  for (const { day, period } of candidates) {
    if (remaining <= 0) break;

    // Skip if already placed on this day (avoid multiple same subject same day)
    const alreadyOnDay = placed.some((p) => p.day === day);
    if (alreadyOnDay && remaining < subject.weeklyHours) continue;

    if (!isSlotValid(classId, day, period, slotData, grid, data)) continue;

    // Place it
    grid[classId][day][period] = { ...slotData, day, period };
    placed.push({ day, period });
    remaining--;
  }

  return { placed, unplaced: remaining };
};

// ── Place a lab subject ────────────────────────────────────────────────────────
const placeLabSubject = (subject, classId, grid, data, randomize = false) => {
  const {
    workingDays,
    periodsPerDayMap,
    settings,
    timeline,
    fridayTimeline,
  } = data;

  const duration = subject.labDetails?.duration || 2;
  const isBatchSplit = subject.labDetails?.isBatchSplit || false;

  // Build teacher + room info
  let teacherIds = [];
  let teacherNames = [];
  let batch1 = null;
  let batch2 = null;

  if (isBatchSplit) {
    const b1t = subject.labDetails.batch1Teacher;
    const b2t = subject.labDetails.batch2Teacher;
    batch1 = {
      teacherId: b1t?._id ? b1t._id.toString() : b1t?.toString() || null,
      teacherName: b1t?.name || '',
      roomName: subject.labDetails.batch1Room || '',
    };
    batch2 = {
      teacherId: b2t?._id ? b2t._id.toString() : b2t?.toString() || null,
      teacherName: b2t?.name || '',
      roomName: subject.labDetails.batch2Room || '',
    };
    if (batch1.teacherId) teacherIds.push(batch1.teacherId);
    if (batch2.teacherId) teacherIds.push(batch2.teacherId);
    if (batch1.teacherName) teacherNames.push(batch1.teacherName);
    if (batch2.teacherName) teacherNames.push(batch2.teacherName);
  } else {
    teacherIds = (subject.teachers || []).map((t) =>
      t._id ? t._id.toString() : t.toString()
    );
    teacherNames = (subject.teachers || []).map((t) => t.name || '');
  }

  const roomName = isBatchSplit ? '' : subject.labDetails?.roomName || '';

  // Build candidate start slots
  let candidates = [];
  for (const day of workingDays) {
    const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
    const periods = periodsPerDayMap[day] || [];

    for (const startPeriod of periods) {
      // Check if duration periods are all available (no break crossing)
      if (!crossesBreak(startPeriod, duration, tl)) {
        // Make sure all periods in block exist
        let allExist = true;
        for (let p = startPeriod; p < startPeriod + duration; p++) {
          if (!periods.includes(p)) {
            allExist = false;
            break;
          }
        }
        if (allExist) {
          candidates.push({
            day,
            startPeriod,
            score: subject.labDetails?.morningPreference
              ? periods.indexOf(startPeriod)
              : Math.random(),
          });
        }
      }
    }
  }

  if (randomize) {
    candidates = shuffle(candidates);
  } else {
    candidates.sort((a, b) => a.score - b.score);
  }

  const baseSlotData = {
    subjectId: subject._id.toString(),
    subjectName: subject.name,
    subjectCode: subject.code,
    subjectType: 'lab',
    teacherIds,
    teacherNames,
    roomName,
    isEmpty: false,
    isBreak: false,
    isLabBlock: true,
    isBatchSplit,
    batch1: batch1 || { teacherId: null, teacherName: '', roomName: '' },
    batch2: batch2 || { teacherId: null, teacherName: '', roomName: '' },
    isElective: false,
    electiveGroupId: '',
    isLocked: false,
    notes: '',
  };

  for (const { day, startPeriod } of candidates) {
    // Validate entire block
    if (!isLabBlockValid(classId, day, startPeriod, duration, baseSlotData, grid, data)) {
      continue;
    }

    // Place all periods in block
    for (let i = 0; i < duration; i++) {
      const period = startPeriod + i;
      grid[classId][day][period] = {
        ...baseSlotData,
        day,
        period,
        labBlockIndex: i,
      };
    }

    return { placed: [{ day, startPeriod, duration }], unplaced: 0 };
  }

  return { placed: [], unplaced: 1 };
};

// ── Place a linked elective ────────────────────────────────────────────────────
const placeLinkedElective = (subject, allClassIds, grid, data) => {
  const { workingDays, periodsPerDayMap } = data;

  const teacherIds = (subject.teachers || []).map((t) =>
    t._id ? t._id.toString() : t.toString()
  );
  const teacherNames = (subject.teachers || []).map((t) => t.name || '');

  const slotData = {
    subjectId: subject._id.toString(),
    subjectName: subject.name,
    subjectCode: subject.code,
    subjectType: 'elective',
    teacherIds,
    teacherNames,
    roomName: '',
    isEmpty: false,
    isBreak: false,
    isLabBlock: false,
    labBlockIndex: 0,
    isBatchSplit: false,
    isElective: true,
    electiveGroupId: subject.electiveDetails?.linkedGroupId || subject._id.toString(),
    isLocked: false,
    notes: '',
  };

  // Find slot where ALL linked classes are free simultaneously
  for (const day of workingDays) {
    for (const period of periodsPerDayMap[day] || []) {
      let allFree = true;

      for (const classId of allClassIds) {
        if (!isSlotValid(classId, day, period, slotData, grid, data)) {
          allFree = false;
          break;
        }
      }

      if (allFree) {
        // Place in all linked classes
        for (const classId of allClassIds) {
          grid[classId][day][period] = { ...slotData, day, period };
        }
        return { placed: true, day, period };
      }
    }
  }

  return { placed: false };
};

// ── Place an open elective ─────────────────────────────────────────────────────
const placeOpenElective = (subject, allParticipatingClassIds, grid, data) => {
  const { workingDays, periodsPerDayMap } = data;
  const options = subject.electiveDetails?.openElectiveOptions || [];

  // Collect all teacher IDs from all options
  const allOptionTeacherIds = options
    .map((opt) => {
      const t = opt.teacherId;
      return t?._id ? t._id.toString() : t?.toString() || null;
    })
    .filter(Boolean);

  // Find slot where:
  // 1. ALL participating classes are free
  // 2. ALL option teachers are free
  for (const day of workingDays) {
    for (const period of periodsPerDayMap[day] || []) {
      let allClassesFree = true;

      // Check all participating classes free
      for (const classId of allParticipatingClassIds) {
        const existing = grid[classId]?.[day]?.[period];
        if (existing && !existing.isEmpty && !existing.isBreak) {
          allClassesFree = false;
          break;
        }
      }
      if (!allClassesFree) continue;

      // Check all option teachers free
      let allTeachersFree = true;
      for (const teacherId of allOptionTeacherIds) {
        // Check teacher not booked anywhere at this slot
        for (const [classId, dayMap] of Object.entries(grid)) {
          const existingSlot = dayMap[day]?.[period];
          if (!existingSlot || existingSlot.isEmpty || existingSlot.isBreak) continue;

          const existingTeacherIds = [];
          if (existingSlot.teacherIds) {
            existingSlot.teacherIds.forEach((id) => existingTeacherIds.push(id.toString()));
          }

          if (existingTeacherIds.includes(teacherId)) {
            allTeachersFree = false;
            break;
          }
        }
        if (!allTeachersFree) break;
      }

      if (!allTeachersFree) continue;

      // Place in all participating classes
      for (const classId of allParticipatingClassIds) {
        grid[classId][day][period] = {
          subjectId: subject._id.toString(),
          subjectName: subject.name,
          subjectCode: subject.code,
          subjectType: 'elective',
          teacherIds: allOptionTeacherIds,
          teacherNames: options.map((o) => o.teacherId?.name || ''),
          roomName: '',
          isEmpty: false,
          isBreak: false,
          isLabBlock: false,
          labBlockIndex: 0,
          isBatchSplit: false,
          isElective: true,
          electiveGroupId: subject._id.toString(),
          isLocked: false,
          notes: `Open elective: ${options.map((o) => o.optionName).join(' / ')}`,
          day,
          period,
        };
      }

      return { placed: true, day, period };
    }
  }

  return { placed: false };
};

// ── Main placement function ────────────────────────────────────────────────────
const placeAllSubjects = (data, randomize = false) => {
  const {
    classes,
    subjects,
    workingDays,
    allPeriodsPerDayMap,
    breakPeriodsPerDayMap,
    periodsPerDayMap,
  } = data;

  const unplacedSubjects = [];
  const warnings = [];

  // Initialize empty grid
  const grid = initializeGrid(
    classes,
    workingDays,
    allPeriodsPerDayMap,
    breakPeriodsPerDayMap
  );

  // ── Step 1: Place open electives first (most constrained) ─────────────────
  const openElectives = subjects.filter(
    (s) =>
      s.type === 'elective' &&
      s.electiveDetails?.electiveType === 'open'
  );

  const placedOpenElectiveIds = new Set();

  for (const subject of openElectives) {
    if (placedOpenElectiveIds.has(subject._id.toString())) continue;

    const participatingClassIds = (subject.electiveDetails?.participatingClasses || []).map(
      (c) => (c._id ? c._id.toString() : c.toString())
    );

    if (participatingClassIds.length === 0) {
      unplacedSubjects.push({
        subjectId: subject._id,
        subjectName: subject.name,
        reason: 'Open elective has no participating classes',
      });
      continue;
    }

    const result = placeOpenElective(subject, participatingClassIds, grid, data);
    if (!result.placed) {
      unplacedSubjects.push({
        subjectId: subject._id,
        subjectName: subject.name,
        reason: 'No valid slot found for open elective — all participating classes or teachers conflicted',
      });
      warnings.push(`Could not place open elective: ${subject.name}`);
    }

    placedOpenElectiveIds.add(subject._id.toString());
  }

  // ── Step 2: Place linked electives ────────────────────────────────────────
  const linkedGroups = {};
  for (const subject of subjects) {
    if (
      subject.type === 'elective' &&
      subject.electiveDetails?.electiveType === 'linked' &&
      subject.electiveDetails?.linkedGroupId
    ) {
      const gid = subject.electiveDetails.linkedGroupId;
      if (!linkedGroups[gid]) linkedGroups[gid] = [];
      linkedGroups[gid].push(subject);
    }
  }

  for (const [gid, groupSubjects] of Object.entries(linkedGroups)) {
    // All subjects in a linked group share the same slot
    // Use first subject's data for placement check
    const primarySubject = groupSubjects[0];
    const allClassIds = groupSubjects.map((s) => s.classId.toString());

    const result = placeLinkedElective(primarySubject, allClassIds, grid, data);

    if (!result.placed) {
      for (const s of groupSubjects) {
        unplacedSubjects.push({
          subjectId: s._id,
          subjectName: s.name,
          reason: `Linked elective group '${gid}' could not find a common free slot`,
        });
      }
      warnings.push(`Could not place linked elective group: ${gid}`);
    }
  }

  // ── Step 3: Place labs ─────────────────────────────────────────────────────
  const labs = subjects.filter((s) => s.type === 'lab');
  const shuffledLabs = randomize ? shuffle(labs) : labs;

  for (const subject of shuffledLabs) {
    const classId = subject.classId.toString();
    const result = placeLabSubject(subject, classId, grid, data, randomize);

    if (result.unplaced > 0) {
      unplacedSubjects.push({
        subjectId: subject._id,
        subjectName: subject.name,
        reason: 'No valid consecutive slot found for lab (may cross break or teacher conflict)',
      });
      warnings.push(`Could not place lab: ${subject.name} for class ${classId}`);
    }
  }

  // ── Step 4: Place theory subjects ─────────────────────────────────────────
  const theories = subjects.filter(
    (s) => s.type === 'theory'
  );
  const shuffledTheories = randomize ? shuffle(theories) : theories;

  for (const subject of shuffledTheories) {
    const classId = subject.classId.toString();
    const result = placeTheorySubject(subject, classId, grid, data, randomize);

    if (result.unplaced > 0) {
      unplacedSubjects.push({
        subjectId: subject._id,
        subjectName: subject.name,
        reason: `Could not place ${result.unplaced} of ${subject.weeklyHours} periods (teacher conflicts or no available slots)`,
      });
      if (result.unplaced === subject.weeklyHours) {
        warnings.push(`Could not place any periods for: ${subject.name}`);
      } else {
        warnings.push(
          `Partially placed ${subject.name}: ${subject.weeklyHours - result.unplaced}/${subject.weeklyHours} periods`
        );
      }
    }
  }

  return { grid, unplacedSubjects, warnings };
};

// ── Convert grid to classTimetables array format ──────────────────────────────
const gridToClassTimetables = (grid, classes) => {
  const classTimetables = [];

  for (const cls of classes) {
    const classId = cls._id.toString();
    const classGrid = grid[classId] || {};
    const slots = [];

    for (const [day, periodMap] of Object.entries(classGrid)) {
      for (const [periodStr, slot] of Object.entries(periodMap)) {
        slots.push({ ...slot });
      }
    }

    // Sort slots by day then period
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    slots.sort((a, b) => {
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.period - b.period;
    });

    classTimetables.push({
      classId: cls._id,
      className: `${cls.departmentId?.code || ''} S${cls.semester}${cls.section}`,
      slots,
    });
  }

  return classTimetables;
};

module.exports = {
  initializeGrid,
  placeAllSubjects,
  placeTheorySubject,
  placeLabSubject,
  placeLinkedElective,
  placeOpenElective,
  gridToClassTimetables,
  shuffle,
};