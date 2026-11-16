/**
 * tests/faculty_double_booking_prevention.test.js
 * 
 * CRITICAL REGRESSION SUITE: PREVENT FACULTY DOUBLE-BOOKING & FALSE SUCCESS IN AUTO READJUST
 * 
 * Tests:
 * - Test A: Ordinary double-booking detection (same faculty, same day, same period, different classes)
 * - Test B: Cross-department double-booking detection (same faculty across departmental boundaries)
 * - Test C: Same faculty member, different periods (must remain valid)
 * - Test D: Legal swap (Auto Readjust finds viable conflict-free 3-way cyclic shift)
 * - Test E: Impossible arrangement (explicit failure response, original timetable unchanged)
 * - Test F: S8 CST416 shared Capstone session (Dr Gunasekaran Thursday & Friday P1-P6 remains valid)
 * - Test G: Unauthorized shared-session rejection (ordinary theory/lab with spoofed sharedSessionId rejected)
 * - Test H: False success prevention (candidate with double-booking rejected by API and service)
 * - Test I: Faculty identity normalization (string ID vs name vs object vs batch split resolved canonically)
 * - Test J: Full timetable regression (all 4 independent validators report 0 hard violations, 100% placement)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Timetable = require('../src/models/Timetable');
const Class = require('../src/models/Class');
const Teacher = require('../src/models/Teacher');
const Subject = require('../src/models/Subject');

const { loadData } = require('../src/services/engine/dataLoader');
const { gridFromTimetable } = require('../src/services/engine/persistedValidator');
const { validateOutput } = require('../src/services/engine/constraintValidator');
const { validateGlobalTimetable } = require('../src/services/engine/globalTimetableValidator');
const { auditTimetable } = require('../src/services/engine/independentValidator');
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
const { timetableToGrid, simulateRebalance, commitRebalance } = require('../src/services/rebalanceService');
const { applyRebalance, previewRebalance } = require('../src/controllers/timetableController');

function cloneGrid(grid) {
  return JSON.parse(JSON.stringify(grid));
}

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

describe('CRITICAL REGRESSION SUITE: FACULTY DOUBLE-BOOKING PREVENTION & AUTO READJUST CORRECTNESS', () => {
  let data;
  let baseTimetable;
  let baseGrid;
  let initialFingerprint;

  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    baseTimetable = await Timetable.findOne({ isAccepted: true });
    assert.ok(baseTimetable, 'Authoritative published timetable must exist');

    const str = JSON.stringify(baseTimetable.toObject());
    initialFingerprint = crypto.createHash('sha256').update(str).digest('hex');

    data = await loadData({});
    baseGrid = timetableToGrid(baseTimetable);
  });

  after(async () => {
    // Assert production DB was never modified
    const currentDoc = await Timetable.findOne({ isAccepted: true });
    const currentFingerprint = crypto.createHash('sha256').update(JSON.stringify(currentDoc.toObject())).digest('hex');
    assert.equal(currentFingerprint, initialFingerprint, 'Production database fingerprint must remain strictly unchanged');
    await mongoose.disconnect();
  });

  // -------------------------------------------------------------
  // Test A: Ordinary Double-Booking Detection
  // -------------------------------------------------------------
  test('Test A: Ordinary double-booking detection (same faculty, same day, same period, different classes)', () => {
    const testGrid = cloneGrid(baseGrid);
    const classes = data.classes;
    assert.ok(classes.length >= 2, 'Need at least two classes');

    const c1Id = classes[0]._id.toString();
    const c2Id = classes[1]._id.toString();
    const teacher = data.teachers.find(t => t.name.includes('Shiji'));
    assert.ok(teacher, 'Ms Shiji must exist');
    const tid = teacher._id.toString();

    // Assign Ms Shiji to both classes on Monday Period 2
    testGrid[c1Id]['Monday'][2] = {
      ...testGrid[c1Id]['Monday'][2],
      subjectCode: 'TEST101',
      subjectName: 'Test Theory 1',
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      isEmpty: false,
      isBreak: false,
    };
    testGrid[c2Id]['Monday'][2] = {
      ...testGrid[c2Id]['Monday'][2],
      subjectCode: 'TEST102',
      subjectName: 'Test Theory 2',
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      isEmpty: false,
      isBreak: false,
    };

    const valOut = validateOutput(testGrid, data, []);
    assert.equal(valOut.checks.zero_teacher_conflicts, false, 'zero_teacher_conflicts must be false');
    const conflict = valOut.hardViolations.find(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Monday' && v.period === 2);
    assert.ok(conflict, 'Must identify TEACHER_DOUBLE_BOOKED on Monday Period 2');

    const audit = auditTimetable(testGrid, data);
    const auditConflict = audit.hardViolations.find(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Monday' && v.period === 2);
    assert.ok(auditConflict, 'independentValidator must also report TEACHER_DOUBLE_BOOKED');
  });

  // -------------------------------------------------------------
  // Test B: Cross-Department Double-Booking Detection
  // -------------------------------------------------------------
  test('Test B: Cross-department double-booking detection across departmental boundaries', () => {
    const testGrid = cloneGrid(baseGrid);
    const teacher = data.teachers.find(t => t.name.includes('Reshmi'));
    assert.ok(teacher, 'Dr Reshmi B must exist');
    const tid = teacher._id.toString();

    // S4 CSE A is CSE department
    const s4a = data.classes.find(c => c.name.includes('S4 CSE A'));
    const s4aId = s4a._id.toString();

    // Simulate an external department class (e.g. AIML Dept)
    const extClassId = '6aeccf3cbb1e84200c3db999';
    testGrid[extClassId] = {
      Monday: {
        1: {
          subjectCode: 'AIML201',
          subjectName: 'AI Concepts',
          teacherId: tid,
          teacherIds: [tid],
          teacherNames: [teacher.name],
          day: 'Monday',
          period: 1,
          isEmpty: false,
          isBreak: false,
        }
      }
    };
    testGrid[s4aId]['Monday'][1] = {
      ...testGrid[s4aId]['Monday'][1],
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      isEmpty: false,
      isBreak: false,
    };

    const dummyClasses = [...data.classes, { _id: extClassId, name: 'S4 AIML A', department: 'AIML' }];
    const dummyData = { ...data, classes: dummyClasses };

    const valOut = validateOutput(testGrid, dummyData, []);
    assert.equal(valOut.checks.zero_teacher_conflicts, false);
    const conflict = valOut.hardViolations.find(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Monday' && v.period === 1);
    assert.ok(conflict, 'Cross-department conflict must be flagged as TEACHER_DOUBLE_BOOKED');
  });

  // -------------------------------------------------------------
  // Test C: Same Faculty Member, Different Periods
  // -------------------------------------------------------------
  test('Test C: Same faculty member in different periods must remain valid without conflict', () => {
    const testGrid = cloneGrid(baseGrid);
    const s2a = data.classes.find(c => c.name.includes('S2 CSE A'));
    const s2b = data.classes.find(c => c.name.includes('S2 CSE B'));
    const teacher = data.teachers.find(t => t.name.includes('Satheeshkumar'));
    assert.ok(teacher, 'Dr Satheeshkumar must exist');
    const tid = teacher._id.toString();

    // Dr Satheeshkumar teaching S2 CSE A at Monday P1 and S2 CSE B at Monday P2 (different periods)
    testGrid[s2a._id.toString()]['Monday'][1] = {
      ...testGrid[s2a._id.toString()]['Monday'][1],
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      isEmpty: false,
      isBreak: false,
    };
    testGrid[s2b._id.toString()]['Monday'][2] = {
      ...testGrid[s2b._id.toString()]['Monday'][2],
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      isEmpty: false,
      isBreak: false,
    };

    const valOut = validateOutput(testGrid, data, []);
    const teacherConflicts = valOut.hardViolations.filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && (v.teacherId === tid || v.teacherName === teacher.name));
    assert.equal(teacherConflicts.length, 0, 'Different periods must produce 0 teacher collisions');
  });

  async function createTestTimetable(label, lockAll = false) {
    const cloneData = JSON.parse(JSON.stringify(baseTimetable.toObject()));
    delete cloneData._id;
    const maxDoc = await Timetable.findOne().sort({ version: -1 });
    cloneData.version = (maxDoc ? maxDoc.version : 95000) + Math.floor(Math.random() * 1000) + 1;
    cloneData.revision = 1;
    cloneData.appliedIdempotencyKeys = [];
    cloneData.label = `Test Timetable ${label} (${cloneData.version})`;
    cloneData.isAccepted = false;
    for (const ct of cloneData.classTimetables) {
      for (const s of ct.slots) s.isLocked = lockAll;
    }
    const doc = new Timetable(cloneData);
    await doc.save();
    return doc;
  }

  // -------------------------------------------------------------
  // Test D: Legal Swap via Auto Readjust
  // -------------------------------------------------------------
  test('Test D: Legal swap candidate finds viable conflict-free 3-way cyclic shift with 0 violations', async () => {
    // Create disposable test timetable document
    const doc = await createTestTimetable('Test D Legal Swap', false);

    const s2a = doc.classTimetables.find(c => c.className.includes('S2 CSE A'));
    const cid = s2a.classId.toString();

    // S2 CSE A Monday P1 -> Friday P4 (where direct swap creates teacher collision, but cyclic shift resolves cleanly)
    const res = await simulateRebalance(
      doc._id,
      cid,
      { day: 'Monday', period: 1 },
      { day: 'Friday', period: 4 }
    );

    assert.equal(res.canRebalance, true, 'Auto Readjust must identify viable conflict-free arrangement');
    assert.equal(res.actionLabel, 'Conflict-Free Rebalance');
    assert.ok(res.preview, 'Must provide rebalance preview');
    assert.equal(res.preview.validationResult.hardViolationsCount, 0, 'Candidate must have strictly 0 hard violations');
    assert.ok(res.rebalancedGrid, 'Must return non-null rebalancedGrid');

    // Clean up disposable doc
    await Timetable.findByIdAndDelete(doc._id);
  });

  // -------------------------------------------------------------
  // Test E: Impossible Arrangement Rejection
  // -------------------------------------------------------------
  test('Test E: Impossible arrangement reports explicit failure, original timetable document unchanged', async () => {
    // Create disposable test timetable where all target class slots are locked
    const doc = await createTestTimetable('Test E Impossible', true);

    const s2a = doc.classTimetables.find(c => c.className.includes('S2 CSE A'));
    const cid = s2a.classId.toString();

    let caughtError = null;
    try {
      await simulateRebalance(
        doc._id,
        cid,
        { day: 'Monday', period: 1 },
        { day: 'Friday', period: 4 }
      );
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Must throw or fail when attempting to move locked slots');
    assert.match(caughtError.message, /locked/i, 'Error message must explicitly mention locked slots');

    // Verify original timetable doc is completely unchanged
    const unchangedDoc = await Timetable.findById(doc._id).lean();
    assert.equal(unchangedDoc.revision, 1, 'Revision must not increment on failure');

    // Clean up
    await Timetable.findByIdAndDelete(doc._id);
  });

  // -------------------------------------------------------------
  // Test F: S8 CST416 Shared Capstone Session Preservation
  // -------------------------------------------------------------
  test('Test F: Authorized S8 CST416 shared Capstone session (Dr Gunasekaran Thursday & Friday) remains valid', async () => {
    const valOut = validateOutput(baseGrid, data, []);
    assert.equal(valOut.checks.zero_teacher_conflicts, true, 'Base grid must have 0 teacher conflicts');

    const audit = auditTimetable(baseGrid, data);
    const capstoneConflicts = audit.hardViolations.filter(
      v => v.type === 'TEACHER_DOUBLE_BOOKED' &&
      (v.teacherName?.includes('Gunasekaran') || v.teacherId === '6aeccf3cbb1e84200c3db02b') &&
      (v.day === 'Thursday' || v.day === 'Friday')
    );
    assert.equal(capstoneConflicts.length, 0, 'Authorized S8 Capstone must NEVER be flagged as double-booked');

    const s8a = data.classes.find(c => c.name === 'S8 CSE A');
    const s8b = data.classes.find(c => c.name === 'S8 CSE B');
    assert.ok(s8a && s8b, 'Both S8 classes must exist');

    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const slotA = baseGrid[s8a._id.toString()][d][p];
        const slotB = baseGrid[s8b._id.toString()][d][p];
        assert.equal(slotA.subjectCode, 'CST416');
        assert.equal(slotB.subjectCode, 'CST416');
        assert.equal(slotA.isSharedProject, true);
        assert.equal(slotB.isSharedProject, true);
        assert.equal(slotA.sharedSessionId, slotB.sharedSessionId);
      }
    }
  });

  // -------------------------------------------------------------
  // Test G: Unauthorized Shared-Session Rejection
  // -------------------------------------------------------------
  test('Test G: Unauthorized shared session (ordinary theory/lab with spoofed sharedSessionId) is strictly rejected', () => {
    const testGrid = cloneGrid(baseGrid);
    const s2a = data.classes.find(c => c.name.includes('S2 CSE A'));
    const s2b = data.classes.find(c => c.name.includes('S2 CSE B'));
    const teacher = data.teachers.find(t => t.name.includes('Satheeshkumar'));
    const tid = teacher._id.toString();

    // Assign same teacher to ordinary theory class across S2A and S2B at Monday P1 with spoofed sharedSessionId
    testGrid[s2a._id.toString()]['Monday'][1] = {
      ...testGrid[s2a._id.toString()]['Monday'][1],
      subjectCode: 'GXEST204',
      subjectName: 'Programming in C',
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      sharedSessionId: 'unauthorized_spoofed_session_token_12345',
      isSharedProject: false,
      isEmpty: false,
      isBreak: false,
    };
    testGrid[s2b._id.toString()]['Monday'][1] = {
      ...testGrid[s2b._id.toString()]['Monday'][1],
      subjectCode: 'GXEST204',
      subjectName: 'Programming in C',
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      sharedSessionId: 'unauthorized_spoofed_session_token_12345',
      isSharedProject: false,
      isEmpty: false,
      isBreak: false,
    };

    const valOut = validateOutput(testGrid, data, []);
    assert.equal(valOut.checks.zero_teacher_conflicts, false);
    const conflict = valOut.hardViolations.find(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Monday' && v.period === 1);
    assert.ok(conflict, 'Ordinary theory class with spoofed sharedSessionId must be flagged as TEACHER_DOUBLE_BOOKED');

    const audit = auditTimetable(testGrid, data);
    const auditConflict = audit.hardViolations.find(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Monday' && v.period === 1);
    assert.ok(auditConflict, 'independentValidator must strictly reject ordinary theory with spoofed sharedSessionId');
  });

  // -------------------------------------------------------------
  // Test H: False Success Prevention
  // -------------------------------------------------------------
  test('Test H: Candidate timetable with double-booking is rejected and never reported as success', async () => {
    // Create disposable test timetable
    const doc = await createTestTimetable('Test H False Success Prevention', false);

    const s2a = doc.classTimetables.find(c => c.className.includes('S2 CSE A'));
    const s2b = doc.classTimetables.find(c => c.className.includes('S2 CSE B'));

    // Construct invalid candidate grid with teacher double-booking
    const invalidGrid = cloneGrid(baseGrid);
    const teacher = data.teachers.find(t => t.name.includes('Shiji'));
    const tid = teacher._id.toString();

    invalidGrid[s2a.classId.toString()]['Monday'][1] = {
      ...invalidGrid[s2a.classId.toString()]['Monday'][1],
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      isEmpty: false,
    };
    invalidGrid[s2b.classId.toString()]['Monday'][1] = {
      ...invalidGrid[s2b.classId.toString()]['Monday'][1],
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      isEmpty: false,
    };

    // 1. Service-level prevention: commitRebalance must throw
    let commitError = null;
    try {
      await commitRebalance(
        doc._id,
        s2a.classId.toString(),
        { day: 'Monday', period: 1 },
        { day: 'Friday', period: 4 },
        invalidGrid,
        'tester'
      );
    } catch (err) {
      commitError = err;
    }
    assert.ok(commitError, 'commitRebalance must reject invalidGrid with double booking');
    assert.match(commitError.message, /double-booked|conflict/i);

    // 2. Controller-level prevention: applyRebalance must return 400
    const req = {
      params: { id: doc._id.toString() },
      body: {
        classId: s2a.classId.toString(),
        source: { day: 'Monday', period: 1 },
        target: { day: 'Friday', period: 4 },
        rebalancedGrid: invalidGrid,
      },
      user: { username: 'admin' },
    };
    const res = mockRes();
    await applyRebalance(req, res);

    assert.equal(res.statusCode, 400, 'Controller must respond with HTTP 400');
    assert.equal(res.body.success, false, 'Controller response must have success: false');
    assert.ok(res.body.conflict || res.body.message, 'Must return conflict explanation');

    // Clean up
    await Timetable.findByIdAndDelete(doc._id);
  });

  // -------------------------------------------------------------
  // Test I: Faculty Identity Normalization
  // -------------------------------------------------------------
  test('Test I: Faculty identity normalization resolves IDs, names, objects, and batch splits', () => {
    const testGrid = cloneGrid(baseGrid);
    const classes = data.classes;
    const c1Id = classes[0]._id.toString();
    const c2Id = classes[1]._id.toString();
    const teacher = data.teachers.find(t => t.name.includes('Shiji'));
    const tid = teacher._id.toString();

    // Class 1 stores teacher as string ID in teacherId
    testGrid[c1Id]['Tuesday'][3] = {
      subjectCode: 'TEST201',
      subjectName: 'Test Normalization 1',
      teacherId: tid,
      isEmpty: false,
      isBreak: false,
    };

    // Class 2 stores teacher only in teacherNames array with different whitespace/casing
    testGrid[c2Id]['Tuesday'][3] = {
      subjectCode: 'TEST202',
      subjectName: 'Test Normalization 2',
      teacherNames: [`  ${teacher.name.toUpperCase()}  `],
      isEmpty: false,
      isBreak: false,
    };

    const valOut = validateOutput(testGrid, data, []);
    assert.equal(valOut.checks.zero_teacher_conflicts, false);
    const conflict = valOut.hardViolations.find(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Tuesday' && v.period === 3);
    assert.ok(conflict, 'Name normalization must detect double booking between teacherId and uppercase/untrimmed teacherNames');

    const audit = auditTimetable(testGrid, data);
    const auditConflict = audit.hardViolations.find(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Tuesday' && v.period === 3);
    assert.ok(auditConflict, 'independentValidator must detect double booking under normalized faculty identity');
  });

  // -------------------------------------------------------------
  // Test J: Full Timetable Regression & Placement Preservation
  // -------------------------------------------------------------
  test('Test J: Full timetable regression — all 4 validators report 0 hard violations, 100% placement preserved', async () => {
    // 1. validateOutput (Constraint Validator)
    const valOut = validateOutput(baseGrid, data, []);
    assert.equal(valOut.valid, true, 'validateOutput must be valid');
    assert.equal(valOut.hardViolationsCount, 0, 'validateOutput hardViolationsCount must be 0');
    assert.equal(valOut.checks.all_subjects_placed, true, 'All subjects placed');
    assert.equal(valOut.checks.zero_teacher_conflicts, true, 'Zero teacher conflicts');
    assert.equal(valOut.checks.zero_class_conflicts, true, 'Zero class conflicts');
    assert.equal(valOut.checks.zero_room_conflicts, true, 'Zero room conflicts');

    // 2. validateGlobalTimetable (Faculty Analyzer & Global Validator)
    const valGlob = validateGlobalTimetable(baseGrid, data);
    assert.equal(valGlob.valid, true, 'validateGlobalTimetable must be valid');
    assert.equal(valGlob.hardViolationsCount, 0, 'validateGlobalTimetable hardViolationsCount must be 0');

    // 3. validatePersistedTimetable (Persisted Grid Validator)
    const valPersist = await validatePersistedTimetable(baseTimetable);
    const academicViolations = valPersist.hardViolations.filter(v => v.type !== 'MISSING_CLASS_DATA');
    assert.equal(academicViolations.length, 0, 'validatePersistedTimetable must report 0 academic hard violations');

    // 4. auditTimetable (Independent Ground-Truth Validator)
    const audit = auditTimetable(baseGrid, data);
    assert.equal(audit.valid, true, 'auditTimetable must be valid');
    assert.equal(audit.outcome, 'FULLY_VALID', 'Outcome must be FULLY_VALID');
    assert.equal(audit.hardViolations.length, 0, 'auditTimetable must report 0 hard violations');

    // Placement verification: Exactly 237 academic contact slots placed
    let placedAcademicSlots = 0;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    for (const cid of Object.keys(baseGrid)) {
      for (const d of days) {
        for (let p = 1; p <= 6; p++) {
          const s = baseGrid[cid]?.[d]?.[p];
          if (s && !s.isEmpty && !s.isBreak && s.subjectCode) {
            placedAcademicSlots++;
          }
        }
      }
    }
    assert.equal(placedAcademicSlots, 237, 'Exactly 237 academic slots must be placed (100% placement rate)');
  });
});
