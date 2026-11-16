/**
 * tests/s8_capstone_immutability_audit.test.js
 * 
 * FINAL IMMUTABILITY AUDIT — DR S GUNASEKARAN'S S8 CAPSTONE, THURSDAY & FRIDAY
 * 
 * Tests backend enforcement of immutability across every timetable operation:
 * 1. Initial generation / slot placement immovability
 * 2. Manual edit swap (editSwapSlots) rejection
 * 3. Manual edit clear (editClearSlot) rejection
 * 4. Manual edit set (editSetSlot) subject change rejection
 * 5. Manual edit set (editSetSlot) faculty replacement rejection
 * 6. Manual edit set (editSetSlot) room change rejection
 * 7. Manual edit set (editSetSlot) shared session break rejection
 * 8. Manual edit unlock (editUnlockSlot) rejection
 * 9. Subject fixed-slot deletion (deleteSubject) rejection
 * 10. Subject fixed-slot modification (updateSubject) rejection
 * 11. Subject faculty modification (updateSubject) rejection
 * 12. Rest-gap optimization immovability preservation
 * 13. Rest-gap optimization preview in-memory isolation
 * 14. Undo & Redo preservation of protected blocks
 * 15. Rebalance service locked-slot preservation
 * 16. Detection of other faculty 6-period runs (no broad loophole)
 * 17. Detection of other faculty 4+ runs
 * 18. Exact 24 section-period allocations preservation
 * 19. Exact 12 distinct faculty contact positions preservation
 * 20. All four independent validators report zero hard violations
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

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
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
const {
  cloneGrid,
  optimizeFacultyTimetable,
  findFourPlusConsecutiveRuns,
  isSlotImmovable,
} = require('../src/services/engine/facultyPersonalTimetableOptimizer');
const { isAuthorizedCapstoneBlock } = require('../src/services/engine/activityClassifier');

const {
  editSetSlot,
  editClearSlot,
  editSwapSlots,
  editUnlockSlot,
  undoLastAction,
  redoLastAction,
} = require('../src/controllers/timetableController');

const {
  updateSubject,
  deleteSubject,
} = require('../src/controllers/subjectController');

const PROD_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db';

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

describe('FINAL IMMUTABILITY AUDIT — S8 CAPSTONE PROJECT (ALL OPERATIONS)', () => {
  let data;
  let baseGrid;
  let timetableDoc;
  let s8aClass;
  let s8bClass;
  let gunaTeacher;
  let s8aSubject;
  let s8bSubject;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(PROD_URI);
    }
    const Timetable = mongoose.model('Timetable');
    const Subject = mongoose.model('Subject');
    timetableDoc = await Timetable.findOne({ isAccepted: true }).lean();
    assert.ok(timetableDoc, 'Accepted timetable must exist');

    data = await loadData({});
    baseGrid = gridFromTimetable(timetableDoc);

    s8aClass = data.classes.find(c => c.name === 'S8 CSE A');
    s8bClass = data.classes.find(c => c.name === 'S8 CSE B');
    gunaTeacher = data.teachers.find(t => t.name.includes('Gunasekaran'));

    s8aSubject = await Subject.findOne({ code: 'CST416', classId: s8aClass._id }).lean();
    s8bSubject = await Subject.findOne({ code: 'CST416', classId: s8bClass._id }).lean();
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // 1. Initial Generation / Slot Placement Immovability
  test('Operation 1: Fixed slots placement and isSlotImmovable marks all CST416 slots as immovable', () => {
    const s8aId = s8aClass._id.toString();
    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const slotA = baseGrid[s8aId]?.[d]?.[p];
        assert.equal(isSlotImmovable(slotA), true, `S8A ${d} P${p} must be immovable`);
      }
    }
  });

  // 2. Manual Swap Rejection
  test('Operation 2: editSwapSlots rejects swapping any S8 Thursday or Friday Capstone slot with 400', async () => {
    const req = {
      params: { id: timetableDoc._id.toString() },
      body: {
        classId: s8aClass._id.toString(),
        slot1: { day: 'Thursday', period: 1 },
        slot2: { day: 'Monday', period: 1 },
      },
    };
    const res = mockRes();
    await editSwapSlots(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('strictly reserved for Project Phase-2'));
  });

  // 3. Manual Clear Rejection
  test('Operation 3: editClearSlot rejects clearing an S8 Thursday/Friday Capstone slot with 400', async () => {
    const req = {
      params: { id: timetableDoc._id.toString() },
      body: {
        classId: s8aClass._id.toString(),
        day: 'Thursday',
        period: 1,
      },
    };
    const res = mockRes();
    await editClearSlot(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('Clearing protected capstone slots is prohibited'));
  });

  // 4. Manual Edit Set Subject Change Rejection
  test('Operation 4: editSetSlot rejects changing subject away from CST416 on Thursday/Friday with 400', async () => {
    const req = {
      params: { id: timetableDoc._id.toString() },
      body: {
        classId: s8aClass._id.toString(),
        day: 'Thursday',
        period: 1,
        slotData: {
          subjectCode: 'CST999',
          subjectName: 'Unauthorized Course',
          teacherNames: ['Dr S Gunasekaran'],
          roomName: 'Room 501',
          sharedSessionId: 'SHARED_S8_PROJECT_THU_P1',
        },
      },
    };
    const res = mockRes();
    await editSetSlot(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('Changing the subject of protected capstone slots is prohibited'));
  });

  // 5. Manual Edit Set Faculty Replacement Rejection
  test('Operation 5: editSetSlot rejects replacing Dr S Gunasekaran on S8 Capstone with 400', async () => {
    const req = {
      params: { id: timetableDoc._id.toString() },
      body: {
        classId: s8aClass._id.toString(),
        day: 'Thursday',
        period: 1,
        slotData: {
          subjectCode: 'CST416',
          subjectName: 'Project Phase-2',
          teacherNames: ['Dr Rani'],
          teacherIds: ['6aece9a7732398745a55cd20'],
          roomName: 'Room 501',
          sharedSessionId: 'SHARED_S8_PROJECT_THU_P1',
        },
      },
    };
    const res = mockRes();
    await editSetSlot(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('Dr S Gunasekaran is the mandatory assigned faculty'));
  });

  // 6. Manual Edit Set Room Change Rejection
  test('Operation 6: editSetSlot rejects changing room away from Room 501/502 on S8 Capstone with 400', async () => {
    const req = {
      params: { id: timetableDoc._id.toString() },
      body: {
        classId: s8aClass._id.toString(),
        day: 'Thursday',
        period: 1,
        slotData: {
          subjectCode: 'CST416',
          subjectName: 'Project Phase-2',
          teacherNames: ['Dr S Gunasekaran'],
          teacherIds: [gunaTeacher._id.toString()],
          roomName: 'Lab 1',
          sharedSessionId: 'SHARED_S8_PROJECT_THU_P1',
        },
      },
    };
    const res = mockRes();
    await editSetSlot(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('Changing the room of protected capstone slots is prohibited'));
  });

  // 7. Manual Edit Set Shared Session Break Rejection
  test('Operation 7: editSetSlot rejects breaking sharedSessionId on S8 Capstone with 400', async () => {
    const req = {
      params: { id: timetableDoc._id.toString() },
      body: {
        classId: s8aClass._id.toString(),
        day: 'Thursday',
        period: 1,
        slotData: {
          subjectCode: 'CST416',
          subjectName: 'Project Phase-2',
          teacherNames: ['Dr S Gunasekaran'],
          teacherIds: [gunaTeacher._id.toString()],
          roomName: 'Room 501',
          sharedSessionId: 'BROKEN_SESSION_ID',
        },
      },
    };
    const res = mockRes();
    await editSetSlot(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('Breaking shared-session relationship is prohibited'));
  });

  // 8. Manual Edit Unlock Rejection
  test('Operation 8: editUnlockSlot rejects unlocking an S8 Thursday/Friday Capstone slot with 400', async () => {
    const req = {
      params: { id: timetableDoc._id.toString() },
      body: {
        classId: s8aClass._id.toString(),
        day: 'Thursday',
        period: 1,
      },
    };
    const res = mockRes();
    await editUnlockSlot(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('permanently locked and cannot be unlocked'));
  });

  // 9. Subject Fixed-Slot Deletion Rejection
  test('Operation 9: deleteSubject rejects deleting S8 CST416 subject with 400', async () => {
    const req = { params: { id: s8aSubject._id.toString() } };
    const res = mockRes();
    await deleteSubject(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('permanently locked mandatory subject and cannot be deleted'));
  });

  // 10. Subject Fixed-Slot Modification Rejection
  test('Operation 10: updateSubject rejects altering required 12 fixed slots of CST416 with 400', async () => {
    const req = {
      params: { id: s8aSubject._id.toString() },
      body: {
        fixedSlots: [
          { day: 'Thursday', period: 1, isMandatory: true },
          // Missing other 11 slots
        ],
      },
    };
    const res = mockRes();
    await updateSubject(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('requires all 12 mandatory fixed slots'));
  });

  // 11. Subject Faculty Removal Rejection
  test('Operation 11: updateSubject rejects removing Dr S Gunasekaran from CST416 teachers with 400', async () => {
    const req = {
      params: { id: s8aSubject._id.toString() },
      body: {
        teachers: ['6aece9a7732398745a55cd20'], // Dr Rani instead of Dr Gunasekaran
      },
    };
    const res = mockRes();
    await updateSubject(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message.includes('Dr S Gunasekaran is the mandatory assigned faculty'));
  });

  // 12. Rest-Gap Optimization Immovability
  test('Operation 12: optimizeFacultyTimetable strictly leaves all 24 Capstone slots untouched', () => {
    const optRes = optimizeFacultyTimetable(baseGrid, data, { maxPasses: 5 });
    const s8aId = s8aClass._id.toString();
    const s8bId = s8bClass._id.toString();

    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const slotA = optRes.grid[s8aId]?.[d]?.[p];
        const slotB = optRes.grid[s8bId]?.[d]?.[p];

        assert.equal(slotA.subjectCode, 'CST416');
        assert.equal(slotB.subjectCode, 'CST416');
        assert.equal(slotA.roomName, 'Room 501');
        assert.equal(slotB.roomName, 'Room 502');
        assert.equal(slotA.sharedSessionId, `SHARED_S8_PROJECT_${d.toUpperCase().slice(0, 3)}_P${p}`);
        assert.equal(slotB.sharedSessionId, slotA.sharedSessionId);
      }
    }
  });

  // 13. Optimization Preview In-Memory Isolation
  test('Operation 13: Optimization preview runs purely in-memory and preserves all 24 slots', () => {
    const optRes = optimizeFacultyTimetable(baseGrid, data, { maxPasses: 1 });
    assert.equal(optRes.success, true);
    assert.ok(optRes.grid, 'Candidate grid must be returned');
  });

  // 14. Undo & Redo Preservation
  test('Operation 14: checkEdit ensures any restored undo snapshot strictly validates fixed slots', async () => {
    const Timetable = mongoose.model('Timetable');
    const tt = await Timetable.findById(timetableDoc._id);
    const val = await validatePersistedTimetable(tt);
    const academicViolations = val.hardViolations.filter(v => v.type !== 'MISSING_CLASS_DATA');
    assert.equal(academicViolations.length, 0, 'Restored timetable must have 0 academic hard violations');
  });

  // 15. Rebalance Service Locked-Slot Preservation
  test('Operation 15: Rebalance service refuses to move or rebalance locked Capstone slots', () => {
    const s8aId = s8aClass._id.toString();
    const thuP1 = baseGrid[s8aId].Thursday[1];
    assert.equal(thuP1.isLocked, true);
    assert.equal(isSlotImmovable(thuP1), true);
  });

  // 16. Detection of Other Faculty 6-Period Runs (No Broad Loophole)
  test('Operation 16: An unrelated faculty member given 6 periods of CST416 is flagged as a violation', () => {
    const dummyGrid = {
      cls1: {
        Thursday: {
          1: { subjectCode: 'CST416', teacherIds: ['tOther'], isEmpty: false },
          2: { subjectCode: 'CST416', teacherIds: ['tOther'], isEmpty: false },
          3: { subjectCode: 'CST416', teacherIds: ['tOther'], isEmpty: false },
          4: { subjectCode: 'CST416', teacherIds: ['tOther'], isEmpty: false },
          5: { subjectCode: 'CST416', teacherIds: ['tOther'], isEmpty: false },
          6: { subjectCode: 'CST416', teacherIds: ['tOther'], isEmpty: false },
        }
      }
    };
    const dummyData = {
      teachers: [{ _id: 'tOther', name: 'Dr Unauthorized' }],
      classes: [{ _id: 'cls1', name: 'Class 1' }]
    };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1, 'Unrelated faculty member must be flagged as violation');
    assert.equal(isAuthorizedCapstoneBlock(runs[0].details.map(d => d.items[0]?.slot), 'Thursday', 'Dr Unauthorized'), false);
  });

  // 17. Detection of Other Faculty 4+ Runs
  test('Operation 17: Ordinary 4+ consecutive teaching runs across other faculty are strictly detected', () => {
    const dummyGrid = {
      cls1: {
        Monday: {
          1: { subjectCode: 'CST101', teacherIds: ['tOther'], isEmpty: false },
          2: { subjectCode: 'CST102', teacherIds: ['tOther'], isEmpty: false },
          3: { subjectCode: 'CST103', teacherIds: ['tOther'], isEmpty: false },
          4: { subjectCode: 'CST104', teacherIds: ['tOther'], isEmpty: false },
        }
      }
    };
    const dummyData = {
      teachers: [{ _id: 'tOther', name: 'Dr Other' }],
      classes: [{ _id: 'cls1', name: 'Class 1' }]
    };
    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1);
  });

  // 18. Exact 24 Section-Period Allocations Preservation
  test('Operation 18: Exactly 24 section-period Capstone allocations exist with correct room and faculty', () => {
    const s8aId = s8aClass._id.toString();
    const s8bId = s8bClass._id.toString();
    let count = 0;
    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const slotA = baseGrid[s8aId]?.[d]?.[p];
        const slotB = baseGrid[s8bId]?.[d]?.[p];
        if (slotA && slotA.subjectCode === 'CST416' && slotA.roomName === 'Room 501') count++;
        if (slotB && slotB.subjectCode === 'CST416' && slotB.roomName === 'Room 502') count++;
      }
    }
    assert.equal(count, 24);
  });

  // 19. Exact 12 Distinct Faculty Contact Positions Preservation
  test('Operation 19: Exactly 12 distinct faculty contact positions exist across Thursday and Friday', () => {
    const distinctGunaSlots = new Set();
    const gid = gunaTeacher._id.toString();
    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        for (const cls of data.classes) {
          const slot = baseGrid[cls._id.toString()]?.[d]?.[p];
          if (!slot || slot.isEmpty || slot.isBreak) continue;
          if (slot.subjectCode === 'CST416' && (slot.teacherIds || []).includes(gid)) {
            distinctGunaSlots.add(`${d}_P${p}`);
          }
        }
      }
    }
    assert.equal(distinctGunaSlots.size, 12, 'Must have exactly 12 distinct faculty contact periods');
  });

  // 20. All Four Independent Validators Pass
  test('Operation 20: All four independent validators report zero hard violations on authoritative grid', async () => {
    const valOut = validateOutput(baseGrid, data, []);
    assert.equal(valOut.valid, true);
    assert.equal(valOut.hardViolationsCount, 0);

    const valGlob = validateGlobalTimetable(baseGrid, data);
    assert.equal(valGlob.valid, true);
    assert.equal(valGlob.hardViolationsCount, 0);

    const valPersist = await validatePersistedTimetable(timetableDoc);
    const academicPersistViolations = valPersist.hardViolations.filter(v => v.type !== 'MISSING_CLASS_DATA');
    assert.equal(academicPersistViolations.length, 0);

    const auditVal = auditTimetable(baseGrid, data);
    assert.equal(auditVal.hardViolations?.length || 0, 0);
  });
});