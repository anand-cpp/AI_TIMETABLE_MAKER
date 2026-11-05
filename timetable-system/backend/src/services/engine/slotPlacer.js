const { isSlotValid, isLabBlockValid, slotTeacherIds } = require('./constraintValidator');
const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * ENHANCED SLOT PLACER FOR ASET 2026-27 EVEN SEMESTER
 * Supports: P2 (2-period), P3 (3-period Mon-Thu), P6 (2×P3 blocks)
 * Co-instructor labs, Friday P3 prohibition, Lab 3/4 room constraints
 * NO AUTO-FILL - free periods remain FREE
 */

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
            isOverride: false,
            overrideType: '',
            overrideDetails: '',
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
            isOverride: false,
            overrideType: '',
            overrideDetails: '',
          };
        }
      }
    }
  }

  return grid;
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Room pools
const LAB3_ROOM = 'Lab 3';
const LAB4_ROOM = 'Lab 4';
const CLASSROOM_POOL = ['Classroom 1', 'Classroom 2', 'Classroom 3', 'Classroom 4', 'Classroom 5', 'Classroom 6', 'Classroom 7', 'Classroom 8'];

// Reserved slot constraints
const S6_ELECTIVE_RESERVED_SLOTS = [
  { day: 'Monday', period: 3 },
  { day: 'Tuesday', period: 3 },
  { day: 'Wednesday', period: 3 },
];

const S8_PROJECT_RESERVED_SLOTS = [
  { day: 'Thursday', period: 4 }, // Thu P4-P6 (3-period block)
  { day: 'Friday', period: 4 },   // Fri P4-P6 (3-period block, but Fri P4 is 50 min)
];

// Check if a slot is reserved for S6 electives
const isS6ElectiveReserved = (subject, classId, day, period) => {
  if (!subject || !classId) return false;
  const isS6 = classId.includes('S6');
  if (!isS6) return false;
  
  // Check if subject is an S6 elective
  const s6ElectiveCodes = ['PECST635', 'PBCST604', 'GAEST605', 'PECST631'];
  const isElective = s6ElectiveCodes.some(code => subject.code?.startsWith(code));
  if (!isElective) return false;
  
  // Check if this is a reserved S6 elective slot
  return S6_ELECTIVE_RESERVED_SLOTS.some(s => s.day === day && s.period === period);
};

// Check if a slot is reserved for S8 project
const isS8ProjectReserved = (subject, classId, day, period) => {
  if (!subject || !classId) return false;
  const isS8 = classId.includes('S8');
  if (!isS8) return false;
  
  // Check if subject is Project Phase II
  const isProject = subject.code === 'CSD416';
  if (!isProject) return false;
  
  // Check if this is a reserved S8 project slot
  // S8 A: Thursday P4-P6
  // S8 B: Friday P4-P6
  const section = classId.includes('_A') ? 'A' : classId.includes('_B') ? 'B' : null;
  if (section === 'A' && day === 'Thursday' && period >= 4 && period <= 6) return true;
  if (section === 'B' && day === 'Friday' && period >= 4 && period <= 6) return true;
  
  return false;
};

// Check if a slot is reserved for any special purpose
const isSlotReserved = (subject, classId, day, period) => {
  if (isS6ElectiveReserved(subject, classId, day, period)) return 'S6_ELECTIVE';
  if (isS8ProjectReserved(subject, classId, day, period)) return 'S8_PROJECT';
  return null;
};

// Check if a subject can be placed in a reserved slot
const canPlaceInReservedSlot = (subject, classId, reservationType) => {
  if (reservationType === 'S6_ELECTIVE') {
    const s6ElectiveCodes = ['PECST635', 'PBCST604', 'GAEST605', 'PECST631'];
    return s6ElectiveCodes.some(code => subject.code?.startsWith(code));
  }
  if (reservationType === 'S8_PROJECT') {
    return subject.code === 'CSD416';
  }
  return false;
};

// Check if a subject MUST be placed in a reserved slot (hard constraint)
const mustPlaceInReservedSlot = (subject, classId) => {
  if (subject.code === 'CSD416') {
    const section = classId.includes('_A') ? 'A' : classId.includes('_B') ? 'B' : null;
    if (section === 'A') return { day: 'Thursday', periods: [4, 5, 6] };
    if (section === 'B') return { day: 'Friday', periods: [4, 5, 6] };
  }
  return null;
};

const checkMathematicalSolvability = (data) => {
  const { classes, subjects, teacherMap } = data;
  let totalRequiredHours = 0;
  for (const s of subjects || []) {
    totalRequiredHours += s.weeklyHours || 0;
  }

  let totalTeacherCapacity = 0;
  for (const t of Object.values(teacherMap || {})) {
    totalTeacherCapacity += t.maxPeriodsPerWeek || 20;
  }

  const isSolvable = totalTeacherCapacity >= totalRequiredHours;
  console.log(`[SOLVABILITY CHECK] Required Subject Hours: ${totalRequiredHours} | Teacher Capacity: ${totalTeacherCapacity} | Solvable: ${isSolvable}`);

  return {
    isSolvable,
    totalRequiredHours,
    totalTeacherCapacity,
  };
};

const calculateTeacherWorkload = (grid, data) => {
  const { teacherMap } = data;
  const workload = {};

  for (const [tId, teacher] of Object.entries(teacherMap)) {
    workload[tId] = {
      name: teacher.name,
      weeklyLimit: teacher.maxPeriodsPerWeek || 20,
      dailyLimit: teacher.maxPeriodsPerDay || 4,
      days: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 },
      total: 0,
    };
  }

  for (const dayMap of Object.values(grid)) {
    for (const [day, periodMap] of Object.entries(dayMap)) {
      for (const slot of Object.values(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;

        const tIds = [];
        if (slot.teacherIds) slot.teacherIds.forEach((id) => tIds.push(id.toString()));
        if (slot.coInstructorIds) slot.coInstructorIds.forEach((id) => tIds.push(id.toString()));
        if (slot.isBatchSplit) {
          if (slot.batch1?.teacherId) tIds.push(slot.batch1.teacherId.toString());
          if (slot.batch2?.teacherId) tIds.push(slot.batch2.teacherId.toString());
        }

        for (const tId of tIds) {
          if (workload[tId]) {
            workload[tId].days[day] = (workload[tId].days[day] || 0) + 1;
            workload[tId].total++;
          }
        }
      }
    }
  }

  return workload;
};

