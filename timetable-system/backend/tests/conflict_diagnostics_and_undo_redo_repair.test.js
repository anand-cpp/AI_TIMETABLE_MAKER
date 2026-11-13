const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Timetable = require('../src/models/Timetable');
const Class = require('../src/models/Class');
const Teacher = require('../src/models/Teacher');
const Subject = require('../src/models/Subject');
const { generateTimetableDiagnostics } = require('../src/services/engine/diagnosticService');
const { loadData } = require('../src/services/engine/dataLoader');
const { undoLastAction, redoLastAction, editSwapSlots } = require('../src/controllers/timetableController');

describe('Comprehensive Conflict Diagnostics & Undo/Redo Engine Test Suite', () => {
  let activeTimetable = null;
  let data = null;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db');
    }
    data = await loadData({});
    activeTimetable = (await Timetable.findOne({ isAccepted: true })) || (await Timetable.findOne().sort({ version: -1 }));
    assert.ok(activeTimetable, 'Active timetable must exist in MongoDB');
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // -------------------------------------------------------------
  // PART 1: CONFLICT DIAGNOSTICS FEATURE TESTS
  // -------------------------------------------------------------
  test('1. Diagnostics on Published Timetable has 0 Hard Conflicts', async () => {
    const diag = await generateTimetableDiagnostics(activeTimetable, data);
    assert.strictEqual(diag.summary.hardConflictsCount, 0, 'Authoritative timetable must have 0 hard conflicts');
    assert.strictEqual(diag.summary.overallStatus, 'PASSED', 'Overall status must be PASSED');
    assert.ok(diag.summary.qualityScore >= 95, 'Quality score must be high');
  });

  test('2. Faculty Double-Booking Diagnostic Detection with Full Context', async () => {
    const cloned = JSON.parse(JSON.stringify(activeTimetable.toObject()));
    const classA = cloned.classTimetables[0];
    const classB = cloned.classTimetables[1];

    const teacher = data.teachers[0];
    const tid = teacher._id.toString();

    // Assign same teacher to Class A and Class B on Monday Period 2
    const slotA = classA.slots.find((s) => s.day === 'Monday' && s.period === 2);
    const slotB = classB.slots.find((s) => s.day === 'Monday' && s.period === 2);

    slotA.isEmpty = false;
    slotA.isBreak = false;
    slotA.isElective = false;
    slotA.sharedSessionId = null;
    slotA.teacherIds = [tid];
    slotA.teacherNames = [teacher.name];
    slotA.subjectCode = 'TEST101';
    slotA.subjectName = 'Test Subject 1';

    slotB.isEmpty = false;
    slotB.isBreak = false;
    slotB.isElective = false;
    slotB.sharedSessionId = null;
    slotB.teacherIds = [tid];
    slotB.teacherNames = [teacher.name];
    slotB.subjectCode = 'TEST102';
    slotB.subjectName = 'Test Subject 2';

    const diag = await generateTimetableDiagnostics(cloned, data);
    const doubleBookConflict = diag.hardConflicts.find((h) => h.type === 'TEACHER_DOUBLE_BOOKED');

    assert.ok(doubleBookConflict, 'Must detect teacher double booking');
    assert.strictEqual(doubleBookConflict.severity, 'CRITICAL');
    assert.strictEqual(doubleBookConflict.day, 'Monday');
    assert.strictEqual(doubleBookConflict.period, 2);
    assert.strictEqual(doubleBookConflict.teacherName, teacher.name);
    assert.ok(doubleBookConflict.explanation.includes(teacher.name), 'Explanation must mention teacher');
    assert.ok(doubleBookConflict.rootCause, 'Root cause must be defined');
    assert.ok(doubleBookConflict.resolution, 'Resolution must be defined');
    assert.ok(doubleBookConflict.primaryAssignment, 'Primary assignment must be populated');
    assert.ok(doubleBookConflict.conflictingAssignment, 'Conflicting assignment must be populated');
  });

  test('3. Laboratory Room Collision Diagnostic Detection', async () => {
    const cloned = JSON.parse(JSON.stringify(activeTimetable.toObject()));
    const classA = cloned.classTimetables[0];
    const classB = cloned.classTimetables[1];

    const slotA = classA.slots.find((s) => s.day === 'Wednesday' && s.period === 3);
    const slotB = classB.slots.find((s) => s.day === 'Wednesday' && s.period === 3);

    slotA.isEmpty = false;
    slotA.isBreak = false;
    slotA.roomName = 'Lab 3';
    slotA.subjectType = 'lab';

    slotB.isEmpty = false;
    slotB.isBreak = false;
    slotB.roomName = 'Lab 3';
    slotB.subjectType = 'lab';

    const diag = await generateTimetableDiagnostics(cloned, data);
    const labConflict = diag.hardConflicts.find((h) => h.type === 'LAB_ROOM_CONFLICT');

    assert.ok(labConflict, 'Must detect lab room collision');
    assert.strictEqual(labConflict.severity, 'CRITICAL');
    assert.strictEqual(labConflict.roomName, 'Lab 3');
    assert.strictEqual(labConflict.day, 'Wednesday');
    assert.strictEqual(labConflict.period, 3);
    assert.ok(labConflict.primaryAssignment, 'Primary lab assignment must exist');
    assert.ok(labConflict.conflictingAssignment, 'Conflicting lab assignment must exist');
  });

  test('4. Daily Subject Repetition Diagnostic Detection', async () => {
    const cloned = JSON.parse(JSON.stringify(activeTimetable.toObject()));
    const classA = cloned.classTimetables[0];

    const s1 = classA.slots.find((s) => s.day === 'Monday' && s.period === 1);
    const s2 = classA.slots.find((s) => s.day === 'Monday' && s.period === 5);

    s1.isEmpty = false;
    s1.isBreak = false;
    s1.subjectType = 'theory';
    s1.subjectCode = 'CST999';
    s1.subjectName = 'Duplicate Subject';

    s2.isEmpty = false;
    s2.isBreak = false;
    s2.subjectType = 'theory';
    s2.subjectCode = 'CST999';
    s2.subjectName = 'Duplicate Subject';

    const diag = await generateTimetableDiagnostics(cloned, data);
    const dsuConflict = diag.hardConflicts.find(
      (h) => h.type === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION' && h.subjectCode === 'CST999'
    );

    assert.ok(dsuConflict, 'Must detect daily subject uniqueness violation');
    assert.strictEqual(dsuConflict.day, 'Monday');
    assert.ok(dsuConflict.explanation.includes('CST999'), 'Explanation must cite duplicate subject code');
  });

  test('5. Soft Warnings are Generated with Explanations and Resolutions', async () => {
    const diag = await generateTimetableDiagnostics(activeTimetable, data);
    assert.ok(diag.softWarnings.length > 0, 'Soft warnings should be present for quality awareness');
    for (const sw of diag.softWarnings) {
      assert.strictEqual(sw.category, 'SOFT_WARNING');
      assert.strictEqual(sw.severity, 'WARNING');
      assert.ok(sw.title, 'Warning title must be defined');
      assert.ok(sw.explanation, 'Warning explanation must be defined');
      assert.ok(sw.resolution, 'Warning resolution must be defined');
    }
  });

  test('6. Optimization Opportunities Identify Actionable Improvements', async () => {
    const diag = await generateTimetableDiagnostics(activeTimetable, data);
    assert.ok(diag.optimizations.length > 0, 'Optimization opportunities should be identified');
    for (const opt of diag.optimizations) {
      assert.strictEqual(opt.category, 'OPTIMIZATION');
      assert.strictEqual(opt.severity, 'OPTIMIZATION');
      assert.ok(opt.currentArrangement, 'Current arrangement must be explained');
      assert.ok(opt.suggestedArrangement, 'Suggested arrangement must be provided');
      assert.ok(opt.expectedBenefit, 'Expected benefit must be described');
      assert.ok(typeof opt.isSafe === 'boolean', 'Safety indicator must be boolean');
    }
  });

  // -------------------------------------------------------------
  // PART 2: UNDO & REDO ENGINE INTEGRATION TESTS
  // -------------------------------------------------------------
  test('7. Undo/Redo: Edit pushes snapshot to undoStack and clears redoStack', async () => {
    const targetClass = activeTimetable.classTimetables.find((c) => c.className === 'S2 CSE A');
    const slot1 = targetClass.slots.find((s) => s.day === 'Tuesday' && s.period === 1);
    const slot2 = targetClass.slots.find((s) => s.day === 'Tuesday' && s.period === 2);

    const initialCode1 = slot1.subjectCode;
    const initialCode2 = slot2.subjectCode;

    const req = {
      params: { id: activeTimetable._id.toString() },
      body: {
        classId: targetClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Tuesday', period: 2 },
        adminOverride: true,
      },
      user: { id: 'admin-test', username: 'admin' },
    };

    let swapResponse = null;
    const res = {
      status: (code) => ({
        json: (payload) => {
          swapResponse = { code, ...payload };
          return swapResponse;
        },
      }),
      json: (payload) => {
        swapResponse = { code: 200, ...payload };
        return swapResponse;
      },
    };

    await editSwapSlots(req, res);
    assert.strictEqual(swapResponse?.code, 200, 'Swap must succeed');

    // Reload from MongoDB
    const reloadedAfterSwap = await Timetable.findById(activeTimetable._id);
    const reloadedClass = reloadedAfterSwap.classTimetables.find((c) => c.className === 'S2 CSE A');
    const swappedSlot1 = reloadedClass.slots.find((s) => s.day === 'Tuesday' && s.period === 1);
    const swappedSlot2 = reloadedClass.slots.find((s) => s.day === 'Tuesday' && s.period === 2);

    assert.strictEqual(swappedSlot1.subjectCode, initialCode2, 'Slot 1 must have Slot 2 content');
    assert.strictEqual(swappedSlot2.subjectCode, initialCode1, 'Slot 2 must have Slot 1 content');
    assert.ok(reloadedAfterSwap.undoStack?.length > 0, 'undoStack must have at least 1 entry');
    assert.strictEqual(reloadedAfterSwap.redoStack?.length || 0, 0, 'redoStack must be cleared on new edit');

    // 8. Invoke UNDO
    const undoReq = { params: { id: activeTimetable._id.toString() } };
    let undoResponse = null;
    const undoRes = {
      status: (code) => ({
        json: (payload) => {
          undoResponse = { code, ...payload };
          return undoResponse;
        },
      }),
      json: (payload) => {
        undoResponse = { code: 200, ...payload };
        return undoResponse;
      },
    };

    await undoLastAction(undoReq, undoRes);
    assert.strictEqual(undoResponse?.code, 200, 'Undo must succeed');

    const reloadedAfterUndo = await Timetable.findById(activeTimetable._id);
    const undoneClass = reloadedAfterUndo.classTimetables.find((c) => c.className === 'S2 CSE A');
    const restoredSlot1 = undoneClass.slots.find((s) => s.day === 'Tuesday' && s.period === 1);
    const restoredSlot2 = undoneClass.slots.find((s) => s.day === 'Tuesday' && s.period === 2);

    assert.strictEqual(restoredSlot1.subjectCode, initialCode1, 'Slot 1 must be restored to initial code');
    assert.strictEqual(restoredSlot2.subjectCode, initialCode2, 'Slot 2 must be restored to initial code');
    assert.ok(reloadedAfterUndo.redoStack?.length > 0, 'redoStack must contain the undone edit');

    // 9. Invoke REDO
    const redoReq = { params: { id: activeTimetable._id.toString() } };
    let redoResponse = null;
    const redoRes = {
      status: (code) => ({
        json: (payload) => {
          redoResponse = { code, ...payload };
          return redoResponse;
        },
      }),
      json: (payload) => {
        redoResponse = { code: 200, ...payload };
        return redoResponse;
      },
    };

    await redoLastAction(redoReq, redoRes);
    assert.strictEqual(redoResponse?.code, 200, 'Redo must succeed');

    const reloadedAfterRedo = await Timetable.findById(activeTimetable._id);
    const redoneClass = reloadedAfterRedo.classTimetables.find((c) => c.className === 'S2 CSE A');
    const redoneSlot1 = redoneClass.slots.find((s) => s.day === 'Tuesday' && s.period === 1);
    const redoneSlot2 = redoneClass.slots.find((s) => s.day === 'Tuesday' && s.period === 2);

    assert.strictEqual(redoneSlot1.subjectCode, initialCode2, 'Redo must restore swapped code to Slot 1');
    assert.strictEqual(redoneSlot2.subjectCode, initialCode1, 'Redo must restore swapped code to Slot 2');

    // Clean up: Undo once more to return to authoritative baseline
    await undoLastAction(undoReq, undoRes);
    const finalClean = await Timetable.findById(activeTimetable._id);
    const finalClass = finalClean.classTimetables.find((c) => c.className === 'S2 CSE A');
    assert.strictEqual(
      finalClass.slots.find((s) => s.day === 'Tuesday' && s.period === 1).subjectCode,
      initialCode1
    );
  });

  test('8. Branch Invalidation: New edit after undo invalidates redo stack', async () => {
    const targetClass = activeTimetable.classTimetables.find((c) => c.className === 'S2 CSE A');
    const req = {
      params: { id: activeTimetable._id.toString() },
      body: {
        classId: targetClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Tuesday', period: 2 },
        adminOverride: true,
      },
      user: { id: 'admin-test', username: 'admin' },
    };

    const dummyRes = {
      status: () => dummyRes,
      json: () => dummyRes,
    };

    // Swap 1
    await editSwapSlots(req, dummyRes);
    // Undo 1 (populates redoStack)
    await undoLastAction({ params: { id: activeTimetable._id.toString() } }, dummyRes);

    const checkBefore = await Timetable.findById(activeTimetable._id);
    assert.ok(checkBefore.redoStack?.length > 0, 'redoStack must have entries after undo');

    // Perform new edit (Swap 2 on Wednesday P4 and P5 - theory slots)
    const newEditReq = {
      params: { id: activeTimetable._id.toString() },
      body: {
        classId: targetClass.classId.toString(),
        slot1: { day: 'Wednesday', period: 4 },
        slot2: { day: 'Wednesday', period: 5 },
        adminOverride: true,
      },
      user: { id: 'admin-test', username: 'admin' },
    };
    await editSwapSlots(newEditReq, dummyRes);

    // Verify redoStack is purged
    const checkAfter = await Timetable.findById(activeTimetable._id);
    assert.strictEqual(checkAfter.redoStack?.length || 0, 0, 'redoStack must be purged after new edit');

    // Clean up: Undo Wednesday swap
    await undoLastAction({ params: { id: activeTimetable._id.toString() } }, dummyRes);
  });

  test('9. Database Persistence Across Reload: Authoritative state remains pristine', async () => {
    const freshDoc = await Timetable.findById(activeTimetable._id).lean();
    assert.ok(freshDoc, 'Document exists in MongoDB');
    assert.strictEqual(freshDoc.publicationStatus, 'PUBLISHED', 'Authoritative timetable is published');
    assert.strictEqual(freshDoc.isAccepted, true, 'isAccepted must be true');

    const diag = await generateTimetableDiagnostics(freshDoc, data);
    assert.strictEqual(diag.summary.hardConflictsCount, 0, 'Must have zero hard conflicts');
  });
});
