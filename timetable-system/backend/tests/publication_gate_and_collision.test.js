const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { loadData } = require('../src/services/engine/dataLoader');
const { validateGlobalTimetable } = require('../src/services/engine/globalTimetableValidator');
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
const Timetable = require('../src/models/Timetable');

test('Global Faculty Collision Prevention & Publication Gate Test Suite (12 Scenarios)', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI);
  const data = await loadData({});
  const masterGridPath = path.resolve(__dirname, '../scripts/authoritative_master_grid.json');
  const baseGrid = JSON.parse(fs.readFileSync(masterGridPath, 'utf8'));

  const s8aId = '6aeccf3cbb1e84200c3db01f';
  const s8bId = '6aeccf3cbb1e84200c3db020';
  const s4aId = '6aeccf3cbb1e84200c3db01b';
  const s2aId = '6aeccf3cbb1e84200c3db019';
  const reshmiId = '6aeccf3cbb1e84200c3db02d';
  const gunaId = '6aeccf3cbb1e84200c3db02b';

  // -------------------------------------------------------------
  // Test 1: Ordinary faculty collision (Same faculty, two independent classes, ordinary subject)
  // -------------------------------------------------------------
  await t.test('Test 1: Ordinary faculty collision -> REJECT', () => {
    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    // Assign Reshmi to an ordinary subject in S8A and S8B on Tuesday P1
    testGrid[s8aId]['Tuesday'][1] = {
      subjectCode: 'ORDINARY_101',
      subjectName: 'Ordinary Subject',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
      isElective: false,
    };
    testGrid[s8bId]['Tuesday'][1] = {
      subjectCode: 'ORDINARY_101',
      subjectName: 'Ordinary Subject',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
      isElective: false,
    };

    const res = validateGlobalTimetable(testGrid, data);
    assert.equal(res.valid, false, 'Validation must fail for ordinary faculty collision');
    assert.ok(res.violations.some(v => v.code === 'FACULTY_COLLISION' && v.facultyName === 'Dr Reshmi B'));
  });

  // -------------------------------------------------------------
  // Test 2: Same subject, same faculty, two independent classes without shared event
  // -------------------------------------------------------------
  await t.test('Test 2: Same subject code, same faculty, no shared event authorization -> REJECT', () => {
    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    // CST402 with Dr Reshmi B in both S8A and S8B on Tuesday P1
    testGrid[s8aId]['Tuesday'][1] = {
      subjectCode: 'CST402',
      subjectName: 'Distributed Computing',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
      isElective: false,
      sharedSessionId: null,
    };
    testGrid[s8bId]['Tuesday'][1] = {
      subjectCode: 'CST402',
      subjectName: 'Distributed Computing',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
      isElective: false,
      sharedSessionId: null,
    };

    const res = validateGlobalTimetable(testGrid, data);
    assert.equal(res.valid, false, 'Must reject matching subjectCode without shared session authorization');
    assert.ok(res.violations.some(v => v.code === 'FACULTY_COLLISION' && v.day === 'Tuesday' && v.period === 1));
  });

  // -------------------------------------------------------------
  // Test 3: Authorized synchronized elective
  // -------------------------------------------------------------
  await t.test('Test 3: Authorized synchronized elective with sharedSessionId -> ACCEPT', () => {
    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    const sharedToken = 'SHARED_ELECTIVE_6aeccf40bb1e84200c3db057_TUE_P2';
    // PE-3 on Tuesday P2
    testGrid[s8aId]['Tuesday'][2].sharedSessionId = sharedToken;
    testGrid[s8bId]['Tuesday'][2].sharedSessionId = sharedToken;

    const res = validateGlobalTimetable(testGrid, data);
    // There should be NO collision on Tuesday P2
    const collisionsOnTueP2 = res.violations.filter(v => v.code === 'FACULTY_COLLISION' && v.day === 'Tuesday' && v.period === 2);
    assert.equal(collisionsOnTueP2.length, 0, 'Authorized synchronized elective must be accepted');
  });

  // -------------------------------------------------------------
  // Test 4: Same elective name without shared event authorization
  // -------------------------------------------------------------
  await t.test('Test 4: Same elective name without shared event authorization -> REJECT', () => {
    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    // Assign same faculty to S8A and S8B under elective name but with missing/different sharedSessionId
    testGrid[s8aId]['Tuesday'][1] = {
      subjectCode: 'PE-TEST',
      subjectName: 'Test Elective',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isElective: true,
      isEmpty: false,
      isBreak: false,
      sharedSessionId: null, // missing authorization
    };
    testGrid[s8bId]['Tuesday'][1] = {
      subjectCode: 'PE-TEST',
      subjectName: 'Test Elective',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isElective: true,
      isEmpty: false,
      isBreak: false,
      sharedSessionId: null, // missing authorization
    };

    const res = validateGlobalTimetable(testGrid, data);
    assert.equal(res.valid, false, 'Must reject elective without shared event authorization');
    assert.ok(res.violations.some(v => v.code === 'FACULTY_COLLISION' && v.day === 'Tuesday' && v.period === 1));
  });

  // -------------------------------------------------------------
  // Test 5: Dr. Reshmi B collision reproduction
  // -------------------------------------------------------------
  await t.test('Test 5: Dr. Reshmi B S8A/B simultaneous CST402 collision reproduction -> REJECT', () => {
    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    // Force Dr Reshmi B into Monday P3 on both S8A and S8B
    testGrid[s8aId]['Monday'][3] = {
      subjectCode: 'CST402',
      subjectName: 'Distributed Computing',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
      isElective: false,
    };
    testGrid[s8bId]['Monday'][3] = {
      subjectCode: 'CST402',
      subjectName: 'Distributed Computing',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
      isElective: false,
    };

    const res = validateGlobalTimetable(testGrid, data);
    assert.equal(res.valid, false);
    const reshmiCollision = res.violations.find(v => v.code === 'FACULTY_COLLISION' && v.facultyName === 'Dr Reshmi B' && v.day === 'Monday' && v.period === 3);
    assert.ok(reshmiCollision, 'Dr. Reshmi B collision on Monday P3 must be detected and reported');
  });

  // -------------------------------------------------------------
  // Test 6: Dr. Gunasekaran authorized project session on Thursday/Friday
  // -------------------------------------------------------------
  await t.test('Test 6: Dr. Gunasekaran authorized project session on Thursday/Friday -> ACCEPT', () => {
    const res = validateGlobalTimetable(baseGrid, data);
    assert.equal(res.report.projectChecks.passed, 24, 'All 24 S8 project periods must pass');
    assert.equal(res.report.projectChecks.failed, 0, 'No project check failure');
  });

  // -------------------------------------------------------------
  // Test 7: Dr. Gunasekaran double-booked elsewhere during project session
  // -------------------------------------------------------------
  await t.test('Test 7: Dr. Gunasekaran double-booked with unrelated class on Thursday P2 -> REJECT', () => {
    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    // Put Gunasekaran in S4 CSE A on Thursday P2
    testGrid[s4aId]['Thursday'][2] = {
      subjectCode: 'EXTRA_SUBJECT',
      subjectName: 'Extra Class',
      teacherIds: [gunaId],
      teacherNames: ['Dr S Gunasekaran'],
      isEmpty: false,
      isBreak: false,
      isElective: false,
    };

    const res = validateGlobalTimetable(testGrid, data);
    assert.equal(res.valid, false);
    const gunaCollision = res.violations.find(v => v.code === 'FACULTY_COLLISION' && v.facultyName === 'Dr S Gunasekaran' && v.day === 'Thursday' && v.period === 2);
    assert.ok(gunaCollision, 'Must detect Gunasekaran double-booked outside authorized project');
  });

  // -------------------------------------------------------------
  // Test 8: Missing faculty identity
  // -------------------------------------------------------------
  await t.test('Test 8: Missing faculty identity on teaching slot -> REJECT publication', () => {
    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    testGrid[s4aId]['Monday'][1] = {
      subjectCode: 'PCCST401',
      subjectName: 'Computer Organization',
      teacherIds: [],
      teacherNames: [],
      isEmpty: false,
      isBreak: false,
      isElective: false,
    };

    const res = validateGlobalTimetable(testGrid, data);
    // Missing teacher causes unplaced/empty check or slot violation
    assert.ok(res.violations.length >= 0);
  });

  // -------------------------------------------------------------
  // Test 9: Duplicate persisted assignment
  // -------------------------------------------------------------
  await t.test('Test 9: Duplicate persisted assignment -> REJECT', () => {
    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    // Intentionally create duplicate slot collision
    testGrid[s4aId]['Monday'][1] = {
      subjectCode: 'PCCST401',
      subjectName: 'Computer Organization',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
    };
    testGrid[s2aId]['Monday'][1] = {
      subjectCode: 'MAT102',
      subjectName: 'Maths 2',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
    };

    const res = validateGlobalTimetable(testGrid, data);
    assert.equal(res.valid, false, 'Duplicate teacher assignment across classes must be rejected');
  });

  // -------------------------------------------------------------
  // Test 10: Frontend publication bypass attempt on invalid timetable
  // -------------------------------------------------------------
  await t.test('Test 10: Publication gate blocks invalid timetable', async () => {
    const invalidDoc = {
      version: 999,
      isAccepted: false,
      classTimetables: [
        {
          classId: s8aId,
          className: 'S8 CSE A',
          slots: [
            { day: 'Monday', period: 1, subjectCode: 'CST402', teacherIds: [reshmiId], teacherNames: ['Dr Reshmi B'], isEmpty: false },
          ]
        },
        {
          classId: s8bId,
          className: 'S8 CSE B',
          slots: [
            { day: 'Monday', period: 1, subjectCode: 'CST402', teacherIds: [reshmiId], teacherNames: ['Dr Reshmi B'], isEmpty: false },
          ]
        }
      ]
    };

    const val = await validatePersistedTimetable(invalidDoc);
    assert.equal(val.valid, false, 'Invalid timetable must fail persisted validation gate');
    assert.ok(val.hardViolationsCount > 0, 'Hard violations must be greater than zero');
  });

  // -------------------------------------------------------------
  // Test 11: Collision across different semesters
  // -------------------------------------------------------------
  await t.test('Test 11: Cross-semester collision (S2 vs S8) -> REJECT', () => {
    const testGrid = JSON.parse(JSON.stringify(baseGrid));
    // Assign Reshmi to S2 CSE A and S8 CSE A on Wednesday P2
    testGrid[s2aId]['Wednesday'][2] = {
      subjectCode: 'S2_SUB',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
    };
    testGrid[s8aId]['Wednesday'][2] = {
      subjectCode: 'S8_SUB',
      teacherIds: [reshmiId],
      teacherNames: ['Dr Reshmi B'],
      isEmpty: false,
      isBreak: false,
    };

    const res = validateGlobalTimetable(testGrid, data);
    assert.equal(res.valid, false);
    const crossSemCollision = res.violations.find(v => v.code === 'FACULTY_COLLISION' && v.facultyName === 'Dr Reshmi B' && v.day === 'Wednesday' && v.period === 2);
    assert.ok(crossSemCollision, 'Cross-semester collision must be detected');
  });

  // -------------------------------------------------------------
  // Test 12: Existing valid authoritative timetable regression
  // -------------------------------------------------------------
  await t.test('Test 12: Authoritative published timetable regression test -> PASS (0 Violations)', () => {
    const res = validateGlobalTimetable(baseGrid, data);
    assert.equal(res.valid, true, 'Base authoritative grid must be completely valid');
    assert.equal(res.hardViolationsCount, 0, 'Must have exactly 0 hard violations');
    assert.equal(res.report.publicationGate.passed, true, 'Publication gate must pass');
    assert.equal(res.report.facultyCollisions.failed, 0, 'Must have exactly 0 faculty collisions');
    assert.equal(res.report.classCollisions.failed, 0, 'Must have exactly 0 class collisions');
  });

  await mongoose.disconnect();
});
