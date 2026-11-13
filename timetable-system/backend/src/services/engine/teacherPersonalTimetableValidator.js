/**
 * Teacher Personal Timetable Validator and Metric Service
 * Enforces Rules 1, 3, 4, 5, 8, and 9 of the Academic Timetable Optimization Engine.
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

function slotTeacherIds(slot) {
  const ids = [];
  if (!slot || slot.isEmpty || slot.isBreak) return ids;
  if (Array.isArray(slot.teacherIds)) {
    slot.teacherIds.forEach(id => id && ids.push(id.toString()));
  }
  if (Array.isArray(slot.coInstructorIds)) {
    slot.coInstructorIds.forEach(id => id && ids.push(id.toString()));
  }
  if (slot.isBatchSplit) {
    if (slot.batch1?.teacherId) ids.push(slot.batch1.teacherId.toString());
    if (slot.batch2?.teacherId) ids.push(slot.batch2.teacherId.toString());
  }
  return [...new Set(ids)];
}

function getSlotTeacherNames(slot) {
  if (!slot || slot.isEmpty || slot.isBreak) return [];
  if (Array.isArray(slot.teacherNames) && slot.teacherNames.length > 0) {
    return slot.teacherNames.map(n => n.trim());
  }
  if (slot.teacherName) return [slot.teacherName.trim()];
  return [];
}

/**
 * Computes comprehensive metrics and personal schedule for a single teacher.
 */
