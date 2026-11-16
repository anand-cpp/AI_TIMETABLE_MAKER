const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

require('../src/models/Timetable');
require('../src/models/Teacher');
require('../src/models/Department');
require('../src/models/Class');
require('../src/models/Subject');

const Timetable = mongoose.model('Timetable');
const Teacher = mongoose.model('Teacher');
const Class = mongoose.model('Class');
const Subject = mongoose.model('Subject');

const {
  analyzeFacultyPersonalTimetable,
  analyzeAllFacultyPersonalTimetables,
  validateFacultyScheduleAgreement,
  analyzeDayRunsAndGaps,
} = require('../src/services/engine/facultyPersonalTimetableAnalyzer');

test.describe('PHASE 1 — FACULTY PERSONAL TIMETABLE ANALYZER TEST SUITE', () => {
  let authoritativeTimetable;
  let teachers;
  let classes;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db');
    }
    authoritativeTimetable = await Timetable.findOne({ isAccepted: true }).sort({ createdAt: -1 }).lean();
    teachers = await Teacher.find().populate('departmentId').lean();
    classes = await Class.find().lean();
  });

  test.after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // SCENARIO 1: Faculty with one teaching period
  test('Scenario 1: Faculty with exactly one teaching period in a day', () => {
    const singleSlotDay = [
      { day: 'Monday', period: 2, subjectName: 'Data Structures', className: 'S4 CSE A' },
    ];
    const dayMetrics = analyzeDayRunsAndGaps(singleSlotDay, 'Monday');
    assert.equal(dayMetrics.dailyTeachingPeriods, 1);
    assert.equal(dayMetrics.freePeriodsCount, 5);
    assert.equal(dayMetrics.firstTeachingPeriod, 2);
    assert.equal(dayMetrics.lastTeachingPeriod, 2);
    assert.equal(dayMetrics.isolatedPeriodsCount, 1);
    assert.equal(dayMetrics.longestConsecutiveRun, 1);
    assert.equal(dayMetrics.consecutiveRuns.length, 1);
  });

  // SCENARIO 2: Faculty with two consecutive periods
  test('Scenario 2: Faculty with two consecutive periods', () => {
    const twoConsecutiveDay = [
      { day: 'Tuesday', period: 1, subjectName: 'Discrete Math', className: 'S4 CSE A' },
      { day: 'Tuesday', period: 2, subjectName: 'Discrete Math', className: 'S4 CSE A' },
    ];
    const dayMetrics = analyzeDayRunsAndGaps(twoConsecutiveDay, 'Tuesday');
    assert.equal(dayMetrics.dailyTeachingPeriods, 2);
    assert.equal(dayMetrics.longestConsecutiveRun, 2);
    assert.equal(dayMetrics.consecutiveRuns.length, 1);
    assert.equal(dayMetrics.consecutiveRuns[0].length, 2);
    assert.equal(dayMetrics.isolatedPeriodsCount, 0);
  });

  // SCENARIO 3: Faculty with a free period between classes (Idle Gap)
  test('Scenario 3: Faculty with a free period between classes', () => {
    const gappedDay = [
      { day: 'Wednesday', period: 1, subjectName: 'Automata', className: 'S6 CSE A' },
      { day: 'Wednesday', period: 3, subjectName: 'Automata', className: 'S6 CSE A' },
    ];
    const dayMetrics = analyzeDayRunsAndGaps(gappedDay, 'Wednesday');
    assert.equal(dayMetrics.dailyTeachingPeriods, 2);
    assert.equal(dayMetrics.gapSequences.length, 1);
    assert.equal(dayMetrics.gapSequences[0].length, 1);
    assert.deepEqual(dayMetrics.gapSequences[0].periods, [2]);
    assert.equal(dayMetrics.totalIdleTime, 1);
    assert.equal(dayMetrics.isolatedPeriodsCount, 2);
  });

  // SCENARIO 4: Faculty with three consecutive periods (Flags diagnostic)
  test('Scenario 4: Faculty with three consecutive periods triggers 3+ consecutive flag', () => {
    const threeConsecutiveSlots = [
      { day: 'Monday', period: 1, subjectName: 'OS Lab', className: 'S4 CSE A' },
      { day: 'Monday', period: 2, subjectName: 'OS Lab', className: 'S4 CSE A' },
      { day: 'Monday', period: 3, subjectName: 'OS Lab', className: 'S4 CSE A' },
    ];
    const dayMetrics = analyzeDayRunsAndGaps(threeConsecutiveSlots, 'Monday');
    assert.equal(dayMetrics.dailyTeachingPeriods, 3);
    assert.equal(dayMetrics.longestConsecutiveRun, 3);
    assert.equal(dayMetrics.consecutiveRuns[0].length, 3);

    // Profile diagnostic test for 3 consecutive theory periods
    const dummyTeacherId = new mongoose.Types.ObjectId();
    const dummyTeacher = { _id: dummyTeacherId, id: dummyTeacherId.toString(), name: 'Test Faculty' };
    const dummyTT = {
      classTimetables: [{
        classId: new mongoose.Types.ObjectId(),
        className: 'S4 CSE A',
        slots: [
          { day: 'Monday', period: 1, subjectCode: 'PCCST403', subjectName: 'Operating Systems', subjectType: 'theory', teacherId: dummyTeacherId, teacherName: 'Test Faculty' },
          { day: 'Monday', period: 2, subjectCode: 'PCCST403', subjectName: 'Operating Systems', subjectType: 'theory', teacherId: dummyTeacherId, teacherName: 'Test Faculty' },
          { day: 'Monday', period: 3, subjectCode: 'PCCST403', subjectName: 'Operating Systems', subjectType: 'theory', teacherId: dummyTeacherId, teacherName: 'Test Faculty' },
        ]
      }]
    };
    const profile = analyzeFacultyPersonalTimetable(dummyTeacher, dummyTT);
    const threeConsecDiag = profile.breakDiagnosticFindings.filter(f => f.type === 'THREE_OR_MORE_CONSECUTIVE_PERIODS');
    assert.ok(threeConsecDiag.length >= 1, 'Expected THREE_OR_MORE_CONSECUTIVE_PERIODS finding for consecutive theory');

    // Profile diagnostic test for institutional lab block (authorized extended block)
    const dummyTTLab = {
      classTimetables: [{
        classId: new mongoose.Types.ObjectId(),
        className: 'S4 CSE A',
        slots: [
          { day: 'Monday', period: 1, subjectName: 'OS Lab', teacherId: dummyTeacherId, teacherName: 'Test Faculty' },
          { day: 'Monday', period: 2, subjectName: 'OS Lab', teacherId: dummyTeacherId, teacherName: 'Test Faculty' },
          { day: 'Monday', period: 3, subjectName: 'OS Lab', teacherId: dummyTeacherId, teacherName: 'Test Faculty' },
        ]
      }]
    };
    const profileLab = analyzeFacultyPersonalTimetable(dummyTeacher, dummyTTLab);
    const labBlockDiag = profileLab.breakDiagnosticFindings.filter(f => f.type === 'INSTITUTIONAL_EXTENDED_BLOCK');
    assert.ok(labBlockDiag.length >= 1, 'Expected INSTITUTIONAL_EXTENDED_BLOCK finding for lab');
  });

  // SCENARIO 5: Faculty with pre-lunch (P3) and post-lunch (P4) classes
  test('Scenario 5: Faculty teaching Period 3 and Period 4 triggers lunch flanking', () => {
    const lunchFlankSlots = [
      { day: 'Thursday', period: 3, subjectName: 'Compiler Design', className: 'S6 CSE A' },
      { day: 'Thursday', period: 4, subjectName: 'Compiler Design', className: 'S6 CSE B' },
    ];
    const dayMetrics = analyzeDayRunsAndGaps(lunchFlankSlots, 'Thursday');
    assert.equal(dayMetrics.teachesAcrossLunch, true);
    assert.equal(dayMetrics.preLunchCount, 1);
    assert.equal(dayMetrics.postLunchCount, 1);
  });

  // SCENARIO 6: Faculty teaching across multiple sections (e.g. S8 CSE A and S8 CSE B)
  test('Scenario 6: Faculty teaching across multiple sections correctly identified and aggregated', () => {
    const guna = teachers.find(t => t.name.includes('Gunasekaran'));
    assert.ok(guna, 'Dr S Gunasekaran must exist in database');
    const profile = analyzeFacultyPersonalTimetable(guna, authoritativeTimetable, classes);
    assert.ok(profile.distinctClasses.some(c => c.includes('S8 CSE A')), 'Must include S8 CSE A');
    assert.ok(profile.distinctClasses.some(c => c.includes('S8 CSE B')), 'Must include S8 CSE B');
    assert.ok(profile.distinctClasses.length >= 2, 'Must teach in 2 or more distinct classes');
  });

  // SCENARIO 7: Faculty teaching across different semesters
  test('Scenario 7: Faculty teaching across different semesters correctly reflects multi-semester distribution', () => {
    const analysis = analyzeAllFacultyPersonalTimetables(authoritativeTimetable, teachers, classes);
    // Find any teacher who teaches in multiple semesters
    const multiSemesterTeacher = analysis.facultyProfiles.find(p => {
      const semesters = new Set(p.distinctClasses.map(c => c.split(' ')[0]));
      return semesters.size > 1;
    });
    assert.ok(multiSemesterTeacher, 'Should identify faculty teaching across semesters');
    assert.ok(multiSemesterTeacher.distinctClasses.length >= 2);
  });

  // SCENARIO 8: Faculty with no teaching allocation
  test('Scenario 8: Faculty with zero teaching allocation reports 0 load and full free periods cleanly', () => {
    const dummyTeacherId = new mongoose.Types.ObjectId();
    const dummyTeacher = { _id: dummyTeacherId, id: dummyTeacherId.toString(), name: 'Unassigned Faculty' };
    const emptyTT = { classTimetables: [] };
    const profile = analyzeFacultyPersonalTimetable(dummyTeacher, emptyTT, []);
    assert.equal(profile.totalWeeklyTeachingPeriods, 0);
    assert.equal(profile.totalWeeklyFreePeriods, 30);
    assert.equal(profile.longestWeeklyConsecutiveSequence, 0);
    assert.equal(profile.distinctClasses.length, 0);
    assert.equal(profile.breakDiagnosticFindings.length, 0);
  });

  // SCENARIO 9: Updated and deleted allocations immediately reflected in faculty view
  test('Scenario 9: Dynamic calculation accurately reflects added and deleted allocations', () => {
    const teacherId = new mongoose.Types.ObjectId();
    const dynamicTT = {
      classTimetables: [{
        classId: new mongoose.Types.ObjectId(),
        className: 'S4 CSE A',
        slots: [
          { day: 'Friday', period: 1, subjectName: 'DBMS', teacherId: teacherId.toString(), teacherName: 'Dyn Teacher' },
          { day: 'Friday', period: 2, subjectName: 'DBMS', teacherId: teacherId.toString(), teacherName: 'Dyn Teacher' },
        ]
      }]
    };
    const tObj = { _id: teacherId, id: teacherId.toString(), name: 'Dyn Teacher' };
    let p = analyzeFacultyPersonalTimetable(tObj, dynamicTT, []);
    assert.equal(p.totalWeeklyTeachingPeriods, 2);

    // Simulate deleting Period 2
    dynamicTT.classTimetables[0].slots.pop();
    p = analyzeFacultyPersonalTimetable(tObj, dynamicTT, []);
    assert.equal(p.totalWeeklyTeachingPeriods, 1);

    // Simulate adding Period 5
    dynamicTT.classTimetables[0].slots.push({
      day: 'Friday', period: 5, subjectName: 'DBMS Lab', teacherId: teacherId.toString(), teacherName: 'Dyn Teacher'
    });
    p = analyzeFacultyPersonalTimetable(tObj, dynamicTT, []);
    assert.equal(p.totalWeeklyTeachingPeriods, 2);
    // Period 1 and Period 5 -> Idle gap between 1 and 5
    assert.equal(p.dailyAnalysis.Friday.gapSequences.length, 1);
    assert.equal(p.dailyAnalysis.Friday.gapSequences[0].length, 3); // periods 2, 3, 4
  });

  // SCENARIO 10: Persisted timetable consistency and 1-to-1 agreement (0 inconsistencies)
  test('Scenario 10: Authoritative timetable achieves 1-to-1 agreement between faculty and class schedules (0 inconsistencies)', () => {
    assert.ok(authoritativeTimetable, 'Authoritative timetable must exist');
    const agreement = validateFacultyScheduleAgreement(authoritativeTimetable, teachers, classes);
    assert.equal(agreement.valid, true, `Validation failed with ${agreement.inconsistencies.length} errors: ${JSON.stringify(agreement.inconsistencies.slice(0, 3))}`);
    assert.equal(agreement.inconsistencies.length, 0);
    assert.ok(agreement.totalFacultySlotsChecked > 0);
    assert.ok(agreement.totalClassSlotsChecked > 0);
  });
});
