/**
 * Faculty Personal Timetable Quality Scorer
 * Phase 2 — Multi-Dimensional Explainable Scoring Model
 *
 * Dimensions:
 * 1. Consecutive Rest & Fatigue Prevention: 25 pts
 *    - 3+ consecutive periods for ordinary courses: forbidden (severe penalty)
 *    - 2 consecutive periods: permitted, but penalizes missing follow-up break
 * 2. Lunch Interval Separation & Integrity: 20 pts
 *    - Separates pre-lunch and post-lunch sessions
 *    - Penalizes flanking lunch (P3 and P4 on Mon-Thu, P4 and P5 on Friday)
 * 3. Daily Workload Distribution & Variance: 25 pts
 *    - Penalizes extreme day-to-day load spikes (max - min >= 3)
 *    - Penalizes concentration of > 4 periods in a single day
 * 4. Idle Gap & Fragmentation Control: 15 pts
 *    - Penalizes excessive gaps (>= 3 idle periods) on low-teaching days
 *    - Penalizes highly isolated single periods
 * 5. Institutional Workload & Integrity: 15 pts
 *    - Enforces zero double bookings and 100% assigned period placement
 * Total: 100 points
 */

const {
  DAYS,
  PERIODS,
  buildAuthoritativeFacultySchedules,
  analyzeDayRunsAndGaps,
} = require('./facultyPersonalTimetableAnalyzer');
const {
  ACTIVITY_TYPES,
  classifyActivity,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
  isPlacement,
  isTutorial,
  isUnknownActivity,
  isAuthorizedCapstoneBlock,
} = require('./activityClassifier');

const DEFAULT_FACULTY_SCORING_CONFIG = {
  weights: {
    consecutiveRest: 25,
    lunchSeparation: 20,
    dailyBalance: 25,
    idleGapControl: 15,
    institutionalIntegrity: 15,
  },
  penalties: {
    fourConsecutiveTeaching: 30,    // Severe penalty for 4+ consecutive teaching periods
    threeConsecutiveTheory: 25,     // Completely zeroes out the consecutiveRest dimension
    twoConsecutiveWithoutBreak: 2,  // Deducted when a 2-period block has no succeeding rest
    lunchFlanking: 4,               // Deducted per day with classes flanking lunch (P3+P4 or Fri P4+P5)
    highVarianceSpread: 3,          // Deducted when maxDay - minDay >= 3
    excessiveDailyLoad: 4,          // Deducted for days with > 4 teaching periods
    excessiveIdleGap: 2,            // Deducted for idle gap >= 3 on fragmented days
    isolatedPeriod: 1,              // Deducted for isolated teaching periods
    teacherDoubleBooking: 50,       // Catastrophic penalty gating overall score
  },
};

/**
 * Evaluates the faculty timetable quality for a single teacher schedule record.
 */