// Check if all periods in a block are consecutive teaching periods (no breaks between)
const isConsecutiveTeachingBlock = (startPeriod, duration, timeline) => {
  const indices = [];
  for (let i = 0; i < duration; i++) {
    const pNum = startPeriod + i;
    const idx = timeline.findIndex((t) => t.periodNumber === pNum && !t.isBreak);
    if (idx === -1) return false;
    indices.push(idx);
  }
  const sorted = [...indices].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  // No break entry between first and last
  for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) {
    if (timeline[i] && timeline[i].isBreak) return false;
  }
  return true;
};

// Theory Placement - supports L (lecture) and T (tutorial) periods
// Feature A: Consecutive periods for theory subjects
// Feature B: Fixed day/period slot constraints (multiple)
const placeTheorySubject = (subject, classId, grid, data, randomize = false, options = {}) => {
  const { workingDays, periodsPerDayMap, adminOverrides = {}, timeline, settings } = data;
  const { allowOvertime = false, ignoreSameDay = false, includeSaturday = false } = options;
  const placed = [];
  
  // Determine if subject uses L/T breakdown (new) or weeklyHours (legacy)
  const usesLTBreakdown = !!(subject.L || subject.T);
  const totalRequired = usesLTBreakdown ? (subject.L || 0) + (subject.T || 0) : (subject.weeklyHours || 0);

  const alreadyPlaced = countPlacedForSubject(grid, classId, subject._id);
  const remainingLectures = Math.max(0, (subject.L || 0) - alreadyPlaced);
  const remainingTutorials = Math.max(0, (subject.T || 0) - countPlacedTutorials(grid, classId, subject._id));
  // If L and T are not set, use weeklyHours as the total remaining
  let remaining = usesLTBreakdown ? (remainingLectures + remainingTutorials) : Math.max(0, totalRequired - alreadyPlaced);

  const teacherIds = (subject.teachers || []).map((t) => (t._id ? t._id.toString() : t.toString()));
  const teacherNames = (subject.teachers || []).map((t) => t.name || '');

  const subjectOverride = (adminOverrides.subjectOverrides || []).find(
    (o) => o.subjectId === subject._id.toString() || o.subjectName === subject.name
  );

  // Feature A: Check if subject requires consecutive periods
  const requiresConsecutive = subject.requiresConsecutivePeriods && subject.consecutivePeriodsCount > 1;
  const consecutiveCount = subject.consecutivePeriodsCount || 1;

  // Feature B: Check if subject has fixed slots (multiple)
  const fixedSlots = (subject.fixedSlots || []).filter(s => s && s.day && s.period && s.isMandatory !== false);

  let daysToSearch = [...workingDays];
  if (includeSaturday && !daysToSearch.includes('Saturday')) {
    daysToSearch.push('Saturday');
  }

  // Add fixed slot days to priority search
  for (const slot of fixedSlots) {
    if (!daysToSearch.includes(slot.day)) {
      daysToSearch.unshift(slot.day);
    }
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
    // Pass the consecutive periods and fixed slot info to the slot for validation
    requiresConsecutivePeriods: requiresConsecutive,
    consecutivePeriodsCount: consecutiveCount,
    fixedSlots: fixedSlots, // Pass all fixed slots for validation
    notes: subjectOverride ? `Override: ${subjectOverride.selectedOption}` : '',
    isOverride: !!subjectOverride || includeSaturday,
    overrideType: includeSaturday ? 'SATURDAY_ENABLED' : subjectOverride?.requestType || '',
    overrideDetails: includeSaturday ? 'Saturday teaching enabled' : subjectOverride?.selectedOption || '',
  };

  // If fixed slots are specified, try to place each one first
  for (const fixedSlot of fixedSlots) {
    if (remaining <= 0) break;
    
    const fixedDay = fixedSlot.day;
    const fixedPeriod = fixedSlot.period;
    
    // Check if we can place at the fixed slot
    const canPlaceFixed = !isSlotReserved(subject, classId, fixedDay, fixedPeriod) || 
                          canPlaceInReservedSlot(subject, classId, isSlotReserved(subject, classId, fixedDay, fixedPeriod));
    
    if (canPlaceFixed && isSlotValid(classId, fixedDay, fixedPeriod, slotData, grid, data, { allowOvertime })) {
      // For consecutive periods, we need to place a block starting at the fixed period
      if (requiresConsecutive) {
        // Check if we have enough consecutive periods available starting from fixedPeriod
        let canPlaceBlock = true;
        for (let i = 0; i < consecutiveCount; i++) {
          const p = fixedPeriod + i;
          if (!periodsPerDayMap[fixedDay]?.includes(p) || 
              !isSlotValid(classId, fixedDay, p, slotData, grid, data, { allowOvertime })) {
            canPlaceBlock = false;
            break;
          }
        }
        if (canPlaceBlock) {
          // Place the consecutive block
          for (let i = 0; i < consecutiveCount && remaining > 0; i++) {
            const p = fixedPeriod + i;
            grid[classId][fixedDay][p] = { ...slotData, day: fixedDay, period: p };
            placed.push({ day: fixedDay, period: p });
            remaining--;
          }
        }
      } else {
        // Single period at fixed slot
        grid[classId][fixedDay][fixedPeriod] = { ...slotData, day: fixedDay, period: fixedPeriod };
        placed.push({ day: fixedDay, period: fixedPeriod });
        remaining--;
      }
    }
  }

  // If we still have remaining periods to place
  if (remaining > 0) {
    let candidates = [];
    for (const day of daysToSearch) {
      const periods = periodsPerDayMap[day] || [1, 2, 3, 4, 5, 6, 7];
      for (const period of periods) {
        // Skip any fixed slot that was already placed
        const isFixedSlotPlaced = fixedSlots.some(s => s.day === day && s.period === period);
        if (isFixedSlotPlaced) continue;
        candidates.push({ day, period });
      }
    }

    if (randomize) candidates = shuffle(candidates);

    if (requiresConsecutive) {
      // Find consecutive blocks of required size
      for (const { day, period } of candidates) {
        if (remaining <= 0) break;

        if (!ignoreSameDay) {
          const alreadyOnDay = placed.some((p) => p.day === day);
          // For legacy subjects (weeklyHours only), allow multiple periods per day
          // For L/T breakdown subjects, limit to one per day until all periods placed
          const threshold = usesLTBreakdown ? totalRequired : 0;
          if (alreadyOnDay && remaining < threshold) continue;
        }

        // Check if we can place a consecutive block starting at this period
        let canPlaceBlock = true;
        for (let i = 0; i < consecutiveCount; i++) {
          const p = period + i;
          if (!periodsPerDayMap[day]?.includes(p)) {
            canPlaceBlock = false;
            break;
          }
          // Check if slot is available
          const existingSlot = grid[classId]?.[day]?.[p];
          if (existingSlot && !existingSlot.isEmpty && !existingSlot.isBreak) {
            canPlaceBlock = false;
            break;
          }
          // Check teacher availability
          if (!isSlotValid(classId, day, p, slotData, grid, data, { allowOvertime })) {
            canPlaceBlock = false;
            break;
          }
          // Check reserved slots
          const reservation = isSlotReserved(subject, classId, day, p);
          if (reservation && !canPlaceInReservedSlot(subject, classId, reservation)) {
            canPlaceBlock = false;
            break;
          }
          if (!reservation && (isS6ElectiveReserved(subject, classId, day, p) || isS8ProjectReserved(subject, classId, day, p))) {
            canPlaceBlock = false;
            break;
          }
        }

        if (canPlaceBlock) {
          // Place the consecutive block
          for (let i = 0; i < consecutiveCount && remaining > 0; i++) {
            const p = period + i;
            grid[classId][day][p] = { ...slotData, day, period: p };
            placed.push({ day, period: p });
            remaining--;
          }
        }
      }
    } else {
      // Normal placement for non-consecutive subjects
      for (const { day, period } of candidates) {
        if (remaining <= 0) break;

        if (!ignoreSameDay) {
          const alreadyOnDay = placed.some((p) => p.day === day);
          // For legacy subjects (weeklyHours only), allow multiple periods per day
          // For L/T breakdown subjects, limit to one per day until all periods placed
          const threshold = usesLTBreakdown ? totalRequired : 0;
          if (alreadyOnDay && remaining < threshold) continue;
        }

        // Check reserved slot constraints
        const reservation = isSlotReserved(subject, classId, day, period);
        if (reservation) {
          if (!canPlaceInReservedSlot(subject, classId, reservation)) {
            continue;
          }
        } else {
          if (isS6ElectiveReserved(subject, classId, day, period) || isS8ProjectReserved(subject, classId, day, period)) {
            continue;
          }
        }

        if (!isSlotValid(classId, day, period, slotData, grid, data, { allowOvertime })) continue;

        grid[classId][day][period] = { ...slotData, day, period };
        placed.push({ day, period });
        remaining--;
      }
    }
  }

  // Escalation: swap placement
  if (remaining > 0) {
    for (let i = 0; i < remaining; i++) {
      if (trySwapPlacement(subject, classId, grid, data, slotData)) {
        remaining--;
      }
    }
  }

  // Escalation: cascade reschedule
  if (remaining > 0) {
    for (let i = 0; i < remaining; i++) {
      if (tryCascadeReschedule(subject, classId, grid, data, slotData, 1)) {
        remaining--;
      }
    }
  }

  return { placed, unplaced: remaining };
};

