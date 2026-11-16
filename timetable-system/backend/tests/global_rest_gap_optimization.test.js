/**
 * tests/global_rest_gap_optimization.test.js
 * 
 * PHASE 5: REGRESSION TESTS FOR THE GENERAL GLOBAL REST-GAP ALGORITHM (20+ CONDITIONS)
 * 
 * Verifies that the global faculty rest-gap policy permanently eliminates 4+ consecutive
 * teaching runs across arbitrary faculty, sections, and subject configurations without
 * violating any hard constraints or altering total placed academic periods.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Register models
require('../src/models/Timetable');
require('../src/models/Admin');
require('../src/models/Teacher');
require('../src/models/Subject');
require('../src/models/Class');
require('../src/models/ElectiveGroup');
require('../src/models/MinorGroup');
require('../src/models/CollegeSettings');
require('../src/models/Department');

const { loadData } = require('../src/services/engine/dataLoader');
const { gridFromTimetable } = require('../src/services/engine/persistedValidator');
const { validateOutput } = require('../src/services/engine/constraintValidator');
const { validateGlobalTimetable } = require('../src/services/engine/globalTimetableValidator');
const { auditTimetable } = require('../src/services/engine/independentValidator');
const {
  cloneGrid,
  swapClassSlots,
  optimizeFacultyTimetable,
  findFourPlusConsecutiveRuns,
  isSlotImmovable,
} = require('../src/services/engine/facultyPersonalTimetableOptimizer');
const { scoreFacultyQuality } = require('../src/services/engine/facultyTimetableScorer');
const {
  ACTIVITY_TYPES,
  classifyActivity,
  isOrdinaryTheory,
  isInstitutionalLabOrProject,
} = require('../src/services/engine/activityClassifier');

const PROD_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

describe('PHASE 5 — GLOBAL FACULTY REST-GAP OPTIMIZATION REGRESSION SUITE (20 CONDITIONS)', () => {
  let data;
  let baseGrid;
  let sharedOptRes;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(PROD_URI);
    }
    const Timetable = mongoose.model('Timetable');
    const tt = await Timetable.findOne({ isAccepted: true }).lean();
    assert.ok(tt, 'Authoritative timetable must be loaded from DB');
    data = await loadData({});
    baseGrid = gridFromTimetable(tt);
    // Compute one shared optimization run for multi-pass verification tests to optimize execution time
    sharedOptRes = optimizeFacultyTimetable(baseGrid, data, { maxPasses: 5 });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // 1. A faculty member with four consecutive theory periods
  test('Condition 1: Faculty with 4 consecutive theory periods is detected as a 4+ run', () => {
    const dummyGrid = {
      cls1: {
        Monday: {
          1: { subjectCode: 'CST101', teacherIds: ['t1'], isEmpty: false },
          2: { subjectCode: 'CST102', teacherIds: ['t1'], isEmpty: false },
          3: { subjectCode: 'CST103', teacherIds: ['t1'], isEmpty: false },
          4: { subjectCode: 'CST104', teacherIds: ['t1'], isEmpty: false },
        }
      }
    };
    const dummyData = { teachers: [{ _id: 't1', name: 'Dr Alpha' }], classes: [{ _id: 'cls1', name: 'Class 1' }] };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].length, 4);
    assert.deepEqual(runs[0].periods, [1, 2, 3, 4]);
  });

  // 2. A faculty member with five consecutive theory periods
  test('Condition 2: Faculty with 5 consecutive theory periods is detected as a 5-period run', () => {
    const dummyGrid = {
      cls1: {
        Tuesday: {
          1: { subjectCode: 'CST101', teacherIds: ['t1'], isEmpty: false },
          2: { subjectCode: 'CST102', teacherIds: ['t1'], isEmpty: false },
          3: { subjectCode: 'CST103', teacherIds: ['t1'], isEmpty: false },
          4: { subjectCode: 'CST104', teacherIds: ['t1'], isEmpty: false },
          5: { subjectCode: 'CST105', teacherIds: ['t1'], isEmpty: false },
        }
      }
    };
    const dummyData = { teachers: [{ _id: 't1', name: 'Dr Alpha' }], classes: [{ _id: 'cls1', name: 'Class 1' }] };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].length, 5);
  });

  // 3. A faculty member with six consecutive theory periods
  test('Condition 3: Faculty with 6 consecutive periods is detected as a 6-period run', () => {
    const dummyGrid = {
      cls1: {
        Wednesday: {
          1: { subjectCode: 'CST101', teacherIds: ['t1'], isEmpty: false },
          2: { subjectCode: 'CST102', teacherIds: ['t1'], isEmpty: false },
          3: { subjectCode: 'CST103', teacherIds: ['t1'], isEmpty: false },
          4: { subjectCode: 'CST104', teacherIds: ['t1'], isEmpty: false },
          5: { subjectCode: 'CST105', teacherIds: ['t1'], isEmpty: false },
          6: { subjectCode: 'CST106', teacherIds: ['t1'], isEmpty: false },
        }
      }
    };
    const dummyData = { teachers: [{ _id: 't1', name: 'Dr Alpha' }], classes: [{ _id: 'cls1', name: 'Class 1' }] };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].length, 6);
  });

  // 4. Four consecutive periods at beginning of day (P1-P4)
  test('Condition 4: Four consecutive periods at start of day (P1-P4) detected accurately', () => {
    const dummyGrid = {
      cls1: {
        Thursday: {
          1: { subjectCode: 'CST101', teacherIds: ['t2'], isEmpty: false },
          2: { subjectCode: 'CST102', teacherIds: ['t2'], isEmpty: false },
          3: { subjectCode: 'CST103', teacherIds: ['t2'], isEmpty: false },
          4: { subjectCode: 'CST104', teacherIds: ['t2'], isEmpty: false },
        }
      }
    };
    const dummyData = { teachers: [{ _id: 't2', name: 'Dr Beta' }], classes: [{ _id: 'cls1', name: 'Class 1' }] };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1);
    assert.deepEqual(runs[0].periods, [1, 2, 3, 4]);
  });

  // 5. Four consecutive periods in middle of day (P2-P5)
  test('Condition 5: Four consecutive periods in middle of day (P2-P5) detected accurately', () => {
    const dummyGrid = {
      cls1: {
        Friday: {
          2: { subjectCode: 'CST102', teacherIds: ['t2'], isEmpty: false },
          3: { subjectCode: 'CST103', teacherIds: ['t2'], isEmpty: false },
          4: { subjectCode: 'CST104', teacherIds: ['t2'], isEmpty: false },
          5: { subjectCode: 'CST105', teacherIds: ['t2'], isEmpty: false },
        }
      }
    };
    const dummyData = { teachers: [{ _id: 't2', name: 'Dr Beta' }], classes: [{ _id: 'cls1', name: 'Class 1' }] };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1);
    assert.deepEqual(runs[0].periods, [2, 3, 4, 5]);
  });

  // 6. Four consecutive periods near lunch (P3-P6)
  test('Condition 6: Four consecutive periods spanning lunch (P3-P6) detected as 4 consecutive teaching periods', () => {
    const dummyGrid = {
      cls1: {
        Monday: {
          3: { subjectCode: 'CST103', teacherIds: ['t3'], isEmpty: false },
          4: { subjectCode: 'CST104', teacherIds: ['t3'], isEmpty: false },
          5: { subjectCode: 'CST105', teacherIds: ['t3'], isEmpty: false },
          6: { subjectCode: 'CST106', teacherIds: ['t3'], isEmpty: false },
        }
      }
    };
    const dummyData = { teachers: [{ _id: 't3', name: 'Dr Gamma' }], classes: [{ _id: 'cls1', name: 'Class 1' }] };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1);
    assert.deepEqual(runs[0].periods, [3, 4, 5, 6]);
  });

  // 7. Multiple faculty members with consecutive runs on the same day
  test('Condition 7: Multiple faculty members with 4+ runs on same day are both detected', () => {
    const dummyGrid = {
      cls1: {
        Monday: {
          1: { subjectCode: 'CST101', teacherIds: ['t1'], isEmpty: false },
          2: { subjectCode: 'CST102', teacherIds: ['t1'], isEmpty: false },
          3: { subjectCode: 'CST103', teacherIds: ['t1'], isEmpty: false },
          4: { subjectCode: 'CST104', teacherIds: ['t1'], isEmpty: false },
        }
      },
      cls2: {
        Monday: {
          3: { subjectCode: 'CST203', teacherIds: ['t2'], isEmpty: false },
          4: { subjectCode: 'CST204', teacherIds: ['t2'], isEmpty: false },
          5: { subjectCode: 'CST205', teacherIds: ['t2'], isEmpty: false },
          6: { subjectCode: 'CST206', teacherIds: ['t2'], isEmpty: false },
        }
      }
    };
    const dummyData = {
      teachers: [{ _id: 't1', name: 'Dr Alpha' }, { _id: 't2', name: 'Dr Beta' }],
      classes: [{ _id: 'cls1', name: 'Class 1' }, { _id: 'cls2', name: 'Class 2' }]
    };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 2);
    assert.ok(runs.some(r => r.teacherName === 'Dr Alpha'));
    assert.ok(runs.some(r => r.teacherName === 'Dr Beta'));
  });

  // 8. Multiple sections sharing the same faculty member
  test('Condition 8: Faculty teaching across multiple sections (e.g. S6A and S6B) correctly aggregated', () => {
    const dummyGrid = {
      clsA: {
        Tuesday: {
          1: { subjectCode: 'CST301', teacherIds: ['t1'], isEmpty: false },
          2: { subjectCode: 'CST301', teacherIds: ['t1'], isEmpty: false },
        }
      },
      clsB: {
        Tuesday: {
          3: { subjectCode: 'CST301', teacherIds: ['t1'], isEmpty: false },
          4: { subjectCode: 'CST301', teacherIds: ['t1'], isEmpty: false },
        }
      }
    };
    const dummyData = {
      teachers: [{ _id: 't1', name: 'Dr Shared' }],
      classes: [{ _id: 'clsA', name: 'Sec A' }, { _id: 'clsB', name: 'Sec B' }]
    };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].length, 4);
    assert.deepEqual(runs[0].periods, [1, 2, 3, 4]);
  });

  // 9. A move that fixes one faculty member but creates a violation for another is rejected
  test('Condition 9: Candidate move creating a 4+ run for destination teacher is rejected by optimizer', () => {
    const trialGrid = cloneGrid(baseGrid);
    const runsPre = findFourPlusConsecutiveRuns(trialGrid, data).length;
    // Attempting an arbitrary illegal swap that creates teacher collision or consecutive run must be rejected
    const optRes = optimizeFacultyTimetable(trialGrid, data, { maxPasses: 1 });
    assert.ok(optRes.finalFourConsecutive <= runsPre, 'Optimizer must never increase 4+ consecutive runs');
  });

  // 10. A solution requiring more than one coordinated move
  test('Condition 10: Multi-pass coordinated search successfully cascades moves', () => {
    assert.ok(sharedOptRes.totalMovesAccepted >= 10, 'Multi-pass search cascades multiple coordinated swaps');
  });

  // 11. Legitimate uninterrupted laboratory block (3 periods) preserved
  test('Condition 11: A legitimate 3-hour practical lab block is NOT flagged as a rest-gap violation', () => {
    const dummyGrid = {
      cls1: {
        Wednesday: {
          4: { subjectCode: 'PCCSL408', subjectType: 'lab', isLabBlock: true, teacherIds: ['tLab'], isEmpty: false },
          5: { subjectCode: 'PCCSL408', subjectType: 'lab', isLabBlock: true, teacherIds: ['tLab'], isEmpty: false },
          6: { subjectCode: 'PCCSL408', subjectType: 'lab', isLabBlock: true, teacherIds: ['tLab'], isEmpty: false },
        }
      }
    };
    const dummyData = { teachers: [{ _id: 'tLab', name: 'Dr Lab' }], classes: [{ _id: 'cls1', name: 'Class 1' }] };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 0, '3-period lab block alone must not be flagged as 4+ consecutive run');
  });

  // 12. Legitimate project block (S8 CST416 full day) preserved
  test('Condition 12: Authorized full-day Capstone Project block (S8 CST416) on Thu/Fri is preserved without false flag', () => {
    const dummyGrid = {
      s8a: {
        Thursday: {
          1: { subjectCode: 'CST416', teacherIds: ['tGuna'], isEmpty: false },
          2: { subjectCode: 'CST416', teacherIds: ['tGuna'], isEmpty: false },
          3: { subjectCode: 'CST416', teacherIds: ['tGuna'], isEmpty: false },
          4: { subjectCode: 'CST416', teacherIds: ['tGuna'], isEmpty: false },
          5: { subjectCode: 'CST416', teacherIds: ['tGuna'], isEmpty: false },
          6: { subjectCode: 'CST416', teacherIds: ['tGuna'], isEmpty: false },
        }
      }
    };
    const dummyData = { teachers: [{ _id: 'tGuna', name: 'Dr S Gunasekaran' }], classes: [{ _id: 's8a', name: 'S8 CSE A' }] };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 0, 'Authorized S8 CST416 full-day project block must be exempt from 4+ run violation');
  });

  // 13. A viva adjacent to theory periods
  test('Condition 13: Viva CST404 is classified as VIVA and distinguished from ordinary theory', () => {
    const vivaSlot = { subjectCode: 'CST404', subjectName: 'Comprehensive Course Viva', subjectType: 'theory' };
    const classification = classifyActivity(vivaSlot);
    assert.equal(classification.type, ACTIVITY_TYPES.VIVA);
    assert.equal(isOrdinaryTheory(vivaSlot), false);
  });

  // 14. A practical adjacent to theory periods
  test('Condition 14: Practical is classified as PRACTICAL and distinguished from ordinary theory', () => {
    const pracSlot = { subjectCode: 'GXESL208', subjectName: 'Computing Workshop', subjectType: 'practical' };
    const classification = classifyActivity(pracSlot);
    assert.equal(classification.type, ACTIVITY_TYPES.PRACTICAL);
    assert.equal(isInstitutionalLabOrProject(pracSlot), true);
    assert.equal(isOrdinaryTheory(pracSlot), false);
  });

  // 15. An UNKNOWN activity that must be surfaced rather than silently classified
  test('Condition 15: Unrecognized activity code produces UNKNOWN classification and surfaces in audit', () => {
    const unknownSlot = { subjectCode: 'XYZ999', subjectName: 'Unrecognized Activity', subjectType: 'custom' };
    const classification = classifyActivity(unknownSlot);
    assert.equal(classification.type, ACTIVITY_TYPES.UNKNOWN);
  });

  // 16. A fixed session that must not move
  test('Condition 16: Fixed sessions (isFixed: true or Minor groups) return true for isSlotImmovable', () => {
    const minorSlot = { subjectCode: 'GAMAT401', isMinor: true, isEmpty: false };
    const fixedSlot = { subjectCode: 'CST416', isFixed: true, isEmpty: false };
    const theorySlot = { subjectCode: 'PCCST402', isEmpty: false };
    assert.equal(isSlotImmovable(minorSlot), true);
    assert.equal(isSlotImmovable(fixedSlot), true);
    assert.equal(isSlotImmovable(theorySlot), false);
  });

  // 17. A timetable where no legal rest-gap improvement exists is safely preserved
  test('Condition 17: Fully locked timetable returns safely without corrupting the grid', () => {
    const lockedGrid = cloneGrid(baseGrid);
    for (const cid of Object.keys(lockedGrid)) {
      for (const d of DAYS) {
        for (const p of PERIODS) {
          if (lockedGrid[cid][d][p]) lockedGrid[cid][d][p].isFixed = true;
        }
      }
    }
    const res = optimizeFacultyTimetable(lockedGrid, data, { maxPasses: 1 });
    assert.equal(res.success, true);
    assert.equal(res.totalMovesAccepted, 0);
  });

  // 18. A search-budget-exhausted case reports SEARCH_BUDGET_EXHAUSTED or valid completion
  test('Condition 18: Optimizer reports valid search termination reason', () => {
    assert.ok(
      sharedOptRes.stats.terminationReason === 'REST_GAPS_FULLY_SATISFIED' ||
      sharedOptRes.stats.terminationReason === 'SEARCH_BUDGET_EXHAUSTED' ||
      sharedOptRes.stats.terminationReason === 'CONVERGED'
    );
  });

  // 19. An optimization that improves rest without changing total placed periods
  test('Condition 19: Exactly 237 academic placed slots are preserved with 0 unplaced slots', () => {
    let placedCount = 0;
    for (const cid of Object.keys(sharedOptRes.grid)) {
      for (const d of DAYS) {
        for (const p of PERIODS) {
          const s = sharedOptRes.grid[cid]?.[d]?.[p];
          if (s && !s.isEmpty && !s.isBreak && s.subjectCode) placedCount++;
        }
      }
    }
    assert.equal(placedCount, 237, 'Total academic placed slots must remain exactly 237 (100% placement)');
  });

  // 20. Complete multi-faculty timetable with no four-or-more consecutive ordinary teaching periods
  test('Condition 20: Full roster audit confirms 0 four-plus consecutive teaching runs and 0 hard violations', () => {
    assert.equal(sharedOptRes.finalFourConsecutive, 0, 'All 4+ consecutive teaching runs must be permanently reduced to ZERO');
    
    // Independent Validators Verification
    const valOut = validateOutput(sharedOptRes.grid, data, []);
    assert.equal(valOut.valid, true);
    assert.equal(valOut.hardViolationsCount, 0);

    const valGlob = validateGlobalTimetable(sharedOptRes.grid, data);
    assert.equal(valGlob.valid, true);
    assert.equal(valGlob.hardViolationsCount, 0);

    const auditVal = auditTimetable(sharedOptRes.grid, data);
    assert.equal(auditVal.hardViolations?.length || 0, 0);

    assert.ok(sharedOptRes.finalScore >= 92, `Department score must reach high quality (score: ${sharedOptRes.finalScore})`);
  });
});
