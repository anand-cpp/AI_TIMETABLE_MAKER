/**
 * Authoritative Regression Test Suite for Centralized Activity Classification & Theory Fatigue
 * 
 * Verifies the 10 production-readiness conditions:
 * 1. Three consecutive ordinary theory periods [Theory, Theory, Theory] MUST trigger penalty
 * 2. Viva -> Theory -> Viva does NOT trigger 3-consecutive theory penalty
 * 3. Theory -> Viva -> Theory does NOT trigger 3-consecutive theory penalty
 * 4. Theory -> Practical -> Theory does NOT trigger 3-consecutive theory penalty
 * 5. Placement sessions are classified as PLACEMENT and do not trigger theory fatigue
 * 6. Tutorials are classified as TUTORIAL and do not trigger theory fatigue
 * 7. Workshops are classified as PRACTICAL and do not trigger theory fatigue
 * 8. Lunch boundaries (P3 and P4) are respected and trigger lunch-flanking diagnostics
 * 9. Unknown activity classification produces UNKNOWN and diagnostic finding, not silent exemption
 * 10. Consistency between analyzer, scorer, and optimizer classification
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  ACTIVITY_TYPES,
  classifyActivity,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
  isPlacement,
  isTutorial,
  isUnknownActivity,
} = require('../src/services/engine/activityClassifier');

const {
  analyzeFacultyPersonalTimetable,
} = require('../src/services/engine/facultyPersonalTimetableAnalyzer');

const {
  scoreSingleFacultySchedule,
  DEFAULT_FACULTY_SCORING_CONFIG,
} = require('../src/services/engine/facultyTimetableScorer');

describe('CENTRALIZED ACTIVITY CLASSIFICATION & FATIGUE SUITE (10 CONDITIONS)', () => {

  // Baseline Type Verification
  test('Exact Rule Verification: CST404=VIVA, PBCST404=THEORY, CST416=PROJECT, PCCSP608=PROJECT', () => {
    const viva = classifyActivity({ subjectCode: 'CST404', subjectName: 'Comprehensive Course Viva', subjectType: 'theory' });
    assert.equal(viva.type, ACTIVITY_TYPES.VIVA);
    assert.equal(viva.isInstitutionalBlock, true);
    assert.equal(viva.isOrdinaryTheory, false);

    const coa = classifyActivity({ subjectCode: 'PBCST404', subjectName: 'Computer Organization and Architecture', subjectType: 'theory' });
    assert.equal(coa.type, ACTIVITY_TYPES.THEORY);
    assert.equal(coa.isInstitutionalBlock, false);
    assert.equal(coa.isOrdinaryTheory, true);

    const capstone = classifyActivity({ subjectCode: 'CST416', subjectName: 'Project Phase-2', subjectType: 'lab' });
    assert.equal(capstone.type, ACTIVITY_TYPES.PROJECT);
    assert.equal(capstone.isInstitutionalBlock, true);

    const miniProj = classifyActivity({ subjectCode: 'PCCSP608', subjectName: 'Mini Project', subjectType: 'lab' });
    assert.equal(miniProj.type, ACTIVITY_TYPES.PROJECT);
    assert.equal(miniProj.isInstitutionalBlock, true);
  });

  // Condition 1: Three consecutive ordinary theory periods MUST trigger penalty
  test('Condition 1: Three consecutive ordinary theory periods MUST trigger 3-consec theory penalty', () => {
    const dummyId = new mongoose.Types.ObjectId();
    const record = {
      teacher: { _id: dummyId, name: 'Theory Faculty' },
      teacherId: dummyId.toString(),
      teacherName: 'Theory Faculty',
      scheduleGrid: {
        Monday: {
          1: { subjectCode: 'CST202', subjectName: 'Computer Organization', period: 1, day: 'Monday' },
          2: { subjectCode: 'CST204', subjectName: 'Database Management', period: 2, day: 'Monday' },
          3: { subjectCode: 'CST206', subjectName: 'Operating Systems', period: 3, day: 'Monday' },
        },
        Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {},
      },
      allocations: [
        { subjectCode: 'CST202', day: 'Monday', period: 1 },
        { subjectCode: 'CST204', day: 'Monday', period: 2 },
        { subjectCode: 'CST206', day: 'Monday', period: 3 },
      ],
    };

    const res = scoreSingleFacultySchedule(record, DEFAULT_FACULTY_SCORING_CONFIG);
    assert.equal(res.threeConsecutiveCount, 1, 'Must record 1 three-consecutive theory run');
    assert.equal(res.consecutiveScore, 0, 'Consecutive dimension must be 0 points');
    assert.equal(res.isGated, true, 'Score MUST be gated');
    assert.ok(res.penaltiesApplied.some(p => p.type === 'THREE_CONSECUTIVE_THEORY'));
  });

  // Condition 2: Viva -> Theory -> Viva does NOT trigger 3-consec theory penalty
  test('Condition 2: Sequence [Viva, Theory, Viva] does NOT trigger 3-consecutive theory penalty', () => {
    const dummyId = new mongoose.Types.ObjectId();
    const record = {
      teacher: { _id: dummyId, name: 'Dr Reshmi B' },
      teacherId: dummyId.toString(),
      teacherName: 'Dr Reshmi B',
      scheduleGrid: {
        Monday: {
          4: { subjectCode: 'CST404', subjectName: 'Comprehensive Course Viva', period: 4, day: 'Monday' },
          5: { subjectCode: 'CST306', subjectName: 'Algorithm Analysis & Design', period: 5, day: 'Monday' },
          6: { subjectCode: 'CST404', subjectName: 'Comprehensive Course Viva', period: 6, day: 'Monday' },
        },
        Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {},
      },
      allocations: [
        { subjectCode: 'CST404', day: 'Monday', period: 4 },
        { subjectCode: 'CST306', day: 'Monday', period: 5 },
        { subjectCode: 'CST404', day: 'Monday', period: 6 },
      ],
    };

    const res = scoreSingleFacultySchedule(record, DEFAULT_FACULTY_SCORING_CONFIG);
    assert.equal(res.threeConsecutiveCount, 0, 'Must have 0 three-consecutive theory runs');
    assert.equal(res.consecutiveScore, 25, 'Consecutive score must be full 25 points');
    assert.equal(res.isGated, false, 'Score must NOT be gated');
  });

  // Condition 3: Theory -> Viva -> Theory does NOT trigger 3-consec theory penalty
  test('Condition 3: Sequence [Theory, Viva, Theory] does NOT trigger 3-consecutive theory penalty', () => {
    const dummyId = new mongoose.Types.ObjectId();
    const record = {
      teacher: { _id: dummyId, name: 'Test Faculty' },
      teacherId: dummyId.toString(),
      teacherName: 'Test Faculty',
      scheduleGrid: {
        Monday: {
          1: { subjectCode: 'CST302', subjectName: 'Compiler Design', period: 1, day: 'Monday' },
          2: { subjectCode: 'CST404', subjectName: 'Comprehensive Course Viva', period: 2, day: 'Monday' },
          3: { subjectCode: 'CST304', subjectName: 'Computer Networks', period: 3, day: 'Monday' },
        },
        Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {},
      },
      allocations: [
        { subjectCode: 'CST302', day: 'Monday', period: 1 },
        { subjectCode: 'CST404', day: 'Monday', period: 2 },
        { subjectCode: 'CST304', day: 'Monday', period: 3 },
      ],
    };

    const res = scoreSingleFacultySchedule(record, DEFAULT_FACULTY_SCORING_CONFIG);
    assert.equal(res.threeConsecutiveCount, 0, 'Must have 0 three-consecutive theory runs');
    assert.equal(res.consecutiveScore, 25);
    assert.equal(res.isGated, false);
  });

  // Condition 4: Theory -> Practical -> Theory does NOT trigger 3-consec theory penalty
  test('Condition 4: Sequence [Theory, Practical, Theory] does NOT trigger 3-consecutive theory penalty', () => {
    const dummyId = new mongoose.Types.ObjectId();
    const record = {
      teacher: { _id: dummyId, name: 'Test Faculty' },
      teacherId: dummyId.toString(),
      teacherName: 'Test Faculty',
      scheduleGrid: {
        Monday: {
          1: { subjectCode: 'CST302', subjectName: 'Compiler Design', period: 1, day: 'Monday' },
          2: { subjectCode: 'GXESL208', subjectName: 'IT Workshop', period: 2, day: 'Monday' },
          3: { subjectCode: 'CST304', subjectName: 'Computer Networks', period: 3, day: 'Monday' },
        },
        Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {},
      },
      allocations: [
        { subjectCode: 'CST302', day: 'Monday', period: 1 },
        { subjectCode: 'GXESL208', day: 'Monday', period: 2 },
        { subjectCode: 'CST304', day: 'Monday', period: 3 },
      ],
    };

    const res = scoreSingleFacultySchedule(record, DEFAULT_FACULTY_SCORING_CONFIG);
    assert.equal(res.threeConsecutiveCount, 0, 'Must have 0 three-consecutive theory runs');
    assert.equal(res.consecutiveScore, 25);
    assert.equal(res.isGated, false);
  });

  // Condition 5: Placement sessions are classified as PLACEMENT and do not trigger theory fatigue
  test('Condition 5: Placement sessions are classified as PLACEMENT and do not trigger theory fatigue', () => {
    const pSlot = { subjectCode: 'PLACE-S4A', subjectName: 'Placement Hour', subjectType: 'theory' };
    const pClass = classifyActivity(pSlot);
    assert.equal(pClass.type, ACTIVITY_TYPES.PLACEMENT);
    assert.equal(pClass.isOrdinaryTheory, false);
    assert.equal(isPlacement(pSlot), true);

    const dummyId = new mongoose.Types.ObjectId();
    const record = {
      teacher: { _id: dummyId, name: 'Placement Officer' },
      teacherId: dummyId.toString(),
      teacherName: 'Placement Officer',
      scheduleGrid: {
        Monday: {
          1: { subjectCode: 'CST202', subjectName: 'Computer Org', period: 1, day: 'Monday' },
          2: { subjectCode: 'PLACE-S4A', subjectName: 'Placement Hour', period: 2, day: 'Monday' },
          3: { subjectCode: 'CST204', subjectName: 'DBMS', period: 3, day: 'Monday' },
        },
        Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {},
      },
      allocations: [
        { subjectCode: 'CST202', day: 'Monday', period: 1 },
        { subjectCode: 'PLACE-S4A', day: 'Monday', period: 2 },
        { subjectCode: 'CST204', day: 'Monday', period: 3 },
      ],
    };

    const res = scoreSingleFacultySchedule(record, DEFAULT_FACULTY_SCORING_CONFIG);
    assert.equal(res.threeConsecutiveCount, 0, 'Placement must not form 3-consec theory');
    assert.equal(res.isGated, false);
  });

  // Condition 6: Tutorials are classified as TUTORIAL and do not trigger theory fatigue
  test('Condition 6: Tutorials are classified as TUTORIAL and do not trigger theory fatigue', () => {
    const tSlot = { subjectCode: 'MAT201-T', subjectName: 'Mathematics Tutorial', subjectType: 'tutorial' };
    const tClass = classifyActivity(tSlot);
    assert.equal(tClass.type, ACTIVITY_TYPES.TUTORIAL);
    assert.equal(tClass.isOrdinaryTheory, false);
    assert.equal(isTutorial(tSlot), true);

    const dummyId = new mongoose.Types.ObjectId();
    const record = {
      teacher: { _id: dummyId, name: 'Math Faculty' },
      teacherId: dummyId.toString(),
      teacherName: 'Math Faculty',
      scheduleGrid: {
        Tuesday: {
          1: { subjectCode: 'GAMAT201', subjectName: 'Mathematics', period: 1, day: 'Tuesday' },
          2: { subjectCode: 'MAT201-T', subjectName: 'Mathematics Tutorial', period: 2, day: 'Tuesday' },
          3: { subjectCode: 'GAMAT201', subjectName: 'Mathematics', period: 3, day: 'Tuesday' },
        },
        Monday: {}, Wednesday: {}, Thursday: {}, Friday: {},
      },
      allocations: [
        { subjectCode: 'GAMAT201', day: 'Tuesday', period: 1 },
        { subjectCode: 'MAT201-T', day: 'Tuesday', period: 2 },
        { subjectCode: 'GAMAT201', day: 'Tuesday', period: 3 },
      ],
    };

    const res = scoreSingleFacultySchedule(record, DEFAULT_FACULTY_SCORING_CONFIG);
    assert.equal(res.threeConsecutiveCount, 0, 'Tutorial must not form 3-consec theory');
    assert.equal(res.isGated, false);
  });

  // Condition 7: Workshops are classified as PRACTICAL and do not trigger theory fatigue
  test('Condition 7: Workshops are classified as PRACTICAL and do not trigger theory fatigue', () => {
    const wSlot = { subjectCode: 'GXESL208', subjectName: 'IT Workshop', isLabBlock: true };
    const wClass = classifyActivity(wSlot);
    assert.equal(wClass.type, ACTIVITY_TYPES.PRACTICAL);
    assert.equal(wClass.isOrdinaryTheory, false);
    assert.equal(wClass.isInstitutionalBlock, true);

    const dummyId = new mongoose.Types.ObjectId();
    const record = {
      teacher: { _id: dummyId, name: 'Workshop Faculty' },
      teacherId: dummyId.toString(),
      teacherName: 'Workshop Faculty',
      scheduleGrid: {
        Wednesday: {
          1: { subjectCode: 'CST302', subjectName: 'Compiler Design', period: 1, day: 'Wednesday' },
          2: { subjectCode: 'GXESL208', subjectName: 'IT Workshop', period: 2, day: 'Wednesday' },
          3: { subjectCode: 'CST306', subjectName: 'Algorithm Analysis', period: 3, day: 'Wednesday' },
        },
        Monday: {}, Tuesday: {}, Thursday: {}, Friday: {},
      },
      allocations: [
        { subjectCode: 'CST302', day: 'Wednesday', period: 1 },
        { subjectCode: 'GXESL208', day: 'Wednesday', period: 2 },
        { subjectCode: 'CST306', day: 'Wednesday', period: 3 },
      ],
    };

    const res = scoreSingleFacultySchedule(record, DEFAULT_FACULTY_SCORING_CONFIG);
    assert.equal(res.threeConsecutiveCount, 0, 'Workshop must not trigger 3-consec theory');
    assert.equal(res.isGated, false);
  });

  // Condition 8: Lunch boundaries (P3 and P4) are respected and trigger lunch-flanking diagnostics
  test('Condition 8: Lunch boundaries (P3 and P4) are respected and trigger lunch-flanking diagnostics', () => {
    const dummyId = new mongoose.Types.ObjectId();
    const dummyTeacher = { _id: dummyId, id: dummyId.toString(), name: 'Flanked Faculty' };
    const dummyTT = {
      classTimetables: [{
        classId: new mongoose.Types.ObjectId(),
        className: 'S6 CSE A',
        slots: [
          { day: 'Thursday', period: 3, subjectCode: 'CST302', subjectName: 'Compiler Design', teacherId: dummyId, teacherName: 'Flanked Faculty' },
          { day: 'Thursday', period: 4, subjectCode: 'CST304', subjectName: 'Computer Networks', teacherId: dummyId, teacherName: 'Flanked Faculty' },
        ],
      }],
    };

    const profile = analyzeFacultyPersonalTimetable(dummyTeacher, dummyTT);
    const flankDiag = profile.breakDiagnosticFindings.filter(f => f.type === 'TEACHING_BEFORE_AND_AFTER_LUNCH');
    assert.equal(flankDiag.length, 1, 'Must detect 1 TEACHING_BEFORE_AND_AFTER_LUNCH finding');
    assert.equal(flankDiag[0].day, 'Thursday');
  });

  // Condition 9: Unknown activity classification produces UNKNOWN and diagnostic finding
  test('Condition 9: Unknown activity classification produces UNKNOWN and diagnostic finding, not silent exemption', () => {
    const unkSlot = { subjectCode: 'XYZ999', subjectName: 'Mystery Session', subjectType: 'mystery' };
    const unkClass = classifyActivity(unkSlot);
    assert.equal(unkClass.type, ACTIVITY_TYPES.UNKNOWN);
    assert.equal(unkClass.isOrdinaryTheory, false, 'Must NOT be silently treated as theory');
    assert.equal(unkClass.isExemptFromFatigue, false, 'Must NOT be silently treated as exempt');
    assert.equal(unkClass.requiresReview, true, 'Must flag requiresReview');
    assert.equal(isUnknownActivity(unkSlot), true);

    const dummyId = new mongoose.Types.ObjectId();
    const dummyTeacher = { _id: dummyId, id: dummyId.toString(), name: 'Unknown Faculty' };
    const dummyTT = {
      classTimetables: [{
        classId: new mongoose.Types.ObjectId(),
        className: 'S4 CSE A',
        slots: [
          { day: 'Monday', period: 1, subjectCode: 'XYZ999', subjectName: 'Mystery Session', teacherId: dummyId, teacherName: 'Unknown Faculty' },
        ],
      }],
    };

    const profile = analyzeFacultyPersonalTimetable(dummyTeacher, dummyTT);
    const unkDiag = profile.breakDiagnosticFindings.filter(f => f.type === 'UNKNOWN_ACTIVITY_TYPE');
    assert.equal(unkDiag.length, 1, 'Must detect UNKNOWN_ACTIVITY_TYPE diagnostic');
    assert.equal(unkDiag[0].severity, 'warning_classification_required');
  });

  // Condition 10: Consistency between analyzer, scorer, and optimizer classification
  test('Condition 10: Consistency between analyzer, scorer, and optimizer classification', () => {
    const analyzer = require('../src/services/engine/facultyPersonalTimetableAnalyzer');
    const scorer = require('../src/services/engine/facultyTimetableScorer');
    const optimizer = require('../src/services/engine/facultyPersonalTimetableOptimizer');

    const sampleSlots = [
      { subjectCode: 'CST404', subjectName: 'Comprehensive Course Viva' },
      { subjectCode: 'PBCST404', subjectName: 'Computer Organization & Architecture' },
      { subjectCode: 'CST416', subjectName: 'Project Phase-2' },
      { subjectCode: 'PCCSL407', subjectName: 'OS Lab', isLabBlock: true },
      { subjectCode: 'PLACE-S4A', subjectName: 'Placement Hour' },
      { subjectCode: 'GXESL208', subjectName: 'IT Workshop' },
      { subjectCode: 'XYZ999', subjectName: 'Unknown Course' },
    ];

    sampleSlots.forEach(slot => {
      const aInst = analyzer.isInstitutionalLabOrProject(slot);
      const sInst = scorer.isInstitutionalLabOrProject(slot);
      const oInst = optimizer.isInstitutionalLabOrProject(slot);
      assert.equal(aInst, sInst, `Analyzer and scorer institutional check must match for ${slot.subjectCode}`);
      assert.equal(sInst, oInst, `Scorer and optimizer institutional check must match for ${slot.subjectCode}`);

      const aTheo = analyzer.isOrdinaryTheory(slot);
      const sTheo = scorer.isOrdinaryTheory(slot);
      const oTheo = optimizer.isOrdinaryTheory(slot);
      assert.equal(aTheo, sTheo, `Analyzer and scorer theory check must match for ${slot.subjectCode}`);
      assert.equal(sTheo, oTheo, `Scorer and optimizer theory check must match for ${slot.subjectCode}`);
    });
  });

});
