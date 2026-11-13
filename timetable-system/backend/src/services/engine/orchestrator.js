const fs = require('fs');
const path = require('path');
const { loadData } = require('./dataLoader');
const { checkFeasibility } = require('./feasibilityChecker');
const { placeAllSubjects } = require('./slotPlacer');
const { optimizeGrid } = require('./softOptimizer');
const { scoreGrid } = require('./qualityScorer');
const { validateOutput } = require('./constraintValidator');
const { runConflictRepair } = require('./conflictRepairEngine');
const { auditTimetable } = require('./independentValidator');
const { validateGlobalLabOccupancy } = require('./labValidationService');

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

/**
 * MASTER PRE-PUBLICATION TIMETABLE GENERATION & REPAIR PIPELINE
 * 
 * SOURCE DATA
 * → REQUIREMENT VALIDATION
 * → INITIAL TIMETABLE GENERATION
 * → COMPLETE CONSTRAINT ANALYSIS
 * → AUTOMATIC CONFLICT DETECTION
 * → AUTOMATIC REPAIR
 * → RE-OPTIMIZATION
 * → INDEPENDENT VALIDATION
 * → FINAL MATHEMATICAL AUDIT
 * → PUBLICATION DECISION
 * → DISPLAY FINAL TIMETABLE
 */