const countPlacedTutorials = (grid, classId, subjectId) => {
  const sid = subjectId.toString();
  let count = 0;
  const dayMap = grid[classId] || {};
  for (const periodMap of Object.values(dayMap)) {
    for (const slot of Object.values(periodMap)) {
      if (!slot || slot.isEmpty || slot.isBreak) continue;
      if (slot.subjectId && slot.subjectId.toString() === sid && slot.subjectType === 'theory') count++;
    }
  }
  return count;
};

// Lab Placement - supports P2, P3 (Mon-Thu only), P6 (2×P3 blocks)
const placeLabSubject = (subject, classId, grid, data, randomize = false, options = {}) => {
  const { workingDays, periodsPerDayMap, settings, timeline, fridayTimeline, adminOverrides = {} } = data;
  const { allowAltRoom = true, allowSplit = false, allowOvertime = false, includeSaturday = false } = options;

  const P = subject.P || subject.labDetails?.duration || 0;
  if (P === 0) {
    return { placed: [], unplaced: 0 };
  }

  // If already placed, don't place again
  if (countPlacedForSubject(grid, classId, subject._id) >= P) {
    return { placed: [], unplaced: 0 };
  }

  // Get all teachers (primary + co-instructors)
  const teacherIds = (subject.teachers || []).map((t) => (t._id ? t._id.toString() : t.toString()));
  const teacherNames = (subject.teachers || []).map((t) => t.name || '');
  const coInstructorIds = (subject.coInstructors || []).map((t) => (t._id ? t._id.toString() : t.toString()));
  const coInstructorNames = (subject.coInstructors || []).map((t) => t.name || '');
  const allTeacherIds = [...teacherIds, ...coInstructorIds];
  const allTeacherNames = [...teacherNames, ...coInstructorNames];

  // Determine lab room based on semester
  const classSem = subject.classId?.semester || 0;
  let preferredRoom = '';
  if (classSem === 2) {
    preferredRoom = LAB3_ROOM; // S2 uses Lab 3
  } else if (classSem >= 4) {
    preferredRoom = LAB4_ROOM; // S4/S6/S8 use Lab 4
  } else {
    preferredRoom = subject.labRoom || subject.labDetails?.roomName || LAB4_ROOM;
  }

  const roomOverride = (adminOverrides.roomOverrides || {})[subject._id.toString()];
  if (roomOverride) preferredRoom = roomOverride;

  const roomsToTry = [preferredRoom];
  if (allowAltRoom) {
    if (preferredRoom === LAB3_ROOM) {
      roomsToTry.push(LAB4_ROOM);
    } else if (preferredRoom === LAB4_ROOM) {
      roomsToTry.push(LAB3_ROOM);
    }
  }

  const subjectOverride = (adminOverrides.subjectOverrides || []).find(
    (o) => o.subjectId === subject._id.toString() || o.subjectName === subject.name
  );

  let daysToSearch = [...workingDays];
  if (includeSaturday && !daysToSearch.includes('Saturday')) {
    daysToSearch.push('Saturday');
  }

  // For P6 (12 hours = 2×P3 blocks), we need to place two separate 3-period blocks
  const isP6 = P >= 6;
  const blockDuration = isP6 ? 3 : P; // P2=2, P3=3, P6=3 per block
  const numBlocks = isP6 ? 2 : 1;

  let allPlaced = true;
  let totalUnplaced = 0;
  const allPlacedBlocks = [];

  for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
    let blockPlaced = false;

    // Check if this subject has mandatory reserved slots (only for first block of Project Phase II)
    const mandatoryReservation = blockIdx === 0 ? mustPlaceInReservedSlot(subject, classId) : null;
    let allowedDays = daysToSearch;
    let allowedStartPeriods = null;
    
    if (mandatoryReservation) {
      // For Project Phase II first block, restrict to the reserved day
      allowedDays = [mandatoryReservation.day];
      allowedStartPeriods = mandatoryReservation.periods[0]; // Start at first period of block (4)
    } else if (subject.code === 'CSD416' && blockIdx > 0) {
      // For Project Phase II second block, avoid the other section's reserved day
      const section = classId.includes('_A') ? 'A' : 'B';
      if (section === 'A') {
        allowedDays = daysToSearch.filter(d => d !== 'Friday'); // S8 B uses Friday
      } else {
        allowedDays = daysToSearch.filter(d => d !== 'Thursday'); // S8 A uses Thursday
      }
    }

    for (const roomCandidate of roomsToTry) {
      let candidates = [];
      
      for (const day of allowedDays) {
        // FRIDAY P3 PROHIBITION: No 3-period labs on Friday (except S8 Project Phase II)
        const isS8Project = subject.code === 'CSD416';
        if (day === 'Friday' && blockDuration >= 3 && !isS8Project) {
          continue;
        }
        
        const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
        const periods = periodsPerDayMap[day] || [];

        const startPeriodsToCheck = allowedStartPeriods ? [allowedStartPeriods] : periods;
        
        for (const startPeriod of startPeriodsToCheck) {
          // Check if block fits without crossing break
          if (!crossesBreak(startPeriod, blockDuration, tl)) {
            // Check if all periods exist in timeline
            let allExist = true;
            for (let p = startPeriod; p < startPeriod + blockDuration; p++) {
              if (!periods.includes(p)) {
                allExist = false;
                break;
              }
            }
            if (allExist) {
              candidates.push({ day, startPeriod });
            }
          }
        }
      }

      if (randomize) candidates = shuffle(candidates);

      const baseSlotData = {
        subjectId: subject._id.toString(),
        subjectName: subject.name,
        subjectCode: subject.code,
        subjectType: 'lab',
        teacherIds: allTeacherIds,
        teacherNames: allTeacherNames,
        roomName: roomCandidate,
        isEmpty: false,
        isBreak: false,
        isLabBlock: true,
        isBatchSplit: false,
        isElective: false,
        electiveGroupId: '',
        isLocked: false,
        notes: subjectOverride ? `Override: ${subjectOverride.selectedOption}` : '',
        isOverride: !!subjectOverride || roomCandidate !== preferredRoom || includeSaturday,
        overrideType: roomCandidate !== preferredRoom ? 'LAB_ROOM_CONFLICT' : includeSaturday ? 'SATURDAY_ENABLED' : subjectOverride?.requestType || '',
        overrideDetails: roomCandidate !== preferredRoom ? `Moved to alternative room ${roomCandidate}` : includeSaturday ? 'Scheduled on Saturday' : subjectOverride?.selectedOption || '',
        coInstructorIds: coInstructorIds,
      };

      for (const { day, startPeriod } of candidates) {
        // Check reserved slot constraints for lab blocks (especially S8 Project Phase II)
        if (subject.code === 'CSD416') {
          // Project Phase II must be placed in Thu/Fri reserved slots
          const isReservedProjectSlot = (day === 'Thursday' || day === 'Friday') && startPeriod === 4 && blockDuration === 3;
          if (!isReservedProjectSlot) {
            continue; // Only allow Project Phase II in Thu/Fri P4-P6
          }
        }

        if (!isLabBlockValid(classId, day, startPeriod, blockDuration, baseSlotData, grid, data, { allowOvertime })) {
          continue;
        }

        // Place the block
        for (let i = 0; i < blockDuration; i++) {
          const period = startPeriod + i;
          grid[classId][day][period] = {
            ...baseSlotData,
            day,
            period,
            labBlockIndex: i,
            labBlockNumber: blockIdx,
          };
        }

        allPlacedBlocks.push({ day, startPeriod, duration: blockDuration, blockIndex: blockIdx });
        blockPlaced = true;
        break;
      }

      if (blockPlaced) break;
    }

    if (!blockPlaced) {
      // Try with overtime
      if (allowOvertime) {
        for (const roomCandidate of roomsToTry) {
          let candidates = [];
          // Respect mandatory reservation even in overtime (only for first block)
          const mandatoryReservation = blockIdx === 0 ? mustPlaceInReservedSlot(subject, classId) : null;
          let overtimeDays = daysToSearch;
          let overtimeStartPeriods = null;
          
          if (mandatoryReservation) {
            overtimeDays = [mandatoryReservation.day];
            overtimeStartPeriods = mandatoryReservation.periods[0];
          }
          
          for (const day of overtimeDays) {
            const isS8Project = subject.code === 'CSD416';
            if (day === 'Friday' && blockDuration >= 3 && !isS8Project) continue;
            const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
            const periods = periodsPerDayMap[day] || [];
            
            const startPeriodsToCheck = overtimeStartPeriods ? [overtimeStartPeriods] : periods;
            
            for (const startPeriod of startPeriodsToCheck) {
              if (!crossesBreak(startPeriod, blockDuration, tl)) {
                let allExist = true;
                for (let p = startPeriod; p < startPeriod + blockDuration; p++) {
                  if (!periods.includes(p)) {
                    allExist = false;
                    break;
                  }
                }
                if (allExist) candidates.push({ day, startPeriod });
              }
            }
          }
          if (randomize) candidates = shuffle(candidates);
          
          // Recreate baseSlotData for overtime section
          const overtimeBaseSlotData = {
            subjectId: subject._id.toString(),
            subjectName: subject.name,
            subjectCode: subject.code,
            subjectType: 'lab',
            teacherIds: allTeacherIds,
            teacherNames: allTeacherNames,
            roomName: roomCandidate,
            isEmpty: false,
            isBreak: false,
            isLabBlock: true,
            isBatchSplit: false,
            isElective: false,
            electiveGroupId: '',
            isLocked: false,
            notes: subjectOverride ? `Override: ${subjectOverride.selectedOption}` : '',
            isOverride: true,
            overrideType: 'TEACHER_OVERTIME',
            overrideDetails: 'Teacher daily limit exceeded for lab placement',
            coInstructorIds: coInstructorIds,
          };
          
          for (const { day, startPeriod } of candidates) {
            // Check reserved slot constraints for lab blocks (especially S8 Project Phase II)
            if (subject.code === 'CSD416') {
              const isReservedProjectSlot = (day === 'Thursday' || day === 'Friday') && startPeriod === 4 && blockDuration === 3;
              if (!isReservedProjectSlot) {
                continue; // Only allow Project Phase II in Thu/Fri P4-P6
              }
            }

            if (!isLabBlockValid(classId, day, startPeriod, blockDuration, overtimeBaseSlotData, grid, data, { allowOvertime: true })) continue;
            
            for (let i = 0; i < blockDuration; i++) {
              const period = startPeriod + i;
              grid[classId][day][period] = {
                ...overtimeBaseSlotData,
                day,
                period,
                labBlockIndex: i,
                labBlockNumber: blockIdx,
              };
            }
            allPlacedBlocks.push({ day, startPeriod, duration: blockDuration, blockIndex: blockIdx });
            blockPlaced = true;
            break;
          }
          if (blockPlaced) break;
        }
      }
    }

    if (!blockPlaced) {
      allPlaced = false;
      totalUnplaced++;
    }
  }

  if (!allPlaced) {
    return { placed: allPlacedBlocks, unplaced: totalUnplaced };
  }

  return { placed: allPlacedBlocks, unplaced: 0 };
};

