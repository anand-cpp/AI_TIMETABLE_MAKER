/**
 * Faculty Personal Timetable Optimizer
 * Phase 2 — Constraint-Safe Multi-Activity Rearrangement & Rest-Break Optimizer
 *
 * Primary Objective:
 * Optimizes faculty personal schedules so that:
 * - 3+ consecutive teaching periods are eliminated for ordinary theory courses.
 * - Rest breaks and gap periods are intelligently distributed.
 * - Lunch flanking (P3+P4 on Mon-Thu, P4+P5 on Friday) is minimized.
 * - 100% academic placement is strictly preserved (0 missing periods, 0 double bookings).
 * - Fixed slots, laboratory rooms, and elective sync remain 100% protected.
 * - Transactional rollback: baseline is preserved if no improvement can be made safely.
 */

const {
  scoreFacultyQuality,
} = require('./facultyTimetableScorer');
const {
  ACTIVITY_TYPES,
  classifyActivity,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
} = require('./activityClassifier');
const { validateOutput } = require('./constraintValidator');
const { validateGlobalTimetable } = require('./globalTimetableValidator');
const { auditTimetable } = require('./independentValidator');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

/**
 * Deep clones a timetable grid.
 */
function cloneGrid(grid) {
  return JSON.parse(JSON.stringify(grid));
}

/**
 * Swaps two slots within a class grid and updates their coordinate metadata.
 */
function swapClassSlots(grid, classId, s1, s2) {
  const temp = grid[classId][s1.day][s1.period];
  grid[classId][s1.day][s1.period] = grid[classId][s2.day][s2.period];
  grid[classId][s2.day][s2.period] = temp;

  if (grid[classId][s1.day][s1.period]) {
    grid[classId][s1.day][s1.period].day = s1.day;
    grid[classId][s1.day][s1.period].period = s1.period;
  }
  if (grid[classId][s2.day][s2.period]) {
    grid[classId][s2.day][s2.period].day = s2.day;
    grid[classId][s2.day][s2.period].period = s2.period;
  }
}

/**
 * Moves a slot from a source cell to an empty destination cell.
 */
function moveSlotToEmpty(grid, classId, src, dest) {
  grid[classId][dest.day][dest.period] = grid[classId][src.day][src.period];
  if (grid[classId][dest.day][dest.period]) {
    grid[classId][dest.day][dest.period].day = dest.day;
    grid[classId][dest.day][dest.period].period = dest.period;
  }
  grid[classId][src.day][src.period] = {
    isEmpty: true,
    isBreak: false,
    isLocked: false,
    subjectType: 'empty',
    day: src.day,
    period: src.period,
  };
}

/**
 * Main faculty timetable optimization engine.
 */
