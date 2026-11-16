/**
 * Faculty Personal Timetable Analyzer & Diagnostic Service
 * PHASE 1 — High-Fidelity Faculty Schedule Analysis & Diagnostic Profiling
 *
 * Constructs individual faculty personal timetables directly from authoritative
 * persisted timetable allocations (or engine grid objects) across all departments,
 * semesters, sections, and subjects without modifying scheduling behavior.
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];
const PRE_LUNCH_PERIODS = [1, 2, 3];
const POST_LUNCH_PERIODS = [4, 5, 6];

/**
 * Extracts normalized teacher IDs from a slot.
 */
function extractSlotTeacherIds(slot) {
  const ids = [];
  if (!slot || slot.isEmpty || slot.isBreak) return ids;

  if (Array.isArray(slot.teacherIds)) {
    slot.teacherIds.forEach(id => {
      if (id) ids.push(typeof id === 'object' ? id._id?.toString() || id.toString() : id.toString());
    });
  }
  if (Array.isArray(slot.teachers)) {
    slot.teachers.forEach(t => {
      if (t) ids.push(typeof t === 'object' ? t._id?.toString() || t.toString() : t.toString());
    });
  }
  if (slot.teacherId) {
    ids.push(typeof slot.teacherId === 'object' ? slot.teacherId._id?.toString() || slot.teacherId.toString() : slot.teacherId.toString());
  }
  if (Array.isArray(slot.coInstructorIds)) {
    slot.coInstructorIds.forEach(id => {
      if (id) ids.push(typeof id === 'object' ? id._id?.toString() || id.toString() : id.toString());
    });
  }
  if (slot.isBatchSplit) {
    if (slot.batch1?.teacherId) ids.push(slot.batch1.teacherId.toString());
    if (slot.batch2?.teacherId) ids.push(slot.batch2.teacherId.toString());
  }

  return [...new Set(ids.filter(Boolean))];
}

/**
 * Extracts normalized teacher names from a slot.
 */
function extractSlotTeacherNames(slot) {
  const names = [];
  if (!slot || slot.isEmpty || slot.isBreak) return names;

  if (Array.isArray(slot.teacherNames)) {
    slot.teacherNames.forEach(n => n && names.push(n.trim()));
  }
  if (slot.teacherName && typeof slot.teacherName === 'string') {
    names.push(slot.teacherName.trim());
  }
  return [...new Set(names.filter(Boolean))];
}

const {
  ACTIVITY_TYPES,
  classifyActivity,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
  isPlacement,
  isTutorial,
  isUnknownActivity,
} = require('./activityClassifier');

/**
 * Analyzes contiguous teaching runs and gap structures for a single day.
 * Accepts either an array of period numbers [1, 2, 3] or array of slot objects [{period: 1}, ...].
 */