// Count periods already allocated to a subject for a class
const countPlacedForSubject = (grid, classId, subjectId) => {
  const sid = subjectId.toString();
  let count = 0;
  const dayMap = grid[classId] || {};
  for (const periodMap of Object.values(dayMap)) {
    for (const slot of Object.values(periodMap)) {
      if (!slot || slot.isEmpty || slot.isBreak) continue;
      if (slot.subjectId && slot.subjectId.toString() === sid) count++;
    }
  }
  return count;
};

// Level 6: SWAP Displacement Helper
const trySwapPlacement = (subject, classId, grid, data, slotData) => {
  const { workingDays, periodsPerDayMap } = data;

  for (const day of workingDays) {
    for (const period of periodsPerDayMap[day] || []) {
      const existing = grid[classId]?.[day]?.[period];
      if (existing && !existing.isBreak && existing.subjectType === 'theory' && !existing.isLocked) {
        grid[classId][day][period] = { day, period, isBreak: false, isEmpty: true, subjectType: 'empty' };

        if (isSlotValid(classId, day, period, slotData, grid, data, { allowOvertime: true })) {
          grid[classId][day][period] = { ...slotData, day, period, isOverride: true, overrideType: 'SWAP_DISPLACEMENT', overrideDetails: `Swapped with ${existing.subjectName}` };

          let rePlaced = false;
          for (const d2 of workingDays) {
            for (const p2 of periodsPerDayMap[d2] || []) {
              if (isSlotValid(classId, d2, p2, existing, grid, data, { allowOvertime: true })) {
                grid[classId][d2][p2] = { ...existing, day: d2, period: p2 };
                rePlaced = true;
                break;
              }
            }
            if (rePlaced) break;
          }

          if (rePlaced) return true;
          grid[classId][day][period] = existing;
        } else {
          grid[classId][day][period] = existing;
        }
      }
    }
  }
  return false;
};

