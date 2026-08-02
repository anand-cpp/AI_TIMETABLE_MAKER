const { placeAllSubjects, gridToClassTimetables } = require('./slotPlacer');
const { validateGrid } = require('./constraintValidator');
const { scoreGrid } = require('./qualityScorer');

/**
 * Genetic Algorithm Engine
 * Evolves a population of timetable grids toward optimal solution
 */

const POPULATION_SIZE = 10;
const MAX_GENERATIONS = 50;
const MUTATION_RATE = 0.15;
const ELITE_COUNT = 2;
const CONVERGENCE_GENERATIONS = 10;

// ── Generate initial population ────────────────────────────────────────────────
const generatePopulation = (data, size = POPULATION_SIZE) => {
  const population = [];
  let attempts = 0;
  const maxAttempts = size * 5;

  while (population.length < size && attempts < maxAttempts) {
    attempts++;
    try {
      // randomize = true gives different slot orderings each time
      const { grid, unplacedSubjects, warnings } = placeAllSubjects(data, true);
      const validation = validateGrid(grid, data);

      // Calculate fitness
      const hardViolations = validation.violations.length;
      const qualityScore = scoreGrid(grid, data);

      // Fitness: 0 if any hard violations, else quality score
      const fitness = hardViolations === 0 ? qualityScore.overall : 0;

      population.push({
        grid,
        fitness,
        hardViolations,
        qualityScore,
        unplacedSubjects,
        warnings,
      });
    } catch (err) {
      // Skip invalid chromosomes
      continue;
    }
  }

  // Sort by fitness descending
  population.sort((a, b) => b.fitness - a.fitness);

  return population;
};

// ── Tournament selection ───────────────────────────────────────────────────────
const tournamentSelect = (population, tournamentSize = 3) => {
  const tournament = [];
  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    tournament.push(population[idx]);
  }
  tournament.sort((a, b) => b.fitness - a.fitness);
  return tournament[0];
};

// ── Crossover: combine two parent grids ───────────────────────────────────────
// Single-point crossover at class level
// Parent1 contributes some classes, Parent2 contributes rest
// Locked slots from either parent are always preserved
const crossover = (parent1, parent2, data) => {
  const { classes } = data;
  const child = {};

  const crossoverPoint = Math.floor(Math.random() * classes.length);

  for (let i = 0; i < classes.length; i++) {
    const classId = classes[i]._id.toString();
    const sourceParent = i < crossoverPoint ? parent1 : parent2;
    const otherParent = i < crossoverPoint ? parent2 : parent1;

    child[classId] = {};

    // Copy all days from source parent
    for (const day of Object.keys(sourceParent.grid[classId] || {})) {
      child[classId][day] = {};

      for (const [period, slot] of Object.entries(
        sourceParent.grid[classId][day] || {}
      )) {
        // Preserve locked slots - take from whichever parent has the lock
        if (slot.isLocked) {
          child[classId][day][period] = { ...slot };
        } else if (
          otherParent.grid[classId]?.[day]?.[period]?.isLocked
        ) {
          child[classId][day][period] = {
            ...otherParent.grid[classId][day][period],
          };
        } else {
          child[classId][day][period] = { ...slot };
        }
      }
    }
  }

  return child;
};

// ── Mutation: randomly swap theory slots within a class ───────────────────────
// Only swaps theory slots, never labs or electives or locked slots
const mutate = (grid, data, mutationRate = MUTATION_RATE) => {
  const { classes, workingDays, periodsPerDayMap } = data;
  const mutatedGrid = JSON.parse(JSON.stringify(grid)); // Deep clone

  for (const cls of classes) {
    const classId = cls._id.toString();

    if (Math.random() > mutationRate) continue;

    // Collect all mutable theory slots
    const theorySlots = [];
    for (const day of workingDays) {
      for (const period of periodsPerDayMap[day] || []) {
        const slot = mutatedGrid[classId]?.[day]?.[period];
        if (
          slot &&
          !slot.isEmpty &&
          !slot.isBreak &&
          !slot.isLocked &&
          !slot.isLabBlock &&
          !slot.isElective &&
          slot.subjectType === 'theory'
        ) {
          theorySlots.push({ day, period });
        }
      }
    }

    // Also collect empty slots for potential swapping
    const emptySlots = [];
    for (const day of workingDays) {
      for (const period of periodsPerDayMap[day] || []) {
        const slot = mutatedGrid[classId]?.[day]?.[period];
        if (slot && slot.isEmpty && !slot.isBreak && !slot.isLocked) {
          emptySlots.push({ day, period });
        }
      }
    }

    if (theorySlots.length < 2) continue;

    // Pick two random theory slots and swap
    const idx1 = Math.floor(Math.random() * theorySlots.length);
    let idx2 = Math.floor(Math.random() * theorySlots.length);
    while (idx2 === idx1 && theorySlots.length > 1) {
      idx2 = Math.floor(Math.random() * theorySlots.length);
    }

    const s1 = theorySlots[idx1];
    const s2 = theorySlots[idx2];

    const slot1 = mutatedGrid[classId][s1.day][s1.period];
    const slot2 = mutatedGrid[classId][s2.day][s2.period];

    // Swap content
    const temp = {
      subjectId: slot1.subjectId,
      subjectName: slot1.subjectName,
      subjectCode: slot1.subjectCode,
      teacherIds: slot1.teacherIds,
      teacherNames: slot1.teacherNames,
    };

    mutatedGrid[classId][s1.day][s1.period].subjectId = slot2.subjectId;
    mutatedGrid[classId][s1.day][s1.period].subjectName = slot2.subjectName;
    mutatedGrid[classId][s1.day][s1.period].subjectCode = slot2.subjectCode;
    mutatedGrid[classId][s1.day][s1.period].teacherIds = slot2.teacherIds;
    mutatedGrid[classId][s1.day][s1.period].teacherNames = slot2.teacherNames;

    mutatedGrid[classId][s2.day][s2.period].subjectId = temp.subjectId;
    mutatedGrid[classId][s2.day][s2.period].subjectName = temp.subjectName;
    mutatedGrid[classId][s2.day][s2.period].subjectCode = temp.subjectCode;
    mutatedGrid[classId][s2.day][s2.period].teacherIds = temp.teacherIds;
    mutatedGrid[classId][s2.day][s2.period].teacherNames = temp.teacherNames;
  }

  return mutatedGrid;
};

