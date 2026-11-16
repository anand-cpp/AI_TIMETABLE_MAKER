/**
 * tests/shared_session_and_identity_hardening.test.js
 * 
 * REGRESSION SUITE: SHARED SESSION AUTHORIZATION & FACULTY IDENTITY HARDENING
 * 
 * Verifies Phase 3 high-risk areas:
 * - A: S8 CST416 shared Capstone strict identity (reject isSharedProject loophole)
 * - B: Elective and minor shared-session group matching (reject group ID mismatch)
 * - C: Faculty identity normalization with name ambiguity protection
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Timetable = require('../src/models/Timetable');
const { loadData } = require('../src/services/engine/dataLoader');
const { validateGrid, validateOutput, slotTeacherIds } = require('../src/services/engine/constraintValidator');
const { auditTimetable } = require('../src/services/engine/independentValidator');
const { timetableToGrid } = require('../src/services/rebalanceService');

describe('PHASE 3 HARDENING: SHARED-SESSION AUTHORIZATION & IDENTITY INTEGRITY', () => {
  let data;
  let baseTimetable;
  let baseGrid;

  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    baseTimetable = await Timetable.findOne({ isAccepted: true });
    assert.ok(baseTimetable, 'Authoritative timetable must exist');
    data = await loadData({});
    baseGrid = timetableToGrid(baseTimetable);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // -------------------------------------------------------------
  // Test 1: isSharedProject Loophole on Ordinary Subject
  // -------------------------------------------------------------
  test('Test 1: Ordinary class with isSharedProject: true must NOT be exempted from double-booking check', () => {
    const s8a = data.classes.find(c => c.name === 'S8 CSE A');
    const s8b = data.classes.find(c => c.name === 'S8 CSE B');
    assert.ok(s8a && s8b);

    const gunaId = '6aeccf3cbb1e84200c3db02b';
    const testGrid = JSON.parse(JSON.stringify(baseGrid));

    // Place an ordinary subject (e.g. CST101) with isSharedProject: true on Thursday P1 for Dr Gunasekaran
    testGrid[s8a._id.toString()]['Thursday'][1] = {
      subjectCode: 'CST101',
      subjectName: 'Ordinary Computer Science',
      isSharedProject: true, // Spoofed flag!
      sharedSessionId: 'spoofed_capstone_session_uuid',
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      roomName: 'Room 501',
      day: 'Thursday',
      period: 1,
      isEmpty: false,
    };
    testGrid[s8b._id.toString()]['Thursday'][1] = {
      subjectCode: 'CST101',
      subjectName: 'Ordinary Computer Science',
      isSharedProject: true, // Spoofed flag!
      sharedSessionId: 'spoofed_capstone_session_uuid',
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      roomName: 'Room 502',
      day: 'Thursday',
      period: 1,
      isEmpty: false,
    };

    const val = validateGrid(testGrid, data);
    const teacherCollisionsVal = (val.violations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Thursday' && v.period === 1);
    assert.ok(teacherCollisionsVal.length > 0, 'constraintValidator must flag TEACHER_DOUBLE_BOOKED for ordinary class with isSharedProject: true');

    const audit = auditTimetable(testGrid, data);
    const teacherCollisionsAudit = audit.hardViolations.filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Thursday' && v.period === 1);
    assert.ok(teacherCollisionsAudit.length > 0, 'auditTimetable must flag TEACHER_DOUBLE_BOOKED for ordinary class with isSharedProject: true');
  });

  // -------------------------------------------------------------
  // Test 2: Non-S8 Class Claiming CST416
  // -------------------------------------------------------------
  test('Test 2: Non-S8 class claiming CST416 on Thursday with Dr Gunasekaran must be rejected as double-booking', () => {
    const s2a = data.classes.find(c => c.name === 'S2 CSE A');
    const s8a = data.classes.find(c => c.name === 'S8 CSE A');
    assert.ok(s2a && s8a);

    const gunaId = '6aeccf3cbb1e84200c3db02b';
    const testGrid = JSON.parse(JSON.stringify(baseGrid));

    testGrid[s2a._id.toString()]['Thursday'][1] = {
      subjectCode: 'CST416',
      subjectName: 'Project Phase-2',
      isSharedProject: true,
      sharedSessionId: testGrid[s8a._id.toString()]['Thursday'][1]?.sharedSessionId || 'sess1',
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      day: 'Thursday',
      period: 1,
      isEmpty: false,
    };

    const val = validateGrid(testGrid, data);
    const collisions = (val.violations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Thursday' && v.period === 1);
    assert.ok(collisions.length > 0, 'Non-S8 class cannot share CST416 with S8 class');
  });

  // -------------------------------------------------------------
  // Test 3: CST416 on Non-Authorized Day (e.g. Wednesday)
  // -------------------------------------------------------------
  test('Test 3: CST416 scheduled simultaneously on non-authorized day (Wednesday) must be detected as collision', () => {
    const s8a = data.classes.find(c => c.name === 'S8 CSE A');
    const s8b = data.classes.find(c => c.name === 'S8 CSE B');
    const gunaId = '6aeccf3cbb1e84200c3db02b';
    const testGrid = JSON.parse(JSON.stringify(baseGrid));

    testGrid[s8a._id.toString()]['Wednesday'][1] = {
      subjectCode: 'CST416',
      subjectName: 'Project Phase-2',
      isSharedProject: true,
      sharedSessionId: 'wed_capstone_sess',
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      roomName: 'Room 501',
      day: 'Wednesday',
      period: 1,
      isEmpty: false,
    };
    testGrid[s8b._id.toString()]['Wednesday'][1] = {
      subjectCode: 'CST416',
      subjectName: 'Project Phase-2',
      isSharedProject: true,
      sharedSessionId: 'wed_capstone_sess',
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      roomName: 'Room 502',
      day: 'Wednesday',
      period: 1,
      isEmpty: false,
    };

    const val = validateGrid(testGrid, data);
    const collisions = (val.violations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Wednesday' && v.period === 1);
    assert.ok(collisions.length > 0, 'CST416 on Wednesday is not authorized and must be flagged as double-booked');
  });

  // -------------------------------------------------------------
  // Test 4: CST416 with Unauthorized Faculty Member
  // -------------------------------------------------------------
  test('Test 4: CST416 scheduled with unauthorized faculty member (not Dr Gunasekaran) must be flagged', () => {
    const s8a = data.classes.find(c => c.name === 'S8 CSE A');
    const s8b = data.classes.find(c => c.name === 'S8 CSE B');
    const otherTeacher = data.teachers.find(t => t.name.includes('Shiji'));
    const tid = otherTeacher._id.toString();
    const testGrid = JSON.parse(JSON.stringify(baseGrid));

    testGrid[s8a._id.toString()]['Thursday'][1] = {
      subjectCode: 'CST416',
      subjectName: 'Project Phase-2',
      isSharedProject: true,
      sharedSessionId: 'thu_p1_shiji',
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [otherTeacher.name],
      roomName: 'Room 501',
      day: 'Thursday',
      period: 1,
      isEmpty: false,
    };
    testGrid[s8b._id.toString()]['Thursday'][1] = {
      subjectCode: 'CST416',
      subjectName: 'Project Phase-2',
      isSharedProject: true,
      sharedSessionId: 'thu_p1_shiji',
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [otherTeacher.name],
      roomName: 'Room 502',
      day: 'Thursday',
      period: 1,
      isEmpty: false,
    };

    const val = validateGrid(testGrid, data);
    const collisions = (val.violations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Thursday' && v.period === 1);
    assert.ok(collisions.length > 0, 'Unauthorized teacher cannot teach CST416 simultaneously across sections');
  });

  // -------------------------------------------------------------
  // Test 5: CST416 with Mismatched sharedSessionId
  // -------------------------------------------------------------
  test('Test 5: CST416 allocations with mismatched sharedSessionId must be detected as collision', () => {
    const s8a = data.classes.find(c => c.name === 'S8 CSE A');
    const s8b = data.classes.find(c => c.name === 'S8 CSE B');
    const gunaId = '6aeccf3cbb1e84200c3db02b';
    const testGrid = JSON.parse(JSON.stringify(baseGrid));

    testGrid[s8a._id.toString()]['Thursday'][1] = {
      subjectCode: 'CST416',
      subjectName: 'Project Phase-2',
      isSharedProject: true,
      sharedSessionId: 'SESSION_AAA',
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      roomName: 'Room 501',
      day: 'Thursday',
      period: 1,
      isEmpty: false,
    };
    testGrid[s8b._id.toString()]['Thursday'][1] = {
      subjectCode: 'CST416',
      subjectName: 'Project Phase-2',
      isSharedProject: true,
      sharedSessionId: 'SESSION_BBB', // Mismatched!
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      roomName: 'Room 502',
      day: 'Thursday',
      period: 1,
      isEmpty: false,
    };

    const val = validateGrid(testGrid, data);
    const collisions = (val.violations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Thursday' && v.period === 1);
    assert.ok(collisions.length > 0, 'Mismatched sharedSessionId must be detected as collision');
  });

  // -------------------------------------------------------------
  // Test 6: CST416 with Wrong Room Assignment
  // -------------------------------------------------------------
  test('Test 6: CST416 allocations with wrong room assignment must be flagged', () => {
    const s8a = data.classes.find(c => c.name === 'S8 CSE A');
    const s8b = data.classes.find(c => c.name === 'S8 CSE B');
    const gunaId = '6aeccf3cbb1e84200c3db02b';
    const testGrid = JSON.parse(JSON.stringify(baseGrid));

    // Put both in Room 101 (invalid room for Capstone)
    testGrid[s8a._id.toString()]['Thursday'][1] = {
      subjectCode: 'CST416',
      subjectName: 'Project Phase-2',
      isSharedProject: true,
      sharedSessionId: 'shared_thu_p1',
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      roomName: 'Room 101', // Wrong room! Must be Room 501
      day: 'Thursday',
      period: 1,
      isEmpty: false,
    };
    testGrid[s8b._id.toString()]['Thursday'][1] = {
      subjectCode: 'CST416',
      subjectName: 'Project Phase-2',
      isSharedProject: true,
      sharedSessionId: 'shared_thu_p1',
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      roomName: 'Room 101', // Double booked room!
      day: 'Thursday',
      period: 1,
      isEmpty: false,
    };

    const val = validateGrid(testGrid, data);
    const roomViolations = (val.violations || []).filter(v => v.type === 'LAB_ROOM_CONFLICT' || v.type === 'FIXED_SLOT_VIOLATION' || v.type === 'ROOM_DOUBLE_BOOKING');
    assert.ok(roomViolations.length > 0, 'Wrong room or room double booking must be detected');
  });

  // -------------------------------------------------------------
  // Test 7: Elective Group ID Mismatch Rejection
  // -------------------------------------------------------------
  test('Test 7: Classes in different elective groups (grp1 vs grp2) with same subjectCode must be flagged as collision', () => {
    const s4a = data.classes.find(c => c.name === 'S4 CSE A');
    const s6a = data.classes.find(c => c.name === 'S6 CSE A');
    const teacher = data.teachers.find(t => t.name.includes('Satheeshkumar'));
    const tid = teacher._id.toString();

    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    testGrid[s4a._id.toString()]['Monday'][1] = {
      subjectCode: 'PE_ELECTIVE_X',
      subjectName: 'Elective X',
      isElective: true,
      electiveGroupId: 'GROUP_ALPHA',
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      day: 'Monday',
      period: 1,
      isEmpty: false,
    };
    testGrid[s6a._id.toString()]['Monday'][1] = {
      subjectCode: 'PE_ELECTIVE_X',
      subjectName: 'Elective X',
      isElective: true,
      electiveGroupId: 'GROUP_BETA', // DIFFERENT elective group!
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      day: 'Monday',
      period: 1,
      isEmpty: false,
    };

    const val = validateGrid(testGrid, data);
    const collisionsVal = (val.violations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Monday' && v.period === 1);
    assert.ok(collisionsVal.length > 0, 'constraintValidator must detect double booking between different elective groups');

    const audit = auditTimetable(testGrid, data);
    const collisionsAudit = audit.hardViolations.filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Monday' && v.period === 1);
    assert.ok(collisionsAudit.length > 0, 'independentValidator must detect double booking between different elective groups');
  });

  // -------------------------------------------------------------
  // Test 8: Minor Group ID Mismatch Rejection
  // -------------------------------------------------------------
  test('Test 8: Classes in different minor groups (min1 vs min2) with same subjectCode must be flagged as collision', () => {
    const s4a = data.classes.find(c => c.name === 'S4 CSE A');
    const s4b = data.classes.find(c => c.name === 'S4 CSE B');
    const teacher = data.teachers.find(t => t.name.includes('Shiji'));
    const tid = teacher._id.toString();

    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    testGrid[s4a._id.toString()]['Monday'][2] = {
      subjectCode: 'MINOR_CYBER',
      subjectName: 'Cyber Ethics',
      isMinor: true,
      subjectType: 'minor',
      minorGroupId: 'MINOR_TRACK_1',
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      day: 'Monday',
      period: 2,
      isEmpty: false,
    };
    testGrid[s4b._id.toString()]['Monday'][2] = {
      subjectCode: 'MINOR_CYBER',
      subjectName: 'Cyber Ethics',
      isMinor: true,
      subjectType: 'minor',
      minorGroupId: 'MINOR_TRACK_2', // DIFFERENT minor group!
      teacherId: tid,
      teacherIds: [tid],
      teacherNames: [teacher.name],
      day: 'Monday',
      period: 2,
      isEmpty: false,
    };

    const val = validateGrid(testGrid, data);
    const collisionsVal = (val.violations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Monday' && v.period === 2);
    assert.ok(collisionsVal.length > 0, 'constraintValidator must detect double booking between different minor groups');

    const audit = auditTimetable(testGrid, data);
    const collisionsAudit = audit.hardViolations.filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.day === 'Monday' && v.period === 2);
    assert.ok(collisionsAudit.length > 0, 'independentValidator must detect double booking between different minor groups');
  });

  // -------------------------------------------------------------
  // Test 9: Faculty Name Ambiguity Detection
  // -------------------------------------------------------------
  test('Test 9: Multiple faculty members with identical names must NOT be arbitrarily resolved', () => {
    // Construct dummy teachers with ambiguous name "Ms Deepthi"
    const dummyTeachers = [
      { _id: 'tid_001', name: 'Ms Deepthi' },
      { _id: 'tid_002', name: 'Ms Deepthi' }, // Identical name!
    ];
    const dummyData = {
      ...data,
      teachers: dummyTeachers,
      teacherMap: {
        'tid_001': dummyTeachers[0],
        'tid_002': dummyTeachers[1],
      }
    };

    const teacherNameToIdMap = {};
    const ambiguousNames = new Set();
    for (const t of dummyTeachers) {
      const norm = t.name.trim().toLowerCase();
      if (teacherNameToIdMap[norm] && teacherNameToIdMap[norm] !== t._id) {
        ambiguousNames.add(norm);
      } else {
        teacherNameToIdMap[norm] = t._id;
      }
    }
    for (const name of ambiguousNames) {
      delete teacherNameToIdMap[name];
    }

    assert.ok(ambiguousNames.has('ms deepthi'), 'ms deepthi must be flagged as ambiguous');
    assert.equal(teacherNameToIdMap['ms deepthi'], undefined, 'Ambiguous name must NOT map to any arbitrary ID');

    // Slot having only ambiguous name without ID cannot arbitrarily resolve to tid_001 or tid_002
    const slot = { teacherNames: ['Ms Deepthi'] };
    const resolvedIds = slotTeacherIds(slot, dummyData.teacherMap, teacherNameToIdMap);
    assert.equal(resolvedIds.length, 0, 'Slot with ambiguous name must not arbitrarily select an ID');
  });

  // -------------------------------------------------------------
  // Test 10: Authorized S8 Capstone Joint Supervision Remains 100% Valid
  // -------------------------------------------------------------
  test('Test 10: Authorized S8 CST416 Capstone Session (Thu/Fri P1-6, Dr Gunasekaran, Room 501/502) is accepted without false alarm', () => {
    const val = validateOutput(baseGrid, data, []);
    assert.equal(val.checks.zero_teacher_conflicts, true, 'Authorized base grid must have zero teacher conflicts');

    const audit = auditTimetable(baseGrid, data);
    const capstoneConflicts = audit.hardViolations.filter(
      v => v.type === 'TEACHER_DOUBLE_BOOKED' &&
      (v.teacherName?.includes('Gunasekaran') || v.teacherId === '6aeccf3cbb1e84200c3db02b') &&
      (v.day === 'Thursday' || v.day === 'Friday')
    );
    assert.equal(capstoneConflicts.length, 0, 'Authorized S8 Capstone must have strictly 0 teacher collisions');
  });
});
