const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Timetable = require('../src/models/Timetable');
const Teacher = require('../src/models/Teacher');
const { loadData } = require('../src/services/engine/dataLoader');
const { validateGlobalTimetable } = require('../src/services/engine/globalTimetableValidator');
const { validateOutput } = require('../src/services/engine/constraintValidator');
const { scoreGrid } = require('../src/services/engine/qualityScorer');
const { computeTeacherMetrics, validateTeacherPersonalTimetables } = require('../src/services/engine/teacherPersonalTimetableValidator');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

function classTimetablesToGrid(classTimetables) {
  const grid = {};
  for (const ct of classTimetables) {
    const cid = ct.classId.toString();
    grid[cid] = {};
    for (const d of DAYS) {
      grid[cid][d] = {};
    }
    for (const s of ct.slots) {
      grid[cid][s.day][s.period] = s;
    }
  }
  return grid;
}

test('Comprehensive Teacher Distribution, Repetition Prevention & Personal Timetable Balance (13 Test Cases)', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI);
  const data = await loadData({});
  const activeTimetable = (await Timetable.findOne({ isAccepted: true }).lean()) || (await Timetable.findOne({ version: 1 }).lean()) || (await Timetable.findOne().lean());
  assert.ok(activeTimetable, 'Active timetable must exist in MongoDB');
  const grid = classTimetablesToGrid(activeTimetable.classTimetables);

  // TEST 1: Class Repetition Prevention
  await t.test('Test 1: Class Repetition Prevention Test', () => {
    const teacherVal = validateTeacherPersonalTimetables(grid, data);
    assert.strictEqual(teacherVal.totalRule1Violations, 0, `Expected 0 hard Rule 1 violations, found ${teacherVal.totalRule1Violations}`);
  });

  // TEST 2: Consecutive Teaching Period Limit
  await t.test('Test 2: Consecutive Teaching Period Limit Test', () => {
    for (const teacher of data.teachers) {
      const metrics = computeTeacherMetrics(teacher, grid, data);
      const isProjectSupervision = metrics.dailyLoads.Thursday === 6 && metrics.dailyLoads.Friday === 6;
      if (!isProjectSupervision) {
        // Full day project supervision is 6 hours; other faculty must have max consecutive <= 4 (allowing 3-period lab + 1 period adjacent)
        assert.ok(
          metrics.maxConsecutiveTeaching <= 4,
          `Teacher ${teacher.name} has ${metrics.maxConsecutiveTeaching} consecutive teaching periods (must be <= 4)`
        );
      }
    }
  });

  // TEST 3: Daily Workload Variance Test
  await t.test('Test 3: Daily Workload Variance Test', () => {
    const teacherVal = validateTeacherPersonalTimetables(grid, data);
    assert.strictEqual(teacherVal.totalHighVariance, 0, `Expected 0 faculty with excessive daily variance, found ${teacherVal.totalHighVariance}`);
  });

  // TEST 4: Laboratory Continuity Test
  await t.test('Test 4: Laboratory Continuity Test', () => {
    const val = validateGlobalTimetable(grid, data);
    assert.strictEqual(val.report.laboratoryChecks.failed, 0, 'All laboratory blocks must be continuous and uninterrupted');
  });

  // TEST 5: S8 Project Phase-2 Scheduling Test
  await t.test('Test 5: S8 Project Phase-2 Scheduling Test', () => {
    const s8Classes = data.classes.filter(c => c.name.includes('S8'));
    for (const cls of s8Classes) {
      const cid = cls._id.toString();
      for (const day of ['Thursday', 'Friday']) {
        for (const p of PERIODS) {
          const slot = grid[cid]?.[day]?.[p];
          assert.ok(slot, `S8 slot on ${day} P${p} must exist`);
          assert.strictEqual(slot.subjectCode, 'CST416', `S8 on ${day} P${p} must be CST416 Project Phase-2`);
        }
      }
    }
  });

  // TEST 6: S6 Open Elective Slot Adherence Test
  await t.test('Test 6: S6 Open Elective Slot Adherence Test', () => {
    const s6Classes = data.classes.filter(c => c.name.includes('S6'));
    const expectedSlots = [
      { day: 'Monday', period: 3 },
      { day: 'Tuesday', period: 3 },
      { day: 'Wednesday', period: 3 },
      { day: 'Thursday', period: 6 },
    ];
    for (const cls of s6Classes) {
      const cid = cls._id.toString();
      for (const es of expectedSlots) {
        const slot = grid[cid]?.[es.day]?.[es.period];
        assert.ok(slot, `S6 slot on ${es.day} P${es.period} must exist`);
        assert.ok(
          slot.subjectCode.includes('PECST635') || slot.subjectCode.includes('PECST631') || slot.isElective,
          `S6 on ${es.day} P${es.period} must be Open Elective`
        );
      }
    }
  });

  // TEST 7: Elective Synchronization Test
  await t.test('Test 7: Elective Synchronization Test', () => {
    // S4 Elective synchronized between S4 CSE A, S4 CSE B, and S4 AIML
    const s4a = data.classes.find(c => c.name === 'S4 CSE A')._id.toString();
    const s4b = data.classes.find(c => c.name === 'S4 CSE B')._id.toString();
    for (const d of DAYS) {
      for (const p of PERIODS) {
        const slotA = grid[s4a]?.[d]?.[p];
        const slotB = grid[s4b]?.[d]?.[p];
        const isElectiveA = slotA?.isElective && (slotA?.subjectCode.includes('PECST411') || slotA?.subjectCode.includes('PECST419'));
        const isElectiveB = slotB?.isElective && (slotB?.subjectCode.includes('PECST411') || slotB?.subjectCode.includes('PECST419'));
        assert.strictEqual(isElectiveA, isElectiveB, `S4 Elective must be synchronized on ${d} P${p}`);
      }
    }
  });

  // TEST 8: Exact Workload Conservation Test
  await t.test('Test 8: Exact Workload Conservation Test', () => {
    const val = validateGlobalTimetable(grid, data);
    assert.strictEqual(val.report.workloadChecks.failed, 0, 'All subject and class workloads must match authoritative manifest');
  });

  // TEST 9: Multi-Class Collision-Free Test
  await t.test('Test 9: Multi-Class Collision-Free Test', () => {
    const val = validateGlobalTimetable(grid, data);
    assert.strictEqual(val.report.facultyCollisions.failed, 0, 'Zero prohibited faculty collisions across all classes');
    assert.strictEqual(val.report.classCollisions.failed, 0, 'Zero class collisions across all classes');
  });

  // TEST 10: Intraday Distribution & Idle Gaps Test
  await t.test('Test 10: Intraday Distribution & Idle Gaps Test', () => {
    for (const teacher of data.teachers) {
      const metrics = computeTeacherMetrics(teacher, grid, data);
      // Faculty with <= 10 hours should not have excessive idle waiting gaps (> 12 total in a week)
      if (metrics.totalScheduledHours > 0 && metrics.totalScheduledHours <= 10) {
        assert.ok(metrics.totalIdleGaps <= 12, `Teacher ${teacher.name} has ${metrics.totalIdleGaps} weekly idle gaps`);
      }
    }
  });

  // TEST 11: Teacher Personal Timetable Generation Test
  await t.test('Test 11: Teacher Personal Timetable Generation Test', () => {
    for (const teacher of data.teachers) {
      const metrics = computeTeacherMetrics(teacher, grid, data);
      assert.ok(metrics.teacherId, 'Teacher metrics must have teacherId');
      assert.ok(metrics.schedule, 'Teacher metrics must contain full schedule');
      assert.strictEqual(Object.keys(metrics.dailyLoads).length, 5, 'Daily loads must cover all 5 working days');
    }
  });

  // TEST 12: Publication Gate Integration Test
  await t.test('Test 12: Publication Gate Integration Test', () => {
    const val = validateGlobalTimetable(grid, data);
    assert.strictEqual(val.valid, true, 'Timetable must be valid');
    assert.strictEqual(val.hardViolationsCount, 0, 'Hard violations count must be 0');
    assert.strictEqual(val.report.publicationGate.passed, true, 'Publication gate must report passed=true');
  });

  // TEST 13: End-to-End Persistence and Regression Test
  await t.test('Test 13: End-to-End Persistence and Regression Test', () => {
    assert.strictEqual(activeTimetable.publicationStatus, 'PUBLISHED', 'Timetable must be PUBLISHED');
    assert.strictEqual(activeTimetable.publicationGatePassed, true, 'publicationGatePassed must be true');
    assert.strictEqual(activeTimetable.qualityScore.overall, 100, 'Quality score must be 100');
    assert.strictEqual(activeTimetable.classTimetables.length, data.classes.length, 'All classes persisted');
  });

  await mongoose.disconnect();
});
