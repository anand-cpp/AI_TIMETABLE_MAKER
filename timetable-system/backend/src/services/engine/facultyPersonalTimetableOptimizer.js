/**
 * Faculty Personal Timetable Optimizer
 * Phase 3 — Global Conflict-Aware Multi-Activity Rest-Break Optimization Engine
 *
 * Primary Objectives:
 * 1. Permanently eliminate 4+ consecutive teaching periods across the entire faculty roster (Rule A).
 * 2. Eliminate 3 consecutive theory teaching periods without breaks.
 * 3. Preserve 100% academic workload placement (exactly 237 slots, zero missing, zero unplaced).
 * 4. Guarantee zero hard-constraint violations (validateOutput, validateGlobalTimetable, auditTimetable).
 * 5. Strictly preserve legitimate institutional blocks (S8 CST416 full-day, labs, vivas, minor tracks).
 * 6. Intelligently balance daily workload distribution and minimize lunch-flanking instances.
 * 7. Transactional fail-safe rollback if no valid improvement can be achieved.
 */

const { scoreFacultyQuality } = require('./facultyTimetableScorer');
const {
  ACTIVITY_TYPES,
  classifyActivity,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
  isSlotImmovable,
  isAuthorizedCapstoneBlock,
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
 * Universal detector for sequences of 4 or more consecutive teaching periods
 * across the complete faculty roster.
 * Excludes only authorized full-day institutional project supervision (CST416 on Thu/Fri).
 */
function findFourPlusConsecutiveRuns(grid, data) {
  const teachers = data.teachers || [];
  const classes = data.classes || [];
  const runs = [];

  for (const t of teachers) {
    const tid = t._id.toString();
    const tname = t.name;

    for (const d of DAYS) {
      const occupiedPeriods = [];
      const periodDetails = {};

      for (const cls of classes) {
        for (let p = 1; p <= 6; p++) {
          const s = grid[cls._id.toString()]?.[d]?.[p];
          if (!s || s.isEmpty || s.isBreak) continue;

          let matches = false;
          if (s.teacherId && s.teacherId.toString() === tid) matches = true;
          if (Array.isArray(s.teacherIds) && s.teacherIds.some(id => id && id.toString() === tid)) matches = true;
          if (s.batch1TeacherId && s.batch1TeacherId.toString() === tid) matches = true;
          if (s.batch2TeacherId && s.batch2TeacherId.toString() === tid) matches = true;

          if (matches) {
            if (!occupiedPeriods.includes(p)) {
              occupiedPeriods.push(p);
              periodDetails[p] = [];
            }
            periodDetails[p].push({
              classId: cls._id.toString(),
              className: cls.name,
              period: p,
              slot: s,
              isImmovable: isSlotImmovable(s),
            });
          }
        }
      }

      occupiedPeriods.sort((a, b) => a - b);

      let currentRun = [];
      for (const p of occupiedPeriods) {
        if (currentRun.length === 0 || p === currentRun[currentRun.length - 1] + 1) {
          currentRun.push(p);
        } else {
          evalRun(currentRun);
          currentRun = [p];
        }
      }
      evalRun(currentRun);

      function evalRun(run) {
        if (run.length >= 4) {
          const runSlots = run.map(p => {
            const details = periodDetails[p] || [];
            return details[0]?.slot;
          });
          const isAuthCapstone = isAuthorizedCapstoneBlock(runSlots, d, tid) || isAuthorizedCapstoneBlock(runSlots, d, tname);
          if (isAuthCapstone) {
            return; // Authorized Capstone Project Phase-2 full-day block for Dr S Gunasekaran
          }
          runs.push({
            teacherId: tid,
            teacherName: tname,
            day: d,
            periods: [...run],
            length: run.length,
            details: run.map(p => ({
              period: p,
              items: periodDetails[p] || [],
            })),
          });
        }
      }
    }
  }

  return runs;
}

/**
 * Main faculty personal timetable optimizer.
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

  const initialRuns = findFourPlusConsecutiveRuns(bestGrid, data);
  let bestFourConsecutive = initialRuns.length;
  let bestScoreSum = baselineScoreObj.totalScoreSum;
  let bestThreeConsecutive = baselineScoreObj.totalThreeConsecutive;
  let bestLunchFlanking = baselineScoreObj.totalLunchFlanking;

  const classes = data.classes || [];
  const auditTrail = [];
  let totalAcceptedMoves = 0;

  // ── PHASE A: Targeted 4+ Consecutive Run Resolution ────────────────────────
  let targetedPass = 0;
  while (bestFourConsecutive > 0 && targetedPass < 10) {
    targetedPass++;
    let targetedResolved = false;

    const currentRuns = findFourPlusConsecutiveRuns(bestGrid, data);
    for (const run of currentRuns) {
      const movableItems = [];
      for (const pDetail of run.details) {
        for (const item of pDetail.items) {
          if (!item.isImmovable) {
            movableItems.push(item);
          }
        }
      }

      let runFixed = false;
      for (const item of movableItems) {
        const cid = item.classId;
        const cls = classes.find(c => c._id.toString() === cid);

        for (const targetDay of DAYS) {
          for (const targetPeriod of PERIODS) {
            if (targetDay === run.day && run.periods.includes(targetPeriod)) continue;

            const targetSlot = bestGrid[cid]?.[targetDay]?.[targetPeriod];
            if (isSlotImmovable(targetSlot)) continue;
            if (targetSlot?.subjectId && targetSlot.subjectId.toString() === item.slot?.subjectId?.toString()) continue;

            const trialGrid = cloneGrid(bestGrid);
            const s1 = { day: run.day, period: item.period };
            const s2 = { day: targetDay, period: targetPeriod };

            const involvesElective = item.slot?.isElective || targetSlot?.isElective;
            if (involvesElective) {
              const semClassIds = classes.filter(c => c.semester === cls.semester).map(c => c._id.toString());
              let canSync = true;
              for (const otherCid of semClassIds) {
                const o1 = bestGrid[otherCid]?.[s1.day]?.[s1.period];
                const o2 = bestGrid[otherCid]?.[s2.day]?.[s2.period];
                if (isSlotImmovable(o1) || isSlotImmovable(o2)) {
                  canSync = false;
                  break;
                }
              }
              if (!canSync) continue;
              for (const otherCid of semClassIds) {
                swapClassSlots(trialGrid, otherCid, s1, s2);
              }
            } else {
              if (!targetSlot || targetSlot.isEmpty) moveSlotToEmpty(trialGrid, cid, s1, s2);
              else swapClassSlots(trialGrid, cid, s1, s2);
            }

            // Strict Validators
            const val = validateOutput(trialGrid, data, []);
            if (!val.valid || val.hardViolationsCount > 0) continue;

            const globalVal = validateGlobalTimetable(trialGrid, data);
            if (!globalVal.valid || globalVal.hardViolationsCount > 0) continue;

            const auditVal = auditTimetable(trialGrid, data);
            if (auditVal && auditVal.hardViolations && auditVal.hardViolations.length > 0) continue;

            const trialRuns = findFourPlusConsecutiveRuns(trialGrid, data).length;
            if (trialRuns < bestFourConsecutive) {
              const trialScore = scoreFacultyQuality(trialGrid, data, scoringConfig);
              bestGrid = trialGrid;
              bestFourConsecutive = trialRuns;
              bestScoreSum = trialScore.totalScoreSum;
              bestThreeConsecutive = trialScore.totalThreeConsecutive;
              bestLunchFlanking = trialScore.totalLunchFlanking;
              totalAcceptedMoves++;
              targetedResolved = true;
              runFixed = true;
              auditTrail.push({
                stage: 'TARGETED_REST_GAP_REPAIR',
                move: `${cls.name}: swapped (${s1.day} P${s1.period}) [${item.slot?.subjectCode}] with (${s2.day} P${s2.period}) [${targetSlot?.subjectCode || 'EMPTY'}]`,
                fourConsecutiveRemaining: bestFourConsecutive,
                scoreSum: bestScoreSum,
              });
              break;
            }
          }
          if (runFixed) break;
        }
        if (runFixed) break;
      }
    }

    if (!targetedResolved) break;
  }

  // ── PHASE B: General Multi-Pass Neighborhood Search (Preserving Rest-Gap Invariants) ──
  let pass = 0;
  while (pass < maxPasses) {
    pass++;
    let passMoves = 0;

    for (const cls of classes) {
      const cid = cls._id.toString();

      const allSlots = [];
      for (const d of DAYS) {
        for (const p of PERIODS) {
          allSlots.push({ day: d, period: p });
        }
      }

      for (let i = 0; i < allSlots.length; i++) {
        for (let j = i + 1; j < allSlots.length; j++) {
          const s1 = allSlots[i];
          const s2 = allSlots[j];

          const slot1 = bestGrid[cid]?.[s1.day]?.[s1.period];
          const slot2 = bestGrid[cid]?.[s2.day]?.[s2.period];

          if (isSlotImmovable(slot1) || isSlotImmovable(slot2)) continue;

          const s1Empty = !slot1 || slot1.isEmpty;
          const s2Empty = !slot2 || slot2.isEmpty;
          if (s1Empty && s2Empty) continue;
          if (!s1Empty && !s2Empty && slot1.subjectId && slot1.subjectId.toString() === slot2.subjectId?.toString()) continue;

          const trialGrid = cloneGrid(bestGrid);
          const involvesElective = slot1?.isElective || slot2?.isElective;

          if (involvesElective) {
            const semClassIds = classes.filter(c => c.semester === cls.semester).map(c => c._id.toString());
            let canSync = true;
            for (const otherCid of semClassIds) {
              const o1 = bestGrid[otherCid]?.[s1.day]?.[s1.period];
              const o2 = bestGrid[otherCid]?.[s2.day]?.[s2.period];
              if (isSlotImmovable(o1) || isSlotImmovable(o2)) {
                canSync = false;
                break;
              }
            }
            if (!canSync) continue;
            for (const otherCid of semClassIds) {
              swapClassSlots(trialGrid, otherCid, s1, s2);
            }
          } else {
            if (s2Empty) moveSlotToEmpty(trialGrid, cid, s1, s2);
            else if (s1Empty) moveSlotToEmpty(trialGrid, cid, s2, s1);
            else swapClassSlots(trialGrid, cid, s1, s2);
          }

          // Strict Validators
          const val = validateOutput(trialGrid, data, []);
          if (!val.valid || val.hardViolationsCount > 0) continue;

          const globalVal = validateGlobalTimetable(trialGrid, data);
          if (!globalVal.valid || globalVal.hardViolationsCount > 0) continue;

          const auditVal = auditTimetable(trialGrid, data);
          if (auditVal && auditVal.hardViolations && auditVal.hardViolations.length > 0) continue;

          // Invariant: Never accept a move that increases 4+ consecutive teaching runs
          const trialRuns = findFourPlusConsecutiveRuns(trialGrid, data).length;
          if (trialRuns > bestFourConsecutive) continue;

          const trialScore = scoreFacultyQuality(trialGrid, data, scoringConfig);

          // Acceptance criteria:
          // 1. Strict elimination of 4+ consecutive runs
          // 2. Strict elimination of 3 consecutive theory periods
          // 3. Strict increase in score sum
          // 4. Strict decrease in lunch flanking
          const isBetter =
            trialRuns < bestFourConsecutive ||
            (trialRuns === bestFourConsecutive && trialScore.totalThreeConsecutive < bestThreeConsecutive) ||
            (trialRuns === bestFourConsecutive &&
              trialScore.totalThreeConsecutive === bestThreeConsecutive &&
              trialScore.totalScoreSum > bestScoreSum) ||
            (trialRuns === bestFourConsecutive &&
              trialScore.totalThreeConsecutive === bestThreeConsecutive &&
              trialScore.totalScoreSum === bestScoreSum &&
              trialScore.totalLunchFlanking < bestLunchFlanking);

          if (isBetter) {
            bestGrid = trialGrid;
            bestFourConsecutive = trialRuns;
            bestScoreSum = trialScore.totalScoreSum;
            bestThreeConsecutive = trialScore.totalThreeConsecutive;
            bestLunchFlanking = trialScore.totalLunchFlanking;
            passMoves++;
            totalAcceptedMoves++;

            auditTrail.push({
              stage: `NEIGHBORHOOD_PASS_${pass}`,
              move: `${cls.name}: swapped (${s1.day} P${s1.period}) [${slot1?.subjectCode || 'EMPTY'}] with (${s2.day} P${s2.period}) [${slot2?.subjectCode || 'EMPTY'}]`,
              fourConsecutiveRemaining: bestFourConsecutive,
              scoreSum: bestScoreSum,
              threeConsecutive: bestThreeConsecutive,
              lunchFlanking: bestLunchFlanking,
            });
            break;
          }
        }
      }
    }

    if (passMoves === 0) break;
  }

  // Final verification of optimized solution against baseline
  const finalScoreObj = scoreFacultyQuality(bestGrid, data, scoringConfig);
  const finalVal = validateOutput(bestGrid, data, []);
  const finalGlobalVal = validateGlobalTimetable(bestGrid, data);
  const finalAudit = auditTimetable(bestGrid, data);

  // Fail-safe guarantee: Revert to baseline if any hard violation was introduced
  if (
    !finalVal.valid ||
    finalVal.hardViolationsCount > 0 ||
    !finalGlobalVal.valid ||
    finalGlobalVal.hardViolationsCount > 0 ||
    (finalAudit && finalAudit.hardViolations && finalAudit.hardViolations.length > 0) ||
    bestFourConsecutive > initialRuns.length
  ) {
    return {
      success: true,
      improved: false,
      grid: baselineGrid,
      baselineScore: baselineScoreObj.overall,
      finalScore: baselineScoreObj.overall,
      initialFourConsecutive: initialRuns.length,
      finalFourConsecutive: initialRuns.length,
      baselineMetrics: {
        threeConsecutive: baselineScoreObj.totalThreeConsecutive,
        lunchFlanking: baselineScoreObj.totalLunchFlanking,
        scoreSum: baselineScoreObj.totalScoreSum,
        fourConsecutive: initialRuns.length,
      },
      finalMetrics: {
        threeConsecutive: baselineScoreObj.totalThreeConsecutive,
        lunchFlanking: baselineScoreObj.totalLunchFlanking,
        scoreSum: baselineScoreObj.totalScoreSum,
        fourConsecutive: initialRuns.length,
      },
      totalMovesAccepted: 0,
      repairsAuditTrail: [],
      stats: {
        terminationReason: bestFourConsecutive > 0 ? 'SEARCH_BUDGET_EXHAUSTED' : 'CONVERGED',
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
    initialFourConsecutive: initialRuns.length,
    finalFourConsecutive: bestFourConsecutive,
    baselineMetrics: {
      threeConsecutive: baselineScoreObj.totalThreeConsecutive,
      lunchFlanking: baselineScoreObj.totalLunchFlanking,
      scoreSum: baselineScoreObj.totalScoreSum,
      fourConsecutive: initialRuns.length,
    },
    finalMetrics: {
      threeConsecutive: finalScoreObj.totalThreeConsecutive,
      lunchFlanking: finalScoreObj.totalLunchFlanking,
      scoreSum: finalScoreObj.totalScoreSum,
      fourConsecutive: bestFourConsecutive,
    },
    totalMovesAccepted: totalAcceptedMoves,
    repairsAuditTrail: auditTrail,
    stats: {
      terminationReason: bestFourConsecutive === 0 ? 'REST_GAPS_FULLY_SATISFIED' : 'SEARCH_BUDGET_EXHAUSTED',
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
  findFourPlusConsecutiveRuns,
  isSlotImmovable,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
  classifyActivity,
  ACTIVITY_TYPES,
};