// ── Evaluate fitness of a grid ─────────────────────────────────────────────────
const evaluateFitness = (grid, data) => {
  const validation = validateGrid(grid, data);
  const hardViolations = validation.violations.length;

  if (hardViolations > 0) {
    return {
      fitness: 0,
      hardViolations,
      qualityScore: { overall: 0 },
      violations: validation.violations,
    };
  }

  const qualityScore = scoreGrid(grid, data);
  return {
    fitness: qualityScore.overall,
    hardViolations: 0,
    qualityScore,
    violations: [],
  };
};

// ── Main GA runner ─────────────────────────────────────────────────────────────
const runGeneticAlgorithm = (data, options = {}) => {
  const {
    populationSize = POPULATION_SIZE,
    maxGenerations = MAX_GENERATIONS,
    mutationRate = MUTATION_RATE,
    eliteCount = ELITE_COUNT,
    convergenceGenerations = CONVERGENCE_GENERATIONS,
  } = options;

  const startTime = Date.now();

  // Step 1: Generate initial population
  let population = generatePopulation(data, populationSize);

  if (population.length === 0) {
    return {
      success: false,
      error: 'Could not generate any valid initial timetables. Check constraints.',
      grid: null,
      generationStats: { generations: 0, timeMs: Date.now() - startTime },
    };
  }

  let bestIndividual = population[0];
  let generationsWithoutImprovement = 0;
  let generationsRun = 0;

  // Step 2: Evolve
  for (let gen = 0; gen < maxGenerations; gen++) {
    generationsRun = gen + 1;

    // Early exit if perfect score
    if (bestIndividual.fitness >= 98) break;

    // Convergence detection
    if (generationsWithoutImprovement >= convergenceGenerations) {
      break;
    }

    const newPopulation = [];

    // Elitism: carry top individuals forward unchanged
    for (let i = 0; i < Math.min(eliteCount, population.length); i++) {
      newPopulation.push(population[i]);
    }

    // Fill rest of population with offspring
    while (newPopulation.length < populationSize) {
      const parent1 = tournamentSelect(population);
      const parent2 = tournamentSelect(population);

      // Crossover
      let childGrid;
      try {
        childGrid = crossover(parent1, parent2, data);
      } catch {
        // If crossover fails, just mutate parent1
        childGrid = JSON.parse(JSON.stringify(parent1.grid));
      }

      // Mutation
      const mutatedGrid = mutate(childGrid, data, mutationRate);

      // Evaluate
      const { fitness, hardViolations, qualityScore, violations } = evaluateFitness(
        mutatedGrid,
        data
      );

      newPopulation.push({
        grid: mutatedGrid,
        fitness,
        hardViolations,
        qualityScore,
        unplacedSubjects: [],
        warnings: [],
      });
    }

    // Sort new population
    newPopulation.sort((a, b) => b.fitness - a.fitness);
    population = newPopulation;

    // Track improvement
    if (population[0].fitness > bestIndividual.fitness) {
      bestIndividual = population[0];
      generationsWithoutImprovement = 0;
    } else {
      generationsWithoutImprovement++;
    }
  }

  const timeMs = Date.now() - startTime;

  // Return best individual found
  return {
    success: true,
    grid: bestIndividual.grid,
    fitness: bestIndividual.fitness,
    hardViolations: bestIndividual.hardViolations,
    qualityScore: bestIndividual.qualityScore,
    unplacedSubjects: bestIndividual.unplacedSubjects || [],
    warnings: bestIndividual.warnings || [],
    generationStats: {
      generations: generationsRun,
      timeMs,
      hardViolations: bestIndividual.hardViolations,
      populationSize,
    },
  };
};

module.exports = {
  runGeneticAlgorithm,
  generatePopulation,
  evaluateFitness,
  mutate,
  crossover,
};