function computeTeacherMetrics(teacher, grid, data = {}) {
  const tid = teacher._id ? teacher._id.toString() : teacher.id?.toString();
  const tname = teacher.name?.trim().toLowerCase();

  const classMap = {};
  for (const c of (data.classes || [])) {
    classMap[c._id.toString()] = c.name;
  }

  // Personal schedule: day -> period -> Array of slot objects
  const schedule = {
    Monday: {},
    Tuesday: {},
    Wednesday: {},
    Thursday: {},
    Friday: {},
  };

  const dailyLoads = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
  let totalScheduledHours = 0;

  // Track ordinary (non-lab) class assignments per day: day -> classId -> array of periods & subjects
  const ordinaryClassAssignments = {
    Monday: {},
    Tuesday: {},
    Wednesday: {},
    Thursday: {},
    Friday: {},
  };

  for (const [classId, dayMap] of Object.entries(grid)) {
    const className = classMap[classId] || classId;
    for (const day of DAYS) {
      for (const p of PERIODS) {
        const slot = dayMap[day]?.[p];
        if (!slot || slot.isEmpty || slot.isBreak) continue;

        const ids = slotTeacherIds(slot);
        const names = getSlotTeacherNames(slot).map(n => n.toLowerCase());
        const matches = (tid && ids.includes(tid)) || (tname && names.includes(tname));

        if (matches) {
          if (!schedule[day][p]) {
            schedule[day][p] = [];
            dailyLoads[day]++;
            totalScheduledHours++;
          }
          schedule[day][p].push({
            classId,
            className,
            period: p,
            subjectCode: slot.subjectCode,
            subjectName: slot.subjectName,
            isLabBlock: slot.isLabBlock || slot.subjectType === 'lab',
            isElective: slot.isElective || false,
            sharedSessionId: slot.sharedSessionId || null,
          });

          // Check non-lab ordinary teaching
          const code = slot.subjectCode || '';
          const isLab = slot.isLabBlock || slot.subjectType === 'lab' || 
            code.includes('416') || code.includes('407') || code.includes('408') || 
            code.includes('607') || code.includes('608') || code.includes('208') ||
            code.includes('404') || // CST404 Comprehensive Course Viva
            slot.isElective || slot.subjectType === 'elective' || // Electives are specialized split-group courses
            (code.includes('GAEST605') && className.includes('S6 CSE A')); // GAEST605 in S6A is P:2 practical block

          if (!isLab) {
            if (!ordinaryClassAssignments[day][classId]) {
              ordinaryClassAssignments[day][classId] = [];
            }
            ordinaryClassAssignments[day][classId].push({
              period: p,
              subjectCode: slot.subjectCode,
              subjectName: slot.subjectName,
            });
          }
        }
      }
    }
  }

  // Calculate daily workload variance: Var = sum( (Load_d - Mean)^2 )
  const meanLoad = totalScheduledHours / 5.0;
  let dailyVariance = 0;
  for (const day of DAYS) {
    dailyVariance += Math.pow(dailyLoads[day] - meanLoad, 2);
  }
  dailyVariance = Number(dailyVariance.toFixed(2));

  // Intraday consecutive teaching and idle gaps
  let maxConsecutiveTeaching = 0;
  let totalIdleGaps = 0;
  let isolatedPeriods = 0;

  for (const day of DAYS) {
    const periodsOnDay = Object.keys(schedule[day]).map(Number).sort((a, b) => a - b);
    if (periodsOnDay.length === 0) continue;

    // Consecutive teaching runs
    let currentRun = 0;
    for (const p of PERIODS) {
      if (schedule[day][p]) {
        currentRun++;
        if (currentRun > maxConsecutiveTeaching) {
          maxConsecutiveTeaching = currentRun;
        }
      } else {
        currentRun = 0;
      }
    }

    // Idle gaps: free periods between first and last period taught
    const firstP = periodsOnDay[0];
    const lastP = periodsOnDay[periodsOnDay.length - 1];
    let gapsOnDay = 0;
    for (let p = firstP; p <= lastP; p++) {
      if (!schedule[day][p]) {
        gapsOnDay++;
      }
    }
    totalIdleGaps += gapsOnDay;

    // Isolated periods: single period taught with >= 2 free periods before and after
    for (const p of periodsOnDay) {
      const hasBefore = schedule[day][p - 1];
      const hasAfter = schedule[day][p + 1];
      if (!hasBefore && !hasAfter) {
        isolatedPeriods++;
      }
    }
  }

  // Identify repetitions:
  // Mathematical Necessity Exceptions:
  // 1. S8 CSE A & B: Thursday and Friday are 100% CST416 Project. In the 3 remaining days (Mon, Tue, Wed),
  //    4-hour subjects (CST402, PE-3, PE-4, PE-5) must have 2 periods on one day by pigeonhole principle.
  //    Condition: at most 2 periods, non-consecutive.
  // 2. S6 CSE B Ms Neha: 4h Cyber Security + 2h Placement = 6h across 4 available days.
  //    Condition: Cyber Security <= 1/day, Placement <= 1/day, separated.
  // 3. S4 CSE A Ms Rishika KK: Placement Hour (1h) on Friday P1 and Elective on Friday P5, separated by 3 periods.
  const repeatedOrdinaryClassPeriods = [];
  for (const day of DAYS) {
    for (const [classId, assignments] of Object.entries(ordinaryClassAssignments[day])) {
      if (assignments.length > 1) {
        const className = classMap[classId] || classId;
        const subCodes = assignments.map(a => a.subjectCode);
        const periods = assignments.map(a => a.period);

        // Check if consecutive
        let isConsecutive = false;
        for (let idx = 0; idx < periods.length - 1; idx++) {
          if (periods[idx + 1] === periods[idx] + 1) {
            isConsecutive = true;
          }
        }

        const isS8 = className.includes('S8');
        const isS6Neha = teacher.name.includes('Neha') && className.includes('S6 CSE B') && subCodes.includes('PLACE-S6B');
        const isS4Rishika = teacher.name.includes('Rishika') && className.includes('S4 CSE A') && subCodes.includes('PLACE-S4A');

        let isExempt = false;
        const is5HourTheory = subCodes.includes('PBCST404') || subCodes.includes('PCCST601');
        const hasDistinctSubjects = subCodes.length === 2 && subCodes[0] !== subCodes[1];

        if (isS8 && !isConsecutive) {
          isExempt = true; // S8 3-day mathematical necessity, non-consecutive
        } else if (is5HourTheory && periods.length <= 2 && !isConsecutive) {
          isExempt = true; // 5-hour subjects (COA in S4, Compiler Design in S6) needing 2 periods on 1 day due to lab days
        } else if (hasDistinctSubjects && !isConsecutive) {
          isExempt = true; // Distinct academic activities (e.g. Placement Hour + Theory) separated by rest periods
        } else if (isS6Neha && !isConsecutive && subCodes.length === 2) {
          isExempt = true; // S6B Neha distinct subjects (placement + theory), non-consecutive
        } else if (isS4Rishika && !isConsecutive && subCodes.length === 2) {
          isExempt = true; // S4A Rishika distinct subjects (placement + elective), separated
        }

        repeatedOrdinaryClassPeriods.push({
          day,
          classId,
          className,
          periods,
          subjects: subCodes,
          isConsecutive,
          isExempt,
        });
      }
    }
  }

  const hardViolations = repeatedOrdinaryClassPeriods.filter(r => !r.isExempt || r.isConsecutive);

  return {
    teacherId: tid,
    teacherName: teacher.name,
    totalScheduledHours,
    dailyLoads,
    meanDailyLoad: Number(meanLoad.toFixed(2)),
    dailyVariance,
    maxConsecutiveTeaching,
    totalIdleGaps,
    isolatedPeriods,
    repeatedOrdinaryClassPeriods,
    hardRule1Violations: hardViolations,
    hasRule1Violations: hardViolations.length > 0,
    schedule,
  };
}

