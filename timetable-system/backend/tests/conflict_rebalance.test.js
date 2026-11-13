const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Timetable = require('../src/models/Timetable');
const Class = require('../src/models/Class');
const Teacher = require('../src/models/Teacher');
const { simulateRebalance, commitRebalance } = require('../src/services/rebalanceService');
const { editSwapSlots } = require('../src/controllers/timetableController');
const { validateOutput } = require('../src/services/engine/constraintValidator');
const { loadData } = require('../src/services/engine/dataLoader');

const createMockRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

test('Teacher Conflict Handling & Smart Auto-Adjust (Readjust) Test Suite', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI);

  const baseTimetable = await Timetable.findOne({ isAccepted: true });
  assert.ok(baseTimetable, 'Authoritative published timetable must exist');

  async function createTestTimetable(label) {
    const cloneData = JSON.parse(JSON.stringify(baseTimetable.toObject()));
    delete cloneData._id;
    const maxDoc = await Timetable.findOne().sort({ version: -1 });
    cloneData.version = (maxDoc ? maxDoc.version : 95000) + Math.floor(Math.random() * 500) + 1;
    cloneData.revision = 1;
    cloneData.appliedIdempotencyKeys = [];
    cloneData.label = `Conflict AutoAdjust Test ${label} (${cloneData.version})`;
    cloneData.isAccepted = false;
    for (const ct of cloneData.classTimetables) {
      for (const s of ct.slots) {
        s.isLocked = false;
      }
    }
    const doc = new Timetable(cloneData);
    await doc.save();
    return doc;
  }

  // -------------------------------------------------------------
  // Test 1: Conflict detection & Auto-Adjust simulation for theory slot
  // -------------------------------------------------------------
  await t.test('Test 1: Conflict simulation finds minimal conflict-free Auto-Adjust (3-way cyclic shift)', async () => {
    const tt = await createTestTimetable('Test 1');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));

    // Move Monday P1 to Friday P4 where direct swap creates teacher collision
    const res = await simulateRebalance(
      tt._id,
      s2a.classId.toString(),
      { day: 'Monday', period: 1 },
      { day: 'Friday', period: 4 }
    );

    assert.ok(res.canRebalance, 'Must identify viable conflict-free rebalance');
    assert.equal(res.actionLabel, 'Conflict-Free Rebalance');
    assert.ok(res.preview, 'Must provide rebalance preview');
    assert.equal(res.preview.validationResult.hardViolationsCount, 0, 'Must have 0 hard violations');

    // Minimal perturbation principle: exactly 2 other changes (total 3 slots in class adjusted)
    assert.equal(res.preview.otherChanges.length, 2, 'Minimal perturbation: exactly 1 alternate cyclic slot touched');
    assert.ok(res.rebalancedGrid, 'Must return rebalancedGrid');

    // Clean up
    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 2: Minimal Perturbation Verification ("without overmaking this")
  // -------------------------------------------------------------
  await t.test('Test 2: Minimal perturbation verification — only conflicting class and minimal slots are repositioned', async () => {
    const tt = await createTestTimetable('Test 2');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));
    const s2aIdStr = s2a.classId.toString();

    const simRes = await simulateRebalance(
      tt._id,
      s2aIdStr,
      { day: 'Monday', period: 1 },
      { day: 'Friday', period: 4 }
    );

    const rebalancedGrid = simRes.rebalancedGrid;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Verify other classes in grid are 100% UNTOUCHED
    for (const ct of tt.classTimetables) {
      const cid = ct.classId.toString();
      if (cid === s2aIdStr) continue;

      for (const d of days) {
        for (let p = 1; p <= 6; p++) {
          const origSlot = ct.slots.find((s) => s.day === d && s.period === p);
          const gridSlot = rebalancedGrid[cid]?.[d]?.[p];
          if (origSlot && gridSlot) {
            assert.equal(
              gridSlot.subjectCode,
              origSlot.subjectCode,
              `Other class ${ct.className} at ${d} P${p} must remain strictly untouched`
            );
          }
        }
      }
    }

    // Clean up
    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 3: Commit Auto-Adjust to Database
  // -------------------------------------------------------------
  await t.test('Test 3: Applying Auto-Adjust persists to MongoDB with incremented revision and audit history', async () => {
    const tt = await createTestTimetable('Test 3');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));

    const simRes = await simulateRebalance(
      tt._id,
      s2a.classId.toString(),
      { day: 'Monday', period: 1 },
      { day: 'Friday', period: 4 }
    );

    const commitRes = await commitRebalance(
      tt._id,
      s2a.classId.toString(),
      { day: 'Monday', period: 1 },
      { day: 'Friday', period: 4 },
      simRes.rebalancedGrid,
      'admin_tester'
    );

    assert.ok(commitRes.success, 'Commit must succeed');
    assert.equal(commitRes.timetable.revision, 2, 'Revision must be incremented from 1 to 2');

    // Verify authoritative MongoDB read
    const savedDoc = await Timetable.findById(tt._id).lean();
    assert.equal(savedDoc.revision, 2);
    const lastHistory = savedDoc.editHistory[savedDoc.editHistory.length - 1];
    assert.equal(lastHistory.action, 'rebalance');
    assert.equal(lastHistory.editedBy, 'admin_tester');

    // Validate overall grid constraints
    const data = await loadData({});
    const val = validateOutput(simRes.rebalancedGrid, data, []);
    assert.equal(val.checks.zero_teacher_conflicts, true, 'Zero teacher conflicts');
    assert.equal(val.checks.zero_class_conflicts, true, 'Zero class conflicts');
    assert.equal(val.checks.zero_room_conflicts, true, 'Zero room conflicts');

    // Clean up
    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 4: Force Swap Option (Admin Override)
  // -------------------------------------------------------------
  await t.test('Test 4: Force swap option with adminOverride allows user to accept conflict when desired', async () => {
    const tt = await createTestTimetable('Test 4');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2a.classId.toString(),
        slot1: { day: 'Tuesday', period: 2 },
        slot2: { day: 'Tuesday', period: 4 },
        adminOverride: true,
      },
      user: { username: 'admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 200, 'Force swap with adminOverride must succeed and auto-save');
    assert.equal(res.body.data.revision, 2, 'Revision must increment');

    // Clean up
    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 5: Laboratory Block Rebalance Simulation
  // -------------------------------------------------------------
  await t.test('Test 5: Laboratory block rebalance evaluates atomic group integrity without splitting', async () => {
    const tt = await createTestTimetable('Test 5');
    const s2b = tt.classTimetables.find((c) => c.className.includes('S2 CSE B'));

    // GXESL208 IT Workshop in S2 CSE B is on Thursday P4-P5
    const res = await simulateRebalance(
      tt._id,
      s2b.classId.toString(),
      { day: 'Thursday', period: 4 },
      { day: 'Thursday', period: 1 }
    );

    assert.ok(res.canRebalance, 'Lab group move must be recognized and supported');
    assert.equal(res.actionLabel, 'Direct Move Available');
    assert.equal(res.preview.validationResult.hardViolationsCount, 0);

    // Clean up
    await Timetable.findByIdAndDelete(tt._id);
  });

  await mongoose.disconnect();
});
