const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  validateLabEligibility,
  validateGlobalLabOccupancy,
  checkLabAvailability,
} = require('../src/services/engine/labValidationService');
const { runConflictRepair } = require('../src/services/engine/conflictRepairEngine');
const { auditTimetable } = require('../src/services/engine/independentValidator');
const { loadData } = require('../src/services/engine/dataLoader');
const orchestrator = require('../src/services/engine/orchestrator');

test('Mandatory Laboratory Allocation Rules (Part 8.1 - 17 Specific Test Cases)', async (t) => {
  // Test 1: S1 practical assigned to Lab 1 — PASS
  await t.test('Test 1: S1 practical assigned to Lab 1 -> PASS', () => {
    const res = validateLabEligibility(1, 'Lab 1', { type: 'lab', name: 'Programming in C Lab' });
    assert.equal(res.valid, true, 'S1 practical in Lab 1 must pass');
  });

  // Test 2: S1 practical assigned to Lab 2 — PASS
  await t.test('Test 2: S1 practical assigned to Lab 2 -> PASS', () => {
    const res = validateLabEligibility(1, 'Lab 2', { type: 'lab', name: 'Programming in C Lab' });
    assert.equal(res.valid, true, 'S1 practical in Lab 2 must pass');
  });

  // Test 3: S1 practical assigned to Lab 3 — FAIL
  await t.test('Test 3: S1 practical assigned to Lab 3 -> FAIL', () => {
    const res = validateLabEligibility(1, 'Lab 3', { type: 'lab', name: 'Programming in C Lab' });
    assert.equal(res.valid, false, 'S1 practical in Lab 3 must fail');
    assert.equal(res.violationType, 'INVALID_LAB_ASSIGNMENT');
  });

  // Test 4: S1 practical assigned to Lab 4 — FAIL
  await t.test('Test 4: S1 practical assigned to Lab 4 -> FAIL', () => {
    const res = validateLabEligibility(1, 'Lab 4', { type: 'lab', name: 'Programming in C Lab' });
    assert.equal(res.valid, false, 'S1 practical in Lab 4 must fail');
    assert.equal(res.violationType, 'INVALID_LAB_ASSIGNMENT');
  });

  // Test 5: S2 practical assigned to Lab 1 — PASS
  await t.test('Test 5: S2 practical assigned to Lab 1 -> PASS', () => {
    const res = validateLabEligibility(2, 'Lab 1', { type: 'lab', name: 'IT Workshop' });
    assert.equal(res.valid, true, 'S2 practical in Lab 1 must pass');
  });

  // Test 6: S2 practical assigned to Lab 2 — PASS
  await t.test('Test 6: S2 practical assigned to Lab 2 -> PASS', () => {
    const res = validateLabEligibility(2, 'Lab 2', { type: 'lab', name: 'IT Workshop' });
    assert.equal(res.valid, true, 'S2 practical in Lab 2 must pass');
  });

  // Test 7: S2 practical assigned to Lab 3 — FAIL
  await t.test('Test 7: S2 practical assigned to Lab 3 -> FAIL', () => {
    const res = validateLabEligibility(2, 'Lab 3', { type: 'lab', name: 'IT Workshop' });
    assert.equal(res.valid, false, 'S2 practical in Lab 3 must fail');
    assert.equal(res.violationType, 'INVALID_LAB_ASSIGNMENT');
  });

  // Test 8: S2 practical assigned to Lab 4 — FAIL
  await t.test('Test 8: S2 practical assigned to Lab 4 -> FAIL', () => {
    const res = validateLabEligibility(2, 'Lab 4', { type: 'lab', name: 'IT Workshop' });
    assert.equal(res.valid, false, 'S2 practical in Lab 4 must fail');
    assert.equal(res.violationType, 'INVALID_LAB_ASSIGNMENT');
  });

  // Test 9: S1 Mini Project assigned to Lab 3 — PASS
  await t.test('Test 9: S1 Mini Project assigned to Lab 3 -> PASS', () => {
    const res = validateLabEligibility(1, 'Lab 3', { type: 'lab', name: 'Mini Project' });
    assert.equal(res.valid, true, 'S1 Mini Project in Lab 3 must pass');
  });

  // Test 10: S2 Mini Project assigned to Lab 3 — PASS
  await t.test('Test 10: S2 Mini Project assigned to Lab 3 -> PASS', () => {
    const res = validateLabEligibility(2, 'Lab 3', { type: 'lab', name: 'Mini Project' });
    assert.equal(res.valid, true, 'S2 Mini Project in Lab 3 must pass');
  });

  // Test 11: S1/S2 Mini Project assigned to Lab 1, Lab 2 or Lab 4 — FAIL
  await t.test('Test 11: S1/S2 Mini Project in Lab 1, Lab 2 or Lab 4 -> FAIL', () => {
    assert.equal(validateLabEligibility(1, 'Lab 1', { type: 'lab', name: 'Mini Project' }).valid, false);
    assert.equal(validateLabEligibility(2, 'Lab 2', { type: 'lab', name: 'Mini Project' }).valid, false);
    assert.equal(validateLabEligibility(2, 'Lab 4', { type: 'lab', name: 'Mini Project' }).valid, false);
  });

  // Test 12: S3–S8 regular practical assigned to Lab 4 — PASS
  await t.test('Test 12: S3-S8 regular practical assigned to Lab 4 -> PASS', () => {
    assert.equal(validateLabEligibility(3, 'Lab 4', { type: 'lab', name: 'Data Structures Lab' }).valid, true);
    assert.equal(validateLabEligibility(4, 'Lab 4', { type: 'lab', name: 'DBMS Lab' }).valid, true);
    assert.equal(validateLabEligibility(6, 'Lab 4', { type: 'lab', name: 'Systems Lab' }).valid, true);
  });

  // Test 13: S3–S8 regular practical assigned to Lab 1, Lab 2 or Lab 3 — FAIL
  await t.test('Test 13: S3-S8 regular practical in Lab 1, Lab 2 or Lab 3 -> FAIL', () => {
    assert.equal(validateLabEligibility(4, 'Lab 1', { type: 'lab', name: 'DBMS Lab' }).valid, false);
    assert.equal(validateLabEligibility(4, 'Lab 2', { type: 'lab', name: 'DBMS Lab' }).valid, false);
    assert.equal(validateLabEligibility(4, 'Lab 3', { type: 'lab', name: 'DBMS Lab' }).valid, false);
  });

  // Test 14: S3–S8 Mini Project assigned to Lab 4 — PASS
  await t.test('Test 14: S3-S8 Mini Project assigned to Lab 4 -> PASS', () => {
    const res = validateLabEligibility(6, 'Lab 4', { type: 'lab', name: 'Mini Project' });
    assert.equal(res.valid, true, 'S6 Mini Project in Lab 4 must pass');
  });

  // Test 15: S3–S8 Mini Project assigned to Lab 1, Lab 2 or Lab 3 — FAIL
  await t.test('Test 15: S3-S8 Mini Project in Lab 1, Lab 2 or Lab 3 -> FAIL', () => {
    assert.equal(validateLabEligibility(6, 'Lab 1', { type: 'lab', name: 'Mini Project' }).valid, false);
    assert.equal(validateLabEligibility(6, 'Lab 2', { type: 'lab', name: 'Mini Project' }).valid, false);
    assert.equal(validateLabEligibility(6, 'Lab 3', { type: 'lab', name: 'Mini Project' }).valid, false);
  });

  // Test 16: Two practicals assigned to the same lab at overlapping times — FAIL
  await t.test('Test 16: Two practicals in same lab at same time -> FAIL', () => {
    const dummyGrid = {
      'cls1': { 'Monday': { 1: { roomName: 'Lab 4', subjectName: 'OS Lab', isLabBlock: true } } },
      'cls2': { 'Monday': { 1: { roomName: 'Lab 4', subjectName: 'DBMS Lab', isLabBlock: true } } },
    };
    const res = validateGlobalLabOccupancy(dummyGrid, [{ _id: 'cls1', semester: 4 }, { _id: 'cls2', semester: 4 }]);
    assert.equal(res.valid, false, 'Must fail for simultaneous double-booking of Lab 4');
    assert.ok(res.violations.some((v) => v.type === 'LAB_DOUBLE_BOOKING'));
  });

  // Test 17: Multi-period practical with a conflict in its second or third period — FAIL
  await t.test('Test 17: Multi-period practical with conflict in 2nd period -> FAIL', () => {
    const dummyGrid = {
      'cls1': {
        'Monday': {
          1: { roomName: 'Lab 4', subjectName: 'OS Lab', isLabBlock: true },
          2: { roomName: 'Lab 4', subjectName: 'OS Lab', isLabBlock: true },
          3: { roomName: 'Lab 4', subjectName: 'OS Lab', isLabBlock: true },
        },
      },
      'cls2': {
        'Monday': {
          2: { roomName: 'Lab 4', subjectName: 'Systems Lab', isLabBlock: true },
        },
      },
    };
    const res = validateGlobalLabOccupancy(dummyGrid, [{ _id: 'cls1', semester: 4 }, { _id: 'cls2', semester: 6 }]);
    assert.equal(res.valid, false, 'Must fail for collision in period 2 of 3-period block');
    assert.ok(res.violations.some((v) => v.type === 'LAB_DOUBLE_BOOKING' && v.period === 2));
  });
});