// Level 7: CASCADE Reschedule Helper (Recursive 3-levels deep)
const tryCascadeReschedule = (subject, classId, grid, data, slotData, depth = 1) => {
  if (depth > 3) return false;
  const { workingDays, periodsPerDayMap } = data;

  const teacherId = slotData.teacherIds?.[0];
  if (!teacherId) return false;

  for (const day of workingDays) {
    for (const period of periodsPerDayMap[day] || []) {
      for (const [otherClassId, dayMap] of Object.entries(grid)) {
        if (otherClassId === classId) continue;
        const blockingSlot = dayMap[day]?.[period];
        if (!blockingSlot || blockingSlot.isEmpty || blockingSlot.isBreak || blockingSlot.isLocked) continue;
        if (blockingSlot.isLabBlock || blockingSlot.isElective || blockingSlot.isBatchSplit) continue;
        if (blockingSlot.subjectType && blockingSlot.subjectType !== 'theory') continue;

        if (blockingSlot.teacherIds?.includes(teacherId)) {
          for (const d2 of workingDays) {
            for (const p2 of periodsPerDayMap[d2] || []) {
              if (isSlotValid(otherClassId, d2, p2, blockingSlot, grid, data, { allowOvertime: true })) {
                grid[otherClassId][d2][p2] = { ...blockingSlot, day: d2, period: p2, isOverride: true, overrideType: 'CASCADE_RESCHEDULE', overrideDetails: `Moved to free up ${slotData.teacherNames[0] || 'teacher'}` };
                grid[otherClassId][day][period] = { day, period, isBreak: false, isEmpty: true, subjectType: 'empty' };

                if (isSlotValid(classId, day, period, slotData, grid, data, { allowOvertime: true })) {
                  grid[classId][day][period] = { ...slotData, day, period };
                  return true;
                }

                grid[otherClassId][day][period] = blockingSlot;
                grid[otherClassId][d2][p2] = { day: d2, period: p2, isBreak: false, isEmpty: true, subjectType: 'empty' };
              }
            }
          }
        }
      }
    }
  }

  return false;
};