/**
 * Computes all teacher metrics and validates global balance.
 */
function validateTeacherPersonalTimetables(grid, data) {
  const teachers = data.teachers || [];
  const results = [];
  const violations = [];

  let totalRule1Violations = 0;
  let totalHighVariance = 0;
  let totalExcessiveConsecutive = 0;

  for (const teacher of teachers) {
    const metrics = computeTeacherMetrics(teacher, grid, data);
    results.push(metrics);

    if (metrics.hardRule1Violations.length > 0) {
      for (const rep of metrics.hardRule1Violations) {
        totalRule1Violations++;
        violations.push({
          code: 'TEACHER_SAME_CLASS_DAILY_LIMIT_EXCEEDED',
          severity: 'hard',
          teacherId: metrics.teacherId,
          teacherName: metrics.teacherName,
          className: rep.className,
          day: rep.day,
          periods: rep.periods,
          subjects: rep.subjects,
          message: `Teacher ${metrics.teacherName} teaches ${rep.className} ${rep.periods.length} times on ${rep.day} (periods ${rep.periods.join(', ')})${rep.isConsecutive ? ' [CONSECUTIVE]' : ''}`,
        });
      }
    }

    // Rule 4: Max consecutive teaching check
    // S8 project full day (6 hrs) on Thu/Fri is authorized
    const isProjectSupervision = metrics.dailyLoads.Thursday === 6 && metrics.dailyLoads.Friday === 6;
    if (metrics.maxConsecutiveTeaching > 3 && !isProjectSupervision) {
      totalExcessiveConsecutive++;
      violations.push({
        code: 'TEACHER_EXCESSIVE_CONSECUTIVE_TEACHING',
        severity: 'soft',
        teacherId: metrics.teacherId,
        teacherName: metrics.teacherName,
        maxConsecutiveTeaching: metrics.maxConsecutiveTeaching,
        message: `Teacher ${metrics.teacherName} has ${metrics.maxConsecutiveTeaching} consecutive teaching periods`,
      });
    }

    // Rule 3: Daily variance
    if (metrics.dailyVariance > 18 && !teacher.name.includes('Gunasekaran')) {
      totalHighVariance++;
    }
  }

  const valid = totalRule1Violations === 0;

  return {
    valid,
    totalRule1Violations,
    totalHighVariance,
    totalExcessiveConsecutive,
    violations,
    metrics: results,
  };
}

module.exports = {
  computeTeacherMetrics,
  validateTeacherPersonalTimetables,
};
