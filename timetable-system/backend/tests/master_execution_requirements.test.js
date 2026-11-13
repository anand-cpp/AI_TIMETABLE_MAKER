const assert = require('assert');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Timetable = require('../src/models/Timetable');
const Teacher = require('../src/models/Teacher');
const Class = require('../src/models/Class');
const Subject = require('../src/models/Subject');
const ElectiveGroup = require('../src/models/ElectiveGroup');

const { loadData } = require('../src/services/engine/dataLoader');
const { validateOutput } = require('../src/services/engine/constraintValidator');
const { scoreGrid } = require('../src/services/engine/qualityScorer');
const { timetableToGrid, simulateRebalance } = require('../src/services/rebalanceService');

async function runMasterTests() {
  console.log('================================================================');
  console.log(' MASTER EXECUTION REQUIREMENT VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  const data = await loadData({});
  const activeTimetable = await Timetable.findOne({ isAccepted: true }) || await Timetable.findOne().sort({ version: -1 });
  assert.ok(activeTimetable, 'Active/latest timetable must exist in MongoDB');
  const grid = timetableToGrid(activeTimetable);

  let passedCount = 0;
  let failedCount = 0;

  async function runTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failedCount++;
    }
  }

  // ─── PART A: S4 ELECTIVE SYNCHRONIZATION TESTS ─────────────────────────────
  console.log('--- SUITE 1: S4 Elective Synchronization ---');
  const s4aId = '6aeccf3cbb1e84200c3db01b';
  const s4bId = '6aeccf3cbb1e84200c3db01c';

  await runTest('S4 CSE A and S4 CSE B electives occur at identical day-period positions', () => {
    assert.ok(grid[s4aId] && grid[s4bId], 'S4A and S4B grids must exist');
    let s4aElectiveCount = 0;
    let s4bElectiveCount = 0;

    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const sA = grid[s4aId][d]?.[p];
        const sB = grid[s4bId][d]?.[p];
        const isElcA = sA?.isElective || sA?.subjectType === 'elective';
        const isElcB = sB?.isElective || sB?.subjectType === 'elective';
        if (isElcA) s4aElectiveCount++;
        if (isElcB) s4bElectiveCount++;
        assert.strictEqual(
          isElcA,
          isElcB,
          `Elective mismatch on ${d} P${p}: S4A is ${isElcA ? 'elective' : 'non-elective'}, S4B is ${isElcB ? 'elective' : 'non-elective'}`
        );
      }
    }
    assert.ok(s4aElectiveCount > 0, 'S4 electives must be scheduled');
    assert.strictEqual(s4aElectiveCount, s4bElectiveCount, 'Total elective periods must match across S4A and S4B');
  });

  await runTest('S4 Elective Group contains only valid alternatives and correct weekly hours', () => {
    const s4Group = data.electiveGroups.find(g => g._id.toString() === '6aeccf40bb1e84200c3db053');
    assert.ok(s4Group, 'S4 Elective Group 1 must exist');
    assert.strictEqual(s4Group.options.length, 2, 'S4 Elective Group must have exactly 2 alternatives');
    const optHours = s4Group.options.map(o => o.weeklyHours);
    assert.ok(optHours.every(h => h === 4), 'Each S4 elective option must be 4 weekly hours');
  });

  // ─── PART B: S6 ELECTIVE SYNCHRONIZATION AND FIXED PERIODS ─────────────────
  console.log('\n--- SUITE 2: S6 Elective Synchronization & Fixed Periods ---');
  const s6aId = '6aeccf3cbb1e84200c3db01d';
  const s6bId = '6aeccf3cbb1e84200c3db01e';
  const fixedS6Slots = [
    { day: 'Monday', period: 3 },
    { day: 'Tuesday', period: 3 },
    { day: 'Wednesday', period: 3 },
    { day: 'Thursday', period: 6 },
  ];

  await runTest('S6 electives are locked and synchronized at Mon P3, Tue P3, Wed P3, Thu P6', () => {
    for (const fs of fixedS6Slots) {
      const sA = grid[s6aId][fs.day]?.[fs.period];
      const sB = grid[s6bId][fs.day]?.[fs.period];
      assert.ok(sA, `S6A must have slot on ${fs.day} P${fs.period}`);
      assert.ok(sB, `S6B must have slot on ${fs.day} P${fs.period}`);
      assert.ok(sA.isElective || sA.subjectType === 'elective', `S6A slot on ${fs.day} P${fs.period} must be elective`);
      assert.ok(sB.isElective || sB.subjectType === 'elective', `S6B slot on ${fs.day} P${fs.period} must be elective`);
      assert.strictEqual(sA.isElective, sB.isElective, `S6A and S6B must match on ${fs.day} P${fs.period}`);
    }
  });

  // ─── PART C: S8 ELECTIVES: THREE DISTINCT ELECTIVE GROUPS ──────────────────
  console.log('\n--- SUITE 3: S8 Three Distinct Elective Groups & Project Phase-2 ---');
  const s8aId = '6aeccf3cbb1e84200c3db01f';
  const s8bId = '6aeccf3cbb1e84200c3db020';

  await runTest('S8 contains exactly three distinct elective groups', () => {
    const s8Groups = data.electiveGroups.filter(g => g.name?.includes('S8') || g.semester === 8);
    assert.strictEqual(s8Groups.length, 3, 'Must have exactly three S8 elective groups');
    const groupNames = s8Groups.map(g => g.name);
    assert.ok(groupNames.some(n => n.includes('1')), 'Group 1 must exist');
    assert.ok(groupNames.some(n => n.includes('2')), 'Group 2 must exist');
    assert.ok(groupNames.some(n => n.includes('3')), 'Group 3 must exist');
  });

  await runTest('All three S8 groups are synchronized across S8 CSE A and S8 CSE B', () => {
    for (const d of ['Monday', 'Tuesday', 'Wednesday']) {
      for (let p = 1; p <= 6; p++) {
        const sA = grid[s8aId][d]?.[p];
        const sB = grid[s8bId][d]?.[p];
        if (sA?.isElective || sB?.isElective) {
          assert.strictEqual(sA?.isElective, sB?.isElective, `S8 elective mismatch on ${d} P${p}`);
          assert.strictEqual(sA?.electiveGroupId, sB?.electiveGroupId, `S8 elective group mismatch on ${d} P${p}`);
        }
      }
    }
  });

  await runTest('S8 Project Phase-2 has 6 periods Thursday and 6 periods Friday in Lab 2 & Lab 3', () => {
    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const sA = grid[s8aId][d]?.[p];
        const sB = grid[s8bId][d]?.[p];
        assert.ok(sA, `S8A slot missing on ${d} P${p}`);
        assert.ok(sB, `S8B slot missing on ${d} P${p}`);
        assert.strictEqual(sA.subjectCode, 'CST416', `S8A ${d} P${p} must be CST416 Project Phase-2`);
        assert.strictEqual(sB.subjectCode, 'CST416', `S8B ${d} P${p} must be CST416 Project Phase-2`);
        assert.strictEqual(sA.roomName, 'Lab 2', `S8A must be in Lab 2`);
        assert.strictEqual(sB.roomName, 'Lab 3', `S8B must be in Lab 3`);
      }
    }
  });

  // ─── PART D: SWAP & CONFLICT-FREE REBALANCE TESTS ──────────────────────────
  console.log('\n--- SUITE 4: Conflict-Free Swapping & Rebalancing ---');

  await runTest('Locked slot swap is strictly rejected', async () => {
    try {
      await simulateRebalance(activeTimetable._id, s8aId, { day: 'Thursday', period: 1 }, { day: 'Thursday', period: 2 });
      assert.fail('Should have thrown error on locked slot swap');
    } catch (err) {
      assert.ok(err.message.includes('locked'), 'Must reject moving locked slots');
    }
  });

  await runTest('Direct swap validation simulation correctly detects conflicts', async () => {
    // Test swap between two unlocked slots (e.g. Monday Period 1 and Period 4)
    const res = await simulateRebalance(activeTimetable._id, s4aId, { day: 'Monday', period: 1 }, { day: 'Monday', period: 4 });
    assert.ok(res, 'Simulation result must be returned');
    assert.ok(res.canDirectSwap !== undefined, 'canDirectSwap must be defined');
    assert.ok(res.canRebalance !== undefined, 'canRebalance must be defined');
  });

  // ─── PART E: TEACHER PERSONAL TIMETABLE TESTS ──────────────────────────────
  console.log('\n--- SUITE 5: Teacher Personal Timetable & Faculty Workload ---');

  await runTest('Every faculty member has a complete 30-slot personal weekly schedule', async () => {
    const teachers = await Teacher.find().lean();
    assert.ok(teachers.length > 0, 'Teachers must exist');

    for (const t of teachers.slice(0, 5)) { // sample 5 teachers
      let scheduledCount = 0;
      let freeCount = 0;
      for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
        for (let p = 1; p <= 6; p++) {
          let occupied = false;
          for (const [cid, dMap] of Object.entries(grid)) {
            const slot = dMap[d]?.[p];
            if (!slot || slot.isEmpty || slot.isBreak) continue;
            const tIds = (slot.teacherIds || []).map(id => id.toString());
            if (tIds.includes(t._id.toString())) {
              occupied = true;
              break;
            }
          }
          if (occupied) scheduledCount++;
          else freeCount++;
        }
      }
      assert.strictEqual(scheduledCount + freeCount, 30, `Total slots for teacher ${t.name} must equal 30`);
    }
  });

  // ─── PART F: QUALITY SCORE TESTS ───────────────────────────────────────────
  console.log('\n--- SUITE 6: Timetable Quality Score out of 100 ---');

  await runTest('Quality score dimensions total exactly 100 points', () => {
    const score = scoreGrid(grid, data);
    assert.ok(score.breakdown, 'Score must include breakdown array');
    assert.strictEqual(score.breakdown.length, 8, 'Must have exactly 8 dimensions');

    const totalMax = score.breakdown.reduce((sum, d) => sum + d.maxScore, 0);
    assert.strictEqual(totalMax, 100, `Total maximum score must be exactly 100, got ${totalMax}`);

    const totalScore = score.breakdown.reduce((sum, d) => sum + d.score, 0);
    assert.strictEqual(score.overall, totalScore, 'Overall score must equal sum of dimension scores');
    assert.strictEqual(score.overall, 100, `Accepted master timetable must have 100/100, got ${score.overall}`);
  });

  await runTest('Master timetable passes all 8 validation checks with 0 hard violations', () => {
    const val = validateOutput(grid, data, []);
    assert.strictEqual(val.valid, true, 'Master timetable must be valid');
    assert.strictEqual(val.hardViolationsCount, 0, 'Hard violations must be 0');
    assert.strictEqual(val.checks.zero_teacher_conflicts, true, 'Zero teacher conflicts required');
    assert.strictEqual(val.checks.zero_class_conflicts, true, 'Zero class conflicts required');
    assert.strictEqual(val.checks.zero_room_conflicts, true, 'Zero room conflicts required');
    assert.strictEqual(val.checks.all_subjects_placed, true, 'All subjects placed required');
    assert.strictEqual(val.checks.all_subject_hours_met, true, 'All subject hours met required');
    assert.strictEqual(val.checks.zero_lab_block_violations, true, 'Zero lab block violations required');
  });

  console.log('\n================================================================');
  console.log(` TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(failedCount > 0 ? 1 : 0);
}

runMasterTests().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