function analyzeDayRunsAndGaps(periodsOrSlots, day) {
  const rawPeriods = (periodsOrSlots || [])
    .map(p => typeof p === 'number' ? p : p?.period)
    .filter(p => typeof p === 'number' && !isNaN(p));
  const sortedPeriods = [...new Set(rawPeriods)].sort((a, b) => a - b);
  const firstPeriod = sortedPeriods.length > 0 ? sortedPeriods[0] : null;
  const lastPeriod = sortedPeriods.length > 0 ? sortedPeriods[sortedPeriods.length - 1] : null;

  // 1. Contiguous runs
  const consecutiveRuns = [];
  let currentRun = null;

  for (const p of PERIODS) {
    if (sortedPeriods.includes(p)) {
      const isLunchSeparation =
        currentRun &&
        ((day === 'Friday' && currentRun.endPeriod === 4 && p === 5) ||
         (day !== 'Friday' && currentRun.endPeriod === 3 && p === 4));

      if (isLunchSeparation) {
        // Institutional rule: Lunch separates pre-lunch and post-lunch sequences
        consecutiveRuns.push(currentRun);
        currentRun = { day, startPeriod: p, endPeriod: p, length: 1, periods: [p] };
      } else if (!currentRun) {
        currentRun = { day, startPeriod: p, endPeriod: p, length: 1, periods: [p] };
      } else {
        currentRun.endPeriod = p;
        currentRun.length += 1;
        currentRun.periods.push(p);
      }
    } else {
      if (currentRun) {
        consecutiveRuns.push(currentRun);
        currentRun = null;
      }
    }
  }
  if (currentRun) consecutiveRuns.push(currentRun);

  const longestConsecutiveRun = consecutiveRuns.reduce((max, r) => Math.max(max, r.length), 0);

  // 2. Isolated periods: runs of length 1
  const isolatedRuns = consecutiveRuns.filter(r => r.length === 1);
  const isolatedPeriodsCount = isolatedRuns.length;

  // 3. Idle gaps: free periods between firstPeriod and lastPeriod
  const idlePeriods = [];
  const gapSequences = [];
  let currentGap = null;

  if (firstPeriod !== null && lastPeriod !== null && firstPeriod < lastPeriod) {
    for (let p = firstPeriod; p <= lastPeriod; p++) {
      if (!sortedPeriods.includes(p)) {
        idlePeriods.push(p);
        if (!currentGap) {
          currentGap = { startPeriod: p, endPeriod: p, length: 1, periods: [p] };
        } else {
          currentGap.endPeriod = p;
          currentGap.length += 1;
          currentGap.periods.push(p);
        }
      } else {
        if (currentGap) {
          gapSequences.push(currentGap);
          currentGap = null;
        }
      }
    }
    if (currentGap) gapSequences.push(currentGap);
  }

  const totalIdleTime = idlePeriods.length;
  const gapLengths = gapSequences.map(g => g.length);

  // 4. Pre-lunch & Post-lunch distribution
  const preLunchCount = sortedPeriods.filter(p => PRE_LUNCH_PERIODS.includes(p)).length;
  const postLunchCount = sortedPeriods.filter(p => POST_LUNCH_PERIODS.includes(p)).length;

  // 5. Lunch separation
  // KTU lunch break occurs between Period 3 and Period 4.
  // Flanking lunch: teacher has teaching on P3 AND P4 on the same day.
  const teachesBeforeLunch = sortedPeriods.includes(3);
  const teachesAfterLunch = sortedPeriods.includes(4);
  const teachesAcrossLunch = teachesBeforeLunch && teachesAfterLunch;

  // 6. Excessively fragmented day: <= 2 classes taught with idle gap >= 3 periods
  const isExcessivelyFragmented = sortedPeriods.length > 0 && sortedPeriods.length <= 2 && totalIdleTime >= 3;

  return {
    day,
    dailyTeachingPeriods: sortedPeriods.length,
    firstTeachingPeriod: firstPeriod,
    lastTeachingPeriod: lastPeriod,
    freePeriodsCount: PERIODS.length - sortedPeriods.length,
    consecutiveRuns,
    longestConsecutiveRun,
    isolatedPeriodsCount,
    idlePeriods,
    gapSequences,
    gapLengths,
    totalIdleTime,
    preLunchCount,
    postLunchCount,
    teachesBeforeLunch,
    teachesAfterLunch,
    teachesAcrossLunch,
    isExcessivelyFragmented,
  };
}

/**
 * Builds the authoritative faculty schedule map from classTimetables array or a grid object.
 * Returns: Map<teacherIdentifier, { teacher, scheduleGrid, allocations }>
 */
