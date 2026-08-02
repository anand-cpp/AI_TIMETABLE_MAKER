const { loadData } = require('./dataLoader');
const { checkFeasibility } = require('./feasibilityChecker');
const { runGeneticAlgorithm } = require('./geneticAlgorithm');
const { optimizeGrid } = require('./softOptimizer');
const { gridToClassTimetables } = require('./slotPlacer');
const { validateGrid } = require('./constraintValidator');

/**
 * Main Engine Orchestrator
 * Entry point for timetable generation
 * Steps:
 * 1. Load data from DB
 * 2. Check feasibility
 * 3. Run Genetic Algorithm
 * 4. Run Soft Optimizer
 * 5. Final validation
 * 6. Convert to classTimetables format
 */

const GENERATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const run = async (options = {}) => {
  const startTime = Date.now();

  try {
    // ── Step 1: Load Data ──────────────────────────────────────────────────
    let data;
    try {
      data = await loadData();
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }

    const { classes, subjects } = data;

    // ── Step 2: Basic checks ───────────────────────────────────────────────
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

    // ── Step 3: Feasibility Check ──────────────────────────────────────────
    const feasibility = checkFeasibility(data);

    if (!feasibility.feasible) {
      return {
        success: false,
        error: 'Feasibility check failed',
        feasibilityErrors: feasibility.errors,
        warnings: feasibility.warnings,
      };
    }

    // ── Step 4: Run Genetic Algorithm ──────────────────────────────────────
    const gaOptions = {
      populationSize: options.populationSize || 10,
      maxGenerations: options.maxGenerations || 50,
      mutationRate: options.mutationRate || 0.15,
      eliteCount: options.eliteCount || 2,
      convergenceGenerations: options.convergenceGenerations || 10,
    };

    // Timeout wrapper
    let gaResult;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Generation timeout - returning best result found so far')),
        GENERATION_TIMEOUT_MS
      )
    );

    try {
      gaResult = await Promise.race([
        Promise.resolve(runGeneticAlgorithm(data, gaOptions)),
        timeoutPromise,
      ]);
    } catch (timeoutErr) {
      // If timeout, try one simple placement as fallback
      console.warn('⚠️ GA timeout, falling back to simple placement');
      const { placeAllSubjects } = require('./slotPlacer');
      const { grid, unplacedSubjects, warnings } = placeAllSubjects(data, false);

      gaResult = {
        success: true,
        grid,
        fitness: 0,
        hardViolations: 0,
        qualityScore: { overall: 0 },
        unplacedSubjects,
        warnings: [...warnings, 'Generation timed out — simple placement used as fallback'],
        generationStats: {
          generations: 0,
          timeMs: Date.now() - startTime,
          hardViolations: 0,
        },
      };
    }

    if (!gaResult.success || !gaResult.grid) {
      return {
        success: false,
        error: gaResult.error || 'Genetic algorithm failed to produce a valid timetable',
        warnings: feasibility.warnings,
      };
    }

    // ── Step 5: Soft Optimization ──────────────────────────────────────────
    let finalGrid = gaResult.grid;
    let finalQualityScore = gaResult.qualityScore;

    try {
      const optimized = optimizeGrid(gaResult.grid, data);
      finalGrid = optimized.grid;
      finalQualityScore = optimized.qualityScore;
    } catch (optErr) {
      console.warn('⚠️ Soft optimizer error (using GA result):', optErr.message);
      // Keep GA result if optimizer fails
    }

    // ── Step 6: Final Validation ───────────────────────────────────────────
    const finalValidation = validateGrid(finalGrid, data);
    const hardViolations = finalValidation.violations.length;

    if (hardViolations > 0) {
      console.warn(
        `⚠️ Final timetable has ${hardViolations} hard violations:`,
        finalValidation.violations.map((v) => v.message)
      );
    }

    // ── Step 7: Convert to output format ───────────────────────────────────
    const classTimetables = gridToClassTimetables(finalGrid, classes);

    // ── Step 8: Collect all warnings ───────────────────────────────────────
    const allWarnings = [
      ...feasibility.warnings,
      ...(gaResult.warnings || []),
    ];

    if (hardViolations > 0) {
      allWarnings.push(
        `Warning: Generated timetable has ${hardViolations} constraint violation(s). Manual review recommended.`
      );
    }

    const timeMs = Date.now() - startTime;

    return {
      success: true,
      classTimetables,
      qualityScore: finalQualityScore,
      warnings: allWarnings,
      unplacedSubjects: gaResult.unplacedSubjects || [],
      generationStats: {
        generations: gaResult.generationStats?.generations || 0,
        timeMs,
        hardViolations,
        populationSize: gaOptions.populationSize,
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

module.exports = { run };