function optimizeFacultyTimetable(grid, data, options = {}) {
  const startTime = Date.now();
  const maxPasses = options.maxPasses || 5;
  const scoringConfig = options.scoringConfig || {};

  // 1. Transactional isolation: Save baseline candidate
  const baselineGrid = cloneGrid(grid);
  const baselineValidation = validateOutput(baselineGrid, data, []);

  // Safety Gate: Do not optimize if baseline is already invalid
  if (!baselineValidation.valid || baselineValidation.hardViolationsCount > 0) {
    return {
      success: false,
      improved: false,
      error: 'Cannot optimize an invalid baseline timetable with existing hard conflicts.',
      grid,
      baselineScore: 0,
      finalScore: 0,
    };
  }

  const baselineScoreObj = scoreFacultyQuality(baselineGrid, data, scoringConfig);
  let bestGrid = cloneGrid(baselineGrid);
  let bestScoreSum = baselineScoreObj.totalScoreSum;
  let bestThreeConsecutive = baselineScoreObj.totalThreeConsecutive;
  let bestLunchFlanking = baselineScoreObj.totalLunchFlanking;

  const classes = data.classes || [];
  const auditTrail = [];

  // Identify linked S8 classes for synchronized elective swaps
  const s8a = classes.find(c => c.name.includes('S8') && c.name.includes('A'))?._id?.toString();
  const s8b = classes.find(c => c.name.includes('S8') && c.name.includes('B'))?._id?.toString();

  let pass = 0;
  let totalAcceptedMoves = 0;

  while (pass < maxPasses) {
    pass++;
    let passMoves = 0;

    for (const cls of classes) {
      const cid = cls._id.toString();
      const isS8Linked = (cid === s8a || cid === s8b);

      // Collect all movable and empty slots in this class
      const allSlots = [];
      for (const d of DAYS) {
        for (const p of PERIODS) {
          allSlots.push({ day: d, period: p, slot: bestGrid[cid]?.[d]?.[p] });
        }
      }

      for (let i = 0; i < allSlots.length; i++) {
        for (let j = i + 1; j < allSlots.length; j++) {
          const s1 = allSlots[i];
          const s2 = allSlots[j];

          const slot1 = bestGrid[cid]?.[s1.day]?.[s1.period];
          const slot2 = bestGrid[cid]?.[s2.day]?.[s2.period];

          // 1. Immutable slots: breaks, explicitly locked slots, institutional labs & capstones
          if (slot1?.isBreak || slot2?.isBreak) continue;
          if (slot1?.isLocked || slot2?.isLocked) continue;
          if (isInstitutionalLabOrProject(slot1) || isInstitutionalLabOrProject(slot2)) continue;

          // 2. Do not swap two empty slots
          const s1Empty = !slot1 || slot1.isEmpty;
          const s2Empty = !slot2 || slot2.isEmpty;
          if (s1Empty && s2Empty) continue;

          // 3. Do not swap identical subjects
          if (!s1Empty && !s2Empty && slot1.subjectId && slot1.subjectId.toString() === slot2.subjectId?.toString()) {
            continue;
          }

          // 4. Minor tracks must never be displaced
          if (slot1?.isMinor || slot2?.isMinor) continue;

          // Perform trial move on isolated candidate
          const trialGrid = cloneGrid(bestGrid);
          const involvesElective = slot1?.isElective || slot2?.isElective;

          if (involvesElective) {
            // Synchronize elective swap across all participating sections in this semester
            const semClassIds = (data.classes || [])
              .filter(c => c.semester === cls.semester)
              .map(c => c._id.toString());

            let canSync = true;
            for (const otherCid of semClassIds) {
              const oSlot1 = bestGrid[otherCid]?.[s1.day]?.[s1.period];
              const oSlot2 = bestGrid[otherCid]?.[s2.day]?.[s2.period];
              if (
                oSlot1?.isBreak ||
                oSlot2?.isBreak ||
                oSlot1?.isLocked ||
                oSlot2?.isLocked ||
                isInstitutionalLabOrProject(oSlot1) ||
                isInstitutionalLabOrProject(oSlot2) ||
                oSlot1?.isMinor ||
                oSlot2?.isMinor
              ) {
                canSync = false;
                break;
              }
            }
            if (!canSync) continue;

            for (const otherCid of semClassIds) {
              swapClassSlots(trialGrid, otherCid, s1, s2);
            }
          } else {
            if (s2Empty) {
              moveSlotToEmpty(trialGrid, cid, s1, s2);
            } else if (s1Empty) {
              moveSlotToEmpty(trialGrid, cid, s2, s1);
            } else {
              swapClassSlots(trialGrid, cid, s1, s2);
            }
          }

          // Strict verification: No hard constraint may be violated
          const val = validateOutput(trialGrid, data, []);
          if (!val.valid || val.hardViolationsCount > 0) {
            continue; // Rejection: Hard constraint violation encountered
          }

          // Strict verification: No global collision or desynchronization
          const globalVal = validateGlobalTimetable(trialGrid, data);
          if (!globalVal.valid || globalVal.hardViolationsCount > 0) {
            continue; // Rejection: Global hard constraint violation encountered
          }

          // Strict verification: Independent validator check (FACULTY_REST_GAP, room clashes, etc.)
          const auditVal = auditTimetable(trialGrid, data);
          if (auditVal && auditVal.hardViolations && auditVal.hardViolations.length > 0) {
            continue; // Rejection: Independent validator hard violation encountered
          }

          // Strict verification: Subject workload must not be lost
          const underScheduled = (val.hardViolations || []).filter(v => v.type === 'SUBJECT_UNDER_SCHEDULED');
          if (underScheduled.length > 0) {
            continue;
          }

          // Evaluate candidate faculty score
          const trialScore = scoreFacultyQuality(trialGrid, data, scoringConfig);

          // Acceptance criteria:
          // A) Elimination of 3+ consecutive periods takes utmost priority
          // B) Improvement in overall faculty score sum
          // C) Reduction in lunch flanking when score sum is equal
          const isStrictlyBetter =
            trialScore.totalThreeConsecutive < bestThreeConsecutive ||
            (trialScore.totalThreeConsecutive === bestThreeConsecutive && trialScore.totalScoreSum > bestScoreSum) ||
            (trialScore.totalThreeConsecutive === bestThreeConsecutive &&
              trialScore.totalScoreSum === bestScoreSum &&
              trialScore.totalLunchFlanking < bestLunchFlanking);

          if (isStrictlyBetter) {
            const moveDesc = `Class ${cls.name}: swapped (${s1.day} P${s1.period}) [${slot1?.subjectCode || 'EMPTY'}] with (${s2.day} P${s2.period}) [${slot2?.subjectCode || 'EMPTY'}]`;

            bestGrid = trialGrid;
            bestScoreSum = trialScore.totalScoreSum;
            bestThreeConsecutive = trialScore.totalThreeConsecutive;
            bestLunchFlanking = trialScore.totalLunchFlanking;
            passMoves++;
            totalAcceptedMoves++;

            auditTrail.push({
              pass,
              className: cls.name,
              move: moveDesc,
              scoreSum: bestScoreSum,
              threeConsecutive: bestThreeConsecutive,
              lunchFlanking: bestLunchFlanking,
            });
            break; // Move to next slot pair
          }
        }
      }
    }

    if (passMoves === 0) {
      break; // Optimization converged
    }
  }

  // Final verification of optimized solution against baseline
  const finalScoreObj = scoreFacultyQuality(bestGrid, data, scoringConfig);
  const finalVal = validateOutput(bestGrid, data, []);
  const finalGlobalVal = validateGlobalTimetable(bestGrid, data);
  const finalAudit = auditTimetable(bestGrid, data);

  // Fail-safe guarantee: If for any reason the final solution regressed or introduced any violation, revert to baseline
  if (
    !finalVal.valid ||
    finalVal.hardViolationsCount > 0 ||
    !finalGlobalVal.valid ||
    finalGlobalVal.hardViolationsCount > 0 ||
    (finalAudit && finalAudit.hardViolations && finalAudit.hardViolations.length > 0) ||
    finalScoreObj.overall < baselineScoreObj.overall
  ) {
    return {
      success: true,
      improved: false,
      grid: baselineGrid,
      baselineScore: baselineScoreObj.overall,
      finalScore: baselineScoreObj.overall,
      baselineMetrics: {
        threeConsecutive: baselineScoreObj.totalThreeConsecutive,
        lunchFlanking: baselineScoreObj.totalLunchFlanking,
        scoreSum: baselineScoreObj.totalScoreSum,
        dimensionAverages: baselineScoreObj.dimensionAverages,
      },
      finalMetrics: {
        threeConsecutive: baselineScoreObj.totalThreeConsecutive,
        lunchFlanking: baselineScoreObj.totalLunchFlanking,
        scoreSum: baselineScoreObj.totalScoreSum,
        dimensionAverages: baselineScoreObj.dimensionAverages,
      },
      totalMovesAccepted: 0,
      repairsAuditTrail: [],
      stats: {
        passesRun: pass,
        timeMs: Date.now() - startTime,
      },
    };
  }

  return {
    success: true,
    improved: totalAcceptedMoves > 0,
    grid: bestGrid,
    baselineScore: baselineScoreObj.overall,
    finalScore: finalScoreObj.overall,
    baselineMetrics: {
      threeConsecutive: baselineScoreObj.totalThreeConsecutive,
      lunchFlanking: baselineScoreObj.totalLunchFlanking,
      scoreSum: baselineScoreObj.totalScoreSum,
      dimensionAverages: baselineScoreObj.dimensionAverages,
    },
    finalMetrics: {
      threeConsecutive: finalScoreObj.totalThreeConsecutive,
      lunchFlanking: finalScoreObj.totalLunchFlanking,
      scoreSum: finalScoreObj.totalScoreSum,
      dimensionAverages: finalScoreObj.dimensionAverages,
    },
    totalMovesAccepted: totalAcceptedMoves,
    repairsAuditTrail: auditTrail,
    stats: {
      passesRun: pass,
      timeMs: Date.now() - startTime,
    },
  };
}

module.exports = {
  cloneGrid,
  swapClassSlots,
  moveSlotToEmpty,
  optimizeFacultyTimetable,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
  classifyActivity,
  ACTIVITY_TYPES,
};