function buildAuthoritativeFacultySchedules(timetableOrGrid, teachers = [], classes = []) {
  const teacherScheduleMap = new Map();

  const classInfoMap = new Map();
  classes.forEach(c => {
    const cid = c._id ? c._id.toString() : c.id?.toString();
    if (cid) classInfoMap.set(cid, c);
  });

  // Pre-seed all teachers
  teachers.forEach(t => {
    const tid = t._id ? t._id.toString() : t.id?.toString();
    const tname = t.name?.trim();
    if (tid) {
      teacherScheduleMap.set(tid, {
        teacher: t,
        teacherId: tid,
        teacherName: tname,
        department: t.departmentId?.name || t.department || 'Computer Science and Engineering',
        scheduleGrid: {
          Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {}
        },
        allocations: [],
      });
    }
  });

  // Extract all occupied slots
  const occupiedSlots = [];

  // Case A: timetableOrGrid is array of classTimetables or timetable document with classTimetables
  const classTimetables = Array.isArray(timetableOrGrid)
    ? timetableOrGrid
    : (timetableOrGrid?.classTimetables || null);

  if (Array.isArray(classTimetables)) {
    classTimetables.forEach(ct => {
      const classId = ct.classId?.toString() || '';
      const cls = classInfoMap.get(classId);
      const className = ct.className || cls?.name || `S${cls?.semester || ''} ${cls?.section || ''}`.trim() || 'Class';
      const semester = cls?.semester || (className.match(/S(\d)/i) ? Number(className.match(/S(\d)/i)[1]) : null);
      const section = cls?.section || (className.match(/\b([A-Z])\b/) ? className.match(/\b([A-Z])\b/)[1] : null);

      (ct.slots || ct.schedule || []).forEach(slot => {
        if (!slot || slot.isEmpty || slot.isBreak) return;
        occupiedSlots.push({
          classId,
          className,
          semester,
          section,
          day: slot.day,
          period: slot.period,
          slot,
        });
      });
    });
  } else if (typeof timetableOrGrid === 'object' && timetableOrGrid !== null) {
    // Case B: Grid object: grid[classId][day][period]
    for (const [classId, dayMap] of Object.entries(timetableOrGrid)) {
      const cls = classInfoMap.get(classId);
      const className = cls?.name || `S${cls?.semester || ''} ${cls?.section || ''}`.trim() || classId;
      const semester = cls?.semester || (className.match(/S(\d)/i) ? Number(className.match(/S(\d)/i)[1]) : null);
      const section = cls?.section || (className.match(/\b([A-Z])\b/) ? className.match(/\b([A-Z])\b/)[1] : null);

      for (const day of DAYS) {
        for (const p of PERIODS) {
          const slot = dayMap?.[day]?.[p];
          if (!slot || slot.isEmpty || slot.isBreak) continue;
          occupiedSlots.push({
            classId,
            className,
            semester,
            section,
            day,
            period: p,
            slot,
          });
        }
      }
    }
  }

  // Map each occupied slot to its assigned faculty
  occupiedSlots.forEach(({ classId, className, semester, section, day: occDay, period: occPeriod, slot }) => {
    const day = occDay || slot.day;
    const period = Number(occPeriod !== undefined ? occPeriod : slot.period);
    if (!DAYS.includes(day) || !PERIODS.includes(period)) return;

    const teacherIds = extractSlotTeacherIds(slot);
    const teacherNames = extractSlotTeacherNames(slot).map(n => n.toLowerCase());

    // Find all matching teachers in teacherScheduleMap
    const matchedTeacherRecords = [];

    teachers.forEach(t => {
      const tid = t._id ? t._id.toString() : t.id?.toString();
      const tname = (t.name || '').trim().toLowerCase();
      const idMatch = tid && teacherIds.includes(tid);
      const nameMatch = tname && teacherNames.includes(tname);

      if (idMatch || nameMatch) {
        if (tid && teacherScheduleMap.has(tid)) {
          matchedTeacherRecords.push(teacherScheduleMap.get(tid));
        }
      }
    });

    matchedTeacherRecords.forEach(tRecord => {
      const allocation = {
        classId,
        className,
        classNames: [className],
        semester,
        section,
        day,
        period,
        subjectId: slot.subjectId ? slot.subjectId.toString() : '',
        subjectName: slot.subjectName || slot.subjectCode || 'Subject',
        subjectCode: slot.subjectCode || '',
        subjectType: slot.subjectType || (slot.isLabBlock ? 'lab' : slot.isElective ? 'elective' : slot.isMinor ? 'minor' : ''),
        roomName: slot.roomName || '—',
        duration: slot.duration || 1,
        isLabBlock: Boolean(slot.isLabBlock || slot.subjectType === 'lab'),
        isElective: Boolean(slot.isElective || slot.subjectType === 'elective'),
        isMinor: Boolean(slot.isMinor || slot.subjectType === 'minor'),
        isSharedSession: Boolean(slot.isSharedSession || slot.isSharedProject || slot.isElective),
        sharedSessionId: slot.sharedSessionId || null,
        isLocked: Boolean(slot.isLocked),
        isFixed: Boolean(slot.isFixed),
      };

      tRecord.allocations.push(allocation);

      if (!tRecord.scheduleGrid[day][period]) {
        tRecord.scheduleGrid[day][period] = allocation;
      } else {
        // Multi-section concurrent session (e.g. S8 Project Phase-2 or Shared Elective)
        const existing = tRecord.scheduleGrid[day][period];
        if (!existing.classNames) existing.classNames = [existing.className];
        if (!existing.classNames.includes(className)) {
          existing.classNames.push(className);
          existing.className = existing.classNames.join(' / ');
        }
      }
    });
  });

  return teacherScheduleMap;
}

