const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Timetable = require('../src/models/Timetable');
const {
  isLabSlot,
  findLabGroup,
  validateLabBlockDestination,
  extractSlotPayload,
  applyAtomicSlotSwap,
} = require('../src/services/engine/labGroupHelper');
const { editSwapSlots } = require('../src/controllers/timetableController');

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

test('Comprehensive Atomic Group-Based Lab Swapping Test Suite (13 Cases)', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI);

  const baseTimetable = (await Timetable.findOne({ isAccepted: true })) || (await Timetable.findOne({ version: 1 })) || (await Timetable.findOne());
  assert.ok(baseTimetable, 'Active accepted timetable must exist');

  // Helper to clone a fresh test timetable doc with unlocked slots by default
  async function createTestTimetable(label) {
    const cloneData = JSON.parse(JSON.stringify(baseTimetable.toObject()));
    delete cloneData._id;
    const maxDoc = await Timetable.findOne().sort({ version: -1 });
    cloneData.version = (maxDoc ? maxDoc.version : 90000) + Math.floor(Math.random() * 500) + 1;
    cloneData.label = `Test Timetable ${label} (${cloneData.version})`;
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
      if (ct.className.includes('S2 CSE A')) {
        for (const p of [1, 2]) {
          const s = ct.slots.find((sl) => sl.day === 'Monday' && sl.period === p);
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
    const doc = new Timetable(cloneData);
    await doc.save();
    return doc;
  }

  // -------------------------------------------------------------
  // Test 1: 3-period lab swapped as a complete group to empty/theory slots
  // -------------------------------------------------------------
  await t.test('Test 1: 3-period lab swapped as a complete group to empty/theory slots', async () => {
    const tt = await createTestTimetable('Test 1');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));
    assert.ok(s4bClass, 'S4 CSE B timetable must exist');

    const labGroup = findLabGroup(s4bClass.slots, 'Tuesday', 1);
    assert.ok(labGroup && labGroup.isLab, 'Tuesday P1 must be recognized as a lab group');
    assert.equal(labGroup.duration, 3, 'Lab duration must be 3 periods');
    assert.deepEqual(labGroup.periods, [1, 2, 3], 'Lab periods must be 1, 2, 3');

    // Swap Tuesday P1-P3 (DBMS Lab) with Wednesday P4-P6
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Wednesday', period: 4 },
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 200, `Swap failed: ${res.body?.message}`);
    const updatedTT = await Timetable.findById(tt._id);
    const updatedClass = updatedTT.classTimetables.find((ct) => ct.classId.toString() === s4bClass.classId.toString());

    // Verify all 3 destination periods [4, 5, 6] on Wednesday have the lab
    for (let i = 0; i < 3; i++) {
      const p = 4 + i;
      const s = updatedClass.slots.find((sl) => sl.day === 'Wednesday' && sl.period === p);
      assert.ok(s && s.isLabBlock, `Wednesday P${p} must be a lab block slot`);
      assert.equal(s.labBlockIndex, i, `Wednesday P${p} must have labBlockIndex ${i}`);
      assert.equal(s.subjectCode, labGroup.subjectCode, `Wednesday P${p} must match lab subject code`);
    }

    // Verify source periods [1, 2, 3] on Tuesday are now non-lab
    for (let p = 1; p <= 3; p++) {
      const s = updatedClass.slots.find((sl) => sl.day === 'Tuesday' && sl.period === p);
      assert.equal(s.isLabBlock, false, `Tuesday P${p} must no longer be a lab block`);
      assert.notEqual(s.subjectCode, labGroup.subjectCode, `Tuesday P${p} must no longer have lab code`);
    }

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 2: 2-period lab swapped as a complete group
  // -------------------------------------------------------------
  await t.test('Test 2: 2-period lab swapped as a complete group', async () => {
    const tt = await createTestTimetable('Test 2');
    const s2aClass = tt.classTimetables.find((ct) => ct.className.includes('S2 CSE A'));
    assert.ok(s2aClass, 'S2 CSE A timetable must exist');

    const labGroup = findLabGroup(s2aClass.slots, 'Wednesday', 2);
    assert.ok(labGroup && labGroup.isLab, 'Wednesday P2 must be recognized as a lab group');
    assert.equal(labGroup.duration, 2, 'Lab duration must be exactly 2 periods');
    assert.deepEqual(labGroup.periods, [2, 3], 'Lab periods must be 2, 3');

    // Swap Wednesday P2-P3 with Monday P1-P2
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2aClass.classId.toString(),
        slot1: { day: 'Wednesday', period: 2 },
        slot2: { day: 'Monday', period: 1 },
        adminOverride: true,
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 200, `Swap failed: ${res.body?.message}`);
    const updatedTT = await Timetable.findById(tt._id);
    const updatedClass = updatedTT.classTimetables.find((ct) => ct.classId.toString() === s2aClass.classId.toString());

    // Check destination periods [1, 2] on Monday
    const mP1 = updatedClass.slots.find((sl) => sl.day === 'Monday' && sl.period === 1);
    const mP2 = updatedClass.slots.find((sl) => sl.day === 'Monday' && sl.period === 2);
    assert.ok(mP1.isLabBlock && mP2.isLabBlock, 'Both Monday P1 and P2 must be lab blocks');
    assert.equal(mP1.labBlockIndex, 0);
    assert.equal(mP2.labBlockIndex, 1);
    assert.equal(mP1.subjectCode, labGroup.subjectCode);

    // Check source periods [2, 3] on Wednesday
    const wP2 = updatedClass.slots.find((sl) => sl.day === 'Wednesday' && sl.period === 2);
    const wP3 = updatedClass.slots.find((sl) => sl.day === 'Wednesday' && sl.period === 3);
    assert.equal(wP2.isLabBlock, false);
    assert.equal(wP3.isLabBlock, false);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 3: Compatible lab-to-lab swap of equal duration
  // -------------------------------------------------------------
  await t.test('Test 3: Compatible lab-to-lab swap of equal duration', async () => {
    const tt = await createTestTimetable('Test 3');
    const s2bClass = tt.classTimetables.find((ct) => ct.className.includes('S2 CSE B'));

    // S2 CSE B has GXEST204-P (Wednesday [4, 5]) and GXESL208 (Thursday [4, 5])
    const labWed = findLabGroup(s2bClass.slots, 'Wednesday', 4);
    const labThu = findLabGroup(s2bClass.slots, 'Thursday', 4);

    assert.equal(labWed.duration, 2);
    assert.equal(labThu.duration, 2);
    assert.notEqual(labWed.subjectCode, labThu.subjectCode);

    // Free external claims for these teachers on Wed [4, 5] and Thu [4, 5] in other classes
    const allTids = [...labWed.teacherIds, ...labThu.teacherIds].map((id) => id.toString());
    for (const ct of tt.classTimetables) {
      if (ct.classId.toString() !== s2bClass.classId.toString()) {
        for (const d of ['Wednesday', 'Thursday']) {
          for (const p of [4, 5]) {
            const s = ct.slots.find((sl) => sl.day === d && sl.period === p);
            if (s && s.teacherIds && s.teacherIds.some((tid) => allTids.includes(tid.toString()))) {
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
    }
    await tt.save();

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2bClass.classId.toString(),
        slot1: { day: 'Wednesday', period: 4 },
        slot2: { day: 'Thursday', period: 4 },
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 200, `Swap failed: ${res.body?.message}`);
    const updatedTT = await Timetable.findById(tt._id);
    const updatedClass = updatedTT.classTimetables.find((ct) => ct.classId.toString() === s2bClass.classId.toString());

    // Wednesday [4, 5] should now have GXESL208
    for (let p = 4; p <= 5; p++) {
      const s = updatedClass.slots.find((sl) => sl.day === 'Wednesday' && sl.period === p);
      assert.equal(s.subjectCode, labThu.subjectCode, `Wednesday P${p} must now have ${labThu.subjectCode}`);
      assert.equal(s.labBlockIndex, p - 4);
    }

    // Thursday [4, 5] should now have GXEST204-P
    for (let p = 4; p <= 5; p++) {
      const s = updatedClass.slots.find((sl) => sl.day === 'Thursday' && sl.period === p);
      assert.equal(s.subjectCode, labWed.subjectCode, `Thursday P${p} must now have ${labWed.subjectCode}`);
      assert.equal(s.labBlockIndex, p - 4);
    }

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 4: Incompatible different-duration lab swap rejected
  // -------------------------------------------------------------
  await t.test('Test 4: Incompatible different-duration lab swap rejected', async () => {
    const tt = await createTestTimetable('Test 4');
    const s2aClass = tt.classTimetables.find((ct) => ct.className.includes('S2 CSE A'));

    // S2 CSE A has 2-period lab on Thursday [4, 5]
    // Create a 3-period lab on Monday [1, 2, 3] in S2 CSE A
    for (let p = 1; p <= 3; p++) {
      const idx = s2aClass.slots.findIndex((s) => s.day === 'Monday' && s.period === p);
      s2aClass.slots[idx].subjectType = 'lab';
      s2aClass.slots[idx].isLabBlock = true;
      s2aClass.slots[idx].labBlockIndex = p - 1;
      s2aClass.slots[idx].subjectCode = 'FAKE3LAB';
      s2aClass.slots[idx].subjectName = 'Fake 3-Period Lab';
      s2aClass.slots[idx].isEmpty = false;
      s2aClass.slots[idx].isLocked = false;
    }
    await tt.save();

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2aClass.classId.toString(),
        slot1: { day: 'Thursday', period: 4 }, // duration 2
        slot2: { day: 'Monday', period: 1 },   // duration 3
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 400, 'Must return 400 Bad Request');
    assert.match(
      res.body?.message || '',
      /duration 2 periods.*with laboratory of duration 3 periods/i,
      'Error message must state duration mismatch'
    );

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 5: Rejection when destination causes faculty double-booking
  // -------------------------------------------------------------
  await t.test('Test 5: Rejection when destination causes faculty double-booking', async () => {
    const tt = await createTestTimetable('Test 5');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));

    const labMon = findLabGroup(s4bClass.slots, 'Monday', 4);
    const teacherId = labMon.teacherIds[0];
    assert.ok(teacherId, 'Teacher ID must exist');

    // Make Thursday morning P1-P3 empty in S4B
    for (let p = 1; p <= 3; p++) {
      const idx = s4bClass.slots.findIndex((s) => s.day === 'Thursday' && s.period === p);
      s4bClass.slots[idx].subjectType = 'empty';
      s4bClass.slots[idx].isEmpty = true;
      s4bClass.slots[idx].isLabBlock = false;
      s4bClass.slots[idx].subjectId = null;
      s4bClass.slots[idx].teacherIds = [];
      s4bClass.slots[idx].teacherNames = [];
    }

    // Assign the same teacher to another class (S2 CSE A) on Thursday Period 1
    const otherClass = tt.classTimetables.find((ct) => ct.className.includes('S2 CSE A'));
    const tIdx = otherClass.slots.findIndex((s) => s.day === 'Thursday' && s.period === 1);
    otherClass.slots[tIdx].teacherIds = [teacherId];
    otherClass.slots[tIdx].teacherNames = ['Target Busy Faculty'];
    otherClass.slots[tIdx].isEmpty = false;
    otherClass.slots[tIdx].subjectType = 'theory';
    await tt.save();

    // Now attempt to swap S4B lab into Thursday P1-P3
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Monday', period: 4 },
        slot2: { day: 'Thursday', period: 1 },
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 400, 'Must reject swap causing teacher double-booking');
    assert.match(res.body?.message || '', /rejected|conflict|double-booked/i);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 6: Rejection when destination causes lab room collision
  // -------------------------------------------------------------
  await t.test('Test 6: Rejection when destination causes lab room collision', async () => {
    const tt = await createTestTimetable('Test 6');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));
    const labMon = findLabGroup(s4bClass.slots, 'Monday', 4);
    const labRoom = labMon.roomName || 'Lab 4';

    // Clear Thursday P1-P3 in S4B
    for (let p = 1; p <= 3; p++) {
      const idx = s4bClass.slots.findIndex((s) => s.day === 'Thursday' && s.period === p);
      s4bClass.slots[idx].subjectType = 'empty';
      s4bClass.slots[idx].isEmpty = true;
      s4bClass.slots[idx].isLabBlock = false;
      s4bClass.slots[idx].subjectId = null;
      s4bClass.slots[idx].teacherIds = [];
      s4bClass.slots[idx].teacherNames = [];
    }

    // Occupy labRoom on Thursday P1 in another class (S6 CSE B)
    const s6bClass = tt.classTimetables.find((ct) => ct.className.includes('S6 CSE B'));
    const rIdx = s6bClass.slots.findIndex((s) => s.day === 'Thursday' && s.period === 1);
    s6bClass.slots[rIdx].roomName = labRoom;
    s6bClass.slots[rIdx].isEmpty = false;
    s6bClass.slots[rIdx].subjectType = 'lab';
    await tt.save();

    // Attempt to swap S4B lab to Thursday P1
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Monday', period: 4 },
        slot2: { day: 'Thursday', period: 1 },
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 400, 'Must reject swap causing lab room collision');
    assert.match(res.body?.message || '', /rejected|conflict|room/i);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 7: Rejection when destination causes class collision / overlap
  // -------------------------------------------------------------
  await t.test('Test 7: Rejection when destination causes class collision / overlap', async () => {
    const tt = await createTestTimetable('Test 7');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));

    // S4 CSE B has a 3-period lab on Tuesday [1, 2, 3].
    // Empty Tuesday P1 so it appears as a non-lab start target, but leave Tuesday P2 as a lab slot!
    const idx1 = s4bClass.slots.findIndex((s) => s.day === 'Tuesday' && s.period === 1);
    s4bClass.slots[idx1].isLabBlock = false;
    s4bClass.slots[idx1].subjectType = 'empty';
    s4bClass.slots[idx1].isEmpty = true;
    await tt.save();

    // Now try to move Monday P4 (3-period lab) to Tuesday P1 (which spans P1, P2, P3 and overlaps Tuesday P2 lab)
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Monday', period: 4 },
        slot2: { day: 'Tuesday', period: 1 },
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 400, 'Must reject swap that overlaps with existing laboratory');
    assert.match(res.body?.message || '', /overlaps with another laboratory|cannot swap/i);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 8: Rejection when destination crosses Friday prayer/lunch interval or Mon-Thu lunch
  // -------------------------------------------------------------
  await t.test('Test 8: Rejection when destination crosses Friday prayer/lunch interval or lunch break', async () => {
    const tt = await createTestTimetable('Test 8');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));

    // Attempt 1: Start 3-period lab at Period 3 on Monday (P3-P5 crosses lunch between P3 and P4)
    const req1 = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Monday', period: 3 },
      },
      user: { username: 'test_admin' },
    };
    const res1 = createMockRes();
    await editSwapSlots(req1, res1);
    assert.equal(res1.statusCode, 400, 'Must reject lab crossing lunch break between P3 and P4');
    assert.match(res1.body?.message || '', /cross lunch break/i);

    // Attempt 2: Move 3-period lab to Friday
    const req2 = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Friday', period: 1 },
      },
      user: { username: 'test_admin' },
    };
    const res2 = createMockRes();
    await editSwapSlots(req2, res2);
    assert.equal(res2.statusCode, 400, 'Must reject 3-period lab on Friday');
    assert.match(res2.body?.message || '', /Friday|50-minute/i);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 9: Rollback on validation failure (original state untainted)
  // -------------------------------------------------------------
  await t.test('Test 9: Rollback on validation failure (original state untainted)', async () => {
    const tt = await createTestTimetable('Test 9');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));

    const beforeSlots = JSON.parse(JSON.stringify(s4bClass.slots));

    // Deliberate invalid swap (target P5 for a 3-period lab -> P5, P6, P7 exceeds 6)
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Monday', period: 5 },
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 400, 'Must reject out-of-bounds swap');

    const afterTT = await Timetable.findById(tt._id);
    const afterClass = afterTT.classTimetables.find((ct) => ct.classId.toString() === s4bClass.classId.toString());

    assert.equal(afterClass.slots.length, beforeSlots.length, 'Slot count must be identical');
    for (let i = 0; i < beforeSlots.length; i++) {
      assert.equal(afterClass.slots[i].subjectCode, beforeSlots[i].subjectCode);
      assert.equal(afterClass.slots[i].isLabBlock, beforeSlots[i].isLabBlock);
      assert.equal(afterClass.slots[i].labBlockIndex, beforeSlots[i].labBlockIndex);
    }

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 10: Concurrency protection check
  // -------------------------------------------------------------
  await t.test('Test 10: Concurrency protection check', async () => {
    const tt = await createTestTimetable('Test 10');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));

    // Pass stale updatedAt timestamp from 1 hour ago
    const staleTimestamp = new Date(Date.now() - 3600 * 1000).toISOString();

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Wednesday', period: 4 },
        expectedUpdatedAt: staleTimestamp,
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 409, 'Must return 409 Conflict for stale concurrent edit');
    assert.match(res.body?.message || '', /concurrently|conflict/i);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 11: Zero duplicate periods after swap
  // -------------------------------------------------------------
  await t.test('Test 11: Zero duplicate periods after swap', async () => {
    const tt = await createTestTimetable('Test 11');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));

    // Perform valid atomic swap
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Wednesday', period: 4 },
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200, `Swap failed: ${res.body?.message}`);

    const updatedTT = await Timetable.findById(tt._id);
    const updatedClass = updatedTT.classTimetables.find((ct) => ct.classId.toString() === s4bClass.classId.toString());

    // Check for duplicate (day, period) coordinates
    const seen = new Set();
    for (const slot of updatedClass.slots) {
      const key = `${slot.day}_${slot.period}`;
      assert.ok(!seen.has(key), `Duplicate slot coordinate detected: ${key}`);
      seen.add(key);
    }

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 12: Zero missing periods after swap
  // -------------------------------------------------------------
  await t.test('Test 12: Zero missing periods after swap', async () => {
    const tt = await createTestTimetable('Test 12');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Wednesday', period: 4 },
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200, `Swap failed: ${res.body?.message}`);

    const updatedTT = await Timetable.findById(tt._id);
    const updatedClass = updatedTT.classTimetables.find((ct) => ct.classId.toString() === s4bClass.classId.toString());

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    for (const d of days) {
      for (let p = 1; p <= 6; p++) {
        const slot = updatedClass.slots.find((s) => s.day === d && s.period === p);
        assert.ok(slot, `Missing slot at ${d} Period ${p}`);
      }
    }

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 13: Workload conservation check (all subject weekly hours identical)
  // -------------------------------------------------------------
  await t.test('Test 13: Workload conservation check (all subject weekly hours identical)', async () => {
    const tt = await createTestTimetable('Test 13');
    const s4bClass = tt.classTimetables.find((ct) => ct.className.includes('S4 CSE B'));

    // Tally hours before swap
    const hoursBefore = {};
    for (const s of s4bClass.slots) {
      if (s.subjectCode && !s.isEmpty && !s.isBreak) {
        hoursBefore[s.subjectCode] = (hoursBefore[s.subjectCode] || 0) + 1;
      }
    }

    // Perform atomic lab swap
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4bClass.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Wednesday', period: 4 },
      },
      user: { username: 'test_admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200, `Swap failed: ${res.body?.message}`);

    const updatedTT = await Timetable.findById(tt._id);
    const updatedClass = updatedTT.classTimetables.find((ct) => ct.classId.toString() === s4bClass.classId.toString());

    // Tally hours after swap
    const hoursAfter = {};
    for (const s of updatedClass.slots) {
      if (s.subjectCode && !s.isEmpty && !s.isBreak) {
        hoursAfter[s.subjectCode] = (hoursAfter[s.subjectCode] || 0) + 1;
      }
    }

    assert.deepEqual(
      hoursAfter,
      hoursBefore,
      'Total weekly teaching hours for each subject must be 100% identical before and after swap'
    );

    await Timetable.findByIdAndDelete(tt._id);
  });

  await mongoose.disconnect();
});