// Linked Elective Placement - supports both legacy linkedGroupId and new ElectiveGroup model
const placeLinkedElective = (subject, allClassIds, grid, data, options = {}) => {
  const { workingDays, periodsPerDayMap, electiveGroups = [] } = data;
  const { allowOvertime = false } = options;

  // Try to find the elective group - first by electiveGroupId, then by legacy linkedGroupId
  const electiveGroupId = subject.electiveDetails?.electiveGroupId?._id 
    ? subject.electiveDetails.electiveGroupId._id.toString()
    : (subject.electiveDetails?.electiveGroupId?.toString() || null);
  const legacyGroupId = subject.electiveDetails?.linkedGroupId;
  
  // Find the elective group
  let electiveGroup = null;
  if (electiveGroupId) {
    electiveGroup = electiveGroups.find(g => g._id.toString() === electiveGroupId);
  } else if (legacyGroupId) {
    electiveGroup = electiveGroups.find(g => 
      g.options.some(opt => opt.subjectId?._id?.toString() === subject._id.toString())
    );
  }
  
  if (!electiveGroup) {
    // Fallback: try to find by subject's linkedGroupId
    const groupId = legacyGroupId || subject._id.toString();
    
    const teacherIds = (subject.teachers || []).map((t) => (t._id ? t._id.toString() : t.toString()));
    const teacherNames = (subject.teachers || []).map((t) => t.name || '');

    if (teacherIds.length === 0) {
      return { placed: false };
    }

    const ownSubjectFor = (classId) => {
      const list = data.subjectsByClass?.[classId] || [];
      const match = list.find(
        (s) => s.type === 'elective' && s.electiveDetails?.linkedGroupId === groupId
      );
      return match || subject;
    };

    const slotDataFor = (classId) => {
      const own = ownSubjectFor(classId);
      return {
        subjectId: own._id.toString(),
        subjectName: own.name,
        subjectCode: own.code,
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
        electiveGroupId: groupId,
        isLocked: false,
        notes: '',
      };
    };

    for (const day of workingDays) {
      for (const period of periodsPerDayMap[day] || []) {
        let allFree = true;
        for (const classId of allClassIds) {
          if (!isSlotValid(classId, day, period, slotDataFor(classId), grid, data, { allowOvertime })) {
            allFree = false;
            break;
          }
        }

        if (allFree) {
          for (const classId of allClassIds) {
            grid[classId][day][period] = { ...slotDataFor(classId), day, period };
          }
          return { placed: true, day, period };
        }
      }
    }

    return { placed: false };
  }

  // Use the elective group for placement
  // All options in the group must be placed at the same time slot
  // We need to check teacher availability for ALL options in the group
  
  const groupTeacherIds = electiveGroup.options.flatMap(opt => 
    (opt.teacherIds || []).map(t => t._id ? t._id.toString() : t.toString())
  );
  const groupTeacherNames = electiveGroup.options.flatMap(opt => 
    (opt.teacherIds || []).map(t => t.name || '')
  );

  // Build slot data for each class and each option
  const slotDataForOption = (classId, option) => {
    const optionTeacherIds = (option.teacherIds || []).map(t => t._id ? t._id.toString() : t.toString());
    const optionTeacherNames = (option.teacherIds || []).map(t => t.name || '');
    const optionSubjectId = option.subjectId?._id ? option.subjectId._id.toString() : 
      (option.subjectId?.toString() || subject._id.toString());
    const optionSubjectName = option.subjectId?.name || subject.name;
    const optionSubjectCode = option.subjectId?.code || subject.code;

    return {
      subjectId: optionSubjectId,
      subjectName: optionSubjectName,
      subjectCode: optionSubjectCode,
      subjectType: 'elective',
      teacherIds: optionTeacherIds,
      teacherNames: optionTeacherNames,
      roomName: '',
      isEmpty: false,
      isBreak: false,
      isLabBlock: false,
      labBlockIndex: 0,
      isBatchSplit: false,
      isElective: true,
      electiveGroupId: electiveGroup._id.toString(),
      isLocked: false,
      notes: '',
    };
  };

  // Check if there's a fixed slot for the group
  const fixedSlot = electiveGroup.fixedSlot;
  const hasFixedSlot = fixedSlot && fixedSlot.day && fixedSlot.period && fixedSlot.isMandatory;

  const daysToSearch = hasFixedSlot ? [fixedSlot.day, ...workingDays.filter(d => d !== fixedSlot.day)] : workingDays;
  const periodsToSearch = hasFixedSlot ? [fixedSlot.period] : null;

  for (const day of daysToSearch) {
    const periodList = periodsToSearch || (periodsPerDayMap[day] || []);
    
    for (const period of periodList) {
      let allClassesFree = true;
      let allTeachersFree = true;

      // Check each class in the group
      for (const classId of allClassIds) {
        // For each class, check if the slot is free
        const existing = grid[classId]?.[day]?.[period];
        if (existing && !existing.isEmpty && !existing.isBreak) {
          allClassesFree = false;
          break;
        }

        // Check if all teachers for this class's option are available
        // Find the option for this class
        const classSection = data.classMap?.[classId]?.section;
        const classOption = electiveGroup.options.find(opt => 
          opt.subjectId?._id?.toString() === subject._id.toString() ||
          (opt.subjectId?.toString && opt.subjectId.toString() === subject._id.toString())
        ) || electiveGroup.options[0]; // fallback

        const optionTeacherIds = (classOption.teacherIds || []).map(t => t._id ? t._id.toString() : t.toString());
        
        for (const teacherId of optionTeacherIds) {
          // Check teacher unavailability
          const teacher = data.teacherMap?.[teacherId];
          if (teacher && teacher.unavailability) {
            const isUnavailable = teacher.unavailability.some(u => u.day === day && u.period === period);
            if (isUnavailable) {
              allTeachersFree = false;
              break;
            }
          }
          
          // Check teacher already scheduled
          for (const [clsId, dayMap] of Object.entries(grid)) {
            const existingSlot = dayMap[day]?.[period];
            if (!existingSlot || existingSlot.isEmpty || existingSlot.isBreak) continue;
            
            const existingTeacherIds = [];
            if (existingSlot.teacherIds) {
              existingSlot.teacherIds.forEach(id => existingTeacherIds.push(id.toString()));
            }
            if (existingSlot.coInstructorIds) {
              existingSlot.coInstructorIds.forEach(id => existingTeacherIds.push(id.toString()));
            }
            if (existingTeacherIds.includes(teacherId)) {
              allTeachersFree = false;
              break;
            }
          }
          
          if (!allTeachersFree) break;
        }
        
        if (!allClassesFree || !allTeachersFree) break;
      }

      if (allClassesFree && allTeachersFree) {
        // Place all options for all classes
        for (const classId of allClassIds) {
          // Find the right option for this class
          const classOption = electiveGroup.options[0]; // All classes share the same options
          
          grid[classId][day][period] = { 
            ...slotDataForOption(classId, classOption), 
            day, 
            period 
          };
        }
        return { placed: true, day, period };
      }
    }
  }

  return { placed: false };
};

// Open Elective Placement
const placeOpenElective = (subject, allParticipatingClassIds, grid, data, options = {}) => {
  const { workingDays, periodsPerDayMap } = data;
  const openOptions = subject.electiveDetails?.openElectiveOptions || [];

  const allOptionTeacherIds = openOptions
    .map((opt) => (opt.teacherId?._id ? opt.teacherId._id.toString() : opt.teacherId?.toString() || null))
    .filter(Boolean);

  const preferredDay = 'Thursday';
  const preferredPeriod = 4;

  const dayList = [preferredDay, ...workingDays.filter((d) => d !== preferredDay)];

  for (const day of dayList) {
    const periodList = day === preferredDay ? [preferredPeriod, ...periodsPerDayMap[day].filter((p) => p !== preferredPeriod)] : (periodsPerDayMap[day] || []);

    for (const period of periodList) {
      let allClassesFree = true;
      for (const classId of allParticipatingClassIds) {
        const existing = grid[classId]?.[day]?.[period];
        if (existing && !existing.isEmpty && !existing.isBreak) {
          allClassesFree = false;
          break;
        }
      }
      if (!allClassesFree) continue;

      let allTeachersFree = true;
      for (const teacherId of allOptionTeacherIds) {
        for (const [classId, dayMap] of Object.entries(grid)) {
          const existingSlot = dayMap[day]?.[period];
          if (!existingSlot || existingSlot.isEmpty || existingSlot.isBreak) continue;

          const existingTeacherIds = [];
          if (existingSlot.teacherIds) {
            existingSlot.teacherIds.forEach((id) => existingTeacherIds.push(id.toString()));
          }
          if (existingSlot.coInstructorIds) {
            existingSlot.coInstructorIds.forEach((id) => existingTeacherIds.push(id.toString()));
          }
          if (existingTeacherIds.includes(teacherId)) {
            allTeachersFree = false;
            break;
          }
        }
        if (!allTeachersFree) break;
      }

      if (!allTeachersFree) continue;

      for (const classId of allParticipatingClassIds) {
        grid[classId][day][period] = {
          subjectId: subject._id.toString(),
          subjectName: subject.name,
          subjectCode: subject.code,
          subjectType: 'elective',
          teacherIds: allOptionTeacherIds,
          teacherNames: openOptions.map((o) => o.teacherId?.name || ''),
          roomName: '',
          isEmpty: false,
          isBreak: false,
          isLabBlock: false,
          labBlockIndex: 0,
          isBatchSplit: false,
          isElective: true,
          electiveGroupId: subject._id.toString(),
          isLocked: false,
          notes: `Open elective: ${openOptions.map((o) => o.optionName).join(' / ')}`,
          day,
          period,
        };
      }

      return { placed: true, day, period };
    }
  }

  return { placed: false };
};

