/**
 * tests/rebalance_e2e_and_allocation_diff.test.js
 * 
 * END-TO-END REBALANCE WORKFLOW & EXACT ALLOCATION DIFF VERIFICATION
 * 
 * Tests the complete production execution pipeline:
 * 1. Exact Allocation Diff Reconstruction: S2 CSE A Monday P1 -> Friday P4 (3-way cyclic shift)
 * 2. Complete API Controller Workflow: previewRebalance -> applyRebalance -> database reload
 * 3. Independent Audit of Persisted Result: all 4 validators confirm zero hard violations
 * 4. Undo and Redo Transactional Integrity: undo reverts cleanly, redo reapplies cleanly
 * 5. False Success Prevention via API: invalid candidate rejected with HTTP 400, DB untouched
 * 6. S8 CST416 Immutability Guard via API: protected Capstone move rejected with HTTP 400
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Timetable = require('../src/models/Timetable');
const { loadData } = require('../src/services/engine/dataLoader');
const { timetableToGrid } = require('../src/services/rebalanceService');
const { validateOutput } = require('../src/services/engine/constraintValidator');
const { auditTimetable } = require('../src/services/engine/independentValidator');
const { validateGlobalTimetable } = require('../src/services/engine/globalTimetableValidator');
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
const {
  previewRebalance,
  applyRebalance,
  undoLastAction,
  redoLastAction,
} = require('../src/controllers/timetableController');

function mockRes() {
  const res = {
    statusCode: 200,
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
}

describe('END-TO-END REBALANCE WORKFLOW & ALLOCATION DIFF VERIFICATION', () => {
  let data;
  let baseTimetable;
  let s2aClass;

  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    baseTimetable = await Timetable.findOne({ isAccepted: true });
    assert.ok(baseTimetable, 'Authoritative timetable must exist');
    data = await loadData({});
    s2aClass = data.classes.find(c => c.name.includes('S2 CSE A'));
    assert.ok(s2aClass, 'S2 CSE A must exist');
  });

  after(async () => {
    await mongoose.disconnect();
  });

  async function createDisposableTimetable(label) {
    const cloneData = JSON.parse(JSON.stringify(baseTimetable.toObject()));
    delete cloneData._id;
    const maxDoc = await Timetable.findOne().sort({ version: -1 });
    cloneData.version = (maxDoc ? maxDoc.version : 95000) + Math.floor(Math.random() * 1000) + 1;
    cloneData.revision = 1;
    cloneData.appliedIdempotencyKeys = [];
    cloneData.label = `E2E Test ${label} (${cloneData.version})`;
    cloneData.isAccepted = false;
    for (const ct of cloneData.classTimetables) {
      for (const s of ct.slots) s.isLocked = false;
    }
    const doc = new Timetable(cloneData);
    await doc.save();
    return doc;
  }

  // -------------------------------------------------------------
  // Test 1: Exact Allocation Diff Reconstruction
  // -------------------------------------------------------------
  test('Test 1: Exact Allocation Diff Reconstruction — S2 CSE A Mon P1 -> Fri P4', async () => {
    const testDoc = await createDisposableTimetable('Diff');
    const cid = s2aClass._id.toString();

    // 1. Inspect Initial Allocations in S2 CSE A
    const initialCt = testDoc.classTimetables.find(c => c.classId.toString() === cid);
    const origMonP1 = initialCt.slots.find(s => s.day === 'Monday' && s.period === 1);
    const origFriP4 = initialCt.slots.find(s => s.day === 'Friday' && s.period === 4);
    const origFriP2 = initialCt.slots.find(s => s.day === 'Friday' && s.period === 2);

    assert.equal(origMonP1.subjectCode, 'GAPHT121', 'Mon P1 is Physics GAPHT121');
    assert.equal(origMonP1.teacherNames?.[0], 'Ms Theertha', 'Mon P1 taught by Ms Theertha');
    assert.equal(origFriP4.subjectCode, 'UCEST206', 'Fri P4 is IP Rights UCEST206');
    assert.equal(origFriP2.subjectCode, 'GAPHT121', 'Fri P2 is Physics GAPHT121');

    // 2. Trigger Preview via Controller Endpoint
    const prevReq = {
      params: { id: testDoc._id.toString() },
      body: {
        classId: cid,
        source: { day: 'Monday', period: 1 },
        target: { day: 'Friday', period: 4 },
      },
      user: { username: 'admin' },
    };
    const prevRes = mockRes();
    await previewRebalance(prevReq, prevRes);

    assert.equal(prevRes.statusCode, 200, 'Preview must succeed with HTTP 200');
    assert.equal(prevRes.body.data.canRebalance, true, 'Must identify viable conflict-free rebalance');
    assert.equal(prevRes.body.data.actionLabel, 'Conflict-Free Rebalance');
    assert.ok(prevRes.body.data.rebalancedGrid, 'Must provide candidate grid');
    assert.equal(prevRes.body.data.preview.validationResult.hardViolationsCount, 0, 'Zero hard violations');

    // 3. Apply Rebalance via Controller Endpoint
    const candidateGrid = prevRes.body.data.rebalancedGrid;
    const applyReq = {
      params: { id: testDoc._id.toString() },
      body: {
        classId: cid,
        source: { day: 'Monday', period: 1 },
        target: { day: 'Friday', period: 4 },
        rebalancedGrid: candidateGrid,
      },
      user: { username: 'admin' },
    };
    const applyRes = mockRes();
    await applyRebalance(applyReq, applyRes);

    assert.equal(applyRes.statusCode, 200, 'Apply must succeed with HTTP 200');
    assert.equal(applyRes.body.success, true);

    // 4. Reload from MongoDB and Verify Exact Resulting Allocations
    const reloadedDoc = await Timetable.findById(testDoc._id).lean();
    assert.equal(reloadedDoc.revision, 2, 'Revision must increment to 2');

    const reloadedCt = reloadedDoc.classTimetables.find(c => c.classId.toString() === cid);
    const newMonP1 = reloadedCt.slots.find(s => s.day === 'Monday' && s.period === 1);
    const newFriP4 = reloadedCt.slots.find(s => s.day === 'Friday' && s.period === 4);
    const newFriP2 = reloadedCt.slots.find(s => s.day === 'Friday' && s.period === 2);

    // Verify cyclic shift allocations:
    // GAPHT121 moved to Friday P4
    assert.equal(newFriP4.subjectCode, 'GAPHT121', 'Fri P4 is now GAPHT121');
    assert.equal(newFriP4.teacherNames?.[0], 'Ms Theertha', 'Ms Theertha now teaches Fri P4');
    // UCEST206 displaced from Fri P4 to Friday P2
    assert.equal(newFriP2.subjectCode, 'UCEST206', 'Fri P2 now has UCEST206');
    // GAPHT121 displaced from Friday P2 to Monday P1
    assert.equal(newMonP1.subjectCode, 'GAPHT121', 'Mon P1 has GAPHT121');

    // 5. Verify Zero Lost or Duplicated Periods
    let totalS2aPlaced = reloadedCt.slots.filter(s => !s.isEmpty && !s.isBreak && s.subjectCode).length;
    let origS2aPlaced = initialCt.slots.filter(s => !s.isEmpty && !s.isBreak && s.subjectCode).length;
    assert.equal(totalS2aPlaced, origS2aPlaced, 'Total placed periods in S2 CSE A strictly preserved');

    // Clean up
    await Timetable.findByIdAndDelete(testDoc._id);
  });

  // -------------------------------------------------------------
  // Test 2: Complete Independent Multi-Validator Audit of Persisted Result
  // -------------------------------------------------------------
  test('Test 2: Persisted rebalance result passes all four validators with zero hard violations', async () => {
    const testDoc = await createDisposableTimetable('Audit');
    const cid = s2aClass._id.toString();

    // Perform rebalance
    const prevReq = {
      params: { id: testDoc._id.toString() },
      body: {
        classId: cid,
        source: { day: 'Monday', period: 1 },
        target: { day: 'Friday', period: 4 },
      },
      user: { username: 'admin' },
    };
    const prevRes = mockRes();
    await previewRebalance(prevReq, prevRes);

    const applyReq = {
      params: { id: testDoc._id.toString() },
      body: {
        classId: cid,
        source: { day: 'Monday', period: 1 },
        target: { day: 'Friday', period: 4 },
        rebalancedGrid: prevRes.body.data.rebalancedGrid,
      },
      user: { username: 'admin' },
    };
    const applyRes = mockRes();
    await applyRebalance(applyReq, applyRes);

    const persistedDoc = await Timetable.findById(testDoc._id);
    const persistedGrid = timetableToGrid(persistedDoc);

    // Validator 1: validateOutput
    const valOut = validateOutput(persistedGrid, data, []);
    assert.equal(valOut.valid, true, 'Validator 1 validateOutput must be valid');
    assert.equal(valOut.hardViolationsCount, 0);
    assert.equal(valOut.checks.zero_teacher_conflicts, true);
    assert.equal(valOut.checks.zero_class_conflicts, true);

    // Validator 2: auditTimetable
    const audit = auditTimetable(persistedGrid, data);
    assert.equal(audit.valid, true, 'Validator 2 auditTimetable must be valid');
    assert.equal(audit.hardViolations.length, 0);

    // Validator 3: validateGlobalTimetable
    const valGlob = validateGlobalTimetable(persistedGrid, data);
    assert.equal(valGlob.valid, true, 'Validator 3 validateGlobalTimetable must be valid');
    assert.equal(valGlob.hardViolationsCount, 0);

    // Validator 4: validatePersistedTimetable
    const valPersist = await validatePersistedTimetable(persistedDoc);
    const academicViolations = (valPersist.hardViolations || []).filter(v => v.type !== 'MISSING_CLASS_DATA');
    assert.equal(academicViolations.length, 0, 'Validator 4 validatePersistedTimetable zero academic violations');

    // Clean up
    await Timetable.findByIdAndDelete(testDoc._id);
  });

  // -------------------------------------------------------------
  // Test 3: Undo and Redo Controller Workflow
  // -------------------------------------------------------------
  test('Test 3: Undo and redo controller endpoints restore original state and increment revisions cleanly', async () => {
    const testDoc = await createDisposableTimetable('UndoRedo');
    const cid = s2aClass._id.toString();

    // 1. Apply rebalance
    const prevReq = {
      params: { id: testDoc._id.toString() },
      body: {
        classId: cid,
        source: { day: 'Monday', period: 1 },
        target: { day: 'Friday', period: 4 },
      },
      user: { username: 'admin' },
    };
    const prevRes = mockRes();
    await previewRebalance(prevReq, prevRes);

    const applyReq = {
      params: { id: testDoc._id.toString() },
      body: {
        classId: cid,
        source: { day: 'Monday', period: 1 },
        target: { day: 'Friday', period: 4 },
        rebalancedGrid: prevRes.body.data.rebalancedGrid,
      },
      user: { username: 'admin' },
    };
    const applyRes = mockRes();
    await applyRebalance(applyReq, applyRes);

    // 2. Execute Undo
    const undoReq = {
      params: { id: testDoc._id.toString() },
      user: { username: 'admin' },
    };
    const undoRes = mockRes();
    await undoLastAction(undoReq, undoRes);

    assert.equal(undoRes.statusCode, 200, 'Undo must succeed with HTTP 200');
    assert.equal(undoRes.body.success, true);

    const undoneDoc = await Timetable.findById(testDoc._id).lean();
    const undoneCt = undoneDoc.classTimetables.find(c => c.classId.toString() === cid);
    const undoneMonP1 = undoneCt.slots.find(s => s.day === 'Monday' && s.period === 1);
    const undoneFriP2 = undoneCt.slots.find(s => s.day === 'Friday' && s.period === 2);
    const undoneFriP4 = undoneCt.slots.find(s => s.day === 'Friday' && s.period === 4);
    assert.equal(undoneMonP1.subjectCode, 'GAPHT121', 'Undo restores Mon P1 to Physics GAPHT121');
    assert.equal(undoneFriP2.subjectCode, 'GAPHT121', 'Undo restores Fri P2 to Physics GAPHT121');
    assert.equal(undoneFriP4.subjectCode, 'UCEST206', 'Undo restores Fri P4 to IP Rights UCEST206');

    // 3. Execute Redo
    const redoReq = {
      params: { id: testDoc._id.toString() },
      user: { username: 'admin' },
    };
    const redoRes = mockRes();
    await redoLastAction(redoReq, redoRes);

    assert.equal(redoRes.statusCode, 200, 'Redo must succeed with HTTP 200');
    assert.equal(redoRes.body.success, true);

    const redoneDoc = await Timetable.findById(testDoc._id).lean();
    const redoneCt = redoneDoc.classTimetables.find(c => c.classId.toString() === cid);
    const redoneMonP1 = redoneCt.slots.find(s => s.day === 'Monday' && s.period === 1);
    const redoneFriP2 = redoneCt.slots.find(s => s.day === 'Friday' && s.period === 2);
    const redoneFriP4 = redoneCt.slots.find(s => s.day === 'Friday' && s.period === 4);
    assert.equal(redoneMonP1.subjectCode, 'GAPHT121', 'Redo restores Mon P1 to Physics GAPHT121');
    assert.equal(redoneFriP2.subjectCode, 'UCEST206', 'Redo reapplies Fri P2 to IP Rights UCEST206');
    assert.equal(redoneFriP4.subjectCode, 'GAPHT121', 'Redo reapplies Fri P4 to Physics GAPHT121');

    // Clean up
    await Timetable.findByIdAndDelete(testDoc._id);
  });

  // -------------------------------------------------------------
  // Test 4: False Success Prevention via API (Invalid Candidate Rejected)
  // -------------------------------------------------------------
  test('Test 4: Attempting to apply invalid candidate grid via API returns HTTP 400 and preserves DB', async () => {
    const testDoc = await createDisposableTimetable('Reject');
    const cid = s2aClass._id.toString();

    // Construct invalid candidate grid with double-booking
    const initialGrid = timetableToGrid(testDoc);
    const invalidGrid = JSON.parse(JSON.stringify(initialGrid));
    const teacher = data.teachers.find(t => t.name.includes('Shiji'));
    const tid = teacher._id.toString();

    const s2b = data.classes.find(c => c.name.includes('S2 CSE B'));

    // Introduce double booking on Monday P1 between S2A and S2B
    invalidGrid[cid]['Monday'][1] = {
      ...invalidGrid[cid]['Monday'][1],
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      isEmpty: false,
    };
    invalidGrid[s2b._id.toString()]['Monday'][1] = {
      ...invalidGrid[s2b._id.toString()]['Monday'][1],
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      isEmpty: false,
    };

    const applyReq = {
      params: { id: testDoc._id.toString() },
      body: {
        classId: cid,
        source: { day: 'Monday', period: 1 },
        target: { day: 'Friday', period: 4 },
        rebalancedGrid: invalidGrid,
      },
      user: { username: 'admin' },
    };
    const applyRes = mockRes();
    await applyRebalance(applyReq, applyRes);

    assert.equal(applyRes.statusCode, 400, 'Must return HTTP 400 Bad Request');
    assert.equal(applyRes.body.success, false, 'success must be false');
    assert.ok(applyRes.body.conflict || applyRes.body.message, 'Must provide conflict details');

    // Verify DB revision was NOT incremented
    const unchangedDoc = await Timetable.findById(testDoc._id).lean();
    assert.equal(unchangedDoc.revision, 1, 'Database revision must remain 1');

    // Clean up
    await Timetable.findByIdAndDelete(testDoc._id);
  });

  // -------------------------------------------------------------
  // Test 5: Protected S8 Capstone Rebalance Rejection via API
  // -------------------------------------------------------------
  test('Test 5: Attempting to rebalance protected S8 Capstone slot via API returns HTTP 400', async () => {
    const testDoc = await createDisposableTimetable('CapstoneBlock');
    const s8a = data.classes.find(c => c.name === 'S8 CSE A');
    assert.ok(s8a);

    const prevReq = {
      params: { id: testDoc._id.toString() },
      body: {
        classId: s8a._id.toString(),
        source: { day: 'Thursday', period: 1 },
        target: { day: 'Monday', period: 1 },
      },
      user: { username: 'admin' },
    };
    const prevRes = mockRes();
    await previewRebalance(prevReq, prevRes);

    assert.equal(prevRes.statusCode, 400, 'Rebalancing CST416 on Thursday must return HTTP 400');
    assert.equal(prevRes.body.success, false);
    assert.match(prevRes.body.message, /reserved for Project Phase-2|prohibited/i);

    // Clean up
    await Timetable.findByIdAndDelete(testDoc._id);
  });
});
