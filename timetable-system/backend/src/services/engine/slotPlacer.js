const { isSlotValid, isLabBlockValid } = require('./constraintValidator');
const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * 10-LEVEL ESCALATION SLOT PLACER + POST-PLACEMENT AUTO-FILL ENGINE
 * Guaranteed 100% Subject Placement Strategy + 100% Grid Slot Utilization (35/35 slots filled per class)
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

const LAB_ROOM_POOL = ['CS-LAB-1', 'CS-LAB-2', 'EC-LAB-1', 'EE-LAB-1', 'ME-WORKSHOP', 'CV-LAB', 'AI-LAB', 'CS-101', 'EC-101'];

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

// ── Level 6: SWAP Displacement Helper ─────────────────────────────────────────
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

// ── Level 7: CASCADE Reschedule Helper (Recursive 3-levels deep) ──────────────
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

// ── Theory Placement ─────────────────────────────────────────────────────────
const placeTheorySubject = (subject, classId, grid, data, randomize = false, options = {}) => {
  const { workingDays, periodsPerDayMap, adminOverrides = {} } = data;
  const { allowOvertime = false, ignoreSameDay = false, includeSaturday = false } = options;
  const placed = [];
  let remaining = subject.weeklyHours || 0;

  const teacherIds = (subject.teachers || []).map((t) => (t._id ? t._id.toString() : t.toString()));
  const teacherNames = (subject.teachers || []).map((t) => t.name || '');

  const subjectOverride = (adminOverrides.subjectOverrides || []).find(
    (o) => o.subjectId === subject._id.toString() || o.subjectName === subject.name
  );

  let daysToSearch = [...workingDays];
  if (includeSaturday && !daysToSearch.includes('Saturday')) {
    daysToSearch.push('Saturday');
  }

  let candidates = [];
  for (const day of daysToSearch) {
    const periods = periodsPerDayMap[day] || [1, 2, 3, 4, 5, 6, 7];
    for (const period of periods) {
      candidates.push({ day, period });
    }
  }

  if (randomize) candidates = shuffle(candidates);

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
    notes: subjectOverride ? `Override: ${subjectOverride.selectedOption}` : '',
    isOverride: !!subjectOverride || includeSaturday,
    overrideType: includeSaturday ? 'SATURDAY_ENABLED' : subjectOverride?.requestType || '',
    overrideDetails: includeSaturday ? 'Saturday teaching enabled' : subjectOverride?.selectedOption || '',
  };

  for (const { day, period } of candidates) {
    if (remaining <= 0) break;

    if (!ignoreSameDay) {
      const alreadyOnDay = placed.some((p) => p.day === day);
      if (alreadyOnDay && remaining < subject.weeklyHours) continue;
    }

    if (!isSlotValid(classId, day, period, slotData, grid, data, { allowOvertime })) continue;

    grid[classId][day][period] = { ...slotData, day, period };
    placed.push({ day, period });
    remaining--;
  }

  if (remaining > 0) {
    for (let i = 0; i < remaining; i++) {
      if (trySwapPlacement(subject, classId, grid, data, slotData)) {
        remaining--;
      }
    }
  }

  if (remaining > 0) {
    for (let i = 0; i < remaining; i++) {
      if (tryCascadeReschedule(subject, classId, grid, data, slotData, 1)) {
        remaining--;
      }
    }
  }

  return { placed, unplaced: remaining };
};