/**
 * Fully analyzes a single faculty member's personal timetable.
 * Accepts either a prebuilt teacherScheduleRecord OR (teacher, timetableOrGrid, classes).
 */
function analyzeFacultyPersonalTimetable(recordOrTeacher, timetableOrGrid, classes = []) {
  let record = recordOrTeacher;
  if (!record || !record.scheduleGrid) {
    const teacher = recordOrTeacher;
    const map = buildAuthoritativeFacultySchedules(timetableOrGrid, teacher ? [teacher] : [], classes);
    const tid = teacher?._id ? teacher._id.toString() : teacher?.id?.toString() || teacher?.name;
    record = map.get(tid) || Array.from(map.values())[0];
    if (!record) {
      record = {
        teacher,
        teacherId: tid,
        teacherName: teacher?.name || 'Faculty Member',
        department: teacher?.department || 'Computer Science and Engineering',
        scheduleGrid: { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {} },
        allocations: [],
      };
    }
  }

  const { teacher, teacherId, teacherName, department, scheduleGrid, allocations } = record;

  const dailyAnalysis = {};
  const dailyLoads = {};
  let totalWeeklyTeachingPeriods = 0;
  const allConsecutiveRuns = [];
  const breakDiagnosticFindings = [];

  DAYS.forEach(day => {
    const periodsTaught = Object.keys(scheduleGrid[day] || {}).map(Number).sort((a, b) => a - b);
    const dayMetrics = analyzeDayRunsAndGaps(periodsTaught, day);

    dailyAnalysis[day] = dayMetrics;
    dailyLoads[day] = dayMetrics.dailyTeachingPeriods;
    totalWeeklyTeachingPeriods += dayMetrics.dailyTeachingPeriods;
    allConsecutiveRuns.push(...dayMetrics.consecutiveRuns);

    // Diagnostics per day:
    // 1. Three or more consecutive teaching periods (evaluated against ordinary theory)
    dayMetrics.consecutiveRuns.forEach(run => {
      const runSlots = run.periods.map(p => scheduleGrid[day]?.[p]).filter(Boolean);
      const isInstitutionalBlock = runSlots.length > 0 && runSlots.every(s => isInstitutionalLabOrProject(s));

      // Extract ordinary theory sub-runs
      const theorySubRuns = [];
      let curTheoryRun = [];
      run.periods.forEach(p => {
        const slot = scheduleGrid[day]?.[p];
        if (isOrdinaryTheory(slot)) {
          curTheoryRun.push(p);
        } else {
          if (curTheoryRun.length > 0) {
            theorySubRuns.push(curTheoryRun);
            curTheoryRun = [];
          }
        }
      });
      if (curTheoryRun.length > 0) {
        theorySubRuns.push(curTheoryRun);
      }

      const hasThreeConsecTheory = theorySubRuns.some(tr => tr.length >= 3);

      if (hasThreeConsecTheory) {
        breakDiagnosticFindings.push({
          type: 'THREE_OR_MORE_CONSECUTIVE_PERIODS',
          severity: 'critical_rest_gap',
          day,
          startPeriod: run.startPeriod,
          endPeriod: run.endPeriod,
          length: run.length,
          message: `${teacherName} teaches 3 or more consecutive ordinary theory periods on ${day} (Periods ${run.periods.join(', ')}) without a rest gap`,
        });
      } else if (isInstitutionalBlock) {
        breakDiagnosticFindings.push({
          type: 'INSTITUTIONAL_EXTENDED_BLOCK',
          severity: 'info_institutional_block',
          day,
          startPeriod: run.startPeriod,
          endPeriod: run.endPeriod,
          length: run.length,
          message: `${teacherName} has an authorized ${run.length}-period institutional laboratory/project block on ${day} (Periods ${run.periods.join(', ')})`,
        });
      } else if (run.length >= 3) {
        // Mixed sequence with non-theory periods (e.g. Viva -> Theory -> Viva)
        breakDiagnosticFindings.push({
          type: 'CONSECUTIVE_TEACHING_PERIODS',
          severity: 'info_consecutive',
          day,
          startPeriod: run.startPeriod,
          endPeriod: run.endPeriod,
          length: run.length,
          message: `${teacherName} teaches ${run.length} alternating teaching periods on ${day} (Periods ${run.periods.join(', ')})`,
        });
      } else if (run.length === 2) {
        breakDiagnosticFindings.push({
          type: 'CONSECUTIVE_TEACHING_PERIODS',
          severity: 'info_consecutive',
          day,
          startPeriod: run.startPeriod,
          endPeriod: run.endPeriod,
          length: run.length,
          message: `${teacherName} has 2 consecutive teaching periods on ${day} (Periods ${run.periods.join(', ')})`,
        });
      }
    });

    // 2. Missing free periods between classes (3+ periods taught with 0 gaps in between)
    if (dayMetrics.dailyTeachingPeriods >= 3 && dayMetrics.totalIdleTime === 0) {
      breakDiagnosticFindings.push({
        type: 'MISSING_FREE_PERIOD_BETWEEN_CLASSES',
        severity: 'rest_interval_alert',
        day,
        teachingPeriodsCount: dayMetrics.dailyTeachingPeriods,
        message: `${teacherName} has no free resting period between their ${dayMetrics.dailyTeachingPeriods} teaching periods on ${day}`,
      });
    }

    // 3. Excessively fragmented days (e.g. 1 or 2 classes with 3+ hours idle gap)
    if (dayMetrics.isExcessivelyFragmented) {
      breakDiagnosticFindings.push({
        type: 'EXCESSIVELY_FRAGMENTED_DAY',
        severity: 'schedule_fragmentation',
        day,
        totalIdleTime: dayMetrics.totalIdleTime,
        message: `${teacherName} has an excessively fragmented schedule on ${day} (${dayMetrics.dailyTeachingPeriods} classes separated by ${dayMetrics.totalIdleTime} idle gap hours)`,
      });
    }

    // 4. Teaching periods immediately before and after lunch
    if (dayMetrics.teachesAcrossLunch) {
      breakDiagnosticFindings.push({
        type: 'TEACHING_BEFORE_AND_AFTER_LUNCH',
        severity: 'lunch_flanking',
        day,
        periods: [3, 4],
        message: `${teacherName} is scheduled on Period 3 (pre-lunch) and Period 4 (post-lunch) on ${day}`,
      });
    }

    // 5. Unknown or unclassified activity diagnostic
    periodsTaught.forEach(p => {
      const slot = scheduleGrid[day]?.[p];
      if (slot && isUnknownActivity(slot)) {
        breakDiagnosticFindings.push({
          type: 'UNKNOWN_ACTIVITY_TYPE',
          severity: 'warning_classification_required',
          day,
          period: p,
          subjectCode: slot.subjectCode || 'NONE',
          subjectName: slot.subjectName || 'NONE',
          message: `${teacherName} is scheduled for an unrecognized activity [${slot.subjectCode || 'No Code'}: ${slot.subjectName || 'No Name'}] on ${day} P${p}. Administrative review required.`,
        });
      }
    });
  });

  // Weekly aggregate metrics
  const totalWeeklyFreePeriods = 30 - totalWeeklyTeachingPeriods;
  const meanDailyLoad = Number((totalWeeklyTeachingPeriods / 5.0).toFixed(2));

  let dailyVariance = 0;
  DAYS.forEach(day => {
    dailyVariance += Math.pow(dailyLoads[day] - meanDailyLoad, 2);
  });
  dailyVariance = Number(dailyVariance.toFixed(2));

  const totalWeeklyIdleTime = Object.values(dailyAnalysis).reduce((sum, d) => sum + d.totalIdleTime, 0);
  const totalWeeklyIsolatedPeriods = Object.values(dailyAnalysis).reduce((sum, d) => sum + d.isolatedPeriodsCount, 0);
  const longestWeeklyConsecutiveSequence = Object.values(dailyAnalysis).reduce((max, d) => Math.max(max, d.longestConsecutiveRun), 0);
  const weeklyPreLunchTotal = Object.values(dailyAnalysis).reduce((sum, d) => sum + d.preLunchCount, 0);
  const weeklyPostLunchTotal = Object.values(dailyAnalysis).reduce((sum, d) => sum + d.postLunchCount, 0);

  // 5. Unbalanced daily workload diagnostic
  const maxDayLoad = Math.max(...Object.values(dailyLoads));
  const minDayLoad = Math.min(...Object.values(dailyLoads));
  const hasUnbalancedWorkload = (maxDayLoad - minDayLoad >= 3) && totalWeeklyTeachingPeriods > 4;

  if (hasUnbalancedWorkload) {
    breakDiagnosticFindings.push({
      type: 'UNBALANCED_DAILY_WORKLOAD',
      severity: 'workload_distribution_skew',
      dailyLoads,
      dailyVariance,
      difference: maxDayLoad - minDayLoad,
      message: `${teacherName} has an uneven workload distribution across weekdays (Min: ${minDayLoad}h, Max: ${maxDayLoad}h, Variance: ${dailyVariance})`,
    });
  }

  // Classes, semesters, and subjects taught
  const distinctClasses = [...new Set(allocations.map(a => a.className))];
  const distinctSemesters = [...new Set(allocations.map(a => a.semester).filter(Boolean))].sort((a, b) => a - b);
  const distinctSubjects = [...new Set(allocations.map(a => `${a.subjectName} (${a.subjectCode})`))];

  return {
    teacherId,
    teacherName,
    department,
    dailyLoads,
    totalWeeklyTeachingPeriods,
    totalWeeklyFreePeriods,
    meanDailyLoad,
    dailyVariance,
    hasUnbalancedWorkload,
    longestWeeklyConsecutiveSequence,
    totalWeeklyIdleTime,
    totalWeeklyIsolatedPeriods,
    weeklyPreLunchTotal,
    weeklyPostLunchTotal,
    dailyAnalysis,
    breakDiagnosticFindings,
    distinctClasses,
    distinctSemesters,
    distinctSubjects,
    totalAllocationsCount: allocations.length,
    scheduleGrid,
  };
}

