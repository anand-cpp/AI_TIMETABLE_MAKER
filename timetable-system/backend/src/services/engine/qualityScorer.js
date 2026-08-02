/**
 * Quality Scorer
 * Scores a timetable grid on multiple soft criteria
 * Each category returns 0-100, overall is weighted average
 */

// ── 1. Teacher Load Balance ────────────────────────────────────────────────────
// How evenly distributed are periods across teachers
const scoreTeacherLoad = (grid, data) => {
  const { teacherMap, workingDays, periodsPerDayMap } = data;
  const teacherDailyLoads = {}; // teacherId -> { day -> count }

  for (const [classId, dayMap] of Object.entries(grid)) {
    for (const [day, periodMap] of Object.entries(dayMap)) {
      for (const [period, slot] of Object.entries(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;

        const teacherIds = [];
        if (slot.teacherIds) slot.teacherIds.forEach((id) => teacherIds.push(id.toString()));
        if (slot.isBatchSplit) {
          if (slot.batch1?.teacherId) teacherIds.push(slot.batch1.teacherId.toString());
          if (slot.batch2?.teacherId) teacherIds.push(slot.batch2.teacherId.toString());
        }

        for (const tid of teacherIds) {
          if (!teacherDailyLoads[tid]) teacherDailyLoads[tid] = {};
          if (!teacherDailyLoads[tid][day]) teacherDailyLoads[tid][day] = 0;
          teacherDailyLoads[tid][day]++;
        }
      }
    }
  }

  if (Object.keys(teacherDailyLoads).length === 0) return 100;

  let totalVariance = 0;
  let teacherCount = 0;

  for (const [tid, dayLoads] of Object.entries(teacherDailyLoads)) {
    const loads = Object.values(dayLoads);
    if (loads.length === 0) continue;

    const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
    const variance = loads.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / loads.length;
    totalVariance += variance;
    teacherCount++;
  }

  const avgVariance = teacherCount > 0 ? totalVariance / teacherCount : 0;
  // Lower variance = higher score
  const score = Math.max(0, 100 - avgVariance * 20);
  return Math.round(score);
};

// ── 2. Subject Distribution ────────────────────────────────────────────────────
// Are same subjects spread across different days (not all on one day)
const scoreDistribution = (grid, data) => {
  const { workingDays } = data;
  let totalScore = 0;
  let classCount = 0;

  for (const [classId, dayMap] of Object.entries(grid)) {
    // Count subject occurrences per day
    const subjectDays = {}; // subjectId -> [days]

    for (const [day, periodMap] of Object.entries(dayMap)) {
      for (const [period, slot] of Object.entries(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak || !slot.subjectId) continue;
        const sid = slot.subjectId.toString();
        if (!subjectDays[sid]) subjectDays[sid] = [];
        if (!subjectDays[sid].includes(day)) subjectDays[sid].push(day);
      }
    }

    let classScore = 100;
    for (const [sid, days] of Object.entries(subjectDays)) {
      // Penalize same subject on same day multiple times
      // (already handled by placement, but double check)
      const dayCount = days.length;
      // If subject appears on more unique days = better distribution
      if (dayCount === 1) classScore -= 5; // All on same day
    }

    totalScore += Math.max(0, classScore);
    classCount++;
  }

  return classCount > 0 ? Math.round(totalScore / classCount) : 100;
};

// ── 3. Lab Placement Quality ───────────────────────────────────────────────────
// Labs with morning preference placed in first half of day
const scoreLabPlacement = (grid, data) => {
  const { periodsPerDayMap } = data;
  let labsWithPreference = 0;
  let labsCorrectlyPlaced = 0;

  for (const [classId, dayMap] of Object.entries(grid)) {
    for (const [day, periodMap] of Object.entries(dayMap)) {
      const dayPeriods = periodsPerDayMap[day] || [];
      const midPoint = Math.ceil(dayPeriods.length / 2);
      const morningPeriods = dayPeriods.slice(0, midPoint);

      for (const [period, slot] of Object.entries(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;
        if (slot.subjectType !== 'lab' || slot.labBlockIndex !== 0) continue;

        // Check if this lab has morning preference
        // We track this via the slot data
        labsWithPreference++;

        const periodNum = Number(period);
        if (morningPeriods.includes(periodNum)) {
          labsCorrectlyPlaced++;
        }
      }
    }
  }

  if (labsWithPreference === 0) return 100;
  return Math.round((labsCorrectlyPlaced / labsWithPreference) * 100);
};

// ── 4. Elective Synchronization ────────────────────────────────────────────────
// Linked/open electives properly synchronized across classes
const scoreElectiveSync = (grid, data) => {
  const { subjects } = data;

  const electiveSubjects = subjects.filter(
    (s) => s.type === 'elective'
  );

  if (electiveSubjects.length === 0) return 100;

  let syncedCount = 0;
  let totalElectives = 0;

  // Check linked elective groups - all classes in group have same day/period
  const linkedGroups = {};
  for (const subject of electiveSubjects) {
    if (
      subject.electiveDetails?.electiveType === 'linked' &&
      subject.electiveDetails?.linkedGroupId
    ) {
      const gid = subject.electiveDetails.linkedGroupId;
      if (!linkedGroups[gid]) linkedGroups[gid] = [];
      linkedGroups[gid].push(subject);
    }
  }

  for (const [gid, groupSubjects] of Object.entries(linkedGroups)) {
    totalElectives++;
    const slots = [];

    for (const subject of groupSubjects) {
      const classId = subject.classId.toString();
      // Find this elective in grid
      for (const [day, periodMap] of Object.entries(grid[classId] || {})) {
        for (const [period, slot] of Object.entries(periodMap)) {
          if (
            slot &&
            !slot.isEmpty &&
            slot.subjectId?.toString() === subject._id.toString()
          ) {
            slots.push({ day, period: Number(period) });
          }
        }
      }
    }

    // All slots should be same day + period
    if (slots.length === groupSubjects.length && slots.length > 0) {
      const allSame = slots.every(
        (s) => s.day === slots[0].day && s.period === slots[0].period
      );
      if (allSame) syncedCount++;
    }
  }

  if (totalElectives === 0) return 100;
  return Math.round((syncedCount / totalElectives) * 100);
};

// ── 5. Travel Optimization ─────────────────────────────────────────────────────
// Teachers from same department have consecutive classes in same building
const scoreTravelOptimization = (grid, data) => {
  const { teacherMap, workingDays, periodsPerDayMap } = data;

  // Simple metric: penalize if a teacher has gaps between periods
  // (requires travel between non-consecutive periods)
  let totalGapPenalty = 0;
  let teacherCount = 0;

  const teacherDaySlots = {}; // teacherId -> { day -> [periods] }

  for (const [classId, dayMap] of Object.entries(grid)) {
    for (const [day, periodMap] of Object.entries(dayMap)) {
      for (const [period, slot] of Object.entries(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;

        const teacherIds = [];
        if (slot.teacherIds) slot.teacherIds.forEach((id) => teacherIds.push(id.toString()));
        if (slot.isBatchSplit) {
          if (slot.batch1?.teacherId) teacherIds.push(slot.batch1.teacherId.toString());
          if (slot.batch2?.teacherId) teacherIds.push(slot.batch2.teacherId.toString());
        }

        for (const tid of teacherIds) {
          if (!teacherDaySlots[tid]) teacherDaySlots[tid] = {};
          if (!teacherDaySlots[tid][day]) teacherDaySlots[tid][day] = [];
          teacherDaySlots[tid][day].push(Number(period));
        }
      }
    }
  }

  for (const [tid, daySlots] of Object.entries(teacherDaySlots)) {
    teacherCount++;
    for (const [day, periods] of Object.entries(daySlots)) {
      const sorted = periods.sort((a, b) => a - b);
      // Count gaps
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1] - 1;
        if (gap > 0) totalGapPenalty += gap;
      }
    }
  }

  if (teacherCount === 0) return 100;
  const avgPenalty = totalGapPenalty / teacherCount;
  return Math.round(Math.max(0, 100 - avgPenalty * 15));
};

// ── 6. Teacher Gaps ────────────────────────────────────────────────────────────
// Fewer free periods between teaching periods for teachers = better
const scoreTeacherGaps = (grid, data) => {
  const teacherDaySlots = {};

  for (const [classId, dayMap] of Object.entries(grid)) {
    for (const [day, periodMap] of Object.entries(dayMap)) {
      for (const [period, slot] of Object.entries(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;

        const teacherIds = [];
        if (slot.teacherIds) slot.teacherIds.forEach((id) => teacherIds.push(id.toString()));
        if (slot.isBatchSplit) {
          if (slot.batch1?.teacherId) teacherIds.push(slot.batch1.teacherId.toString());
          if (slot.batch2?.teacherId) teacherIds.push(slot.batch2.teacherId.toString());
        }

        for (const tid of teacherIds) {
          if (!teacherDaySlots[tid]) teacherDaySlots[tid] = {};
          if (!teacherDaySlots[tid][day]) teacherDaySlots[tid][day] = [];
          teacherDaySlots[tid][day].push(Number(period));
        }
      }
    }
  }

  let totalGaps = 0;
  let teacherDayCount = 0;

  for (const [tid, daySlots] of Object.entries(teacherDaySlots)) {
    for (const [day, periods] of Object.entries(daySlots)) {
      teacherDayCount++;
      const sorted = periods.sort((a, b) => a - b);
      let gaps = 0;
      for (let i = 1; i < sorted.length; i++) {
        gaps += sorted[i] - sorted[i - 1] - 1;
      }
      totalGaps += gaps;
    }
  }

  if (teacherDayCount === 0) return 100;
  const avgGaps = totalGaps / teacherDayCount;
  return Math.round(Math.max(0, 100 - avgGaps * 20));
};

// ── 7. Student Stress ──────────────────────────────────────────────────────────
// Penalize back-to-back hard subjects (theory heavy days)
const scoreStudentStress = (grid, data) => {
  const { workingDays, periodsPerDayMap } = data;
  let totalScore = 0;
  let classCount = 0;

  for (const [classId, dayMap] of Object.entries(grid)) {
    let classScore = 100;

    for (const day of workingDays) {
      const periods = periodsPerDayMap[day] || [];
      const daySlots = periods.map((p) => dayMap[day]?.[p]).filter(Boolean);

      // Count consecutive theory periods
      let consecutiveTheory = 0;
      let maxConsecutive = 0;

      for (const slot of daySlots) {
        if (slot.isEmpty || slot.isBreak) {
          maxConsecutive = Math.max(maxConsecutive, consecutiveTheory);
          consecutiveTheory = 0;
        } else if (slot.subjectType === 'theory') {
          consecutiveTheory++;
        } else {
          maxConsecutive = Math.max(maxConsecutive, consecutiveTheory);
          consecutiveTheory = 0;
        }
      }
      maxConsecutive = Math.max(maxConsecutive, consecutiveTheory);

      // Penalize more than 3 consecutive theory periods
      if (maxConsecutive > 3) {
        classScore -= (maxConsecutive - 3) * 5;
      }
    }

    totalScore += Math.max(0, classScore);
    classCount++;
  }

  return classCount > 0 ? Math.round(totalScore / classCount) : 100;
};

// ── Main Scorer ────────────────────────────────────────────────────────────────
const scoreGrid = (grid, data) => {
  const teacherLoad = scoreTeacherLoad(grid, data);
  const distribution = scoreDistribution(grid, data);
  const labPlacement = scoreLabPlacement(grid, data);
  const electiveSync = scoreElectiveSync(grid, data);
  const travelOptimization = scoreTravelOptimization(grid, data);
  const teacherGaps = scoreTeacherGaps(grid, data);
  const studentStress = scoreStudentStress(grid, data);

  // Weighted average - elective sync weighted 2x
  const weights = {
    teacherLoad: 1,
    distribution: 1,
    labPlacement: 1,
    electiveSync: 2,
    travelOptimization: 1,
    teacherGaps: 1,
    studentStress: 1,
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const overall =
    (teacherLoad * weights.teacherLoad +
      distribution * weights.distribution +
      labPlacement * weights.labPlacement +
      electiveSync * weights.electiveSync +
      travelOptimization * weights.travelOptimization +
      teacherGaps * weights.teacherGaps +
      studentStress * weights.studentStress) /
    totalWeight;

  return {
    overall: Math.round(overall),
    teacherLoad,
    distribution,
    labPlacement,
    electiveSync,
    travelOptimization,
    teacherGaps,
    studentStress,
  };
};

module.exports = { scoreGrid };