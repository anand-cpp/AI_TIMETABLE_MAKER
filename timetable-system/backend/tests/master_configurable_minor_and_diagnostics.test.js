const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

describe('MASTER CONFIGURABLE MINOR, FIXED-PERIOD ALLOCATION & CONFLICT DIAGNOSTICS SUITE', () => {
  let Timetable, MinorGroup, Class, Subject, Teacher;
  let validatePersistedTimetable;
  let solveSubMinorAllocation;
  let s4aClass, s4bClass;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/timetable_db');
    }
    Timetable = require('../src/models/Timetable');
    MinorGroup = require('../src/models/MinorGroup');
    Class = require('../src/models/Class');
    Subject = require('../src/models/Subject');
    Teacher = require('../src/models/Teacher');
    const pv = require('../src/services/engine/persistedValidator');
    validatePersistedTimetable = pv.validatePersistedTimetable;
    const sms = require('../src/services/engine/subMinorSolver');
    solveSubMinorAllocation = sms.solveSubMinorAllocation;

    s4aClass = await Class.findOne({ name: /S4 CSE A/i });
    s4bClass = await Class.findOne({ name: /S4 CSE B/i });
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // ==========================================
  // Category 1: Minor Configuration Tests
  // ==========================================
  describe('1. Minor Configuration & Accounting Tests', () => {
    test('Four 1-hour sub-minor subjects produce exactly 4/4 configured hours (Complete)', () => {
      const subMinors = [
        { subjectName: 'Mathematics', weeklyHours: 1 },
        { subjectName: 'DBMS', weeklyHours: 1 },
        { subjectName: 'COA', weeklyHours: 1 },
        { subjectName: 'OS', weeklyHours: 1 },
      ];
      const configured = subMinors.reduce((s, m) => s + m.weeklyHours, 0);
      assert.equal(configured, 4);
      const required = 4;
      const remaining = required - configured;
      assert.equal(remaining, 0);
      const status = configured === required ? 'Complete' : (configured < required ? 'Incomplete' : 'Overconfigured');
      assert.equal(status, 'Complete');
    });

    test('Three 1-hour subjects produce 3/4 hours and are flagged Incomplete with remaining: 1', () => {
      const subMinors = [
        { subjectName: 'Mathematics', weeklyHours: 1 },
        { subjectName: 'DBMS', weeklyHours: 1 },
        { subjectName: 'OS', weeklyHours: 1 },
      ];
      const configured = subMinors.reduce((s, m) => s + m.weeklyHours, 0);
      assert.equal(configured, 3);
      const remaining = 4 - configured;
      assert.equal(remaining, 1);
      const status = configured === 4 ? 'Complete' : (configured < 4 ? 'Incomplete' : 'Overconfigured');
      assert.equal(status, 'Incomplete');
    });

    test('Five 1-hour subjects exceed requirement and are flagged Overconfigured', () => {
      const subMinors = [
        { subjectName: 'Mathematics', weeklyHours: 1 },
        { subjectName: 'DBMS', weeklyHours: 1 },
        { subjectName: 'COA', weeklyHours: 1 },
        { subjectName: 'OS', weeklyHours: 1 },
        { subjectName: 'AI', weeklyHours: 1 },
      ];
      const configured = subMinors.reduce((s, m) => s + m.weeklyHours, 0);
      assert.equal(configured, 5);
      const status = configured === 4 ? 'Complete' : (configured < 4 ? 'Incomplete' : 'Overconfigured');
      assert.equal(status, 'Overconfigured');
    });

    test('Active MinorGroup document in MongoDB is properly configured with 4 sub-minors for both S4A and S4B', async () => {
      const group = await MinorGroup.findOne({ semester: 4, isActive: true, isArchived: false }).lean();
      assert.ok(group, 'Active MinorGroup must exist');
      assert.equal(group.weeklyHours, 4, 'Weekly hours must be 4');
      assert.ok(group.classConfigs && group.classConfigs.length >= 2, 'Must have at least 2 class configs (S4A and S4B)');

      for (const cfg of group.classConfigs) {
        assert.equal(cfg.subMinors.length, 4, `${cfg.className} must have exactly 4 sub-minor subjects`);
        const totalH = cfg.subMinors.reduce((s, sm) => s + sm.weeklyHours, 0);
        assert.equal(totalH, 4, `${cfg.className} sub-minors sum must equal 4 hours`);
      }
    });
  });

  // ==========================================
  // Category 2: Fixed-Slot Tests
  // ==========================================
  describe('2. Fixed-Slot Allocation Tests', () => {
    test('The four non-negotiable fixed slots (Mon P3, Thu P3, Fri P4, Fri P6) exist in MinorGroup', async () => {
      const group = await MinorGroup.findOne({ semester: 4, isActive: true, isArchived: false }).lean();
      const fixedSlots = group.fixedSlots || [];
      assert.equal(fixedSlots.length, 4, 'Must have exactly 4 fixed slots');

      const expected = [
        { day: 'Monday', period: 3 },
        { day: 'Thursday', period: 3 },
        { day: 'Friday', period: 4 },
        { day: 'Friday', period: 6 },
      ];

      for (const exp of expected) {
        const found = fixedSlots.some(s => s.day === exp.day && s.period === exp.period);
        assert.ok(found, `Fixed slot ${exp.day} P${exp.period} must exist`);
      }
    });

    test('Both S4 CSE A and S4 CSE B have Minor scheduled at all 4 fixed slots in the active timetable', async () => {
      const tt = await Timetable.findOne({ isAccepted: true }).lean();
      assert.ok(tt, 'Accepted timetable must exist');

      const s4a = tt.classTimetables.find(c => c.className.includes('S4 CSE A'));
      const s4b = tt.classTimetables.find(c => c.className.includes('S4 CSE B'));
      assert.ok(s4a, 'S4 CSE A timetable must exist');
      assert.ok(s4b, 'S4 CSE B timetable must exist');

      const targetSlots = [
        { day: 'Monday', period: 3 },
        { day: 'Thursday', period: 3 },
        { day: 'Friday', period: 4 },
        { day: 'Friday', period: 6 },
      ];

      for (const ts of targetSlots) {
        const slotA = s4a.slots.find(s => s.day === ts.day && s.period === ts.period);
        const slotB = s4b.slots.find(s => s.day === ts.day && s.period === ts.period);

        assert.ok(slotA && slotA.isMinor, `S4A must have Minor at ${ts.day} P${ts.period}`);
        assert.ok(slotB && slotB.isMinor, `S4B must have Minor at ${ts.day} P${ts.period}`);
        assert.ok(slotA.subjectName.toLowerCase().includes('minor'), `S4A slot must display Minor label`);
        assert.ok(slotB.subjectName.toLowerCase().includes('minor'), `S4B slot must display Minor label`);
      }
    });
  });

  // ==========================================
  // Category 3: Faculty & Collision Prevention Tests
  // ==========================================
  describe('3. Faculty & Collision Prevention Tests', () => {
    test('Zero teacher collisions across S4 CSE A and S4 CSE B during all 4 Minor slots', async () => {
      const tt = await Timetable.findOne({ isAccepted: true }).lean();
      const s4a = tt.classTimetables.find(c => c.className.includes('S4 CSE A'));
      const s4b = tt.classTimetables.find(c => c.className.includes('S4 CSE B'));

      const targetSlots = [
        { day: 'Monday', period: 3 },
        { day: 'Thursday', period: 3 },
        { day: 'Friday', period: 4 },
        { day: 'Friday', period: 6 },
      ];

      for (const ts of targetSlots) {
        const slotA = s4a.slots.find(s => s.day === ts.day && s.period === ts.period);
        const slotB = s4b.slots.find(s => s.day === ts.day && s.period === ts.period);

        const teachersA = (slotA.teacherNames || []).map(t => t.trim().toLowerCase());
        const teachersB = (slotB.teacherNames || []).map(t => t.trim().toLowerCase());

        for (const tA of teachersA) {
          if (!tA) continue;
          assert.ok(!teachersB.includes(tA), `Teacher collision detected at ${ts.day} P${ts.period}: ${tA} scheduled in both S4A and S4B`);
        }
      }
    });

    test('Permutation solver successfully solves joint allocation with zero teacher overlap', () => {
      const testConfigs = [
        {
          classId: 'classA',
          className: 'Class A',
          section: 'A',
          subMinors: [
            { subjectName: 'Mathematics', teacherIds: ['T1'], weeklyHours: 1 },
            { subjectName: 'DBMS', teacherIds: ['T2'], weeklyHours: 1 },
            { subjectName: 'OS', teacherIds: ['T3'], weeklyHours: 1 },
            { subjectName: 'COA', teacherIds: ['T4'], weeklyHours: 1 },
          ],
        },
        {
          classId: 'classB',
          className: 'Class B',
          section: 'B',
          subMinors: [
            { subjectName: 'Mathematics', teacherIds: ['T1'], weeklyHours: 1 },
            { subjectName: 'DBMS', teacherIds: ['T2'], weeklyHours: 1 },
            { subjectName: 'OS', teacherIds: ['T3'], weeklyHours: 1 },
            { subjectName: 'COA', teacherIds: ['T4'], weeklyHours: 1 },
          ],
        },
      ];

      const res = solveSubMinorAllocation(testConfigs);
      assert.equal(res.success, true, 'Solver must succeed');
      const allocA = res.allocationsByClass['classA'];
      const allocB = res.allocationsByClass['classB'];

      for (let i = 0; i < 4; i++) {
        const tA = allocA[i].teacherIds[0];
        const tB = allocB[i].teacherIds[0];
        assert.notEqual(tA, tB, `Slot ${i + 1} must not have the same teacher`);
      }
    });
  });

  // ==========================================
  // Category 4: Timetable Integrity & Distribution Tests
  // ==========================================
  describe('4. Timetable Integrity & Distribution Tests', () => {
    test('Each sub-minor appears exactly once per section in S4 CSE A and S4 CSE B', async () => {
      const tt = await Timetable.findOne({ isAccepted: true }).lean();
      const s4a = tt.classTimetables.find(c => c.className.includes('S4 CSE A'));
      const s4b = tt.classTimetables.find(c => c.className.includes('S4 CSE B'));

      const minorA = s4a.slots.filter(s => s.isMinor);
      const minorB = s4b.slots.filter(s => s.isMinor);

      assert.equal(minorA.length, 4, 'S4A must have 4 Minor periods');
      assert.equal(minorB.length, 4, 'S4B must have 4 Minor periods');

      const expectedSubNames = ['mathematics', 'dbms', 'os', 'coa'];
      for (const name of expectedSubNames) {
        const foundA = minorA.filter(s => (s.minorSubjectName || s.subjectName).toLowerCase().includes(name));
        const foundB = minorB.filter(s => (s.minorSubjectName || s.subjectName).toLowerCase().includes(name));
        assert.equal(foundA.length, 1, `S4A must have exactly 1 period of ${name}`);
        assert.equal(foundB.length, 1, `S4B must have exactly 1 period of ${name}`);
      }
    });

    test('Both S4 CSE A and S4 CSE B have 100% capacity filled (30/30 periods scheduled)', async () => {
      const tt = await Timetable.findOne({ isAccepted: true }).lean();
      const s4a = tt.classTimetables.find(c => c.className.includes('S4 CSE A'));
      const s4b = tt.classTimetables.find(c => c.className.includes('S4 CSE B'));

      const countA = s4a.slots.filter(s => !s.isEmpty && !s.isBreak).length;
      const countB = s4b.slots.filter(s => !s.isEmpty && !s.isBreak).length;

      assert.equal(countA, 30, 'S4 CSE A must have 30 scheduled periods');
      assert.equal(countB, 30, 'S4 CSE B must have 30 scheduled periods');
    });

    test('S4 CSE Electives are 100% synchronized on 4 distinct days across S4A, S4B, and S4 AIML', async () => {
      const tt = await Timetable.findOne({ isAccepted: true }).lean();
      const s4a = tt.classTimetables.find(c => c.className.includes('S4 CSE A'));
      const s4b = tt.classTimetables.find(c => c.className.includes('S4 CSE B'));
      const s4aiml = tt.classTimetables.find(c => c.className.includes('S4 AIML'));

      const elecA = s4a.slots.filter(s => s.isElective);
      const elecB = s4b.slots.filter(s => s.isElective);
      const elecAiml = s4aiml.slots.filter(s => s.isElective && s.subjectCode.includes('PECST411 / PECST419'));

      assert.equal(elecA.length, 4, 'S4A must have exactly 4 elective periods');
      assert.equal(elecB.length, 4, 'S4B must have exactly 4 elective periods');
      assert.equal(elecAiml.length, 4, 'S4 AIML must have exactly 4 elective periods');

      // Check identical day and period
      for (const sl of elecA) {
        const inB = elecB.find(s => s.day === sl.day && s.period === sl.period);
        const inAiml = elecAiml.find(s => s.day === sl.day && s.period === sl.period);
        assert.ok(inB, `Elective missing in S4B at ${sl.day} P${sl.period}`);
        assert.ok(inAiml, `Elective missing in S4 AIML at ${sl.day} P${sl.period}`);
      }

      // Check distinct days (no more than 1 per day)
      const daysA = new Set(elecA.map(s => s.day));
      assert.equal(daysA.size, 4, 'Electives must be on 4 distinct days (1 per day)');
    });
  });

  // ==========================================
  // Category 5: Conflict Diagnostics & Quality Score
  // ==========================================
  describe('5. Conflict Diagnostics & Quality Scorer Tests', () => {
    test('Persisted Validator authoritative check returns VALID with 0 hard conflicts on active published timetable', async () => {
      const tt = await Timetable.findOne({ isAccepted: true }).lean();
      const val = await validatePersistedTimetable(tt);

      assert.equal(val.valid, true, 'Timetable must be valid');
      assert.equal(val.hardViolations.length, 0, 'Must have zero hard violations');
      assert.equal(val.checks.zero_teacher_conflicts, true, 'Zero teacher conflicts');
      assert.equal(val.checks.zero_class_conflicts, true, 'Zero class conflicts');
      assert.equal(val.checks.zero_room_conflicts, true, 'Zero room conflicts');
      assert.equal(val.checks.zero_daily_subject_duplicates, true, 'Zero daily subject duplicates');
      assert.equal(val.checks.elective_groups_synchronized, true, 'Electives synchronized');
      assert.equal(val.checks.minor_slots_synchronized, true, 'Minor synchronized');
    });

    test('Quality Score is 100/100 and un-gated (isGated: false)', async () => {
      const tt = await Timetable.findOne({ isAccepted: true }).lean();
      assert.ok(tt.qualityScore, 'Quality score must exist');
      assert.equal(tt.qualityScore.overall, 100, 'Overall quality score must be 100');
      assert.equal(tt.qualityScore.isGated, false, 'Score must not be gated');
    });
  });
});