/**
 * Master analyzer function that builds and profiles all faculty personal timetables.
 */
function analyzeAllFacultyPersonalTimetables(timetableOrGrid, teachers = [], classes = []) {
  const teacherScheduleMap = buildAuthoritativeFacultySchedules(timetableOrGrid, teachers, classes);
  const facultyProfiles = [];

  for (const record of teacherScheduleMap.values()) {
    const profile = analyzeFacultyPersonalTimetable(record);
    facultyProfiles.push(profile);
  }

  // Sort alphabetically by teacher name
  facultyProfiles.sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  // Global summary statistics
  const totalFacultyCount = facultyProfiles.length;
  const activeTeachingFaculty = facultyProfiles.filter(p => p.totalWeeklyTeachingPeriods > 0);
  const inactiveFaculty = facultyProfiles.filter(p => p.totalWeeklyTeachingPeriods === 0);

  const allThreeConsecutiveViolations = facultyProfiles.flatMap(p =>
    p.breakDiagnosticFindings.filter(f => f.type === 'THREE_OR_MORE_CONSECUTIVE_PERIODS')
  );
  const allFragmentedDays = facultyProfiles.flatMap(p =>
    p.breakDiagnosticFindings.filter(f => f.type === 'EXCESSIVELY_FRAGMENTED_DAY')
  );
  const allLunchFlanking = facultyProfiles.flatMap(p =>
    p.breakDiagnosticFindings.filter(f => f.type === 'TEACHING_BEFORE_AND_AFTER_LUNCH')
  );
  const allUnbalancedWorkloads = facultyProfiles.flatMap(p =>
    p.breakDiagnosticFindings.filter(f => f.type === 'UNBALANCED_DAILY_WORKLOAD')
  );

  return {
    summary: {
      totalFacultyCount,
      activeTeachingFacultyCount: activeTeachingFaculty.length,
      inactiveFacultyCount: inactiveFaculty.length,
      threeOrMoreConsecutiveCount: allThreeConsecutiveViolations.length,
      fragmentedDaysCount: allFragmentedDays.length,
      lunchFlankingCount: allLunchFlanking.length,
      unbalancedWorkloadCount: allUnbalancedWorkloads.length,
    },
    facultyProfiles,
    findings: {
      threeOrMoreConsecutive: allThreeConsecutiveViolations,
      fragmentedDays: allFragmentedDays,
      lunchFlanking: allLunchFlanking,
      unbalancedWorkloads: allUnbalancedWorkloads,
    },
  };
}