function scoreSingleFacultySchedule(record, config = DEFAULT_FACULTY_SCORING_CONFIG) {
  const { teacherId, teacherName, scheduleGrid, allocations } = record;
  const weights = config.weights || DEFAULT_FACULTY_SCORING_CONFIG.weights;
  const penalties = config.penalties || DEFAULT_FACULTY_SCORING_CONFIG.penalties;

  const penaltiesApplied = [];
  const explanations = [];

  // --- Dimension 1: Consecutive Rest & Fatigue Prevention (25 pts) ---
  let consecutiveScore = weights.consecutiveRest;
  let threeConsecutiveCount = 0;
  let fourConsecutiveCount = 0;
  let unbufferedPairsCount = 0;

  DAYS.forEach(day => {
    const slotsMap = scheduleGrid[day] || {};
    const periodsTaught = Object.keys(slotsMap).map(Number).sort((a, b) => a - b);
    const dayMetrics = analyzeDayRunsAndGaps(periodsTaught, day);

    // Global Check: Sequences of 4 or more consecutive teaching periods (Rule A)
    let rawRun = [];
    periodsTaught.forEach(p => {
      if (rawRun.length === 0 || p === rawRun[rawRun.length - 1] + 1) {
        rawRun.push(p);
      } else {
        checkRawRun(rawRun);
        rawRun = [p];
      }
    });
    checkRawRun(rawRun);

    function checkRawRun(run) {
      if (run.length >= 4) {
        // Exclude authorized full-day Capstone Project blocks (S8 CST416 on Thu/Fri for Dr S Gunasekaran)
        const runSlots = run.map(cp => slotsMap[cp]);
        const isAuthCapstone = isAuthorizedCapstoneBlock(runSlots, day, teacherId) || isAuthorizedCapstoneBlock(runSlots, day, teacherName);
        if (isAuthCapstone) {
          return;
        }
        fourConsecutiveCount++;
        penaltiesApplied.push({
          dimension: 'consecutiveRest',
          type: 'FOUR_OR_MORE_CONSECUTIVE_TEACHING',
          day,
          periods: [...run],
          penalty: penalties.fourConsecutiveTeaching || 30,
          message: `${teacherName} teaches ${run.length} consecutive periods on ${day} (${run.join(', ')}) without a rest gap`,
        });
      }
    }

    dayMetrics.consecutiveRuns.forEach(run => {
      // Within this occupied run (already bounded by lunch), extract contiguous sub-runs of ordinary theory
      const theorySubRuns = [];
      let currentTheoryRun = [];

      run.periods.forEach(p => {
        const slot = slotsMap[p];
        if (isOrdinaryTheory(slot)) {
          currentTheoryRun.push(p);
        } else {
          if (currentTheoryRun.length > 0) {
            theorySubRuns.push(currentTheoryRun);
            currentTheoryRun = [];
          }
        }
      });
      if (currentTheoryRun.length > 0) {
        theorySubRuns.push(currentTheoryRun);
      }

      // 1. Evaluate three or more consecutive theory periods
      theorySubRuns.forEach(tRun => {
        if (tRun.length >= 3) {
          threeConsecutiveCount++;
          penaltiesApplied.push({
            dimension: 'consecutiveRest',
            type: 'THREE_CONSECUTIVE_THEORY',
            day,
            periods: tRun,
            penalty: penalties.threeConsecutiveTheory,
            message: `${teacherName} teaches ${tRun.length} consecutive ordinary theory periods on ${day} (${tRun.join(', ')}) without a break`,
          });
        } else if (tRun.length === 2) {
          // Allowed, but check if unbuffered (followed immediately by another teaching period without rest)
          const lastPeriod = tRun[tRun.length - 1];
          if (lastPeriod < 6 && periodsTaught.includes(lastPeriod + 1)) {
            unbufferedPairsCount++;
            penaltiesApplied.push({
              dimension: 'consecutiveRest',
              type: 'TWO_CONSECUTIVE_UNBUFFERED',
              day,
              periods: tRun,
              penalty: penalties.twoConsecutiveWithoutBreak,
              message: `${teacherName} has a 2-period theory block on ${day} (${tRun.join(', ')}) followed immediately by additional teaching without rest`,
            });
          }
        }
      });
    });
  });

  if (fourConsecutiveCount > 0 || threeConsecutiveCount > 0) {
    consecutiveScore = 0;
  } else {
    consecutiveScore = Math.max(0, consecutiveScore - unbufferedPairsCount * penalties.twoConsecutiveWithoutBreak);
  }

  // --- Dimension 2: Lunch Interval Separation & Integrity (20 pts) ---
  let lunchScore = weights.lunchSeparation;
  let lunchFlankingDaysCount = 0;

  DAYS.forEach(day => {
    const slotsMap = scheduleGrid[day] || {};
    const periodsTaught = Object.keys(slotsMap).map(Number).sort((a, b) => a - b);

    // KTU Lunch: Mon-Thu between P3 and P4; Friday between P4 and P5
    const isFriday = day === 'Friday';
    const preLunchP = isFriday ? 4 : 3;
    const postLunchP = isFriday ? 5 : 4;

    const teachesPreLunch = periodsTaught.includes(preLunchP);
    const teachesPostLunch = periodsTaught.includes(postLunchP);

    if (teachesPreLunch && teachesPostLunch) {
      lunchFlankingDaysCount++;
      penaltiesApplied.push({
        dimension: 'lunchSeparation',
        type: 'LUNCH_FLANKING',
        day,
        periods: [preLunchP, postLunchP],
        penalty: penalties.lunchFlanking,
        message: `${teacherName} teaches both before (P${preLunchP}) and immediately after (P${postLunchP}) the lunch break on ${day}`,
      });
    }
  });

  lunchScore = Math.max(0, lunchScore - lunchFlankingDaysCount * penalties.lunchFlanking);

  // --- Dimension 3: Daily Workload Distribution & Variance (25 pts) ---
  let dailyBalanceScore = weights.dailyBalance;
  const dailyLoads = {};
  DAYS.forEach(day => {
    dailyLoads[day] = Object.keys(scheduleGrid[day] || {}).length;
  });

  // Calculate spread across teaching days
  // S8 Capstone Supervisor (Dr S Gunasekaran) is exempt from Thu/Fri full day variance penalties
  const isS8CapstoneSupervisor = teacherName.toLowerCase().includes('gunasekaran');
  const activeLoads = DAYS.map(d => dailyLoads[d]);
  const maxDayLoad = Math.max(...activeLoads);
  const minDayLoad = Math.min(...activeLoads);
  const spread = maxDayLoad - minDayLoad;

  if (!isS8CapstoneSupervisor && spread >= 3 && allocations.length >= 4) {
    const spreadPenalty = (spread - 2) * penalties.highVarianceSpread;
    dailyBalanceScore = Math.max(0, dailyBalanceScore - spreadPenalty);
    penaltiesApplied.push({
      dimension: 'dailyBalance',
      type: 'HIGH_VARIANCE_SPREAD',
      spread,
      dailyLoads,
      penalty: spreadPenalty,
      message: `${teacherName} has an uneven workload spread (${minDayLoad}h to ${maxDayLoad}h) across the week`,
    });
  }

  // Check for days with excessive load (> 4 periods)
  DAYS.forEach(day => {
    const load = dailyLoads[day];
    if (!isS8CapstoneSupervisor && load > 4) {
      dailyBalanceScore = Math.max(0, dailyBalanceScore - penalties.excessiveDailyLoad);
      penaltiesApplied.push({
        dimension: 'dailyBalance',
        type: 'EXCESSIVE_DAILY_LOAD',
        day,
        load,
        penalty: penalties.excessiveDailyLoad,
        message: `${teacherName} teaches ${load} periods on ${day} (exceeds recommended 4 periods/day ceiling)`,
      });
    }
  });

  // --- Dimension 4: Idle Gap & Fragmentation Control (15 pts) ---
  let idleGapScore = weights.idleGapControl;
  let fragmentedDaysCount = 0;
  let isolatedPeriodsCount = 0;

  DAYS.forEach(day => {
    const slotsMap = scheduleGrid[day] || {};
    const periodsTaught = Object.keys(slotsMap).map(Number).sort((a, b) => a - b);
    const dayMetrics = analyzeDayRunsAndGaps(periodsTaught, day);

    // Fragmented day: <= 2 classes taught with idle gap >= 3 periods
    if (dayMetrics.isExcessivelyFragmented) {
      fragmentedDaysCount++;
      penaltiesApplied.push({
        dimension: 'idleGapControl',
        type: 'FRAGMENTED_DAY',
        day,
        periodsTaught,
        idleGapTime: dayMetrics.totalIdleTime,
        penalty: penalties.excessiveIdleGap,
        message: `${teacherName} has a fragmented schedule on ${day} with ${dayMetrics.totalIdleTime} idle gap periods`,
      });
    }

    isolatedPeriodsCount += dayMetrics.isolatedPeriodsCount;
  });

  idleGapScore = Math.max(
    0,
    idleGapScore -
      fragmentedDaysCount * penalties.excessiveIdleGap -
      Math.min(6, isolatedPeriodsCount * penalties.isolatedPeriod)
  );

  // --- Dimension 5: Institutional Workload & Integrity (15 pts) ---
  let institutionalScore = weights.institutionalIntegrity;
  // Check for internal simultaneous double booking in personal schedule
  let teacherDoubleBookingCount = 0;
  DAYS.forEach(day => {
    PERIODS.forEach(p => {
      const slotOrArray = scheduleGrid[day]?.[p];
      if (Array.isArray(slotOrArray) && slotOrArray.length > 1) {
        // If shared session (e.g. S8 CSE A / B Capstone with same sharedSessionId), exempt
        const sharedIds = new Set(slotOrArray.map(s => s.sharedSessionId).filter(Boolean));
        if (sharedIds.size === 0 || slotOrArray.length > sharedIds.size) {
          teacherDoubleBookingCount++;
        }
      }
    });
  });

  if (teacherDoubleBookingCount > 0) {
    institutionalScore = 0;
    penaltiesApplied.push({
      dimension: 'institutionalIntegrity',
      type: 'TEACHER_DOUBLE_BOOKING',
      count: teacherDoubleBookingCount,
      penalty: penalties.teacherDoubleBooking,
      message: `${teacherName} is double booked for ${teacherDoubleBookingCount} period(s)`,
    });
  }

  const rawOverall =
    consecutiveScore + lunchScore + dailyBalanceScore + idleGapScore + institutionalScore;

  const isGated = fourConsecutiveCount > 0 || threeConsecutiveCount > 0 || teacherDoubleBookingCount > 0;
  const overallScore = isGated ? Math.min(rawOverall, 40) : rawOverall;

  return {
    teacherId,
    teacherName,
    overallScore,
    isGated,
    consecutiveScore,
    lunchScore,
    dailyBalanceScore,
    idleGapScore,
    institutionalScore,
    threeConsecutiveCount,
    fourConsecutiveCount,
    lunchFlankingDaysCount,
    dailyLoads,
    penaltiesApplied,
  };
}