// Permission Request Generator
const generatePermissionRequest = (subject, classObj, blockerType, data, grid) => {
  const teacher = (subject.teachers && subject.teachers[0]) || { name: 'Assigned Teacher', maxPeriodsPerDay: 4, maxPeriodsPerWeek: 20 };
  const teacherName = teacher.name || 'Assigned Teacher';
  const teacherId = teacher._id ? teacher._id.toString() : teacher.toString();

  const teacherWorkload = calculateTeacherWorkload(grid, data);
  const currentLoad = teacherWorkload[teacherId]
    ? {
        Mon: `${teacherWorkload[teacherId].days.Monday || 0}/${teacher.maxPeriodsPerDay || 4}`,
        Tue: `${teacherWorkload[teacherId].days.Tuesday || 0}/${teacher.maxPeriodsPerDay || 4}`,
        Wed: `${teacherWorkload[teacherId].days.Wednesday || 0}/${teacher.maxPeriodsPerDay || 4}`,
        Thu: `${teacherWorkload[teacherId].days.Thursday || 0}/${teacher.maxPeriodsPerDay || 4}`,
        Fri: `${teacherWorkload[teacherId].days.Friday || 0}/${teacher.maxPeriodsPerDay || 4}`,
        Sat: `—`,
      }
    : { Mon: '4/4', Tue: '4/4', Wed: '3/4', Thu: '4/4', Fri: '3/4', Sat: '—' };

  if (blockerType === 'TEACHER_OVERTIME') {
    return {
      id: `req-${subject._id}-${Date.now()}`,
      requestType: 'TEACHER_OVERTIME',
      teacherId,
      teacherName,
      subjectId: subject._id.toString(),
      subjectName: subject.name,
      classId: classObj._id.toString(),
      className: classObj.name,
      issueDescription: `${teacherName} is assigned to teach ${subject.name} in multiple classes (total ${teacherWorkload[teacherId]?.total || 24} hrs/week). Their weekly limit is ${teacher.maxPeriodsPerWeek || 22} hrs. To place all required periods for ${classObj.name}, we need extra teaching periods this week.`,
      currentLoad,
      options: [
        { id: 'opt-1', label: 'Enable Saturday for this class (P1-P3 available) ⭐', isRecommended: true, impact: 'Schedules subject on Saturday morning' },
        { id: 'opt-2', label: 'Allow up to 5 periods on Wed & Fri [+2 hrs]', impact: 'Relaxes daily limit from 4 to 5 on Wed and Fri' },
        { id: 'opt-3', label: 'Reassign 1 section to co-faculty with capacity', impact: 'Reassigns subject to co-teacher' },
        { id: 'opt-4', label: 'Split subject: 2 periods primary + 2 periods co-teacher', impact: 'Splits workload across two faculty members' },
      ],
      recommendedOptionId: 'opt-1',
    };
  }

  if (blockerType === 'LAB_ROOM_CONFLICT') {
    const preferredRoom = subject.labRoom || subject.labDetails?.roomName || 'Lab 4';
    return {
      id: `req-${subject._id}-${Date.now()}`,
      requestType: 'LAB_ROOM_CONFLICT',
      teacherId,
      teacherName,
      subjectId: subject._id.toString(),
      subjectName: subject.name,
      classId: classObj._id.toString(),
      className: classObj.name,
      issueDescription: `Preferred lab room '${preferredRoom}' is fully booked at available consecutive slots. Alternative physical lab room required to place ${subject.name} for ${classObj.name}.`,
      currentLoad,
      options: [
        { id: 'opt-1', label: `Use ${preferredRoom === 'Lab 3' ? 'Lab 4' : 'Lab 3'} instead ⭐`, isRecommended: true, impact: `Assigns lab to ${preferredRoom === 'Lab 3' ? 'Lab 4' : 'Lab 3'}` },
        { id: 'opt-2', label: 'Enable Saturday morning for lab block', impact: 'Schedules lab on Saturday' },
        { id: 'opt-3', label: 'Split lab: 2 periods Mon P3-4 + 1 period Wed P5', impact: 'Splits lab block into 2+1' },
        { id: 'opt-4', label: 'Use classroom as adapted lab space', impact: 'Adapts general classroom' },
      ],
      recommendedOptionId: 'opt-1',
    };
  }

  return {
    id: `req-${subject._id}-${Date.now()}`,
    requestType: 'GENERAL_OVERRIDE',
    teacherId,
    teacherName,
    subjectId: subject._id.toString(),
    subjectName: subject.name,
    classId: classObj._id.toString(),
    className: classObj.name,
    issueDescription: `Could not fit ${subject.name} for ${classObj.name} due to tight constraints. Admin decision required.`,
    currentLoad,
    options: [
      { id: 'opt-1', label: 'Grant 1-period daily limit waiver for teacher ⭐', isRecommended: true, impact: 'Places subject with relaxed daily limit' },
      { id: 'opt-2', label: 'Enable Saturday morning slot (P1-P3)', impact: 'Places subject on Saturday' },
      { id: 'opt-3', label: 'Reassign subject to co-teacher', impact: 'Reassigns teacher' },
    ],
    recommendedOptionId: 'opt-1',
  };
};

// Post-Placement Auto-Fill Phase - DISABLED for ASET 2026-27
// Free periods must remain FREE
const postPlacementFillPhase = (grid, data) => {
  // DISABLED - No auto-fill for this semester
  return {
    tutorials: 0,
    pe: 0,
    mentoring: 0,
    skillDev: 0,
    placement: 0,
    deptActivity: 0,
    selfStudy: 0,
    totalFilled: 0,
  };
};

