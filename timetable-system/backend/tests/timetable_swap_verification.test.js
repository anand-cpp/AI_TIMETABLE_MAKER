const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Timetable = require('../src/models/Timetable');
const {
  editSwapSlots,
  getTeacherTimetable,
} = require('../src/controllers/timetableController');
const { findLabGroup, resolveLabStartPeriod } = require('../src/services/engine/labGroupHelper');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

test('Timetable Swapping, Verification Synchronization & Atomic Lab Swapping Test Suite', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const baseTimetable = (await Timetable.findOne({ isAccepted: true })) || (await Timetable.findOne({ version: 1 }));
  assert.ok(baseTimetable, 'Base timetable must exist in MongoDB');

  const createdVersionIds = [];

  async function createTestTimetable(label) {
    const cloneData = JSON.parse(JSON.stringify(baseTimetable.toObject()));
    delete cloneData._id;
    const maxDoc = await Timetable.findOne().sort({ version: -1 });
    cloneData.version = (maxDoc ? maxDoc.version : 90000) + Math.floor(Math.random() * 500) + 1;
    cloneData.revision = 1;
    cloneData.appliedIdempotencyKeys = [];
    cloneData.label = `Verification Test ${label} (v${cloneData.version})`;
    cloneData.isAccepted = false;
    for (const ct of cloneData.classTimetables) {
      for (const s of ct.slots) {
        s.isLocked = false;
      }
      if (ct.className.includes('S4 CSE B')) {
        for (const p of [4, 5, 6]) {
          const s = ct.slots.find((sl) => sl.day === 'Wednesday' && sl.period === p);
          if (s) {
            s.isEmpty = true;
            s.subjectCode = '';
            s.subjectName = 'Free Period';
            s.subjectId = null;
            s.teacherIds = [];
            s.teacherNames = [];
            s.isLabBlock = false;
          }
        }
      }
    }
    const doc = await Timetable.create(cloneData);
    createdVersionIds.push(doc._id);
    return doc;
  }

  t.after(async () => {
    if (createdVersionIds.length > 0) {
      await Timetable.deleteMany({ _id: { $in: createdVersionIds } });
    }
    // Guarantee base Version 1 remains accepted
    await Timetable.updateOne({ version: 1 }, { $set: { isAccepted: true } });
  });

  // Test 1: resolveLabStartPeriod utility
  await t.test('1. resolveLabStartPeriod properly snaps 3-period and 2-period lab blocks on day boundary', () => {
    // 3-period lab on Mon-Thu
    assert.equal(resolveLabStartPeriod(3, 'Monday', 1), 1);
    assert.equal(resolveLabStartPeriod(3, 'Tuesday', 4), 4);
    assert.equal(resolveLabStartPeriod(3, 'Tuesday', 5), 4); // 5 + 3 - 1 = 7 > 6 -> snaps to 4
    assert.equal(resolveLabStartPeriod(3, 'Tuesday', 6), 4); // 6 + 3 - 1 = 8 > 6 -> snaps to 4

    // 2-period lab on Mon-Thu
    assert.equal(resolveLabStartPeriod(2, 'Thursday', 5), 5);
    assert.equal(resolveLabStartPeriod(2, 'Thursday', 6), 5); // 6 + 2 - 1 = 7 > 6 -> snaps to 5
  });

  // Test 2: Normal slot swap updates DB and recalculates quality score & validation checks
  await t.test('2. Normal period swap auto-saves to MongoDB and syncs qualityScore & validationChecks', async () => {
    const tt = await createTestTimetable('NormalSwap');
    const ct = tt.classTimetables.find(c => c.className.includes('S2 CSE B'));
    const s1 = ct.slots.find((s) => s.day === 'Tuesday' && s.period === 1);
    const s2 = ct.slots.find((s) => s.day === 'Tuesday' && s.period === 4);

    const s1SubjBefore = s1.subjectName;
    const s2SubjBefore = s2.subjectName;

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: ct.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Tuesday', period: 4 },
        expectedRevision: 1,
        idempotencyKey: 'test_norm_swap_1',
      },
      user: { username: 'test-admin', role: 'admin' },
    };
    const res = createMockRes();

    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200);

    // Verify persisted MongoDB document
    const reloaded = await Timetable.findById(tt._id);
    assert.equal(reloaded.revision, 2);
    assert.ok(reloaded.qualityScore, 'Quality score must be present');
    assert.ok(typeof reloaded.qualityScore.overall === 'number', 'Quality score overall must be numeric');
    assert.ok(reloaded.validationChecks, 'Validation checks must be present');

    const reloadedCt = reloaded.classTimetables.find((c) => c.classId.toString() === ct.classId.toString());
    const r1 = reloadedCt.slots.find((s) => s.day === 'Tuesday' && s.period === 1);
    const r2 = reloadedCt.slots.find((s) => s.day === 'Tuesday' && s.period === 4);

    assert.equal(r1.subjectName, s2SubjBefore, 'Slot 1 now has content of Slot 2');
    assert.equal(r2.subjectName, s1SubjBefore, 'Slot 2 now has content of Slot 1');
  });

  // Test 3: Verification View Synchronization (Version Fetch, Teacher Timetable)
  await t.test('3. Verification Synchronization: Check Timetable queries reflect saved swap', async () => {
    const tt = await createTestTimetable('CheckSync');
    const ct = tt.classTimetables.find(c => c.className.includes('S2 CSE B'));
    const s1 = ct.slots.find((s) => s.day === 'Tuesday' && s.period === 1);
    const teacherId = s1.teacherIds[0].toString();
    const originalSubject = s1.subjectName;

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: ct.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Tuesday', period: 4 },
        adminOverride: true,
        expectedRevision: 1,
      },
      user: { username: 'admin', role: 'admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200);

    // 3a. Teacher Personal Timetable check
    const teacherReq = {
      params: { teacherId },
      query: { versionId: tt._id.toString() },
      user: { role: 'admin' },
    };
    const teacherRes = createMockRes();
    await getTeacherTimetable(teacherReq, teacherRes);
    assert.equal(teacherRes.statusCode, 200);

    const teacherSlots = teacherRes.body.data.slots;
    const newSlotTeacher = teacherSlots.find((s) => s.day === 'Tuesday' && s.period === 4);
    const oldSlotTeacher = teacherSlots.find((s) => s.day === 'Tuesday' && s.period === 1);

    assert.ok(newSlotTeacher && newSlotTeacher.subjectName === originalSubject, 'Teacher timetable shows subject at Tuesday P4');
    assert.ok(!oldSlotTeacher || oldSlotTeacher.subjectName !== originalSubject, 'Teacher Tuesday P1 no longer has swapped subject');
  });

  // Test 4: Atomic Laboratory Block Swapping (Lab-to-Lab)
  await t.test('4. Atomic Lab-to-Lab Swap moves entire multi-period blocks together without truncation', async () => {
    const tt = await createTestTimetable('LabToLab');
    const s2bClass = tt.classTimetables.find((c) => c.className === 'S2 CSE B');
    assert.ok(s2bClass, 'S2 CSE B exists');

    const labWed = findLabGroup(s2bClass.slots, 'Wednesday', 4);
    const labThu = findLabGroup(s2bClass.slots, 'Thursday', 4);

    assert.equal(labWed.duration, 2);
    assert.equal(labThu.duration, 2);

    // Clear conflicting claims in other classes for these two teachers
    const allTids = [...labWed.teacherIds, ...labThu.teacherIds].map((id) => id.toString());
    for (const c of tt.classTimetables) {
      if (c.classId.toString() !== s2bClass.classId.toString()) {
        for (const d of ['Wednesday', 'Thursday']) {
          for (const p of [4, 5]) {
            const s = c.slots.find((sl) => sl.day === d && sl.period === p);
            if (s && s.teacherIds) {
              s.teacherIds = s.teacherIds.filter((tid) => !allTids.includes(tid.toString()));
            }
          }
        }
      }
    }
    await tt.save();

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2bClass.classId.toString(),
        slot1: { day: 'Wednesday', period: 4 },
        slot2: { day: 'Thursday', period: 4 },
        expectedRevision: 1,
      },
      user: { username: 'admin', role: 'admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200, `Swap failed: ${res.body?.message}`);
    assert.equal(res.body.data.swapType, 'ATOMIC_LAB_TO_LAB');

    // Verify all periods swapped atomically
    const reloaded = await Timetable.findById(tt._id);
    const reloadedCt = reloaded.classTimetables.find((c) => c.classId.toString() === s2bClass.classId.toString());

    for (const p of [4, 5]) {
      const sWed = reloadedCt.slots.find((s) => s.day === 'Wednesday' && s.period === p);
      const sThu = reloadedCt.slots.find((s) => s.day === 'Thursday' && s.period === p);
      assert.equal(sWed.subjectCode, labThu.subjectCode);
      assert.equal(sThu.subjectCode, labWed.subjectCode);
      assert.equal(sWed.isLabBlock, true);
      assert.equal(sThu.isLabBlock, true);
    }
  });

  // Test 5: Atomic Laboratory-to-Block Swap with Target Period Snapping
  await t.test('5. Atomic Lab-to-Block Swap moves entire 3-period lab block into non-lab slots', async () => {
    const tt = await createTestTimetable('LabToBlock');
    const targetClass = tt.classTimetables.find((c) => c.className === 'S4 CSE B');
    assert.ok(targetClass, 'S4 CSE B exists');

    // S4 CSE B has DBMS Lab on Tuesday P1-P3
    const labGroup = findLabGroup(targetClass.slots, 'Tuesday', 1);
    assert.ok(labGroup && labGroup.isLab && labGroup.duration === 3, 'Lab found');

    // Swap lab onto Wednesday afternoon by dropping onto Period 5 (which snaps to Period 4!)
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: targetClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Wednesday', period: 5 },
        adminOverride: true, // Dropped on Period 5
        expectedRevision: 1,
      },
      user: { username: 'admin', role: 'admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.swapType, 'ATOMIC_LAB_TO_BLOCK');

    // Verify all 3 periods [P4, P5, P6] on Wednesday now hold DBMS Lab atomically
    const reloaded = await Timetable.findById(tt._id);
    const reloadedCt = reloaded.classTimetables.find((c) => c.classId.toString() === targetClass.classId.toString());

    for (const p of [4, 5, 6]) {
      const slot = reloadedCt.slots.find((s) => s.day === 'Wednesday' && s.period === p);
      assert.equal(slot.subjectCode, labGroup.subjectCode);
      assert.equal(slot.isLabBlock, true);
    }
  });

  // Test 6: Rejection of invalid lab destination (crossing lunch break)
  await t.test('6. Rejection of illegal lab move crossing lunch break', async () => {
    const tt = await createTestTimetable('IllegalLabMove');
    const ct = tt.classTimetables[0];
    const { validateLabBlockDestination } = require('../src/services/engine/labGroupHelper');
    const validation = validateLabBlockDestination({
      labGroup: { duration: 3, subjectCode: 'CSL331' },
      targetDay: 'Monday',
      targetStartPeriod: 3,
      allSlots: ct.slots,
    });
    assert.equal(validation.valid, false, 'Moving 3-period lab starting at P3 must be rejected');
    assert.match(validation.message, /cross lunch break/i);
  });

  // Test 7: Idempotency Protection
  await t.test('7. Repeated swap with same idempotencyKey returns cached response without duplicate increment', async () => {
    const tt = await createTestTimetable('IdempotencyTest');
    const ct = tt.classTimetables.find(c => c.className.includes('S2 CSE B'));
    const s1 = ct.slots.find((s) => s.day === 'Tuesday' && s.period === 1);
    const s2 = ct.slots.find((s) => s.day === 'Tuesday' && s.period === 4);

    const idemKey = `idem_${Date.now()}`;
    const req1 = {
      params: { id: tt._id.toString() },
      body: {
        classId: ct.classId.toString(),
        slot1: { day: s1.day, period: s1.period },
        slot2: { day: s2.day, period: s2.period },
        expectedRevision: 1,
        idempotencyKey: idemKey,
      },
      user: { username: 'admin', role: 'admin' },
    };
    const res1 = createMockRes();
    await editSwapSlots(req1, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.data.revision, 2);

    // Call second time with exact same idempotencyKey
    const req2 = {
      params: { id: tt._id.toString() },
      body: {
        classId: ct.classId.toString(),
        slot1: { day: s1.day, period: s1.period },
        slot2: { day: s2.day, period: s2.period },
        expectedRevision: 1,
        idempotencyKey: idemKey,
      },
      user: { username: 'admin', role: 'admin' },
    };
    const res2 = createMockRes();
    await editSwapSlots(req2, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.data.alreadyApplied, true);
    assert.equal(res2.body.data.revision, 2, 'Revision remains 2 (no duplicate increment)');
  });
});
