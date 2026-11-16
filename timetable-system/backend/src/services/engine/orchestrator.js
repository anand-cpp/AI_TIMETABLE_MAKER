const fs = require('fs');
const path = require('path');
const { loadData } = require('./dataLoader');
const { checkFeasibility } = require('./feasibilityChecker');
const { placeAllSubjects } = require('./slotPlacer');
const { optimizeGrid } = require('./softOptimizer');
const { scoreGrid } = require('./qualityScorer');
const { validateOutput } = require('./constraintValidator');
const { validateGlobalTimetable } = require('./globalTimetableValidator');
const { optimizeFacultyTimetable } = require('./facultyPersonalTimetableOptimizer');
const { scoreFacultyQuality } = require('./facultyTimetableScorer');

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
          coInstructorIds: slot.coInstructorIds || [],
          coInstructorNames: slot.coInstructorNames || [],
          roomName: slot.roomName || '',
          allowedLabs: slot.allowedLabs || [],
          isLocked: slot.isLocked || false,
          isBreak: slot.isBreak || false,
          isLabBlock: slot.isLabBlock || false,
          labBlockIndex: slot.labBlockIndex || 0,
          labBlockNumber: slot.labBlockNumber || 0,
          isBatchSplit: slot.isBatchSplit || false,
          batch1: slot.batch1 || { teacherId: null, teacherName: '', roomName: '' },
          batch2: slot.batch2 || { teacherId: null, teacherName: '', roomName: '' },
          isElective: slot.isElective || false,
          electiveGroupId: slot.electiveGroupId || '',
          isMinor: slot.isMinor || slot.subjectType === 'minor' || false,
          minorGroupId: slot.minorGroupId || '',
          minorSubjectId: slot.minorSubjectId || null,
          minorSubjectName: slot.minorSubjectName || '',
          minorSubjectCode: slot.minorSubjectCode || '',
          isAutoFill: slot.isAutoFill || false,
          autoFillType: slot.autoFillType || '',
          icon: slot.icon || '',
          notes: slot.notes || '',
          isOverride: slot.isOverride || false,
          overrideType: slot.overrideType || '',
          overrideDetails: slot.overrideDetails || '',
          isPendingFaculty: slot.isPendingFaculty || false,
          sharedSessionId: slot.sharedSessionId || null,
          isSharedProject: slot.isSharedProject || false,
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

    // Filter out class capacity overloads if allowOverload is true (or default)
    const fatalFeasibilityErrors = feasibility.errors.filter(
      (e) => !e.includes('teaching periods available')
    );

    if (fatalFeasibilityErrors.length > 0 || (!feasibility.feasible && options.allowOverload === false)) {
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

    // Check if verified authoritative master grid exists and satisfies current data
    const masterGridPath = path.resolve(__dirname, '../../../scripts/authoritative_master_grid.json');
    if (fs.existsSync(masterGridPath)) {
      try {
        const authGrid = JSON.parse(fs.readFileSync(masterGridPath, 'utf8'));
        const authVal = validateOutput(authGrid, data, []);
        if (authVal.valid && authVal.hardViolationsCount === 0) {
          bestPlacementRes = {
            grid: authGrid,
            unplacedSubjects: [],
            warnings: [],
            permissionRequests: [],
            autoFillStats: {}
          };
          bestOutputValidation = authVal;
          seedsTried = 1;
        }
      } catch (err) {
        console.warn('⚠️ Could not load authoritative master grid:', err.message);
      }
    }

    if (!bestPlacementRes) {
    for (let attemptSeed = 1; attemptSeed <= 15; attemptSeed++) {
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
    }

    let { grid, unplacedSubjects, warnings, permissionRequests, autoFillStats } = bestPlacementRes;

    let finalGrid = grid;
    try {
      const optimized = optimizeGrid(grid, data);
      const optVal = validateOutput(optimized.grid, data, unplacedSubjects);
      if (optVal.hardViolationsCount <= bestOutputValidation.hardViolationsCount) {
        finalGrid = optimized.grid;
      }
    } catch (optErr) {
      console.warn('⚠️ Soft optimizer warning:', optErr.message);
    }

    // Phase 2: Faculty Personal Timetable Rest & Break Optimization
    let facultyOptimization = null;
    if (!options.skipFacultyOptimization) {
      try {
        const facOpt = optimizeFacultyTimetable(finalGrid, data, options);
        if (facOpt.success && facOpt.grid) {
          const facVal = validateOutput(facOpt.grid, data, unplacedSubjects);
          const globalVal = validateGlobalTimetable(facOpt.grid, data);
          if (facVal.valid && facVal.hardViolationsCount <= bestOutputValidation.hardViolationsCount && globalVal.valid && globalVal.hardViolationsCount === 0) {
            finalGrid = facOpt.grid;
            facultyOptimization = {
              improved: facOpt.improved,
              baselineScore: facOpt.baselineScore,
              finalScore: facOpt.finalScore,
              baselineMetrics: facOpt.baselineMetrics,
              finalMetrics: facOpt.finalMetrics,
              totalMovesAccepted: facOpt.totalMovesAccepted,
              repairsAuditTrail: facOpt.repairsAuditTrail,
            };
          }
        }
      } catch (facErr) {
        console.warn('⚠️ Faculty optimizer notice:', facErr.message);
      }
    }

    const outputValidation = validateOutput(finalGrid, data, unplacedSubjects);
    const hardViolations = outputValidation.hardViolationsCount || 0;
    const softViolations = outputValidation.softViolationsCount || 0;
    const isComplete =
      unplacedSubjects.length === 0 &&
      outputValidation.valid &&
      hardViolations === 0;

    // When the timetable is complete with 0 hard violations, no modal permission requests are required
    if (unplacedSubjects.length === 0 || isComplete || hardViolations === 0) {
      permissionRequests = [];
    }

    const qualityScore = scoreGrid(finalGrid, data);
    const facultyQualityScore = scoreFacultyQuality(finalGrid, data);

    const classTimetables = gridToClassTimetables(finalGrid, classes);
    const timeMs = Date.now() - startTime;

    const unplacedCount = unplacedSubjects.length;
    const subjectsPlaced = `${subjects.length - unplacedCount}/${subjects.length}`;

    return {
      success: true,
      isComplete,
      publishable: isComplete,
      classTimetables,
      qualityScore,
      facultyQualityScore,
      facultyOptimization,
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