/**
 * Evaluates the global faculty quality score across all teachers for a timetable grid.
 */
function scoreFacultyQuality(gridOrTimetable, data = {}, customConfig = {}) {
  const config = {
    weights: { ...DEFAULT_FACULTY_SCORING_CONFIG.weights, ...(customConfig.weights || {}) },
    penalties: { ...DEFAULT_FACULTY_SCORING_CONFIG.penalties, ...(customConfig.penalties || {}) },
  };

  const teachers = data.teachers || [];
  const classes = data.classes || [];
  const teacherScheduleMap = buildAuthoritativeFacultySchedules(gridOrTimetable, teachers, classes);

  const facultyScores = [];
  let totalScoreSum = 0;
  let activeFacultyCount = 0;
  let totalFourConsecutive = 0;
  let totalThreeConsecutive = 0;
  let totalLunchFlanking = 0;
  let totalDoubleBookings = 0;

  for (const record of teacherScheduleMap.values()) {
    const singleScore = scoreSingleFacultySchedule(record, config);
    facultyScores.push(singleScore);

    if (record.allocations.length > 0) {
      activeFacultyCount++;
      totalScoreSum += singleScore.overallScore;
      totalFourConsecutive += (singleScore.fourConsecutiveCount || 0);
      totalThreeConsecutive += singleScore.threeConsecutiveCount;
      totalLunchFlanking += singleScore.lunchFlankingDaysCount;
      if (singleScore.penaltiesApplied.some(p => p.type === 'TEACHER_DOUBLE_BOOKING')) {
        totalDoubleBookings++;
      }
    }
  }

  const averageScore = activeFacultyCount > 0 ? Math.round(totalScoreSum / activeFacultyCount) : 100;
  const isGated = totalDoubleBookings > 0 || totalFourConsecutive > 0 || totalThreeConsecutive > 0;

  // Sort faculty by score ascending to identify worst-performing schedules
  facultyScores.sort((a, b) => a.overallScore - b.overallScore);

  const dimensionAverages = {
    consecutiveRest: activeFacultyCount > 0
      ? Math.round(facultyScores.reduce((sum, f) => sum + f.consecutiveScore, 0) / activeFacultyCount)
      : config.weights.consecutiveRest,
    lunchSeparation: activeFacultyCount > 0
      ? Math.round(facultyScores.reduce((sum, f) => sum + f.lunchScore, 0) / activeFacultyCount)
      : config.weights.lunchSeparation,
    dailyBalance: activeFacultyCount > 0
      ? Math.round(facultyScores.reduce((sum, f) => sum + f.dailyBalanceScore, 0) / activeFacultyCount)
      : config.weights.dailyBalance,
    idleGapControl: activeFacultyCount > 0
      ? Math.round(facultyScores.reduce((sum, f) => sum + f.idleGapScore, 0) / activeFacultyCount)
      : config.weights.idleGapControl,
    institutionalIntegrity: activeFacultyCount > 0
      ? Math.round(facultyScores.reduce((sum, f) => sum + f.institutionalScore, 0) / activeFacultyCount)
      : config.weights.institutionalIntegrity,
  };

  return {
    overall: averageScore,
    totalScoreSum,
    preciseAverage: activeFacultyCount > 0 ? totalScoreSum / activeFacultyCount : 100,
    isGated,
    gateReason: isGated
      ? `${totalDoubleBookings} faculty collision(s), ${totalFourConsecutive} four-consecutive run(s), or ${totalThreeConsecutive} three-consecutive violation(s) present.`
      : null,
    activeFacultyCount,
    totalFourConsecutive,
    totalThreeConsecutive,
    totalLunchFlanking,
    totalDoubleBookings,
    dimensionAverages,
    facultyScores,
    worstFaculty: facultyScores.slice(0, 5),
  };
}

module.exports = {
  DEFAULT_FACULTY_SCORING_CONFIG,
  ACTIVITY_TYPES,
  classifyActivity,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
  isPlacement,
  isTutorial,
  isUnknownActivity,
  scoreSingleFacultySchedule,
  scoreFacultyQuality,
};