// Main Placement Strategy
const placeAllSubjects = (data, randomize = false, options = {}) => {
  const { classes, subjects, workingDays, allPeriodsPerDayMap, breakPeriodsPerDayMap, classMap } = data;
  const adminOverrides = options.adminOverrides || {};

  checkMathematicalSolvability(data);

  const unplacedSubjects = [];
  const warnings = [];
  const permissionRequests = [];

  const grid = initializeGrid(classes, workingDays, allPeriodsPerDayMap, breakPeriodsPerDayMap);

  const recordUnplaced = (subject, classId) => {
    const placed = countPlacedForSubject(grid, classId, subject._id);
    const expected = subject.weeklyHours || 0;
    if (placed >= expected) return false;
    const classObj = classMap[classId];
    unplacedSubjects.push({
      classId: String(classId),
      className: classObj?.name || String(classId),
      subjectId: subject._id.toString(),
      subjectName: subject.name,
      subjectType: subject.type,
      placed,
      expected,
      missing: expected - placed,
    });
    return true;
  };

  // Step 1: Open Electives
  const openElectives = subjects.filter((s) => s.type === 'elective' && s.electiveDetails?.electiveType === 'open');
  const placedOpenElectiveIds = new Set();

  for (const subject of openElectives) {
    if (placedOpenElectiveIds.has(subject._id.toString())) continue;
    const participatingClassIds = (subject.electiveDetails?.participatingClasses || []).map((c) => (c._id ? c._id.toString() : c.toString()));

    if (participatingClassIds.length === 0) continue;

    let res = placeOpenElective(subject, participatingClassIds, grid, data, { allowOvertime: true });
    if (!res.placed) {
      const classObj = classMap[participatingClassIds[0]] || { _id: participatingClassIds[0], name: 'Open Elective Class' };
      permissionRequests.push(generatePermissionRequest(subject, classObj, 'TEACHER_OVERTIME', data, grid));
      for (const cid of participatingClassIds) recordUnplaced(subject, cid);
    }
    placedOpenElectiveIds.add(subject._id.toString());
  }

  // Step 2: Linked Electives
  const linkedGroups = {};
  for (const subject of subjects) {
    if (subject.type === 'elective' && subject.electiveDetails?.electiveType === 'linked' && subject.electiveDetails?.linkedGroupId) {
      const gid = subject.electiveDetails.linkedGroupId;
      if (!linkedGroups[gid]) linkedGroups[gid] = [];
      linkedGroups[gid].push(subject);
    }
  }

  for (const [gid, groupSubjects] of Object.entries(linkedGroups)) {
    const primarySubject = groupSubjects[0];
    const allClassIds = groupSubjects.map((s) => s.classId.toString());

    let res = placeLinkedElective(primarySubject, allClassIds, grid, data, { allowOvertime: false });
    if (!res.placed) {
      res = placeLinkedElective(primarySubject, allClassIds, grid, data, { allowOvertime: true });
    }
    if (!res.placed) {
      const classObj = classMap[allClassIds[0]] || { _id: allClassIds[0], name: 'Linked Elective Class' };
      permissionRequests.push(generatePermissionRequest(primarySubject, classObj, 'GENERAL_OVERRIDE', data, grid));
      for (const cid of allClassIds) recordUnplaced(primarySubject, cid);
    }
  }

  // Step 3: Labs (P2, P3, P6) - Escalation Levels
  const labs = subjects.filter((s) => s.type === 'lab');
  const shuffledLabs = randomize ? shuffle(labs) : labs;

  for (const subject of shuffledLabs) {
    const classId = subject.classId.toString();
    const classObj = classMap[classId] || { _id: classId, name: `Class ${classId}` };

    let res = placeLabSubject(subject, classId, grid, data, randomize, { allowAltRoom: false, allowSplit: false });

    if (res.unplaced > 0) {
      res = placeLabSubject(subject, classId, grid, data, randomize, { allowAltRoom: true, allowSplit: false });
    }
    if (res.unplaced > 0) {
      res = placeLabSubject(subject, classId, grid, data, randomize, { allowAltRoom: true, allowSplit: false });
    }
    if (res.unplaced > 0) {
      res = placeLabSubject(subject, classId, grid, data, randomize, { allowAltRoom: true, allowSplit: true });
    }
    if (res.unplaced > 0) {
      res = placeLabSubject(subject, classId, grid, data, randomize, { allowAltRoom: true, allowSplit: true, includeSaturday: true });
    }

    if (res.unplaced > 0) {
      const requestType = subject.labRoom ? 'LAB_ROOM_CONFLICT' : 'CONSECUTIVE_SPLIT';
      permissionRequests.push(generatePermissionRequest(subject, classObj, requestType, data, grid));

      res = placeLabSubject(subject, classId, grid, data, randomize, { allowAltRoom: true, allowSplit: true, allowOvertime: true, includeSaturday: true });
    }

    recordUnplaced(subject, classId);
  }

  // Step 4: Theory Subjects (L + T) - Escalation Levels
  const theories = subjects.filter((s) => s.type === 'theory');
  const shuffledTheories = randomize ? shuffle(theories) : theories;

  for (const subject of shuffledTheories) {
    const classId = subject.classId.toString();
    const classObj = classMap[classId] || { _id: classId, name: `Class ${classId}` };

    let res = placeTheorySubject(subject, classId, grid, data, randomize, { allowOvertime: false, ignoreSameDay: false, adminOverrides });

    if (res.unplaced > 0) {
      const secRes = placeTheorySubject(subject, classId, grid, data, randomize, { allowOvertime: false, ignoreSameDay: true, adminOverrides });
      res.unplaced = secRes.unplaced;
    }
    if (res.unplaced > 0) {
      const satRes = placeTheorySubject(subject, classId, grid, data, randomize, { allowOvertime: false, ignoreSameDay: true, includeSaturday: true, adminOverrides });
      res.unplaced = satRes.unplaced;
    }
    if (res.unplaced > 0) {
      const ovRes = placeTheorySubject(subject, classId, grid, data, randomize, { allowOvertime: true, ignoreSameDay: true, includeSaturday: true, adminOverrides });
      res.unplaced = ovRes.unplaced;
    }

    if (res.unplaced > 0) {
      permissionRequests.push(generatePermissionRequest(subject, classObj, 'TEACHER_OVERTIME', data, grid));

      res = placeTheorySubject(subject, classId, grid, data, randomize, { allowOvertime: true, ignoreSameDay: true, includeSaturday: true, adminOverrides });
    }

    recordUnplaced(subject, classId);
  }

  // Step 5: Post-Placement Auto-Fill Phase - DISABLED
  const autoFillStats = postPlacementFillPhase(grid, data);

  return {
    grid,
    unplacedSubjects,
    warnings,
    permissionRequests,
    autoFillStats,
  };
};

module.exports = {
  initializeGrid,
  placeAllSubjects,
  placeTheorySubject,
  placeLabSubject,
  placeLinkedElective,
  placeOpenElective,
  calculateTeacherWorkload,
  postPlacementFillPhase,
  checkMathematicalSolvability,
};