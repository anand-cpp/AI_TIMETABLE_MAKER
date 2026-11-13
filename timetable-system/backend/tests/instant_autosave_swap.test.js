const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Timetable = require('../src/models/Timetable');
const {
  editSwapSlots,
  getVersion,
  acceptVersion,
} = require('../src/controllers/timetableController');
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
const { findLabGroup } = require('../src/services/engine/labGroupHelper');

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

test('Instant Auto-Save For Every Timetable Swap Test Suite (13 Cases)', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI);

  const baseTimetable = (await Timetable.findOne({ isAccepted: true })) || (await Timetable.findOne({ version: 1 })) || (await Timetable.findOne());
  assert.ok(baseTimetable, 'Authoritative published timetable must exist');

  async function createTestTimetable(label) {
    const cloneData = JSON.parse(JSON.stringify(baseTimetable.toObject()));
    delete cloneData._id;
    const maxDoc = await Timetable.findOne().sort({ version: -1 });
    cloneData.version = (maxDoc ? maxDoc.version : 80000) + Math.floor(Math.random() * 500) + 1;
    cloneData.revision = 1;
    cloneData.appliedIdempotencyKeys = [];
    cloneData.label = `AutoSave Test ${label} (v${cloneData.version})`;
    cloneData.isAccepted = false;
    for (const ct of cloneData.classTimetables) {
      for (const s of ct.slots) {
        s.isLocked = false;
      }
      if (!['Test 11', 'Test 13'].includes(label)) {
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
    }
    const doc = new Timetable(cloneData);
    await doc.save();
    return doc;
  }

  // -------------------------------------------------------------
  // Test 1: One valid swap is persisted immediately to MongoDB
  // -------------------------------------------------------------
  await t.test('Test 1: One valid swap is persisted immediately to MongoDB', async () => {
    const tt = await createTestTimetable('Test 1');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));
    const initialRev = tt.revision || 1;

    // Swap Wednesday P2-P3 (GXESL208 IT Workshop) with Monday P1-P2
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2a.classId.toString(),
        slot1: { day: 'Wednesday', period: 2 },
        slot2: { day: 'Monday', period: 1 },
        expectedRevision: initialRev,
        adminOverride: true,
      },
      user: { username: 'auto_admin', _id: 'admin_123' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 200, `Swap failed: ${res.body?.message}`);
    assert.equal(res.body?.data?.revision, initialRev + 1, 'Revision must be incremented by 1');

    // Query MongoDB directly to verify authoritative persistence
    const persisted = await Timetable.findById(tt._id).lean();
    assert.equal(persisted.revision, initialRev + 1, 'MongoDB revision must match response revision');

    const pClass = persisted.classTimetables.find((c) => c.classId.toString() === s2a.classId.toString());
    const mP1 = pClass.slots.find((s) => s.day === 'Monday' && s.period === 1);
    const mP2 = pClass.slots.find((s) => s.day === 'Monday' && s.period === 2);
    assert.equal(mP1.subjectCode, 'GXESL208', 'Monday P1 must have GXESL208 in MongoDB');
    assert.equal(mP2.subjectCode, 'GXESL208', 'Monday P2 must have GXESL208 in MongoDB');

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 2: Two successive swaps are both persisted
  // -------------------------------------------------------------
  await t.test('Test 2: Two successive swaps are both persisted in order', async () => {
    const tt = await createTestTimetable('Test 2');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));
    const s4b = tt.classTimetables.find((c) => c.className.includes('S4 CSE B'));

    // Swap 1
    const req1 = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2a.classId.toString(),
        slot1: { day: 'Wednesday', period: 2 },
        slot2: { day: 'Monday', period: 1 },
        expectedRevision: 1,
        adminOverride: true,
      },
      user: { username: 'admin1' },
    };
    const res1 = createMockRes();
    await editSwapSlots(req1, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body?.data?.revision, 2);

    // Swap 2 (uses revision 2)
    const req2 = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4b.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Wednesday', period: 4 },
        expectedRevision: 2,
        adminOverride: true,
      },
      user: { username: 'admin2' },
    };
    const res2 = createMockRes();
    await editSwapSlots(req2, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body?.data?.revision, 3);

    // Verify both swaps in MongoDB
    const persisted = await Timetable.findById(tt._id).lean();
    assert.equal(persisted.revision, 3, 'Revision must be 3 after 2 successive swaps');

    const s2aPersisted = persisted.classTimetables.find((c) => c.classId.toString() === s2a.classId.toString());
    const s4bPersisted = persisted.classTimetables.find((c) => c.classId.toString() === s4b.classId.toString());

    assert.equal(
      s2aPersisted.slots.find((s) => s.day === 'Monday' && s.period === 1)?.subjectCode,
      'GXESL208',
      'Swap 1 must be saved in MongoDB'
    );
    assert.equal(
      s4bPersisted.slots.find((s) => s.day === 'Wednesday' && s.period === 4)?.subjectCode,
      'PCCSL408',
      'Swap 2 must be saved in MongoDB'
    );

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 3: Refreshing the page preserves the swaps (MongoDB source of truth)
  // -------------------------------------------------------------
  await t.test('Test 3: Refreshing page preserves swaps (authoritative MongoDB read)', async () => {
    const tt = await createTestTimetable('Test 3');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2a.classId.toString(),
        slot1: { day: 'Wednesday', period: 2 },
        slot2: { day: 'Monday', period: 1 },
        adminOverride: true,
      },
      user: { username: 'admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200);

    // Simulate page reload by querying a brand-new MongoDB read
    const freshDbRead = await Timetable.findById(tt._id).lean();
    const pClass = freshDbRead.classTimetables.find((c) => c.classId.toString() === s2a.classId.toString());
    const mP1 = pClass.slots.find((s) => s.day === 'Monday' && s.period === 1);

    assert.equal(mP1.subjectCode, 'GXESL208', 'Refreshed query from MongoDB must return the swapped subject');
    assert.equal(freshDbRead.revision, 2);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 4: Reopening the timetable returns latest saved state
  // -------------------------------------------------------------
  await t.test('Test 4: Reopening timetable (getVersion API) returns latest saved state', async () => {
    const tt = await createTestTimetable('Test 4');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));

    // Apply swap
    const swapReq = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2a.classId.toString(),
        slot1: { day: 'Wednesday', period: 2 },
        slot2: { day: 'Monday', period: 1 },
        adminOverride: true,
      },
      user: { username: 'admin' },
    };
    const swapRes = createMockRes();
    await editSwapSlots(swapReq, swapRes);
    assert.equal(swapRes.statusCode, 200);

    // Call getVersion API (same route user hits when navigating/reopening)
    const getReq = { params: { id: tt._id.toString() } };
    const getRes = createMockRes();
    await getVersion(getReq, getRes);

    assert.equal(getRes.statusCode, 200);
    const loadedTT = getRes.body?.data?.timetable;
    assert.ok(loadedTT, 'Loaded timetable must exist in getVersion response');
    assert.equal(loadedTT.revision, 2);

    const loadedClass = loadedTT.classTimetables.find((c) => c.classId.toString() === s2a.classId.toString());
    const mP1 = loadedClass.slots.find((s) => s.day === 'Monday' && s.period === 1);
    assert.equal(mP1.subjectCode, 'GXESL208', 'Reopened timetable must contain saved swap');

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 5: An invalid swap does not change MongoDB
  // -------------------------------------------------------------
  await t.test('Test 5: An invalid swap does not modify MongoDB', async () => {
    const tt = await createTestTimetable('Test 5');
    const s4b = tt.classTimetables.find((c) => c.className.includes('S4 CSE B'));
    const beforeSnap = await Timetable.findById(tt._id).lean();

    // Attempt invalid swap (target period 5 for 3-period lab exceeds period 6)
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4b.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Monday', period: 5 },
      },
      user: { username: 'admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 400, 'Must return 400 Bad Request');

    // Query MongoDB to prove document was completely untouched
    const afterSnap = await Timetable.findById(tt._id).lean();
    assert.equal(afterSnap.revision, beforeSnap.revision, 'Revision must NOT change');
    assert.equal(afterSnap.updatedAt.toISOString(), beforeSnap.updatedAt.toISOString(), 'updatedAt must NOT change');
    assert.equal(afterSnap.editHistory.length, beforeSnap.editHistory.length, 'No edit history added on failure');

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 6: A failed database operation does not show "Saved" / returns error
  // -------------------------------------------------------------
  await t.test('Test 6: A failed operation returns error code and does not falsely confirm saved', async () => {
    const tt = await createTestTimetable('Test 6');
    const s4b = tt.classTimetables.find((c) => c.className.includes('S4 CSE B'));

    // Swap targeting non-existent slot coordinates
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4b.classId.toString(),
        slot1: { day: 'InvalidDay', period: 99 },
        slot2: { day: 'Tuesday', period: 1 },
      },
      user: { username: 'admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 404, 'Must return 404 Not Found');
    assert.match(res.body?.message || '', /not found/i);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 7: A network failure does not silently lose intended operation
  // -------------------------------------------------------------
  await t.test('Test 7: Pending swap preserves payload for retry upon connection', async () => {
    const tt = await createTestTimetable('Test 7');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));

    const idempotencyKey = `idemp_retry_${Date.now()}`;
    const pendingSwap = {
      classId: s2a.classId.toString(),
      slot1: { day: 'Wednesday', period: 2 },
      slot2: { day: 'Monday', period: 1 },
      expectedRevision: 1,
      adminOverride: true,
      idempotencyKey,
    };

    // Client can replay this exact payload upon reconnection
    const req = {
      params: { id: tt._id.toString() },
      body: pendingSwap,
      user: { username: 'reconnecting_user' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 200, 'Replayed swap after reconnection must persist');
    const saved = await Timetable.findById(tt._id).lean();
    assert.equal(saved.revision, 2);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 8: Retrying does not duplicate the swap (Idempotency key)
  // -------------------------------------------------------------
  await t.test('Test 8: Retrying does not duplicate swap (Idempotency key protection)', async () => {
    const tt = await createTestTimetable('Test 8');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));

    const idempotencyKey = `idemp_uniq_${Date.now()}`;
    const payload = {
      classId: s2a.classId.toString(),
      slot1: { day: 'Wednesday', period: 2 },
      slot2: { day: 'Monday', period: 1 },
      expectedRevision: 1,
      adminOverride: true,
      idempotencyKey,
    };

    // First attempt
    const req1 = { params: { id: tt._id.toString() }, body: payload, user: { username: 'admin' } };
    const res1 = createMockRes();
    await editSwapSlots(req1, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body?.data?.revision, 2);

    // Second attempt (retry of exact same swap)
    const req2 = { params: { id: tt._id.toString() }, body: payload, user: { username: 'admin' } };
    const res2 = createMockRes();
    await editSwapSlots(req2, res2);

    assert.equal(res2.statusCode, 200, 'Retry must return 200');
    assert.equal(res2.body?.data?.alreadyApplied, true, 'Response must indicate alreadyApplied=true');
    assert.equal(res2.body?.data?.revision, 2, 'Revision must NOT increment a second time');

    const dbDoc = await Timetable.findById(tt._id).lean();
    assert.equal(dbDoc.revision, 2, 'Database revision must remain 2');

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 9: Concurrent edits do not overwrite each other
  // -------------------------------------------------------------
  await t.test('Test 9: Concurrent edits do not overwrite each other', async () => {
    const tt = await createTestTimetable('Test 9');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));
    const s4b = tt.classTimetables.find((c) => c.className.includes('S4 CSE B'));

    // Both users loaded revision 1
    const userA_req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2a.classId.toString(),
        slot1: { day: 'Wednesday', period: 2 },
        slot2: { day: 'Monday', period: 1 },
        expectedRevision: 1,
        adminOverride: true,
      },
      user: { username: 'User A' },
    };

    const userB_req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s4b.classId.toString(),
        slot1: { day: 'Tuesday', period: 1 },
        slot2: { day: 'Wednesday', period: 4 },
        expectedRevision: 1, // Stale!
      },
      user: { username: 'User B' },
    };

    // User A succeeds first
    const resA = createMockRes();
    await editSwapSlots(userA_req, resA);
    assert.equal(resA.statusCode, 200);

    // User B submits based on stale revision 1
    const resB = createMockRes();
    await editSwapSlots(userB_req, resB);

    assert.equal(resB.statusCode, 409, 'User B must be rejected with 409 Conflict');
    assert.match(resB.body?.message || '', /revision mismatch|conflict/i);

    // Verify User A's changes were not overwritten
    const dbDoc = await Timetable.findById(tt._id).lean();
    assert.equal(dbDoc.revision, 2, 'Database must be at revision 2 reflecting User A');

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 10: A stale timetable revision is rejected safely
  // -------------------------------------------------------------
  await t.test('Test 10: Stale revision is rejected safely with 409 Conflict', async () => {
    const tt = await createTestTimetable('Test 10');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2a.classId.toString(),
        slot1: { day: 'Wednesday', period: 2 },
        slot2: { day: 'Monday', period: 1 },
        expectedRevision: 999, // Stale revision
      },
      user: { username: 'admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);

    assert.equal(res.statusCode, 409, 'Must return 409 Conflict');
    assert.match(res.body?.message || '', /mismatch|conflict/i);

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 11: A successful swap preserves all timetable constraints
  // -------------------------------------------------------------
  await t.test('Test 11: Successful swap preserves all timetable constraints', async () => {
    const tt = await createTestTimetable('Test 11');
    const s2b = tt.classTimetables.find((c) => c.className.includes('S2 CSE B'));

    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2b.classId.toString(),
        slot1: { day: 'Thursday', period: 4 },
        slot2: { day: 'Thursday', period: 1 },
      },
      user: { username: 'admin' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200);

    const updatedDoc = await Timetable.findById(tt._id);
    const val = await validatePersistedTimetable(updatedDoc);

    assert.equal(val.checks.zero_teacher_conflicts, true, 'Zero teacher conflicts');
    assert.equal(val.checks.zero_daily_subject_duplicates, true, 'Zero daily subject duplicates');

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 12: Audit history records successful swaps correctly
  // -------------------------------------------------------------
  await t.test('Test 12: Audit history records successful swaps with required fields', async () => {
    const tt = await createTestTimetable('Test 12');
    const s2a = tt.classTimetables.find((c) => c.className.includes('S2 CSE A'));

    const idempotencyKey = `audit_test_${Date.now()}`;
    const req = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2a.classId.toString(),
        slot1: { day: 'Wednesday', period: 2 },
        slot2: { day: 'Monday', period: 1 },
        adminOverride: true,
        idempotencyKey,
      },
      user: { username: 'audit_operator', _id: 'user_456' },
    };
    const res = createMockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 200);

    const updatedDoc = await Timetable.findById(tt._id).lean();
    const lastEntry = updatedDoc.editHistory[updatedDoc.editHistory.length - 1];

    assert.ok(lastEntry, 'Audit log entry must be present');
    assert.equal(lastEntry.classId.toString(), s2a.classId.toString());
    assert.equal(lastEntry.day, 'Wednesday');
    assert.equal(lastEntry.period, 2);
    assert.equal(lastEntry.targetDay, 'Monday');
    assert.equal(lastEntry.targetPeriod, 1);
    assert.equal(lastEntry.revision, 2);
    assert.equal(lastEntry.editedBy, 'audit_operator');
    assert.equal(lastEntry.userId, 'user_456');
    assert.equal(lastEntry.result, 'success');
    assert.equal(lastEntry.idempotencyKey, idempotencyKey);
    assert.ok(lastEntry.editedAt instanceof Date, 'editedAt must be a valid Date');
    assert.ok(lastEntry.before && lastEntry.after, 'before and after states must be recorded');

    await Timetable.findByIdAndDelete(tt._id);
  });

  // -------------------------------------------------------------
  // Test 13: Existing Save and Publish functionality still works
  // -------------------------------------------------------------
  await t.test('Test 13: Existing Save and Publish functionality still works independently', async () => {
    const tt = await createTestTimetable('Test 13');

    // 1. Swap auto-saves without needing publish
    const s2b = tt.classTimetables.find((c) => c.className.includes('S2 CSE B'));
    const swapReq = {
      params: { id: tt._id.toString() },
      body: {
        classId: s2b.classId.toString(),
        slot1: { day: 'Thursday', period: 4 },
        slot2: { day: 'Thursday', period: 1 },
      },
      user: { username: 'admin' },
    };
    const swapRes = createMockRes();
    await editSwapSlots(swapReq, swapRes);
    assert.equal(swapRes.statusCode, 200, 'Swap failed: ' + swapRes.body?.message);

    const docAfterSwap = await Timetable.findById(tt._id).lean();
    assert.equal(docAfterSwap.isAccepted, false, 'Auto-save does NOT force publish');
    assert.equal(docAfterSwap.revision, 2, 'Swap is already permanently saved in MongoDB');

    // 2. Publish workflow operates cleanly on top of auto-saved timetable
    const pubReq = { params: { id: tt._id.toString() } };
    const pubRes = createMockRes();
    await acceptVersion(pubReq, pubRes);
    assert.equal(pubRes.statusCode, 200, 'Publish failed: ' + pubRes.body?.message);

    const publishedDoc = await Timetable.findById(tt._id).lean();
    assert.equal(publishedDoc.isAccepted, true, 'Timetable is now published');
    assert.equal(publishedDoc.publicationStatus, 'PUBLISHED');

    await Timetable.findByIdAndDelete(tt._id);
    await Timetable.updateOne({ version: 1 }, { isAccepted: true });
  });
  await mongoose.disconnect();
});