test('Automatic Conflict Resolution & Repair Engine (Part 8.2)', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI);
  const data = await loadData({});

  // -------------------------------------------------------------
  // Scenario 1: Injected Ineligible Laboratory Assignment
  // -------------------------------------------------------------
  await t.test('Scenario 1: Auto-repair of invalid laboratory assignment', () => {
    const mockGrid = {
      '6aeccf3cbb1e84200c3db019': {
        'Monday': {
          1: { subjectCode: 'GXEST204-P', subjectName: 'Programming in C Lab', isLabBlock: true, roomName: 'Lab 4', subjectType: 'lab', teacherIds: [] },
          2: { subjectCode: 'GXEST204-P', subjectName: 'Programming in C Lab', isLabBlock: true, roomName: 'Lab 4', subjectType: 'lab', teacherIds: [] },
        },
      },
    };

    const initialAudit = auditTimetable(mockGrid, data, { checkSubjectHours: false });
    assert.ok(initialAudit.hardViolations.some((v) => v.type === 'INVALID_LAB_ASSIGNMENT'));

    const repairRes = runConflictRepair(mockGrid, data, { checkSubjectHours: false });
    assert.ok(repairRes.repairsAppliedCount > 0, 'Repair must be applied');
    assert.equal(repairRes.finalViolationsCount, 0, 'Must have 0 hard violations after repair');

    // Confirm it was reassigned to Lab 1 or Lab 2
    const repairedRoom = repairRes.repairedGrid['6aeccf3cbb1e84200c3db019']['Monday'][1].roomName;
    assert.ok(['Lab 1', 'Lab 2'].includes(repairedRoom), 'Must be repaired to Lab 1 or Lab 2');
  });

  // -------------------------------------------------------------
  // Scenario 2: Auto-repair of 3 consecutive teaching periods (Faculty Rest Gap)
  // -------------------------------------------------------------
  await t.test('Scenario 2: Auto-repair of 3 consecutive teaching periods', () => {
    const teacherId = '6aeccf3cbb1e84200c3db036'; // Ms Neha
    const mockGrid = {
      '6aeccf3cbb1e84200c3db01d': {
        'Tuesday': {
          1: { subjectCode: 'THEORY_A', subjectName: 'Theory A', teacherIds: [teacherId], isEmpty: false },
          2: { subjectCode: 'THEORY_B', subjectName: 'Theory B', teacherIds: [teacherId], isEmpty: false },
          3: { subjectCode: 'THEORY_C', subjectName: 'Theory C', teacherIds: [teacherId], isEmpty: false },
          4: { subjectCode: 'OTHER', subjectName: 'Other Subject', teacherIds: ['6aeccf3cbb1e84200c3db032'], isEmpty: false },
        },
        'Wednesday': {
          1: { subjectCode: 'OTHER_2', subjectName: 'Other Subject 2', teacherIds: ['6aeccf3cbb1e84200c3db032'], isEmpty: false },
        },
      },
    };

    const initialAudit = auditTimetable(mockGrid, data, { checkSubjectHours: false });
    assert.ok(initialAudit.hardViolations.some((v) => v.type === 'FACULTY_REST_GAP'));

    const repairRes = runConflictRepair(mockGrid, data, { checkSubjectHours: false });
    assert.ok(repairRes.repairsAppliedCount > 0, 'Rest-gap repair must be applied');
    assert.equal(repairRes.finalViolationsCount, 0, 'Must eliminate 3 consecutive periods');
  });

  // -------------------------------------------------------------
  // Scenario 3: Impossible Scenario Detection & Reporting (Outcome C)
  // -------------------------------------------------------------
  await t.test('Scenario 3: Impossible scenario triggers Outcome C (Infeasible)', () => {
    const impossibleGrid = {
      'clsA': {
        'Monday': { 1: { roomName: 'Lab 4', subjectName: 'OS Lab', isLabBlock: true, subjectCode: 'PCCSL407', isLocked: true } },
      },
      'clsB': {
        'Monday': { 1: { roomName: 'Lab 4', subjectName: 'DBMS Lab', isLabBlock: true, subjectCode: 'PCCSL408', isLocked: true } },
      },
    };

    const audit = auditTimetable(impossibleGrid, data);
    assert.equal(audit.outcome, 'INFEASIBLE', 'Must detect infeasible state');
    assert.equal(audit.isPublishable, false, 'Must not be publishable');
  });

  await mongoose.disconnect();
});

test('Full Pre-Publication Generation & Validation Pipeline (Part 8.3)', async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await orchestrator.run({ allowOverload: true });

  assert.equal(result.success, true, 'Generation orchestrator must return success');
  assert.ok(result.pipelineStages.length >= 7, 'Pipeline must execute all stages');
  assert.equal(result.pipelineStages[0].stage, 'REQUIREMENT_VALIDATION');
  assert.equal(result.pipelineStages[0].status, 'COMPLETED');
  assert.ok(result.pipelineStages.some((s) => s.stage === 'AUTOMATIC_REPAIR'));
  assert.ok(result.pipelineStages.some((s) => s.stage === 'INDEPENDENT_VALIDATION'));
  assert.ok(result.pipelineStages.some((s) => s.stage === 'PUBLICATION_DECISION'));

  // Verify independent audit exists and is authoritative
  assert.ok(result.independentAudit, 'Independent audit must be attached');
  assert.ok(result.publicationOutcome, 'Publication outcome must be defined');

  await mongoose.disconnect();
});
