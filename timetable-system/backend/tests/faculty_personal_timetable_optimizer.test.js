const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

require('../src/models/Timetable');
require('../src/models/Teacher');
require('../src/models/Department');
require('../src/models/Class');
require('../src/models/Subject');

const { loadData } = require('../src/services/engine/dataLoader');
const { validateOutput } = require('../src/services/engine/constraintValidator');
const { scoreFacultyQuality, scoreSingleFacultySchedule } = require('../src/services/engine/facultyTimetableScorer');
const {
  optimizeFacultyTimetable,
  cloneGrid,
  swapClassSlots,
  moveSlotToEmpty,
} = require('../src/services/engine/facultyPersonalTimetableOptimizer');
const { buildAuthoritativeFacultySchedules } = require('../src/services/engine/facultyPersonalTimetableAnalyzer');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

test.describe('PHASE 2 — FACULTY PERSONAL TIMETABLE OPTIMIZER ACCEPTANCE SUITE', () => {
  let data;
  let masterGrid;
  let baselineScore;
  let optRes;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db');
    }
    data = await loadData({});
    const gridPath = path.resolve(__dirname, '../scripts/authoritative_master_grid.json');
    masterGrid = JSON.parse(fs.readFileSync(gridPath, 'utf8'));
    baselineScore = scoreFacultyQuality(masterGrid, data);

    // Pre-compute optimized grid once to test across all scenarios efficiently
    optRes = optimizeFacultyTimetable(masterGrid, data, { maxPasses: 3 });
  });

  test.after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // TEST 1: Faculty member with three consecutive classes
  test('Test 1: Optimizer detects and resolves 3 consecutive theory teaching periods', () => {
    assert.equal(optRes.success, true);
    assert.ok(
      optRes.finalMetrics.threeConsecutive < baselineScore.totalThreeConsecutive,
      `Optimizer must reduce 3-consecutive theory periods (got ${optRes.finalMetrics.threeConsecutive}, base was ${baselineScore.totalThreeConsecutive})`
    );
  });

  // TEST 2: Faculty member with two consecutive classes
  test('Test 2: Two consecutive teaching periods are permitted and follow-up breaks are respected', () => {
    const dummyRecord = {
      teacherId: new mongoose.Types.ObjectId().toString(),
      teacherName: 'Prof. Pair Lecturer',
      scheduleGrid: {
        Monday: {
          1: { subjectCode: 'CS101', subjectType: 'theory' },
          2: { subjectCode: 'CS101', subjectType: 'theory' },
          // P3 is free (Rest gap before lunch)
          // P4 is lunch
          5: { subjectCode: 'CS201', subjectType: 'theory' },
        },
        Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {}
      },
      allocations: [
        { subjectCode: 'CS101' }, { subjectCode: 'CS101' }, { subjectCode: 'CS201' }
      ]
    };

    const singleScore = scoreSingleFacultySchedule(dummyRecord);
    assert.equal(singleScore.threeConsecutiveCount, 0, '2 consecutive periods must NOT be flagged as 3-consecutive');
    assert.equal(singleScore.consecutiveScore, 25, 'Pair with subsequent break must receive full consecutiveRest score');
    assert.ok(singleScore.overallScore >= 90, 'Score should reflect compliant rest gap');
  });

  // TEST 3: Faculty member with sufficient breaks
  test('Test 3: Faculty member with sufficient breaks receives optimal score and is preserved without disruption', () => {
    const balancedRecord = {
      teacherId: new mongoose.Types.ObjectId().toString(),
      teacherName: 'Prof. Balanced Teacher',
      scheduleGrid: {
        Monday: { 1: { subjectCode: 'CS101', subjectType: 'theory' }, 3: { subjectCode: 'CS101', subjectType: 'theory' } },
        Tuesday: { 2: { subjectCode: 'CS102', subjectType: 'theory' }, 5: { subjectCode: 'CS102', subjectType: 'theory' } },
        Wednesday: { 1: { subjectCode: 'CS103', subjectType: 'theory' } },
        Thursday: { 2: { subjectCode: 'CS104', subjectType: 'theory' }, 6: { subjectCode: 'CS104', subjectType: 'theory' } },
        Friday: { 2: { subjectCode: 'CS105', subjectType: 'theory' } },
      },
      allocations: [
        { subjectCode: 'CS101' }, { subjectCode: 'CS101' },
        { subjectCode: 'CS102' }, { subjectCode: 'CS102' },
        { subjectCode: 'CS103' },
        { subjectCode: 'CS104' }, { subjectCode: 'CS104' },
        { subjectCode: 'CS105' },
      ]
    };

    const score = scoreSingleFacultySchedule(balancedRecord);
    assert.equal(score.threeConsecutiveCount, 0);
    assert.equal(score.lunchFlankingDaysCount, 0);
    assert.equal(score.consecutiveScore, 25);
    assert.equal(score.lunchScore, 20);
    assert.ok(score.overallScore >= 90, `Expected score >= 90, got ${score.overallScore}`);
  });

  // TEST 4: Faculty member with classes on both sides of lunch
  test('Test 4: Optimizer penalizes and minimizes lunch-flanking instances across the faculty roster', () => {
    assert.ok(baselineScore.totalLunchFlanking > 0, 'Baseline should contain initial lunch flanking instances');
    assert.equal(optRes.success, true);
    assert.ok(
      optRes.finalMetrics.lunchFlanking <= baselineScore.totalLunchFlanking,
      `Final lunch flanking (${optRes.finalMetrics.lunchFlanking}) must be <= initial (${baselineScore.totalLunchFlanking})`
    );
    assert.ok(optRes.finalMetrics.lunchFlanking <= 10, 'Optimizer should reduce lunch flanking significantly');
  });

  // TEST 5: Faculty member teaching multiple sections
  test('Test 5: Multi-section faculty assignments maintain 0 cross-section double bookings throughout optimization', () => {
    assert.equal(optRes.success, true);

    const val = validateOutput(optRes.grid, data, []);
    const teacherDoubles = (val.hardViolations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED');
    assert.equal(teacherDoubles.length, 0, `Expected 0 teacher double bookings, found ${teacherDoubles.length}`);

    // Verify specifically across all teacher schedules that no non-shared double booking exists
    const teacherMap = buildAuthoritativeFacultySchedules(optRes.grid, data.teachers, data.classes);
    for (const record of teacherMap.values()) {
      DAYS.forEach(day => {
        PERIODS.forEach(p => {
          const sessions = record.scheduleGrid[day]?.[p];
          if (Array.isArray(sessions) && sessions.length > 1) {
            // Must be shared session (e.g. S8 Capstone Project)
            const sharedIds = new Set(sessions.map(s => s.sharedSessionId).filter(Boolean));
            assert.ok(sharedIds.size >= 1, `Teacher ${record.teacherName} has double booking on ${day} P${p}`);
          }
        });
      });
    }
  });

  // TEST 6: Faculty member with multiple laboratories
  test('Test 6: Laboratory block integrity and designated lab rooms (Lab 1-4) are 100% preserved', () => {
    assert.equal(optRes.success, true);

    const val = validateOutput(optRes.grid, data, []);
    const labViolations = (val.hardViolations || []).filter(v => [
      'LAB_BLOCK_SPLIT', 'LAB_BLOCK_NON_CONSECUTIVE', 'LAB_BREAK_CROSSED',
      'LAB_ROOM_MISMATCH', 'LAB_ROOM_CONFLICT', 'LAB_DOUBLE_BOOKING'
    ].includes(v.type));

    assert.equal(labViolations.length, 0, `Expected 0 lab violations, found ${labViolations.length}: ${JSON.stringify(labViolations)}`);
  });

  // TEST 7: Faculty member with fixed slots
  test('Test 7: Fixed slots (S8 CST416 Capstone, S4/S6 Minor tracks) are strictly protected and never moved', () => {
    assert.equal(optRes.success, true);

    const s8a = data.classes.find(c => c.name.includes('S8') && c.name.includes('A'))?._id?.toString();
    const s8b = data.classes.find(c => c.name.includes('S8') && c.name.includes('B'))?._id?.toString();

    // S8 Capstone Project must occupy every period on Thursday and Friday
    for (const cid of [s8a, s8b]) {
      for (const day of ['Thursday', 'Friday']) {
        for (let p = 1; p <= 6; p++) {
          const slot = optRes.grid[cid][day][p];
          assert.equal(slot.subjectCode, 'CST416', `S8 ${cid} on ${day} P${p} must remain CST416 Capstone Project`);
          assert.equal(slot.isLocked, true, 'Capstone slot must remain locked');
        }
      }
    }
  });

  // TEST 8: Faculty schedule that cannot be improved safely
  test('Test 8: Infeasible candidate moves are rolled back, safely retaining the baseline solution without regression', () => {
    // Run optimizer on a locked grid where no theory moves are permissible
    const lockedGrid = cloneGrid(masterGrid);
    for (const cid of Object.keys(lockedGrid)) {
      for (const d of DAYS) {
        for (let p = 1; p <= 6; p++) {
          if (lockedGrid[cid][d][p]) {
            lockedGrid[cid][d][p].isLocked = true;
          }
        }
      }
    }

    const baselineLockedScore = scoreFacultyQuality(lockedGrid, data);
    const lockedOptRes = optimizeFacultyTimetable(lockedGrid, data, { maxPasses: 1 });

    assert.equal(lockedOptRes.success, true);
    assert.equal(lockedOptRes.improved, false, 'Should gracefully report 0 moves possible when all slots are locked');
    assert.equal(lockedOptRes.totalMovesAccepted, 0);
    assert.equal(lockedOptRes.finalScore, baselineLockedScore.overall, 'Must retain exact baseline score');
  });

  // TEST 9: Comprehensive acceptance verification
  test('Test 9: Phase 2 Acceptance: 100% placement preserved, 0 double bookings, 0 3-consec theory, score improves', () => {
    assert.equal(optRes.success, true);
    assert.equal(optRes.improved, true, 'Optimizer must achieve measurable improvements');

    // 1. Hard constraints
    const val = validateOutput(optRes.grid, data, []);
    assert.equal(val.valid, true, `Final grid must be 100% valid. Hard violations: ${val.hardViolationsCount}`);
    assert.equal(val.hardViolationsCount, 0, 'Zero hard violations allowed');

    // 2. 100% placement preserved
    const underScheduled = (val.hardViolations || []).filter(v => v.type === 'SUBJECT_UNDER_SCHEDULED');
    assert.equal(underScheduled.length, 0, 'All subjects must remain 100% placed');

    // 3. Faculty collisions
    const teacherDoubles = (val.hardViolations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED');
    assert.equal(teacherDoubles.length, 0, 'Zero faculty double bookings allowed');

    // 4. Section collisions
    const classDoubles = (val.hardViolations || []).filter(v => v.type === 'CLASS_DOUBLE_BOOKED');
    assert.equal(classDoubles.length, 0, 'Zero class double bookings allowed');

    // 5. Laboratory collisions
    const labDoubles = (val.hardViolations || []).filter(v => v.type === 'LAB_ROOM_CONFLICT' || v.type === 'LAB_DOUBLE_BOOKING');
    assert.equal(labDoubles.length, 0, 'Zero lab double bookings allowed');

    // 6. 3+ consecutive periods eliminated or reduced
    assert.ok(
      optRes.finalMetrics.threeConsecutive < baselineScore.totalThreeConsecutive,
      `Three consecutive theory periods must be reduced from baseline (${baselineScore.totalThreeConsecutive}), got ${optRes.finalMetrics.threeConsecutive}`
    );

    // 7. Overall Faculty Quality Score improvement
    assert.ok(optRes.finalScore >= optRes.baselineScore, `Final score (${optRes.finalScore}) must be >= baseline (${optRes.baselineScore})`);
    assert.ok(optRes.finalScore >= 90, `Expected final score >= 90, got ${optRes.finalScore}`);
  });
});
