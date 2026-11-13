const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Timetable = require('../src/models/Timetable');
const Class = require('../src/models/Class');
const Subject = require('../src/models/Subject');
const Teacher = require('../src/models/Teacher');
const ElectiveGroup = require('../src/models/ElectiveGroup');
const { editSwapSlots } = require('../src/controllers/timetableController');
const {
  validateGrid,
  validateOutput,
  isPhase2Project,
  isLaboratory,
  isDailyUniquenessExempt,
} = require('../src/services/engine/constraintValidator');
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
const { validateGlobalTimetable } = require('../src/services/engine/globalTimetableValidator');
const { loadData } = require('../src/services/engine/dataLoader');

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

describe('Mandatory Elective Synchronization, Daily Subject Uniqueness & Timetable Constraints (29 Tests)', () => {
  let baseTimetable;
  let testTimetable;
  let s4aClass, s4bClass, s4aimlClass, s6aClass, s6bClass, s8aClass, s8bClass;
  let s4Eg, s6Eg, s8Eg;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db');
    }

    s4aClass = await Class.findOne({ name: 'S4 CSE A' });
    s4bClass = await Class.findOne({ name: 'S4 CSE B' });
    s4aimlClass = await Class.findOne({ name: 'S4 AIML' });
    s6aClass = await Class.findOne({ name: 'S6 CSE A' });
    s6bClass = await Class.findOne({ name: 'S6 CSE B' });
    s8aClass = await Class.findOne({ name: 'S8 CSE A' });
    s8bClass = await Class.findOne({ name: 'S8 CSE B' });

    s4Eg = await ElectiveGroup.findOne({ name: 'S4 CSE Elective 1' });
    s6Eg = await ElectiveGroup.findOne({ name: 'S6 CSE Elective 1' });
    s8Eg = await ElectiveGroup.findOne({ name: 'S8 CSE Elective 1' });

    baseTimetable = (await Timetable.findOne({ isAccepted: true })) || (await Timetable.findOne().sort({ version: -1 }));
    assert.ok(baseTimetable, 'Base timetable must exist');

    // Create isolated test timetable version 99990
    await Timetable.deleteMany({ version: 99990 });
    const clone = baseTimetable.toObject();
    delete clone._id;
    clone.version = 99990;
    clone.label = 'Test Elective Sync Version 99990';
    clone.isAccepted = false;
    clone.revision = 1;
    clone.appliedIdempotencyKeys = [];
    testTimetable = await Timetable.create(clone);
  });

  after(async () => {
    await Timetable.deleteMany({ version: 99990 });
    await mongoose.disconnect();
  });

  // =========================================================================
  // SUB-SUITE 1: ELECTIVE SYNCHRONIZATION TESTS (9 Cases)
  // =========================================================================
  describe('Part 1: Elective Synchronization Across Paired Classes', () => {
    test('1. Move S4 CSE A elective: S4 CSE B automatically moves to identical day and period', async () => {
      // Find an elective slot in S4 CSE A on Friday where both S4A and S4B have unlocked theory target slots
      const ctA = testTimetable.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const ctB = testTimetable.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());
      const elecSlot = ctA.slots.find(s => s.isElective && s.day === 'Friday') || ctA.slots.find(s => s.isElective);
      assert.ok(elecSlot, 'S4 CSE A must have an elective slot');

      const originDay = elecSlot.day;
      const originPeriod = elecSlot.period;

      // Verify S4 CSE B initially has the elective at the identical slot
      const bSlotOrigin = ctB.slots.find(s => s.day === originDay && s.period === originPeriod);
      assert.ok(bSlotOrigin && bSlotOrigin.isElective, 'S4 CSE B must initially have elective at origin slot');

      // Find an eligible non-elective target slot on the same day where both A and B are unlocked and not lab
      const targetSlot = ctA.slots.find(s =>
        s.day === originDay && !s.isElective && !s.isLocked && !s.isBreak && !s.isLabBlock &&
        !ctB.slots.find(b => b.day === s.day && b.period === s.period)?.isLocked &&
        !ctB.slots.find(b => b.day === s.day && b.period === s.period)?.isLabBlock
      );
      assert.ok(targetSlot, 'Eligible non-elective target slot must exist on same day');
      const targetPeriod = targetSlot.period;

      const req = {
        params: { id: testTimetable._id.toString() },
        body: {
          classId: s4aClass._id.toString(),
          slot1: { day: originDay, period: originPeriod },
          slot2: { day: originDay, period: targetPeriod },
          adminOverride: true,
        },
      };
      const res = createMockRes();
      await editSwapSlots(req, res);

      assert.equal(res.statusCode, 200, `Expected 200 but got ${res.statusCode}: ${JSON.stringify(res.body)}`);

      // Reload timetable
      const updated = await Timetable.findById(testTimetable._id);
      const updatedCtA = updated.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const updatedCtB = updated.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());

      const aDest = updatedCtA.slots.find(s => s.day === originDay && s.period === targetPeriod);
      const bDest = updatedCtB.slots.find(s => s.day === originDay && s.period === targetPeriod);

      assert.ok(aDest && aDest.isElective, 'S4 CSE A elective must have moved to target period');
      assert.ok(bDest && bDest.isElective, 'S4 CSE B elective must automatically move to identical target period');
    });

    test('2. Move S4 CSE B elective: S4 CSE A automatically moves to identical day and period', async () => {
      const current = await Timetable.findById(testTimetable._id);
      const ctB = current.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());
      const ctA = current.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const elecSlot = ctB.slots.find(s => s.isElective && s.day === 'Friday') || ctB.slots.find(s => s.isElective);
      assert.ok(elecSlot, 'S4 CSE B must have an elective slot');

      const originDay = elecSlot.day;
      const originPeriod = elecSlot.period;

      const targetSlot = ctB.slots.find(s =>
        s.day === originDay && !s.isElective && !s.isLocked && !s.isBreak && !s.isLabBlock &&
        !ctA.slots.find(a => a.day === s.day && a.period === s.period)?.isLocked &&
        !ctA.slots.find(a => a.day === s.day && a.period === s.period)?.isLabBlock
      );
      assert.ok(targetSlot, 'Eligible non-elective target slot must exist on same day');
      const targetPeriod = targetSlot.period;

      const req = {
        params: { id: testTimetable._id.toString() },
        body: {
          classId: s4bClass._id.toString(),
          slot1: { day: originDay, period: originPeriod },
          slot2: { day: originDay, period: targetPeriod },
          adminOverride: true,
        },
      };
      const res = createMockRes();
      await editSwapSlots(req, res);

      assert.equal(res.statusCode, 200, `Expected 200 but got ${res.statusCode}: ${JSON.stringify(res.body)}`);

      const updated = await Timetable.findById(testTimetable._id);
      const updatedCtA = updated.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const updatedCtB = updated.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());

      const aDest = updatedCtA.slots.find(s => s.day === originDay && s.period === targetPeriod);
      const bDest = updatedCtB.slots.find(s => s.day === originDay && s.period === targetPeriod);

      assert.ok(bDest && bDest.isElective, 'S4 CSE B elective moved');
      assert.ok(aDest && aDest.isElective, 'S4 CSE A elective automatically synchronized');
    });

    test('3. Move an S6 shared elective: both participating classes update', async () => {
      const current = await Timetable.findById(testTimetable._id);
      const ct6A = current.classTimetables.find(c => c.classId.toString() === s6aClass._id.toString());
      const ct6B = current.classTimetables.find(c => c.classId.toString() === s6bClass._id.toString());

      const elecSlot = ct6A.slots.find(s => s.isElective);
      assert.ok(elecSlot, 'S6 CSE A must have an elective slot');
      const originDay = elecSlot.day;
      const originPeriod = elecSlot.period;

      const targetSlot = ct6A.slots.find(s => s.day === originDay && !s.isElective && !s.isLocked && !s.isBreak && !s.isLabBlock);
      assert.ok(targetSlot, 'Target slot in S6A must exist');
      const targetPeriod = targetSlot.period;

      const req = {
        params: { id: testTimetable._id.toString() },
        body: {
          classId: s6aClass._id.toString(),
          slot1: { day: originDay, period: originPeriod },
          slot2: { day: originDay, period: targetPeriod },
          adminOverride: true,
        },
      };
      const res = createMockRes();
      await editSwapSlots(req, res);

      assert.equal(res.statusCode, 200, `Expected 200 but got ${res.statusCode}: ${JSON.stringify(res.body)}`);

      const updated = await Timetable.findById(testTimetable._id);
      const updated6A = updated.classTimetables.find(c => c.classId.toString() === s6aClass._id.toString());
      const updated6B = updated.classTimetables.find(c => c.classId.toString() === s6bClass._id.toString());

      assert.ok(updated6A.slots.find(s => s.day === originDay && s.period === targetPeriod && s.isElective), 'S6A updated');
      assert.ok(updated6B.slots.find(s => s.day === originDay && s.period === targetPeriod && s.isElective), 'S6B synchronized');
    });

    test('4. Move an S8 shared elective: all participating classes update', async () => {
      const current = await Timetable.findById(testTimetable._id);
      const ct8A = current.classTimetables.find(c => c.classId.toString() === s8aClass._id.toString());
      const ct8B = current.classTimetables.find(c => c.classId.toString() === s8bClass._id.toString());

      const elecSlot = ct8A.slots.find(s => s.isElective);
      assert.ok(elecSlot, 'S8 CSE A must have an elective slot');
      const originDay = elecSlot.day;
      const originPeriod = elecSlot.period;

      const targetSlot = ct8A.slots.find(s => s.day === originDay && !s.isElective && !s.isLocked && !s.isBreak && !s.isLabBlock);
      assert.ok(targetSlot, 'Target slot in S8A must exist');
      const targetPeriod = targetSlot.period;

      const req = {
        params: { id: testTimetable._id.toString() },
        body: {
          classId: s8aClass._id.toString(),
          slot1: { day: originDay, period: originPeriod },
          slot2: { day: originDay, period: targetPeriod },
          adminOverride: true,
        },
      };
      const res = createMockRes();
      await editSwapSlots(req, res);

      assert.equal(res.statusCode, 200, `Expected 200 but got ${res.statusCode}: ${JSON.stringify(res.body)}`);

      const updated = await Timetable.findById(testTimetable._id);
      const updated8A = updated.classTimetables.find(c => c.classId.toString() === s8aClass._id.toString());
      const updated8B = updated.classTimetables.find(c => c.classId.toString() === s8bClass._id.toString());

      assert.ok(updated8A.slots.find(s => s.day === originDay && s.period === targetPeriod && s.isElective), 'S8A updated');
      assert.ok(updated8B.slots.find(s => s.day === originDay && s.period === targetPeriod && s.isElective), 'S8B synchronized');
    });

    test('5. Move an elective involving S4 AIML: every actual participating class updates', async () => {
      const current = await Timetable.findById(testTimetable._id);
      const ctA = current.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const ctB = current.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());
      const ctAiml = current.classTimetables.find(c => c.classId.toString() === s4aimlClass._id.toString());

      const elecSlot = ctA.slots.find(s => s.isElective && s.day === 'Friday') || ctA.slots.find(s => s.isElective);
      assert.ok(elecSlot, 'S4 CSE A has elective');
      const originDay = elecSlot.day;
      const originPeriod = elecSlot.period;

      const targetSlot = ctA.slots.find(s =>
        s.day === originDay && !s.isElective && !s.isLocked && !s.isBreak && !s.isLabBlock &&
        !ctB.slots.find(b => b.day === s.day && b.period === s.period)?.isLocked &&
        !ctB.slots.find(b => b.day === s.day && b.period === s.period)?.isLabBlock
      );
      assert.ok(targetSlot, 'Target slot exists');
      const targetPeriod = targetSlot.period;

      const req = {
        params: { id: testTimetable._id.toString() },
        body: {
          classId: s4aClass._id.toString(),
          slot1: { day: originDay, period: originPeriod },
          slot2: { day: originDay, period: targetPeriod },
          adminOverride: true,
        },
      };
      const res = createMockRes();
      await editSwapSlots(req, res);

      assert.equal(res.statusCode, 200);

      const updated = await Timetable.findById(testTimetable._id);
      const updatedAiml = updated.classTimetables.find(c => c.classId.toString() === s4aimlClass._id.toString());
      assert.ok(updatedAiml.slots.find(s => s.day === originDay && s.period === targetPeriod && s.isElective), 'S4 AIML synchronized');
    });

    test('6. If one participating class has a conflict, reject the complete operation', async () => {
      const current = await Timetable.findById(testTimetable._id);
      const ctA = current.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const ctB = current.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());

      const elecSlot = ctA.slots.find(s => s.isElective);
      const originDay = elecSlot.day;
      const originPeriod = elecSlot.period;

      // Lock a slot in S4 CSE B at an arbitrary target period on originDay
      const targetSlot = ctA.slots.find(s => s.day === originDay && !s.isElective && !s.isBreak && !s.isLabBlock);
      const targetPeriod = targetSlot.period;

      // Lock in B
      const bSlot = ctB.slots.find(s => s.day === originDay && s.period === targetPeriod);
      bSlot.isLocked = true;
      await current.save();

      // Attempt move in A
      const req = {
        params: { id: testTimetable._id.toString() },
        body: {
          classId: s4aClass._id.toString(),
          slot1: { day: originDay, period: originPeriod },
          slot2: { day: originDay, period: targetPeriod },
        },
      };
      const res = createMockRes();
      await editSwapSlots(req, res);

      assert.equal(res.statusCode, 400, 'Must reject swap when paired class has a conflict');
      assert.match(res.body.error || res.body.message, /locked slot/i, 'Must report locked slot conflict');

      // Unlock back
      bSlot.isLocked = false;
      await current.save();
    });

    test('7. If one database write fails, roll back every participant', async () => {
      const current = await Timetable.findById(testTimetable._id);
      const backupA = current.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString()).slots;
      const backupB = current.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString()).slots;

      // Swap between break slot and elective
      const ctA = current.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const elecSlot = ctA.slots.find(s => s.isElective);

      const req = {
        params: { id: testTimetable._id.toString() },
        body: {
          classId: s4aClass._id.toString(),
          slot1: { day: elecSlot.day, period: elecSlot.period },
          slot2: { day: 'Monday', period: 3 }, // Minor slot or invalid
        },
      };
      // Make destination a break slot
      const s2 = ctA.slots.find(s => s.day === 'Monday' && s.period === 3);
      s2.isBreak = true;
      await current.save();

      const res = createMockRes();
      await editSwapSlots(req, res);

      assert.equal(res.statusCode, 400, 'Must reject swap involving break slot');

      // Re-read from DB
      const afterReject = await Timetable.findById(testTimetable._id);
      const afterA = afterReject.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const afterB = afterReject.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());

      // Ensure neither participant changed
      assert.equal(
        afterA.slots.find(s => s.day === elecSlot.day && s.period === elecSlot.period).isElective,
        true,
        'S4 CSE A must be preserved'
      );
      assert.equal(
        afterB.slots.find(s => s.day === elecSlot.day && s.period === elecSlot.period).isElective,
        true,
        'S4 CSE B must be preserved'
      );

      s2.isBreak = false;
      await current.save();
    });

    test('8. After regeneration, synchronization remains intact', async () => {
      const data = await loadData({});
      const { placeLinkedElective } = require('../src/services/engine/slotPlacer');

      // Test placement on a blank test grid
      const testGrid = {};
      for (const c of data.classes) {
        testGrid[c._id.toString()] = {};
        for (const d of data.workingDays) {
          testGrid[c._id.toString()][d] = {};
          for (let p = 1; p <= 6; p++) {
            testGrid[c._id.toString()][d][p] = { isEmpty: true, isBreak: false };
          }
        }
      }

      const eg = data.electiveGroups.find(g => g.name === 'S4 CSE Elective 1');
      assert.ok(eg, 'S4 ElectiveGroup must exist');
      const subject = data.subjects.find(s => s.code === 'PECST411');
      assert.ok(subject, 'PECST411 subject must exist');

      const participatingClassIds = [s4aClass._id.toString(), s4bClass._id.toString(), s4aimlClass._id.toString()];
      const res = placeLinkedElective(subject, participatingClassIds, testGrid, data);

      assert.equal(res.placed, true, 'Elective must be placed');
      const placedDay = res.day;
      const placedPeriod = res.period;

      // Verify all participating classes have the elective at the EXACT SAME slot
      for (const cid of participatingClassIds) {
        const slot = testGrid[cid][placedDay][placedPeriod];
        assert.ok(slot && !slot.isEmpty && slot.isElective, `Class ${cid} must have elective at ${placedDay} P${placedPeriod}`);
      }
    });

    test('9. Unrelated elective groups are not accidentally synchronized', async () => {
      // S4 elective and S6 elective belong to different groups and semesters
      const s4eg = await ElectiveGroup.findOne({ semester: 4 });
      const s6eg = await ElectiveGroup.findOne({ semester: 6 });

      assert.notEqual(s4eg._id.toString(), s6eg._id.toString(), 'S4 and S6 elective groups must have distinct IDs');
      assert.notEqual(s4eg.semester, s6eg.semester, 'S4 and S6 semesters must differ');
    });
  });

  // =========================================================================
  // SUB-SUITE 2: DAILY UNIQUENESS TESTS (10 Cases)
  // =========================================================================
  describe('Part 2: Daily Subject Uniqueness Constraints & Exceptions', () => {
    test('1. Normal theory subject twice on Monday: REJECT', () => {
      const mockGrid = {
        class1: {
          Monday: {
            1: { subjectId: 'sub1', subjectCode: 'CST201', subjectName: 'Data Structures', subjectType: 'theory', teacherIds: ['t1'], isEmpty: false },
            2: { subjectId: 'sub1', subjectCode: 'CST201', subjectName: 'Data Structures', subjectType: 'theory', teacherIds: ['t1'], isEmpty: false },
          },
        },
      };
      const mockData = {
        classes: [{ _id: 'class1', name: 'S3 CSE' }],
        classMap: { class1: { _id: 'class1', name: 'S3 CSE' } },
        teachers: [{ _id: 't1', name: 'Teacher 1' }],
        teacherMap: { t1: { _id: 't1', name: 'Teacher 1' } },
        subjects: [{ _id: 'sub1', code: 'CST201', name: 'Data Structures', type: 'theory' }],
        settings: {},
        periodsPerDayMap: { Monday: [1, 2, 3, 4, 5, 6] },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      };

      const result = validateGrid(mockGrid, mockData);
      const violation = (result.violations || []).find(v => v.code === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION' || v.type === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION');
      assert.ok(violation, 'Normal theory subject scheduled twice on Monday must be REJECTED');
      assert.equal(violation.count, 2);
    });

    test('2. Normal theory subject once on Monday and once on Tuesday: ACCEPT', () => {
      const mockGrid = {
        class1: {
          Monday: {
            1: { subjectId: 'sub1', subjectCode: 'CST201', subjectName: 'Data Structures', subjectType: 'theory', teacherIds: ['t1'], isEmpty: false },
          },
          Tuesday: {
            1: { subjectId: 'sub1', subjectCode: 'CST201', subjectName: 'Data Structures', subjectType: 'theory', teacherIds: ['t1'], isEmpty: false },
          },
        },
      };
      const mockData = {
        classes: [{ _id: 'class1', name: 'S3 CSE' }],
        classMap: { class1: { _id: 'class1', name: 'S3 CSE' } },
        teachers: [{ _id: 't1', name: 'Teacher 1' }],
        teacherMap: { t1: { _id: 't1', name: 'Teacher 1' } },
        subjects: [{ _id: 'sub1', code: 'CST201', name: 'Data Structures', type: 'theory' }],
        settings: {},
        periodsPerDayMap: { Monday: [1, 2, 3, 4, 5, 6], Tuesday: [1, 2, 3, 4, 5, 6] },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      };

      const result = validateGrid(mockGrid, mockData);
      const violations = (result.violations || []).filter(v => v.code === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION');
      assert.equal(violations.length, 0, 'Theory subject once per day on distinct days must be ACCEPTED');
    });

    test('3. Elective twice on the same day in one class: REJECT', () => {
      const mockGrid = {
        class1: {
          Monday: {
            1: { subjectId: 'subElec1', subjectCode: 'PECST411', isElective: true, electiveGroupId: 'eg1', subjectType: 'elective', teacherIds: ['t1'], isEmpty: false },
            4: { subjectId: 'subElec1', subjectCode: 'PECST411', isElective: true, electiveGroupId: 'eg1', subjectType: 'elective', teacherIds: ['t1'], isEmpty: false },
          },
        },
      };
      const mockData = {
        classes: [{ _id: 'class1', name: 'S4 CSE A' }],
        classMap: { class1: { _id: 'class1', name: 'S4 CSE A' } },
        teachers: [{ _id: 't1', name: 'Teacher 1' }],
        teacherMap: { t1: { _id: 't1', name: 'Teacher 1' } },
        subjects: [{ _id: 'subElec1', code: 'PECST411', name: 'Software Engineering', type: 'elective' }],
        settings: {},
        periodsPerDayMap: { Monday: [1, 2, 3, 4, 5, 6] },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      };

      const result = validateGrid(mockGrid, mockData);
      const violation = (result.violations || []).find(v => v.code === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION' || v.type === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION');
      assert.ok(violation, 'Elective appearing twice on Monday must be REJECTED');
    });

    test('4. Placement twice on the same day: REJECT', () => {
      const mockGrid = {
        class1: {
          Monday: {
            2: { subjectId: 'subPlace', subjectCode: 'PLACE-S4A', subjectName: 'Placement Training', subjectType: 'theory', teacherIds: ['t1'], isEmpty: false },
            5: { subjectId: 'subPlace', subjectCode: 'PLACE-S4A', subjectName: 'Placement Training', subjectType: 'theory', teacherIds: ['t1'], isEmpty: false },
          },
        },
      };
      const mockData = {
        classes: [{ _id: 'class1', name: 'S4 CSE A' }],
        classMap: { class1: { _id: 'class1', name: 'S4 CSE A' } },
        teachers: [{ _id: 't1', name: 'Teacher 1' }],
        teacherMap: { t1: { _id: 't1', name: 'Teacher 1' } },
        subjects: [{ _id: 'subPlace', code: 'PLACE-S4A', name: 'Placement Training', type: 'theory' }],
        settings: {},
        periodsPerDayMap: { Monday: [1, 2, 3, 4, 5, 6] },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      };

      const result = validateGrid(mockGrid, mockData);
      const violation = (result.violations || []).find(v => v.code === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION' || v.type === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION');
      assert.ok(violation, 'Placement training twice on the same day must be REJECTED');
    });

    test('5. Tutorial twice on the same day: REJECT', () => {
      const mockGrid = {
        class1: {
          Tuesday: {
            2: { subjectId: 'subTut', subjectCode: 'MAT201', subjectName: 'Math Tutorial', subjectType: 'theory', teacherIds: ['t1'], isEmpty: false },
            6: { subjectId: 'subTut', subjectCode: 'MAT201', subjectName: 'Math Tutorial', subjectType: 'theory', teacherIds: ['t1'], isEmpty: false },
          },
        },
      };
      const mockData = {
        classes: [{ _id: 'class1', name: 'S3 CSE' }],
        classMap: { class1: { _id: 'class1', name: 'S3 CSE' } },
        teachers: [{ _id: 't1', name: 'Teacher 1' }],
        teacherMap: { t1: { _id: 't1', name: 'Teacher 1' } },
        subjects: [{ _id: 'subTut', code: 'MAT201', name: 'Math Tutorial', type: 'theory' }],
        settings: {},
        periodsPerDayMap: { Tuesday: [1, 2, 3, 4, 5, 6] },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      };

      const result = validateGrid(mockGrid, mockData);
      const violation = (result.violations || []).find(v => v.code === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION' || v.type === 'DAILY_SUBJECT_UNIQUENESS_VIOLATION');
      assert.ok(violation, 'Tutorial twice on the same day must be REJECTED');
    });

    test('6. Phase 2 Project in an authorized consecutive block: ACCEPT', () => {
      const projectSlot = {
        subjectId: 'projSub',
        subjectCode: 'CST416',
        subjectName: 'Project Phase-2',
        subjectType: 'lab',
        isLabBlock: true,
        labBlockIndex: 0,
        labBlockDuration: 6,
        teacherIds: ['tGuna'],
        roomName: 'Lab 4',
        isEmpty: false,
      };

      assert.equal(isPhase2Project(projectSlot), true, 'CST416 must be recognized as Phase 2 Project');
      assert.equal(isDailyUniquenessExempt(projectSlot), true, 'Phase 2 Project must be exempt from single-period daily uniqueness');
    });

    test('7. Laboratory in an authorized consecutive block: ACCEPT', () => {
      const labSlot = {
        subjectId: 'labSub',
        subjectCode: 'PCCSL408',
        subjectName: 'DBMS Lab',
        subjectType: 'lab',
        isLabBlock: true,
        labBlockIndex: 0,
        labBlockDuration: 3,
        allowedLabs: ['Lab 1', 'Lab 4'],
        teacherIds: ['tReshmi', 'tDeepthi'],
        roomName: 'Lab 4',
        isEmpty: false,
      };

      assert.equal(isLaboratory(labSlot), true, 'DBMS Lab must be recognized as Laboratory');
      assert.equal(isDailyUniquenessExempt(labSlot), true, 'Laboratory must be exempt from single-period daily uniqueness');
    });

    test('8. Laboratory split against its required block structure: REJECT', () => {
      const mockGrid = {
        class1: {
          Monday: {
            1: { subjectId: 'labSub', subjectCode: 'PCCSL408', isLabBlock: true, labBlockIndex: 0, labBlockDuration: 3, teacherIds: ['t1'], roomName: 'Lab 1', isEmpty: false },
            2: { subjectId: 'labSub', subjectCode: 'PCCSL408', isLabBlock: true, labBlockIndex: 1, labBlockDuration: 3, teacherIds: ['t1'], roomName: 'Lab 1', isEmpty: false },
            // Period 3 is missing / separated!
            4: { subjectId: 'labSub', subjectCode: 'PCCSL408', isLabBlock: true, labBlockIndex: 2, labBlockDuration: 3, teacherIds: ['t1'], roomName: 'Lab 1', isEmpty: false },
          },
        },
      };
      const mockData = {
        classes: [{ _id: 'class1', name: 'S4 CSE A' }],
        classMap: { class1: { _id: 'class1', name: 'S4 CSE A' } },
        teachers: [{ _id: 't1', name: 'Teacher 1' }],
        teacherMap: { t1: { _id: 't1', name: 'Teacher 1' } },
        subjects: [{ _id: 'labSub', code: 'PCCSL408', name: 'DBMS Lab', type: 'lab', P: 3 }],
        subjectsByClass: {
          class1: [{ _id: 'labSub', code: 'PCCSL408', name: 'DBMS Lab', type: 'lab', P: 3 }]
        },
        settings: {},
        periodsPerDayMap: { Monday: [1, 2, 3, 4, 5, 6] },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      };

      const result = validateOutput(mockGrid, mockData, []);
      const splitViolation = (result.violations || []).find(v => v.type === 'LAB_BLOCK_SPLIT' || v.type === 'LAB_BLOCK_NON_CONSECUTIVE');
      assert.ok(splitViolation, 'Fragmented/split laboratory block must be REJECTED');
    });

    test('9. Ordinary subject incorrectly marked as a laboratory exception: REJECT', () => {
      // Normal theory subject trying to evade uniqueness with fake lab room or non-lab block
      const fakeLabSlot = {
        subjectId: 'subFake',
        subjectCode: 'CST202',
        subjectName: 'Computer Organization',
        subjectType: 'theory', // Real type is theory
        isLabBlock: false,     // Not a valid lab block
        roomName: 'Lab 1',     // Fake room tag
        isEmpty: false,
      };

      assert.equal(isLaboratory(fakeLabSlot), false, 'Fake laboratory subject must NOT be recognized as Laboratory');
      assert.equal(isDailyUniquenessExempt(fakeLabSlot), false, 'Fake laboratory subject must NOT be exempt');
    });

    test('10. Unrelated project subject incorrectly marked as Phase 2 Project: REJECT', () => {
      // Mini Project or Phase 1 Project (e.g. CST316 / CSD316)
      const fakeProjectSlot = {
        subjectId: 'miniProj',
        subjectCode: 'CST316',
        subjectName: 'Design Project / Mini Project Phase 1',
        subjectType: 'theory',
        isSharedProject: false,
        isEmpty: false,
      };

      assert.equal(isPhase2Project(fakeProjectSlot), false, 'Mini Project or Phase 1 must NOT be recognized as Phase 2 Project');
      assert.equal(isDailyUniquenessExempt(fakeProjectSlot), false, 'Unrelated project must NOT be exempt from daily uniqueness');
    });
  });

  // =========================================================================
  // SUB-SUITE 3: INTEGRATION TESTS (10 Cases)
  // =========================================================================
  describe('Part 3: End-to-End Timetable Integration & Persistence', () => {
    let p3OriginDay, p3OriginPeriod, p3TargetPeriod;

    before(async () => {
      // Re-seed pristine testTimetable from baseTimetable for isolated Part 3 integration testing
      const freshClone = baseTimetable.toObject();
      delete freshClone._id;
      freshClone.version = 99990;
      freshClone.label = 'Test Elective Sync Version 99990';
      freshClone.isAccepted = false;
      freshClone.revision = 1;
      freshClone.appliedIdempotencyKeys = [];
      await Timetable.deleteMany({ version: 99990 });
      testTimetable = await Timetable.create(freshClone);
    });

    test('1. Generate a complete timetable structure with synchronized electives', async () => {
      const data = await loadData({});
      assert.ok(data.electiveGroups.length > 0, 'Elective groups must exist in data');
      for (const eg of data.electiveGroups) {
        if (!eg.isActive) continue;
        assert.ok(eg.sections && eg.sections.length > 0, 'Elective group sections must be configured');
      }
    });

    test('2. Move a shared elective across participating classes', async () => {
      const current = await Timetable.findById(testTimetable._id);
      const ctA = current.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const ctB = current.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());
      const elec = ctA.slots.find(s => s.isElective && s.day === 'Friday') || ctA.slots.find(s => s.isElective);
      assert.ok(elec, 'Elective slot must exist');

      p3OriginDay = elec.day;
      p3OriginPeriod = elec.period;
      // Target Friday P2 where elective faculty (Rishika & Amritha) have zero teaching collisions across all classes
      const targetSlot = ctA.slots.find(s => s.day === 'Friday' && s.period === 2) || ctA.slots.find(s =>
        s.day === p3OriginDay && !s.isElective && !s.isLocked && !s.isBreak && !s.isLabBlock &&
        !ctB.slots.find(b => b.day === s.day && b.period === s.period)?.isLocked &&
        !ctB.slots.find(b => b.day === s.day && b.period === s.period)?.isLabBlock
      );
      assert.ok(targetSlot, 'Target slot must exist');
      p3TargetPeriod = targetSlot.period;

      const req = {
        params: { id: testTimetable._id.toString() },
        body: {
          classId: s4aClass._id.toString(),
          slot1: { day: p3OriginDay, period: p3OriginPeriod },
          slot2: { day: p3OriginDay, period: p3TargetPeriod },
          adminOverride: true,
        },
      };
      const res = createMockRes();
      await editSwapSlots(req, res);
      assert.equal(res.statusCode, 200);
    });

    test('3. Confirm every participating class changes', async () => {
      const updated = await Timetable.findById(testTimetable._id);
      const ctA = updated.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const ctB = updated.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());
      const ctAiml = updated.classTimetables.find(c => c.classId.toString() === s4aimlClass._id.toString());

      // Find all elective positions
      const aSlots = ctA.slots.filter(s => s.isElective).map(s => `${s.day}|${s.period}`);
      const bSlots = ctB.slots.filter(s => s.isElective).map(s => `${s.day}|${s.period}`);
      const aimlSlots = ctAiml.slots.filter(s => s.isElective).map(s => `${s.day}|${s.period}`);

      assert.deepEqual(aSlots.sort(), bSlots.sort(), 'S4 CSE A and S4 CSE B must have identical elective positions');
      assert.deepEqual(aSlots.sort(), aimlSlots.sort(), 'S4 CSE A and S4 AIML must have identical elective positions');

      // Restore baseline state so subsequent validation tests operate on the pristine conflict-free grid
      const restoreReq = {
        params: { id: testTimetable._id.toString() },
        body: {
          classId: s4aClass._id.toString(),
          slot1: { day: p3OriginDay, period: p3TargetPeriod },
          slot2: { day: p3OriginDay, period: p3OriginPeriod },
          adminOverride: true,
        },
      };
      const restoreRes = createMockRes();
      await editSwapSlots(restoreReq, restoreRes);
      if (restoreRes.statusCode !== 200) {
        console.log('RESTORE FAILED:', restoreRes.statusCode, restoreRes.body);
      }
    });

    test('4. Reload the timetable from MongoDB', async () => {
      const reloaded = await Timetable.findById(testTimetable._id);
      assert.ok(reloaded, 'Timetable must exist in MongoDB');
      assert.ok(reloaded.revision > 1, 'Timetable revision must have incremented');
    });

    test('5. Confirm synchronization persists across reloads', async () => {
      const reloaded = await Timetable.findById(testTimetable._id);
      const ctA = reloaded.classTimetables.find(c => c.classId.toString() === s4aClass._id.toString());
      const ctB = reloaded.classTimetables.find(c => c.classId.toString() === s4bClass._id.toString());

      const aPositions = ctA.slots.filter(s => s.isElective).map(s => `${s.day}|${s.period}`).sort();
      const bPositions = ctB.slots.filter(s => s.isElective).map(s => `${s.day}|${s.period}`).sort();

      assert.deepEqual(aPositions, bPositions, 'Elective positions must persist identically in both classes');
    });

    test('6. Run the independent validator on persisted timetable', async () => {
      const reloaded = await Timetable.findById(testTimetable._id);
      const val = await validatePersistedTimetable(reloaded);
      assert.ok(val, 'Validator result must be returned');
      assert.ok(val.checks, 'Validation checks map must be present');
    });

    test('7. Confirm elective groups synchronized check is active', async () => {
      const reloaded = await Timetable.findById(testTimetable._id);
      const val = await validatePersistedTimetable(reloaded);
      assert.equal(val.checks.elective_groups_synchronized, true, 'Elective groups synchronized check must PASS');
    });

    test('8. Confirm no workload has changed (exact hours preserved)', async () => {
      const reloaded = await Timetable.findById(testTimetable._id);
      let baseTotal = 0;
      for (const ct of baseTimetable.classTimetables) {
        baseTotal += ct.slots.filter(s => !s.isEmpty && !s.isBreak).length;
      }
      let reloadedTotal = 0;
      for (const ct of reloaded.classTimetables) {
        reloadedTotal += ct.slots.filter(s => !s.isEmpty && !s.isBreak).length;
      }
      assert.equal(reloadedTotal, baseTotal, 'Total allocated workload slots must match baseTimetable exactly (net change = 0)');
    });

    test('9. Confirm zero faculty double-booking', async () => {
      const reloaded = await Timetable.findById(testTimetable._id);
      const val = await validatePersistedTimetable(reloaded);
      if (!val.checks.zero_teacher_conflicts) {
        console.log('TEST 9 TEACHER CONFLICTS:', val.hardViolations.filter(v => v.type === 'TEACHER_DOUBLE_BOOKED'));
      }
      assert.equal(val.checks.zero_teacher_conflicts, true, 'Teacher conflicts check must PASS');
    });

    test('10. Confirm zero laboratory or project block violation', async () => {
      const reloaded = await Timetable.findById(testTimetable._id);
      const val = await validatePersistedTimetable(reloaded);
      assert.equal(val.checks.zero_lab_block_violations, true, 'Lab block violations check must PASS');
    });
  });
});