/**
 * Validates that every faculty personal schedule slot agrees 100% with the student section timetable.
 */
function validateFacultyScheduleAgreement(timetableDoc, arg2 = [], arg3 = []) {
  let teachers = [];
  let classes = [];

  // Auto-detect argument order
  const isTeachers = (arr) => Array.isArray(arr) && arr.length > 0 && (arr[0]?.email !== undefined || arr[0]?.departmentId !== undefined || arr[0]?.experience !== undefined);
  if (isTeachers(arg2)) {
    teachers = arg2;
    classes = arg3;
  } else {
    classes = arg2;
    teachers = arg3;
  }

  const inconsistencies = [];
  const teacherScheduleMap = buildAuthoritativeFacultySchedules(timetableDoc, teachers, classes);

  let totalClassSlotsChecked = 0;
  const studentSlotIndex = new Map();
  (timetableDoc?.classTimetables || []).forEach(ct => {
    const classId = ct.classId?.toString() || '';
    (ct.slots || ct.schedule || []).forEach(slot => {
      if (!slot || slot.isEmpty || slot.isBreak) return;
      totalClassSlotsChecked++;
      const key = `${classId}::${slot.day}::${slot.period}`;
      studentSlotIndex.set(key, {
        classId,
        className: ct.className,
        day: slot.day,
        period: slot.period,
        subjectCode: slot.subjectCode,
        subjectName: slot.subjectName,
        teacherIds: extractSlotTeacherIds(slot),
        teacherNames: extractSlotTeacherNames(slot),
      });
    });
  });

  let totalFacultySlotsChecked = 0;
  // Verify every faculty allocation exists in student timetable
  for (const record of teacherScheduleMap.values()) {
    record.allocations.forEach(alloc => {
      totalFacultySlotsChecked++;
      const key = `${alloc.classId}::${alloc.day}::${alloc.period}`;
      const studentSlot = studentSlotIndex.get(key);

      if (!studentSlot) {
        inconsistencies.push({
          type: 'ORPHAN_FACULTY_ALLOCATION',
          teacherName: record.teacherName,
          allocation: alloc,
          message: `Faculty ${record.teacherName} has allocation ${alloc.subjectCode} in ${alloc.className} on ${alloc.day} P${alloc.period}, but class timetable has no matching active session.`,
        });
      } else {
        if (studentSlot.subjectCode && alloc.subjectCode && studentSlot.subjectCode !== alloc.subjectCode) {
          inconsistencies.push({
            type: 'SUBJECT_MISMATCH',
            teacherName: record.teacherName,
            facultySubject: alloc.subjectCode,
            studentSubject: studentSlot.subjectCode,
            day: alloc.day,
            period: alloc.period,
            className: alloc.className,
            message: `Subject mismatch in ${alloc.className} on ${alloc.day} P${alloc.period}: Faculty shows ${alloc.subjectCode}, Class shows ${studentSlot.subjectCode}`,
          });
        }
      }
    });
  }

  return {
    valid: inconsistencies.length === 0,
    inconsistenciesCount: inconsistencies.length,
    totalFacultySlotsChecked,
    totalClassSlotsChecked,
    inconsistencies,
  };
}

module.exports = {
  DAYS,
  PERIODS,
  ACTIVITY_TYPES,
  classifyActivity,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
  isPlacement,
  isTutorial,
  isUnknownActivity,
  extractSlotTeacherIds,
  extractSlotTeacherNames,
  analyzeDayRunsAndGaps,
  buildAuthoritativeFacultySchedules,
  analyzeFacultyPersonalTimetable,
  analyzeAllFacultyPersonalTimetables,
  validateFacultyScheduleAgreement,
};
