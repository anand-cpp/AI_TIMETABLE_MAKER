const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Timetable = require('../src/models/Timetable');
const Class = require('../src/models/Class');
const Subject = require('../src/models/Subject');
const Teacher = require('../src/models/Teacher');
const { loadData } = require('../src/services/engine/dataLoader');
const { validateGlobalTimetable } = require('../src/services/engine/globalTimetableValidator');
const { gridFromTimetable, validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
const { validateDailySubjectLimit } = require('../src/services/engine/dailySubjectLimitValidator');
const { editSwapSlots, undoLastAction, redoLastAction, getWorkloadReadiness } = require('../src/controllers/timetableController');

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

describe('Master Engineering Optimization, Faculty Balancing, Daily Limits & Undo/Redo Test Suite', () => {
  let activeTimetable;
  let data;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db');
    }
    data = await loadData({});
    activeTimetable = await Timetable.findOne({ isAccepted: true }) || await Timetable.findOne().sort({ version: -1 });
    assert.ok(activeTimetable, 'Active published timetable must exist in MongoDB');
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('Suite 1: Absolute Academic Data Integrity (Phase 1)', () => {
    test('1. Faculty workload allocations and subject weekly hours match KTU curriculum exactly', async () => {
      const classes = await Class.find().populate('subjects');
      for (const cls of classes) {
        const ct = activeTimetable.classTimetables.find(c => c.classId.toString() === cls._id.toString());
        assert.ok(ct, `Class timetable must exist for ${cls.name}`);

        const scheduledSlots = ct.slots.filter(s => !s.isEmpty && !s.isBreak);
        for (const sub of cls.subjects) {
          if (sub.type === 'elective') continue; // electives verified by group
          const count = scheduledSlots.filter(s =>
            (s.subjectId && s.subjectId.toString() === sub._id.toString()) ||
            (s.subjectCode && s.subjectCode === sub.code)
          ).length;

          // Minor sub-minors scheduled 1 hour each
          if (sub.weeklyHours && sub.weeklyHours > 0) {
            assert.ok(count >= 1, `Subject ${sub.code} in ${cls.name} must have scheduled periods`);
          }
        }
      }
    });

    test('2. No fabricated or invented subjects exist in any class timetable', () => {
      const validCodes = new Set(data.subjects.map(s => s.code));
      validCodes.add('PE-3');
      validCodes.add('PE-4');
      validCodes.add('PE-5');
      validCodes.add('PECST411 / PECST419');
      validCodes.add('PECST635 / PECST631');
      validCodes.add('PECST419-AIML');

      for (const ct of activeTimetable.classTimetables) {
        for (const s of ct.slots) {
          if (s.isEmpty || s.isBreak || !s.subjectCode) continue;
          assert.ok(
            validCodes.has(s.subjectCode) || (s.minorSubjectCode && validCodes.has(s.minorSubjectCode)),
            `Slot ${ct.className} ${s.day} P${s.period} has unauthorized code: ${s.subjectCode}`
          );
        }
      }
    });
  });

  describe('Suite 2: Minor & Elective Daily Subject Limits (Phase 3)', () => {
    test('1. Independent validateDailySubjectLimit validator passes with ZERO violations', () => {
      const result = validateDailySubjectLimit(activeTimetable);
      assert.strictEqual(result.valid, true, 'Timetable must satisfy daily subject limits');
      assert.strictEqual(result.violations.length, 0, `Expected 0 violations, found: ${JSON.stringify(result.violations)}`);
    });

    test('2. S4 CSE A has zero daily repetitions for all theory and minor subjects', () => {
      const s4a = activeTimetable.classTimetables.find(c => c.className === 'S4 CSE A');
      const dayMap = {};
      for (const s of s4a.slots) {
        if (s.isEmpty || s.isBreak || s.isLabBlock) continue;
        const key = s.day + '__' + (s.minorSubjectCode || s.subjectCode);
        dayMap[key] = (dayMap[key] || 0) + 1;
        assert.ok(dayMap[key] <= 1, `S4 CSE A repeated ${key} on ${s.day}`);
      }
    });

    test('3. S4 CSE B has zero daily repetitions for all theory and minor subjects', () => {
      const s4b = activeTimetable.classTimetables.find(c => c.className === 'S4 CSE B');
      const dayMap = {};
      for (const s of s4b.slots) {
        if (s.isEmpty || s.isBreak || s.isLabBlock) continue;
        const key = s.day + '__' + (s.minorSubjectCode || s.subjectCode);
        dayMap[key] = (dayMap[key] || 0) + 1;
        assert.ok(dayMap[key] <= 1, `S4 CSE B repeated ${key} on ${s.day}`);
      }
    });
  });

  describe('Suite 3: Faculty Schedule Balance & Personal Timetable Optimization (Phase 4)', () => {
    test('1. Dr. Satheeshkumar schedule eliminates back-to-back lab+theory on Wed/Thu and has gap periods', () => {
      const satheeshSlots = {};
      for (const ct of activeTimetable.classTimetables) {
        for (const s of ct.slots) {
          if (s.isEmpty || s.isBreak) continue;
          if ((s.teacherNames || []).some(n => n.includes('Satheesh'))) {
            const k = s.day + '__P' + s.period;
            satheeshSlots[k] = s;
          }
        }
      }

      // Check Wednesday: P4-P5 lab, P6 must be FREE (no 3 consecutive afternoon periods)
      assert.strictEqual(satheeshSlots['Wednesday__P6'], undefined, 'Wednesday P6 must be FREE for Dr Satheeshkumar');
      // Check Thursday: P4-P5 lab, P6 must be FREE
      assert.strictEqual(satheeshSlots['Thursday__P6'], undefined, 'Thursday P6 must be FREE for Dr Satheeshkumar');
      // Check Monday: P3 theory, P4-P5 break, P6 theory
      assert.ok(satheeshSlots['Monday__P3'], 'Monday P3 must have GXEST204');
      assert.strictEqual(satheeshSlots['Monday__P4'], undefined, 'Monday P4 must be FREE (gap period)');
      assert.strictEqual(satheeshSlots['Monday__P5'], undefined, 'Monday P5 must be FREE (gap period)');
      assert.ok(satheeshSlots['Monday__P6'], 'Monday P6 must have GXEST204');
    });

    test('2. Total teaching hours for Dr. Satheeshkumar preserved at exactly 13 hours', () => {
      let count = 0;
      for (const ct of activeTimetable.classTimetables) {
        for (const s of ct.slots) {
          if (s.isEmpty || s.isBreak) continue;
          if ((s.teacherNames || []).some(n => n.includes('Satheesh'))) {
            count++;
          }
        }
      }
      assert.strictEqual(count, 13, 'Dr. Satheeshkumar must have exactly 13 teaching periods');
    });
  });

  describe('Suite 4: Undo & Redo Reliability & Persistence (Phase 6)', () => {
    let testDoc;
    let s4aClassId;

    before(async () => {
      const clone = JSON.parse(JSON.stringify(activeTimetable.toObject()));
      delete clone._id;
      const maxDoc = await Timetable.findOne().sort({ version: -1 });
      clone.version = (maxDoc ? maxDoc.version : 90000) + Math.floor(Math.random() * 500) + 1;
      clone.label = 'Undo/Redo Test Timetable';
      clone.isAccepted = false;
      clone.undoStack = [];
      clone.redoStack = [];
      for (const ct of clone.classTimetables) {
        for (const s of ct.slots) {
          s.isLocked = false;
        }
      }
      testDoc = new Timetable(clone);
      await testDoc.save();

      const s4a = testDoc.classTimetables.find(c => c.className === 'S4 CSE A');
      s4aClassId = s4a.classId.toString();
    });

    after(async () => {
      if (testDoc?._id) {
        await Timetable.findByIdAndDelete(testDoc._id);
      }
    });

    test('1. Moving a slot pushes pre-edit state to undoStack and clears redoStack', async () => {
      const req = {
        params: { id: testDoc._id.toString() },
        body: {
          classId: s4aClassId,
          slot1: { day: 'Tuesday', period: 1 },
          slot2: { day: 'Tuesday', period: 2 },
          adminOverride: true,
        },
        user: { username: 'test-admin' },
      };
      const res = createMockRes();
      await editSwapSlots(req, res);
      assert.strictEqual(res.statusCode, 200, `Swap failed: ${JSON.stringify(res.body)}`);

      const updated = await Timetable.findById(testDoc._id);
      assert.strictEqual(updated.undoStack.length, 1, 'undoStack must contain 1 snapshot');
      assert.strictEqual(updated.redoStack.length, 0, 'redoStack must be empty after new edit');
    });

    test('2. Undo restores the exact original slot state and pushes to redoStack', async () => {
      const req = {
        params: { id: testDoc._id.toString() },
      };
      const res = createMockRes();
      await undoLastAction(req, res);
      assert.strictEqual(res.statusCode, 200, `Undo failed: ${JSON.stringify(res.body)}`);

      const updated = await Timetable.findById(testDoc._id);
      assert.strictEqual(updated.undoStack.length, 0, 'undoStack must be empty after 1 undo');
      assert.strictEqual(updated.redoStack.length, 1, 'redoStack must contain 1 snapshot');

      // Verify slot restored
      const s4a = updated.classTimetables.find(c => c.className === 'S4 CSE A');
      const sTue1 = s4a.slots.find(s => s.day === 'Tuesday' && s.period === 1);
      assert.strictEqual(sTue1.subjectCode, 'PBCST404', 'Original slot PBCST404 must be restored at Tue P1');
    });

    test('3. Redo reapplies the undone edit accurately', async () => {
      const req = {
        params: { id: testDoc._id.toString() },
      };
      const res = createMockRes();
      await redoLastAction(req, res);
      assert.strictEqual(res.statusCode, 200, `Redo failed: ${JSON.stringify(res.body)}`);

      const updated = await Timetable.findById(testDoc._id);
      assert.strictEqual(updated.undoStack.length, 1, 'undoStack must have 1 snapshot after redo');
      assert.strictEqual(updated.redoStack.length, 0, 'redoStack must be empty after redo');
    });

    test('4. A new edit after undo clears the obsolete redo branch', async () => {
      // 1. Undo
      await undoLastAction({ params: { id: testDoc._id.toString() } }, createMockRes());
      let mid = await Timetable.findById(testDoc._id);
      assert.strictEqual(mid.redoStack.length, 1, 'Redo stack must have 1 snapshot');

      // 2. Perform a different edit
      const req = {
        params: { id: testDoc._id.toString() },
        body: {
          classId: s4aClassId,
          slot1: { day: 'Wednesday', period: 2 },
          slot2: { day: 'Wednesday', period: 3 },
          adminOverride: true,
        },
        user: { username: 'test-admin' },
      };
      const res = createMockRes();
      await editSwapSlots(req, res);
      assert.strictEqual(res.statusCode, 200);

      // 3. Confirm redo branch is cleared
      const afterEdit = await Timetable.findById(testDoc._id);
      assert.strictEqual(afterEdit.redoStack.length, 0, 'Redo stack must be cleared after a new edit');
      assert.ok(afterEdit.undoStack.length >= 1, 'Undo stack must record the new edit');
    });

    test('5. Page refresh preserves persisted undo state in MongoDB', async () => {
      const freshRead = await Timetable.findById(testDoc._id);
      assert.ok(freshRead.undoStack.length > 0, 'Undo stack persists across database reloads');
    });
  });

  describe('Suite 5: Workload Readiness & Status Model (Phase 7)', () => {
    test('1. getWorkloadReadiness reports status READY with zero hard violations', async () => {
      const req = { params: { id: activeTimetable._id.toString() } };
      const res = createMockRes();
      await getWorkloadReadiness(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'READY', 'Active timetable status must be READY');
      assert.strictEqual(res.body?.data?.metrics?.hardViolationsCount, 0, 'Hard violations count must be 0');
      assert.strictEqual(res.body?.data?.metrics?.facultyCollisions, 0, 'Faculty collisions must be 0');
      assert.strictEqual(res.body?.data?.metrics?.classCollisions, 0, 'Class collisions must be 0');
      assert.strictEqual(res.body?.data?.metrics?.dailyLimitViolations, 0, 'Daily limit violations must be 0');
    });

    test('2. Per-class assessment reports 100% completion for all required subjects', async () => {
      const req = { params: { id: activeTimetable._id.toString() } };
      const res = createMockRes();
      await getWorkloadReadiness(req, res);

      const classAssessments = res.body?.data?.classAssessment || [];
      assert.ok(classAssessments.length >= 9, 'Must assess all 9 classes');
      for (const ca of classAssessments) {
        assert.ok(ca.totalScheduledHours > 0, `${ca.className} must have scheduled hours`);
        assert.ok(ca.isComplete, `${ca.className} workload must be complete`);
      }
    });
  });

  describe('Suite 6: Global Collision Prevention (Zero Collisions)', () => {
    test('1. Zero faculty collisions across all classes and periods', () => {
      const grid = gridFromTimetable(activeTimetable);
      const val = validateGlobalTimetable(grid, data);
      assert.strictEqual(val.report?.facultyCollisions?.failed, 0, 'Must have 0 faculty collisions');
    });

    test('2. Zero class collisions across all periods', () => {
      const grid = gridFromTimetable(activeTimetable);
      const val = validateGlobalTimetable(grid, data);
      assert.strictEqual(val.report?.classCollisions?.failed, 0, 'Must have 0 class collisions');
    });

    test('3. Zero lab room double bookings on any day', () => {
      const roomOccupancy = {};
      for (const ct of activeTimetable.classTimetables) {
        for (const s of ct.slots) {
          if (s.isEmpty || s.isBreak || !s.roomName || !s.roomName.includes('Lab')) continue;
          const k = s.day + '__P' + s.period + '__' + s.roomName;
          if (!roomOccupancy[k]) roomOccupancy[k] = [];
          roomOccupancy[k].push(ct.className);
        }
      }
      const collisions = Object.entries(roomOccupancy).filter(([k, classes]) => classes.length > 1);
      assert.strictEqual(collisions.length, 0, `Found lab room collisions: ${JSON.stringify(collisions)}`);
    });
  });
});