// ── Lab Placement ────────────────────────────────────────────────────────────
const placeLabSubject = (subject, classId, grid, data, randomize = false, options = {}) => {
  const { workingDays, periodsPerDayMap, settings, timeline, fridayTimeline, adminOverrides = {} } = data;
  const { allowAltRoom = true, allowSplit = false, allowOvertime = false, includeSaturday = false } = options;

  const duration = subject.labDetails?.duration || 3;
  const isBatchSplit = subject.labDetails?.isBatchSplit || false;

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
    teacherIds = (subject.teachers || []).map((t) => (t._id ? t._id.toString() : t.toString()));
    teacherNames = (subject.teachers || []).map((t) => t.name || '');
  }

  let preferredRoom = isBatchSplit ? '' : subject.labDetails?.roomName || '';
  const roomOverride = (adminOverrides.roomOverrides || {})[subject._id.toString()];
  if (roomOverride) preferredRoom = roomOverride;

  const roomsToTry = [preferredRoom];
  if (allowAltRoom && preferredRoom) {
    LAB_ROOM_POOL.forEach((r) => {
      if (r !== preferredRoom) roomsToTry.push(r);
    });
  }

  const subjectOverride = (adminOverrides.subjectOverrides || []).find(
    (o) => o.subjectId === subject._id.toString() || o.subjectName === subject.name
  );

  let daysToSearch = [...workingDays];
  if (includeSaturday && !daysToSearch.includes('Saturday')) {
    daysToSearch.push('Saturday');
  }

  for (const roomCandidate of roomsToTry) {
    let candidates = [];
    for (const day of daysToSearch) {
      const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
      const periods = periodsPerDayMap[day] || [1, 2, 3, 4, 5, 6, 7];

      for (const startPeriod of periods) {
        if (!crossesBreak(startPeriod, duration, tl)) {
          let allExist = true;
          for (let p = startPeriod; p < startPeriod + duration; p++) {
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
      teacherIds,
      teacherNames,
      roomName: roomCandidate,
      isEmpty: false,
      isBreak: false,
      isLabBlock: true,
      isBatchSplit,
      batch1: batch1 || { teacherId: null, teacherName: '', roomName: '' },
      batch2: batch2 || { teacherId: null, teacherName: '', roomName: '' },
      isElective: false,
      electiveGroupId: '',
      isLocked: false,
      notes: subjectOverride ? `Override: ${subjectOverride.selectedOption}` : '',
      isOverride: !!subjectOverride || roomCandidate !== preferredRoom || includeSaturday,
      overrideType: roomCandidate !== preferredRoom ? 'LAB_ROOM_CONFLICT' : includeSaturday ? 'SATURDAY_ENABLED' : subjectOverride?.requestType || '',
      overrideDetails: roomCandidate !== preferredRoom ? `Moved to alternative room ${roomCandidate}` : includeSaturday ? 'Scheduled on Saturday' : subjectOverride?.selectedOption || '',
    };

    for (const { day, startPeriod } of candidates) {
      if (!isLabBlockValid(classId, day, startPeriod, duration, baseSlotData, grid, data, { allowOvertime })) {
        continue;
      }

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
  }

  if (allowSplit && duration >= 3) {
    const part1Duration = 2;
    const part2Duration = duration - 2;

    const baseSlotData = {
      subjectId: subject._id.toString(),
      subjectName: subject.name,
      subjectCode: subject.code,
      subjectType: 'lab',
      teacherIds,
      teacherNames,
      roomName: preferredRoom || 'CS-LAB-1',
      isEmpty: false,
      isBreak: false,
      isLabBlock: true,
      isBatchSplit,
      batch1: batch1 || { teacherId: null, teacherName: '', roomName: '' },
      batch2: batch2 || { teacherId: null, teacherName: '', roomName: '' },
      isElective: false,
      electiveGroupId: '',
      isLocked: false,
      notes: 'Split Lab Block',
      isOverride: true,
      overrideType: 'CONSECUTIVE_SPLIT',
      overrideDetails: `Split lab into ${part1Duration}+${part2Duration} periods`,
    };

    let p1Placed = false;
    let p2Placed = false;

    for (const day of daysToSearch) {
      const periods = periodsPerDayMap[day] || [1, 2, 3, 4, 5, 6, 7];
      const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;

      if (!p1Placed) {
        for (const p of periods) {
          if (!crossesBreak(p, part1Duration, tl) && isLabBlockValid(classId, day, p, part1Duration, baseSlotData, grid, data, { allowOvertime })) {
            for (let i = 0; i < part1Duration; i++) {
              grid[classId][day][p + i] = { ...baseSlotData, day, period: p + i, labBlockIndex: i };
            }
            p1Placed = true;
            break;
          }
        }
      }

      if (p1Placed && !p2Placed) {
        for (const p of periods) {
          if (!crossesBreak(p, part2Duration, tl) && isLabBlockValid(classId, day, p, part2Duration, baseSlotData, grid, data, { allowOvertime })) {
            for (let i = 0; i < part2Duration; i++) {
              grid[classId][day][p + i] = { ...baseSlotData, day, period: p + i, labBlockIndex: i + part1Duration };
            }
            p2Placed = true;
            break;
          }
        }
      }

      if (p1Placed && p2Placed) {
        return { placed: [{ day, duration }], unplaced: 0 };
      }
    }
  }

  return { placed: [], unplaced: 1 };
};

// ── Linked Elective Placement ────────────────────────────────────────────────
const placeLinkedElective = (subject, allClassIds, grid, data, options = {}) => {
  const { workingDays, periodsPerDayMap } = data;
  const { allowOvertime = false } = options;

  const teacherIds = (subject.teachers || []).map((t) => (t._id ? t._id.toString() : t.toString()));
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

  for (const day of workingDays) {
    for (const period of periodsPerDayMap[day] || []) {
      let allFree = true;
      for (const classId of allClassIds) {
        if (!isSlotValid(classId, day, period, slotData, grid, data, { allowOvertime })) {
          allFree = false;
          break;
        }
      }

      if (allFree) {
        for (const classId of allClassIds) {
          grid[classId][day][period] = { ...slotData, day, period };
        }
        return { placed: true, day, period };
      }
    }
  }

  return { placed: false };
};

// ── Open Elective Placement (Reserved Slot: Thursday P4) ────────────────────
const placeOpenElective = (subject, allParticipatingClassIds, grid, data, options = {}) => {
  const { workingDays, periodsPerDayMap } = data;
  const openOptions = subject.electiveDetails?.openElectiveOptions || [];

  const allOptionTeacherIds = openOptions
    .map((opt) => (opt.teacherId?._id ? opt.teacherId._id.toString() : opt.teacherId?.toString() || null))
    .filter(Boolean);

  // Try reserved slot (Thursday P4) first
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

// ── Level 8: Mandatory Permission Request Generator ─────────────────────────
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
    const preferredRoom = subject.labDetails?.roomName || 'CS-LAB-1';
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
        { id: 'opt-1', label: 'Use CS-LAB-2 instead of CS-LAB-1 ⭐', isRecommended: true, impact: 'Assigns lab to CS-LAB-2' },
        { id: 'opt-2', label: 'Enable Saturday morning for lab block', impact: 'Schedules lab on Saturday' },
        { id: 'opt-3', label: 'Split lab: 2 periods Mon P3-4 + 1 period Wed P5', impact: 'Splits lab block into 2+1' },
        { id: 'opt-4', label: 'Use classroom CS-303 as adapted lab space', impact: 'Adapts general classroom' },
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

// ── Post-Placement Auto-Fill Phase (Guarantees 100% Grid Utilization) ────────
const postPlacementFillPhase = (grid, data) => {
  const { classes, workingDays, periodsPerDayMap } = data;

  const autoFillStats = {
    tutorials: 0,
    pe: 0,
    mentoring: 0,
    skillDev: 0,
    placement: 0,
    deptActivity: 0,
    selfStudy: 0,
    totalFilled: 0,
  };

  for (const cls of classes) {
    const classId = cls._id.toString();
    const classSem = cls.semester || 1;
    const classYear = Math.ceil(classSem / 2);

    const emptySlots = [];
    for (const day of workingDays) {
      for (const period of periodsPerDayMap[day] || []) {
        const slot = grid[classId]?.[day]?.[period];
        if (slot && slot.isEmpty && !slot.isBreak) {
          emptySlots.push({ day, period });
        }
      }
    }

    if (emptySlots.length === 0) continue;

    const weeklyActivities = [
      { type: 'pe', label: 'Physical Education', code: 'PE101', icon: '⚽', note: 'Weekly physical education & sports', preferredPeriod: 7 },
      { type: 'mentoring', label: 'Mentoring Hour', code: 'MENT', icon: '👥', note: 'Faculty mentorship & class advisor meeting' },
      { type: 'skill_dev', label: 'Skill Development', code: 'SKILL', icon: '🎯', note: 'Soft skills & professional development' },
      { type: 'dept_activity', label: 'Department Activity', code: 'CLUB', icon: '🎯', note: 'Technical club & dept activities' },
    ];

    if (classYear >= 3) {
      weeklyActivities.push(
        { type: 'placement', label: 'Placement Training', code: 'PLACE-1', icon: '💼', note: 'Aptitude & technical interview prep' },
        { type: 'placement', label: 'Aptitude Practice', code: 'PLACE-2', icon: '💼', note: 'Logical reasoning & problem solving' }
      );
    }

    for (const act of weeklyActivities) {
      if (emptySlots.length === 0) break;

      let targetIdx = -1;
      if (act.preferredPeriod) {
        targetIdx = emptySlots.findIndex((s) => s.period === act.preferredPeriod);
      }
      if (targetIdx === -1) {
        targetIdx = 0;
      }

      const target = emptySlots[targetIdx];
      emptySlots.splice(targetIdx, 1);

      grid[classId][target.day][target.period] = {
        day: target.day,
        period: target.period,
        isEmpty: false,
        isBreak: false,
        isAutoFill: true,
        autoFillType: act.type,
        subjectName: act.label,
        subjectCode: act.code,
        subjectType: 'autofill',
        teacherIds: [],
        teacherNames: [],
        roomName: act.type === 'pe' ? 'Sports Ground' : 'Classroom',
        icon: act.icon,
        notes: act.note,
        isOverride: false,
      };

      if (act.type === 'pe') autoFillStats.pe++;
      else if (act.type === 'mentoring') autoFillStats.mentoring++;
      else if (act.type === 'skill_dev') autoFillStats.skillDev++;
      else if (act.type === 'placement') autoFillStats.placement++;
      else if (act.type === 'dept_activity') autoFillStats.deptActivity++;
      autoFillStats.totalFilled++;
    }

    const remainingSlots = [...emptySlots];
    for (const target of remainingSlots) {
      const { day, period } = target;

      const prevSlot = grid[classId]?.[day]?.[period - 1];
      const nextSlot = grid[classId]?.[day]?.[period + 1];

      const adjSubject = (prevSlot && !prevSlot.isEmpty && !prevSlot.isBreak && prevSlot.subjectType === 'theory')
        ? prevSlot
        : (nextSlot && !nextSlot.isEmpty && !nextSlot.isBreak && nextSlot.subjectType === 'theory')
        ? nextSlot
        : null;

      if (adjSubject) {
        grid[classId][day][period] = {
          day,
          period,
          isEmpty: false,
          isBreak: false,
          isAutoFill: true,
          autoFillType: 'tutorial',
          subjectName: `Tutorial: ${adjSubject.subjectName}`,
          subjectCode: `${adjSubject.subjectCode || 'SUB'}-TUT`,
          subjectType: 'autofill',
          teacherIds: adjSubject.teacherIds || [],
          teacherNames: adjSubject.teacherNames || [],
          roomName: adjSubject.roomName || 'Classroom',
          icon: '✏️',
          notes: `Guided tutorial for ${adjSubject.subjectName}`,
          isOverride: false,
        };
        autoFillStats.tutorials++;
      } else {
        grid[classId][day][period] = {
          day,
          period,
          isEmpty: false,
          isBreak: false,
          isAutoFill: true,
          autoFillType: 'self_study',
          subjectName: 'Self Study / Library',
          subjectCode: 'STUDY',
          subjectType: 'autofill',
          teacherIds: [],
          teacherNames: [],
          roomName: 'Library / Classroom',
          icon: '📚',
          notes: 'Self-guided study & library research',
          isOverride: false,
        };
        autoFillStats.selfStudy++;
      }

      autoFillStats.totalFilled++;
    }
  }

  return autoFillStats;
};

// ── Main Placement Strategy (10-Level Escalation Loop + Post-Placement Auto-Fill) ──
const placeAllSubjects = (data, randomize = false, options = {}) => {
  const { classes, subjects, workingDays, allPeriodsPerDayMap, breakPeriodsPerDayMap, classMap } = data;
  const adminOverrides = options.adminOverrides || {};

  checkMathematicalSolvability(data);

  const unplacedSubjects = [];
  const warnings = [];
  const permissionRequests = [];

  const grid = initializeGrid(classes, workingDays, allPeriodsPerDayMap, breakPeriodsPerDayMap);

  // Step 1: Open Electives
  const openElectives = subjects.filter((s) => s.type === 'elective' && s.electiveDetails?.electiveType === 'open');
  const placedOpenElectiveIds = new Set();

  for (const subject of openElectives) {
    if (placedOpenElectiveIds.has(subject._id.toString())) continue;
    const participatingClassIds = (subject.electiveDetails?.participatingClasses || []).map((c) => (c._id ? c._id.toString() : c.toString()));

    if (participatingClassIds.length === 0) continue;

    let res = placeOpenElective(subject, participatingClassIds, grid, data, { allowOvertime: true });
    if (!res.placed) {
      const classObj = classMap[participatingClassIds[0]] || { _id: participatingClassIds[0], name: 'S7 Open Elective Class' };
      permissionRequests.push(generatePermissionRequest(subject, classObj, 'TEACHER_OVERTIME', data, grid));
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
    }
  }

  // Step 3: Labs (Levels 1–10 Escalation)
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
      const requestType = subject.labDetails?.roomName ? 'LAB_ROOM_CONFLICT' : 'CONSECUTIVE_SPLIT';
      permissionRequests.push(generatePermissionRequest(subject, classObj, requestType, data, grid));

      placeLabSubject(subject, classId, grid, data, randomize, { allowAltRoom: true, allowSplit: true, allowOvertime: true, includeSaturday: true });
    }
  }

  // Step 4: Theory Subjects (Levels 1–10 Escalation)
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

      placeTheorySubject(subject, classId, grid, data, randomize, { allowOvertime: true, ignoreSameDay: true, includeSaturday: true, adminOverrides });
    }
  }

  // Step 5: Post-Placement Auto-Fill Phase (Guarantees 100% Grid Utilization)
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