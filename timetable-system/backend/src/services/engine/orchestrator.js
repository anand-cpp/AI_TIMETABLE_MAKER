const { loadData } = require('./dataLoader');
const { checkFeasibility } = require('./feasibilityChecker');
const { placeAllSubjects } = require('./slotPlacer');
const { optimizeGrid } = require('./softOptimizer');
const { scoreGrid } = require('./qualityScorer');
const { validateOutput } = require('./constraintValidator');

/**
 * Helper to convert grid object to classTimetables array format
 */
const gridToClassTimetables = (grid, classes) => {
  const result = [];

  for (const cls of classes) {
    const classId = cls._id.toString();
    const dayMap = grid[classId] || {};
    const slots = [];

    for (const [day, periodMap] of Object.entries(dayMap)) {
      for (const [periodStr, slot] of Object.entries(periodMap)) {
        const period = Number(periodStr);

        if (!slot) continue;

        slots.push({
          day,
          period,
          subjectId: slot.subjectId || null,
          subjectName: slot.subjectName || '',
          subjectCode: slot.subjectCode || '',
          subjectType: slot.subjectType || 'empty',
          teacherIds: slot.teacherIds || [],
          teacherNames: slot.teacherNames || [],
          roomName: slot.roomName || '',
          isLocked: slot.isLocked || false,
          isBreak: slot.isBreak || false,
          isLabBlock: slot.isLabBlock || false,
          labBlockIndex: slot.labBlockIndex || 0,
          isBatchSplit: slot.isBatchSplit || false,
          batch1: slot.batch1 || { teacherId: null, teacherName: '', roomName: '' },
          batch2: slot.batch2 || { teacherId: null, teacherName: '', roomName: '' },
          isElective: slot.isElective || false,
          electiveGroupId: slot.electiveGroupId || '',
          isAutoFill: slot.isAutoFill || false,
          autoFillType: slot.autoFillType || '',
          icon: slot.icon || '',
          notes: slot.notes || '',
          isOverride: slot.isOverride || false,
          overrideType: slot.overrideType || '',
          overrideDetails: slot.overrideDetails || '',
        });
      }
    }

    result.push({
      classId: cls._id,
      className: cls.name,
      slots,
    });
  }

  return result;
};

const run = async (options = {}) => {
  const startTime = Date.now();

  try {
    let data;
    try {
      data = await loadData(options);
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }

    data.adminOverrides = options.adminOverrides || {};

    const { classes, subjects } = data;

    if (!classes || classes.length === 0) {
      return {
        success: false,
        error: 'No classes found. Add classes before generating.',
      };
    }

    if (!subjects || subjects.length === 0) {
      return {
        success: false,
        error: 'No subjects found. Add subjects before generating.',
      };
    }

    const feasibility = checkFeasibility(data);

    // A hard-infeasible configuration cannot produce a valid timetable. Return
    // the concrete reasons instead of fabricating a "complete" result.
    if (!feasibility.feasible) {
      return {
        success: false,
        error: `Timetable cannot be generated with the current data:\n- ${feasibility.errors.join('\n- ')}`,
        feasibility,
        validationChecks: { feasible: false },
      };
    }

    // Multi-Seed Search for 0 Hard Violations
    let bestPlacementRes = null;
    let bestOutputValidation = null;
    let seedsTried = 0;

    for (let attemptSeed = 1; attemptSeed <= 5; attemptSeed++) {
      seedsTried = attemptSeed;
      const randomize = attemptSeed > 1;
      const placementRes = placeAllSubjects(data, randomize, { adminOverrides: data.adminOverrides });
      const outputValidation = validateOutput(placementRes.grid, data, placementRes.unplacedSubjects);

      if (!bestPlacementRes || outputValidation.hardViolationsCount < bestOutputValidation.hardViolationsCount) {
        bestPlacementRes = placementRes;
        bestOutputValidation = outputValidation;
      }

      if (outputValidation.valid && outputValidation.hardViolationsCount === 0) {
        break;
      }
    }

    let { grid, unplacedSubjects, warnings, permissionRequests, autoFillStats } = bestPlacementRes;

    let finalGrid = grid;
    try {
      const optimized = optimizeGrid(grid, data);
      finalGrid = optimized.grid;
    } catch (optErr) {
      console.warn('⚠️ Soft optimizer warning:', optErr.message);
    }

    // Re-validate whatever grid we are actually going to save (the optimizer
    // may have mutated it) so the reported checks reflect reality.
    const outputValidation = validateOutput(finalGrid, data, unplacedSubjects);
    const hardViolations = outputValidation.hardViolationsCount || 0;
    const softViolations = outputValidation.softViolationsCount || 0;
    const isComplete =
      unplacedSubjects.length === 0 &&
      outputValidation.valid &&
      hardViolations === 0 &&
      outputValidation.emptySlotsCount === 0;

    const qualityScore = scoreGrid(finalGrid, data);

    const classTimetables = gridToClassTimetables(finalGrid, classes);
    const timeMs = Date.now() - startTime;

    // Number of distinct (class,subject) pairs that were not fully scheduled
    const unplacedCount = unplacedSubjects.length;
    const subjectsPlaced = `${subjects.length - unplacedCount}/${subjects.length}`;

    return {
      success: true,
      isComplete,
      publishable: isComplete,
      classTimetables,
      qualityScore,
      validationChecks: {
        ...outputValidation.checks,
        hardViolationsCount: hardViolations,
        softViolationsCount: softViolations,
      },
      hardViolations: outputValidation.hardViolations,
      softViolations: outputValidation.softViolations,
      autoFillStats: autoFillStats || {},
      warnings: [...(feasibility.warnings || []), ...warnings],
      unplacedSubjects: unplacedSubjects || [],
      permissionRequests: permissionRequests || [],
      generationStats: {
        seedsTried,
        timeMs,
        hardViolations,
        softViolations,
        subjectsPlaced,
        emptySlotsCount: outputValidation.emptySlotsCount || 0,
      },
    };
  } catch (error) {
    console.error('❌ Orchestrator error:', error);
    return {
      success: false,
      error: `Engine error: ${error.message}`,
    };
  }
};

module.exports = { run, gridToClassTimetables };