const run = async (options = {}) => {
  const startTime = Date.now();
  const pipelineStages = [];

  try {
    // -----------------------------------------------------------------
    // STAGE 1: SOURCE DATA & REQUIREMENT VALIDATION
    // -----------------------------------------------------------------
    pipelineStages.push({ stage: 'REQUIREMENT_VALIDATION', status: 'IN_PROGRESS' });
    let data;
    try {
      data = await loadData(options);
    } catch (err) {
      return {
        success: false,
        error: err.message,
        pipelineStages: [{ stage: 'REQUIREMENT_VALIDATION', status: 'FAILED', error: err.message }],
      };
    }

    data.adminOverrides = options.adminOverrides || {};
    const { classes, subjects } = data;

    if (!classes || classes.length === 0) {
      return {
        success: false,
        error: 'No classes found. Add classes before generating.',
        pipelineStages: [{ stage: 'REQUIREMENT_VALIDATION', status: 'FAILED', error: 'No classes found' }],
      };
    }

    if (!subjects || subjects.length === 0) {
      return {
        success: false,
        error: 'No subjects found. Add subjects before generating.',
        pipelineStages: [{ stage: 'REQUIREMENT_VALIDATION', status: 'FAILED', error: 'No subjects found' }],
      };
    }

    const feasibility = checkFeasibility(data);
    const fatalFeasibilityErrors = feasibility.errors.filter(
      (e) => !e.includes('teaching periods available')
    );

    if (fatalFeasibilityErrors.length > 0 || (!feasibility.feasible && options.allowOverload === false)) {
      return {
        success: false,
        error: `Timetable cannot be generated with the current data:\n- ${feasibility.errors.join('\n- ')}`,
        feasibility,
        validationChecks: { feasible: false },
        pipelineStages: [{ stage: 'REQUIREMENT_VALIDATION', status: 'FAILED', error: feasibility.errors.join(', ') }],
      };
    }
    pipelineStages[0].status = 'COMPLETED';

    // -----------------------------------------------------------------
    // STAGE 2: INITIAL TIMETABLE GENERATION
    // -----------------------------------------------------------------
    pipelineStages.push({ stage: 'INITIAL_TIMETABLE_GENERATION', status: 'IN_PROGRESS' });
    let bestPlacementRes = null;
    let bestOutputValidation = null;
    let seedsTried = 0;

    for (let attemptSeed = 1; attemptSeed <= 10; attemptSeed++) {
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
    pipelineStages[1].status = 'COMPLETED';

    // -----------------------------------------------------------------
    // STAGE 3: COMPLETE CONSTRAINT ANALYSIS & CONFLICT DETECTION
    // -----------------------------------------------------------------
    pipelineStages.push({ stage: 'COMPLETE_CONSTRAINT_ANALYSIS', status: 'IN_PROGRESS' });
    let { grid, unplacedSubjects, warnings, permissionRequests, autoFillStats } = bestPlacementRes;
    const initialAudit = auditTimetable(grid, data);
    pipelineStages[2].status = 'COMPLETED';
    pipelineStages[2].initialConflicts = initialAudit.hardViolationsCount;

    // -----------------------------------------------------------------
    // STAGE 4: AUTOMATIC CONFLICT REPAIR ENGINE
    // -----------------------------------------------------------------
    pipelineStages.push({ stage: 'AUTOMATIC_REPAIR', status: 'IN_PROGRESS' });
    let repairResult = {
      repairedGrid: grid,
      repairsAppliedCount: 0,
      auditTrail: [],
      initialViolationsCount: initialAudit.hardViolationsCount,
      finalViolationsCount: initialAudit.hardViolationsCount,
    };

    if (initialAudit.hardViolationsCount > 0) {
      repairResult = runConflictRepair(grid, data, options);
      grid = repairResult.repairedGrid;
    }
    pipelineStages[3].status = 'COMPLETED';
    pipelineStages[3].repairsApplied = repairResult.repairsAppliedCount;

    // -----------------------------------------------------------------
    // STAGE 5: RE-OPTIMIZATION
    // -----------------------------------------------------------------
    pipelineStages.push({ stage: 'RE_OPTIMIZATION', status: 'IN_PROGRESS' });
    let finalGrid = grid;
    try {
      const optimized = optimizeGrid(grid, data);
      const optVal = validateOutput(optimized.grid, data, unplacedSubjects);
      const optAudit = auditTimetable(optimized.grid, data);
      if (optAudit.hardViolationsCount <= repairResult.finalViolationsCount) {
        finalGrid = optimized.grid;
      }
    } catch (optErr) {
      console.warn('⚠️ Soft optimizer warning:', optErr.message);
    }
    pipelineStages[4].status = 'COMPLETED';

    // -----------------------------------------------------------------
    // STAGE 6: INDEPENDENT FINAL VALIDATION & MATHEMATICAL AUDIT
    // -----------------------------------------------------------------
    pipelineStages.push({ stage: 'INDEPENDENT_VALIDATION', status: 'IN_PROGRESS' });
    const independentAudit = auditTimetable(finalGrid, data);
    const labAudit = validateGlobalLabOccupancy(finalGrid, classes);
    pipelineStages[5].status = 'COMPLETED';

    // -----------------------------------------------------------------
    // STAGE 7: PUBLICATION DECISION (Part 5.3)
    // -----------------------------------------------------------------
    pipelineStages.push({ stage: 'PUBLICATION_DECISION', status: 'COMPLETED' });
    const isFullyValid = independentAudit.outcome === 'FULLY_VALID';
    const publicationOutcome = independentAudit.outcome; // FULLY_VALID | PARTIALLY_FEASIBLE | INFEASIBLE

    // Reconcile quality score
    let qualityScore = scoreGrid(finalGrid, data);
    if (!isFullyValid) {
      qualityScore.isGated = true;
      qualityScore.gateReason = `${independentAudit.hardViolationsCount} critical hard-constraint violation(s) remain unresolved.`;
      // Never allow 100/100 if violations exist
      let realisticCalc = 100 - (independentAudit.hardViolationsCount * 8) - (independentAudit.softWarningsCount * 0.6);
      if (independentAudit.missingSubjects.length > 0) {
        realisticCalc -= independentAudit.missingSubjects.length * 10;
      }
      qualityScore.overall = Math.max(15, Math.min(48, Math.round(realisticCalc)));
    }

    const classTimetables = gridToClassTimetables(finalGrid, classes);
    const timeMs = Date.now() - startTime;
    const unplacedCount = independentAudit.missingSubjects.length;
    const subjectsPlaced = `${subjects.length - unplacedCount}/${subjects.length}`;

    return {
      success: true,
      isComplete: isFullyValid,
      publishable: isFullyValid,
      publicationOutcome,
      publicationGatePassed: isFullyValid,
      pipelineStages,
      repairsAppliedCount: repairResult.repairsAppliedCount,
      repairsAuditTrail: repairResult.auditTrail,
      classTimetables,
      qualityScore,
      independentAudit,
      validationChecks: {
        all_subjects_placed: unplacedCount === 0,
        all_subject_hours_met: independentAudit.metrics.missingHours === 0,
        zero_teacher_conflicts: independentAudit.hardViolations.filter((v) => v.type === 'TEACHER_DOUBLE_BOOKED').length === 0,
        zero_class_conflicts: independentAudit.hardViolations.filter((v) => v.type === 'CLASS_DOUBLE_BOOKED').length === 0,
        zero_room_conflicts: independentAudit.hardViolations.filter((v) => v.type === 'LAB_ROOM_CONFLICT').length === 0,
        zero_lab_double_bookings: labAudit.violations.filter((v) => v.type === 'LAB_DOUBLE_BOOKING').length === 0,
        valid_lab_allocations: labAudit.violations.filter((v) => v.type === 'INVALID_LAB_ASSIGNMENT').length === 0,
        faculty_rest_gaps_guaranteed: independentAudit.hardViolations.filter((v) => v.type === 'FACULTY_REST_GAP').length === 0,
        minor_slots_synchronized: independentAudit.hardViolations.filter((v) => v.type === 'MINOR_TRACK_DESYNCHRONIZATION').length === 0,
        hardViolationsCount: independentAudit.hardViolationsCount,
        softViolationsCount: independentAudit.softWarningsCount,
      },
      hardViolations: independentAudit.hardViolations,
      softViolations: independentAudit.softWarnings,
      autoFillStats: autoFillStats || {},
      warnings: [...(feasibility.warnings || []), ...warnings],
      unplacedSubjects: independentAudit.missingSubjects || [],
      permissionRequests: isFullyValid ? [] : permissionRequests || [],
      generationStats: {
        seedsTried,
        timeMs,
        hardViolations: independentAudit.hardViolationsCount,
        softViolations: independentAudit.softWarningsCount,
        repairsApplied: repairResult.repairsAppliedCount,
        subjectsPlaced,
        emptySlotsCount: (data.classes.length * 30) - independentAudit.metrics.totalScheduledHours,
      },
    };
  } catch (error) {
    console.error('❌ Orchestrator error:', error);
    return {
      success: false,
      error: `Engine error: ${error.message}`,
      pipelineStages,
    };
  }
};

module.exports = {
  run,
  gridToClassTimetables,
};
