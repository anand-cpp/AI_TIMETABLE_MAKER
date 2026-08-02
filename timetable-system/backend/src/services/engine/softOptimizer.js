const { validateGrid } = require('./constraintValidator');
const { scoreGrid } = require('./qualityScorer');

/**
 * Soft Optimizer
 * Post-processing step after GA
 * Tries to improve quality score by swapping theory slots
 * Never touches labs, electives, or locked slots
 * Only accepts swaps that improve quality score
 * Re-validates hard constraints after every swap
 */

const MAX_ITERATIONS = 200;
const NO_IMPROVEMENT_LIMIT = 50;

// ── Get all swappable theory slots for a class ─────────────────────────────────
const getSwappableSlots = (classId, grid, data) => {
  const { workingDays, periodsPerDayMap } = data;
  const slots = [];

  for (const day of workingDays) {
    for (const period of periodsPerDayMap[day] || []) {
      const slot = grid[classId]?.[day]?.[period];
      if (
        slot &&
        !slot.isEmpty &&
        !slot.isBreak &&
        !slot.isLocked &&
        !slot.isLabBlock &&
        !slot.isElective &&
        slot.subjectType === 'theory'
      ) {
        slots.push({ day, period });
      }
    }
  }

  return slots;
};

// ── Deep clone grid ────────────────────────────────────────────────────────────
const cloneGrid = (grid) => JSON.parse(JSON.stringify(grid));

// ── Swap two slots in a class ──────────────────────────────────────────────────
const swapSlots = (grid, classId, s1, s2) => {
  const slot1 = grid[classId][s1.day][s1.period];
  const slot2 = grid[classId][s2.day][s2.period];

  const fieldsToSwap = [
    'subjectId',
    'subjectName',
    'subjectCode',
    'subjectType',
    'teacherIds',
    'teacherNames',
    'roomName',
    'isEmpty',
    'isElective',
    'electiveGroupId',
    'notes',
  ];

  const temp = {};
  for (const field of fieldsToSwap) {
    temp[field] = slot1[field];
  }

  for (const field of fieldsToSwap) {
    slot1[field] = slot2[field];
  }

  for (const field of fieldsToSwap) {
    slot2[field] = temp[field];
  }
};

// ── Main optimizer ─────────────────────────────────────────────────────────────
const optimizeGrid = (grid, data) => {
  const { classes } = data;

  let currentGrid = cloneGrid(grid);
  let currentScore = scoreGrid(currentGrid, data);
  let iterations = 0;
  let noImprovementCount = 0;
  let totalSwapsAccepted = 0;

  while (
    iterations < MAX_ITERATIONS &&
    noImprovementCount < NO_IMPROVEMENT_LIMIT
  ) {
    iterations++;
    let improved = false;

    // Try a random swap for each class
    for (const cls of classes) {
      const classId = cls._id.toString();
      const swappable = getSwappableSlots(classId, currentGrid, data);

      if (swappable.length < 2) continue;

      // Pick two random slots
      const idx1 = Math.floor(Math.random() * swappable.length);
      let idx2 = Math.floor(Math.random() * swappable.length);
      while (idx2 === idx1 && swappable.length > 1) {
        idx2 = Math.floor(Math.random() * swappable.length);
      }

      const s1 = swappable[idx1];
      const s2 = swappable[idx2];

      // Don't swap same subject
      const slot1 = currentGrid[classId][s1.day][s1.period];
      const slot2 = currentGrid[classId][s2.day][s2.period];
      if (slot1.subjectId === slot2.subjectId) continue;

      // Try swap on a clone
      const trialGrid = cloneGrid(currentGrid);
      swapSlots(trialGrid, classId, s1, s2);

      // Re-validate hard constraints
      const validation = validateGrid(trialGrid, data);
      if (!validation.valid) continue;

      // Score trial grid
      const trialScore = scoreGrid(trialGrid, data);

      // Accept only if improved
      if (trialScore.overall > currentScore.overall) {
        currentGrid = trialGrid;
        currentScore = trialScore;
        improved = true;
        totalSwapsAccepted++;
      }
    }

    if (improved) {
      noImprovementCount = 0;
    } else {
      noImprovementCount++;
    }
  }

  return {
    grid: currentGrid,
    qualityScore: currentScore,
    optimizationStats: {
      iterations,
      swapsAccepted: totalSwapsAccepted,
      finalScore: currentScore.overall,
    },
  };
};

module.exports = { optimizeGrid };