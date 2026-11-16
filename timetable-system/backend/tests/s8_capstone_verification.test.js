/**
 * tests/s8_capstone_verification.test.js
 * 
 * CRITICAL VERIFICATION: S8 CST416 CAPSTONE PROJECT (DR GUNASEKARAN, THURSDAY AND FRIDAY)
 * 
 * Verifies all 15 conditions specified in the authoritative audit prompt:
 * 1. Thursday S8 CSE A P1–P6 CST416 is preserved.
 * 2. Thursday S8 CSE B P1–P6 CST416 is preserved.
 * 3. Friday S8 CSE A P1–P6 CST416 is preserved.
 * 4. Friday S8 CSE B P1–P6 CST416 is preserved.
 * 5. All 24 section-period allocations remain present.
 * 6. The correct faculty is assigned in every allocation.
 * 7. Shared-session semantics are correctly handled.
 * 8. Faculty collision detection does not report a false collision for legitimate shared sessions.
 * 9. A genuinely different simultaneous faculty assignment is still detected as a collision.
 * 10. The optimizer cannot move or delete any protected CST416 allocation.
 * 11. The authorized capstone is not counted as an ordinary consecutive-teaching violation.
 * 12. A different faculty member's unrelated six-period teaching run is still detected.
 * 13. Other unauthorized four-or-more consecutive teaching runs are still detected.
 * 14. Period placement remains 100%.
 * 15. All independent validators pass.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Register models
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
const {
  cloneGrid,
  optimizeFacultyTimetable,
  findFourPlusConsecutiveRuns,
  isSlotImmovable,
} = require('../src/services/engine/facultyPersonalTimetableOptimizer');
const { scoreFacultyQuality, scoreSingleFacultySchedule } = require('../src/services/engine/facultyTimetableScorer');
const {
  isAuthorizedCapstoneBlock,
  isInstitutionalLabOrProject,
} = require('../src/services/engine/activityClassifier');

const PROD_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db';
const DAYS = ['Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

describe('CRITICAL VERIFICATION — S8 CST416 CAPSTONE PROJECT (15 CONDITIONS)', () => {
  let data;
  let baseGrid;
  let optResult;
  let s8aClass;
  let s8bClass;
  let gunaTeacher;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(PROD_URI);
    }
    const Timetable = mongoose.model('Timetable');
    const tt = await Timetable.findOne({ isAccepted: true }).lean();
    assert.ok(tt, 'Authoritative accepted timetable must exist');
    data = await loadData({});
    baseGrid = gridFromTimetable(tt);

    s8aClass = data.classes.find(c => c.name === 'S8 CSE A');
    s8bClass = data.classes.find(c => c.name === 'S8 CSE B');
    gunaTeacher = data.teachers.find(t => t.name.includes('Gunasekaran'));

    assert.ok(s8aClass, 'S8 CSE A class must exist');
    assert.ok(s8bClass, 'S8 CSE B class must exist');
    assert.ok(gunaTeacher, 'Dr S Gunasekaran teacher record must exist');

    // Run one shared optimization in-memory
    optResult = optimizeFacultyTimetable(baseGrid, data, { maxPasses: 5 });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // 1. Thursday S8 CSE A P1–P6 CST416 is preserved
  test('Condition 1: Thursday S8 CSE A P1–P6 CST416 is preserved in candidate grid', () => {
    const s8aId = s8aClass._id.toString();
    for (let p = 1; p <= 6; p++) {
      const slot = optResult.grid[s8aId]?.Thursday?.[p];
      assert.ok(slot, `S8 CSE A slot on Thursday P${p} must exist`);
      assert.equal(slot.subjectCode, 'CST416');
      assert.equal(slot.isEmpty, false);
    }
  });

  // 2. Thursday S8 CSE B P1–P6 CST416 is preserved
  test('Condition 2: Thursday S8 CSE B P1–P6 CST416 is preserved in candidate grid', () => {
    const s8bId = s8bClass._id.toString();
    for (let p = 1; p <= 6; p++) {
      const slot = optResult.grid[s8bId]?.Thursday?.[p];
      assert.ok(slot, `S8 CSE B slot on Thursday P${p} must exist`);
      assert.equal(slot.subjectCode, 'CST416');
      assert.equal(slot.isEmpty, false);
    }
  });

  // 3. Friday S8 CSE A P1–P6 CST416 is preserved
  test('Condition 3: Friday S8 CSE A P1–P6 CST416 is preserved in candidate grid', () => {
    const s8aId = s8aClass._id.toString();
    for (let p = 1; p <= 6; p++) {
      const slot = optResult.grid[s8aId]?.Friday?.[p];
      assert.ok(slot, `S8 CSE A slot on Friday P${p} must exist`);
      assert.equal(slot.subjectCode, 'CST416');
      assert.equal(slot.isEmpty, false);
    }
  });

  // 4. Friday S8 CSE B P1–P6 CST416 is preserved
  test('Condition 4: Friday S8 CSE B P1–P6 CST416 is preserved in candidate grid', () => {
    const s8bId = s8bClass._id.toString();
    for (let p = 1; p <= 6; p++) {
      const slot = optResult.grid[s8bId]?.Friday?.[p];
      assert.ok(slot, `S8 CSE B slot on Friday P${p} must exist`);
      assert.equal(slot.subjectCode, 'CST416');
      assert.equal(slot.isEmpty, false);
    }
  });

  // 5. All 24 section-period allocations remain present
  test('Condition 5: All 24 section-period allocations remain present across S8A and S8B', () => {
    let count = 0;
    const s8aId = s8aClass._id.toString();
    const s8bId = s8bClass._id.toString();

    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const slotA = optResult.grid[s8aId]?.[d]?.[p];
        const slotB = optResult.grid[s8bId]?.[d]?.[p];
        if (slotA && slotA.subjectCode === 'CST416') count++;
        if (slotB && slotB.subjectCode === 'CST416') count++;
      }
    }
    assert.equal(count, 24, 'Exactly 24 section-period CST416 allocations must be present');
  });

  // 6. The correct faculty is assigned in every allocation
  test('Condition 6: Dr S Gunasekaran is assigned to all 24 section-period allocations', () => {
    const s8aId = s8aClass._id.toString();
    const s8bId = s8bClass._id.toString();
    const gunaId = gunaTeacher._id.toString();

    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const slotA = optResult.grid[s8aId]?.[d]?.[p];
        const slotB = optResult.grid[s8bId]?.[d]?.[p];

        const matchA = (slotA.teacherNames || []).some(n => n.includes('Gunasekaran')) ||
                       (slotA.teacherIds || []).includes(gunaId) ||
                       slotA.teacherId?.toString() === gunaId;
        const matchB = (slotB.teacherNames || []).some(n => n.includes('Gunasekaran')) ||
                       (slotB.teacherIds || []).includes(gunaId) ||
                       slotB.teacherId?.toString() === gunaId;

        assert.ok(matchA, `S8A ${d} P${p} must be assigned to Dr S Gunasekaran`);
        assert.ok(matchB, `S8B ${d} P${p} must be assigned to Dr S Gunasekaran`);
      }
    }
  });

  // 7. Shared-session semantics are correctly handled
  test('Condition 7: Shared-session semantics are explicitly linked via sharedSessionId and isSharedProject', () => {
    const s8aId = s8aClass._id.toString();
    const s8bId = s8bClass._id.toString();

    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const slotA = optResult.grid[s8aId]?.[d]?.[p];
        const slotB = optResult.grid[s8bId]?.[d]?.[p];

        assert.ok(slotA.sharedSessionId, `S8A ${d} P${p} must have sharedSessionId`);
        assert.ok(slotB.sharedSessionId, `S8B ${d} P${p} must have sharedSessionId`);
        assert.equal(slotA.sharedSessionId, slotB.sharedSessionId, `SharedSessionId must match for ${d} P${p}`);
        assert.equal(slotA.isSharedProject, true);
        assert.equal(slotB.isSharedProject, true);
      }
    }
  });

  // 8. Faculty collision detection does not report a false collision for legitimate shared session
  test('Condition 8: Faculty collision detection accepts authorized S8 CST416 shared sessions without false alarm', () => {
    const valGlob = validateGlobalTimetable(optResult.grid, data);
    assert.equal(valGlob.valid, true);
    assert.equal(valGlob.hardViolationsCount, 0);

    const valOut = validateOutput(optResult.grid, data, []);
    assert.equal(valOut.valid, true);
    assert.equal(valOut.hardViolationsCount, 0);

    const teacherDoubles = (valOut.violations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED');
    assert.equal(teacherDoubles.length, 0, 'Zero TEACHER_DOUBLE_BOOKED violations on candidate timetable');
  });

  // 9. A genuinely different simultaneous faculty assignment is still detected as a collision
  test('Condition 9: Unauthorized simultaneous teaching assignment for same teacher is correctly detected as collision', () => {
    const trialGrid = cloneGrid(optResult.grid);
    const s4a = data.classes.find(c => c.name === 'S4 CSE A');
    const gunaId = gunaTeacher._id.toString();

    // Place Dr Gunasekaran illegally in S4 CSE A on Thursday P1 (while he is teaching S8 CST416)
    trialGrid[s4a._id.toString()].Thursday[1] = {
      subjectCode: 'UNAUTH101',
      subjectName: 'Unauthorized Course',
      teacherId: gunaId,
      teacherIds: [gunaId],
      teacherNames: [gunaTeacher.name],
      isEmpty: false,
      isBreak: false,
      sharedSessionId: null,
      isSharedProject: false,
    };

    const valOut = validateOutput(trialGrid, data, []);
    const doubles = (valOut.violations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED' && v.teacherId === gunaId);
    assert.ok(doubles.length > 0, 'Unauthorized simultaneous assignment must trigger TEACHER_DOUBLE_BOOKED');

    const valGlob = validateGlobalTimetable(trialGrid, data);
    const globCollisions = (valGlob.violations || []).filter(v => v.facultyId === gunaId);
    assert.ok(globCollisions.length > 0, 'Unauthorized simultaneous assignment must trigger global FACULTY_COLLISION');
  });

  // 10. The optimizer cannot move or delete any protected CST416 allocation
  test('Condition 10: isSlotImmovable strictly protects all CST416 slots from moves or deletions', () => {
    const s8aId = s8aClass._id.toString();
    const thuP1 = optResult.grid[s8aId].Thursday[1];
    assert.equal(isSlotImmovable(thuP1), true, 'CST416 slot must be immovable');
    assert.equal(isInstitutionalLabOrProject(thuP1), true, 'CST416 slot must be institutional lab/project');

    // Verify grid after optimization has exact same 12 slots for S8A and S8B as baseGrid
    for (const d of ['Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        assert.equal(optResult.grid[s8aId][d][p].subjectCode, 'CST416');
        assert.equal(optResult.grid[s8bClass._id.toString()][d][p].subjectCode, 'CST416');
      }
    }
  });

  // 11. The authorized capstone is not counted as an ordinary consecutive-teaching violation
  test('Condition 11: Authorized S8 Capstone is exempt from 4+ consecutive run violation for Dr Gunasekaran', () => {
    const gunaRuns = findFourPlusConsecutiveRuns(optResult.grid, data).filter(r => r.teacherName.includes('Gunasekaran'));
    assert.equal(gunaRuns.length, 0, 'Dr Gunasekaran must have 0 four-plus consecutive run violations');

    const runSlots = [1, 2, 3, 4, 5, 6].map(p => optResult.grid[s8aClass._id.toString()].Thursday[p]);
    assert.equal(isAuthorizedCapstoneBlock(runSlots, 'Thursday', gunaTeacher.name), true);
    assert.equal(isAuthorizedCapstoneBlock(runSlots, 'Friday', gunaTeacher.name), true);
  });

  // 12. A different faculty member's unrelated six-period teaching run is still detected
  test('Condition 12: An unrelated faculty member given a 6-period CST416 run is detected as a violation', () => {
    const dummyGrid = {
      cls1: {
        Thursday: {
          1: { subjectCode: 'CST416', teacherIds: ['tDifferent'], isEmpty: false },
          2: { subjectCode: 'CST416', teacherIds: ['tDifferent'], isEmpty: false },
          3: { subjectCode: 'CST416', teacherIds: ['tDifferent'], isEmpty: false },
          4: { subjectCode: 'CST416', teacherIds: ['tDifferent'], isEmpty: false },
          5: { subjectCode: 'CST416', teacherIds: ['tDifferent'], isEmpty: false },
          6: { subjectCode: 'CST416', teacherIds: ['tDifferent'], isEmpty: false },
        }
      }
    };
    const dummyData = {
      teachers: [{ _id: 'tDifferent', name: 'Dr Different' }],
      classes: [{ _id: 'cls1', name: 'Class 1' }]
    };

    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1, 'Different faculty member 6-period run must be detected as violation');
    assert.equal(runs[0].teacherName, 'Dr Different');
    assert.equal(runs[0].length, 6);

    // Also verify isAuthorizedCapstoneBlock returns false for other faculty
    const testSlots = [1, 2, 3, 4, 5, 6].map(p => dummyGrid.cls1.Thursday[p]);
    assert.equal(isAuthorizedCapstoneBlock(testSlots, 'Thursday', 'Dr Different'), false);
  });

  // 13. Other unauthorized four-or-more consecutive teaching runs are still detected
  test('Condition 13: Dr Gunasekaran with an unauthorized 4-period theory run on Monday is detected', () => {
    const dummyGrid = {
      cls1: {
        Monday: {
          1: { subjectCode: 'CST101', teacherIds: [gunaTeacher._id.toString()], isEmpty: false },
          2: { subjectCode: 'CST102', teacherIds: [gunaTeacher._id.toString()], isEmpty: false },
          3: { subjectCode: 'CST103', teacherIds: [gunaTeacher._id.toString()], isEmpty: false },
          4: { subjectCode: 'CST104', teacherIds: [gunaTeacher._id.toString()], isEmpty: false },
        }
      }
    };
    const dummyData = {
      teachers: [gunaTeacher],
      classes: [{ _id: 'cls1', name: 'Class 1' }]
    };

    const runs = findFourPlusConsecutiveRuns(dummyGrid, dummyData);
    assert.equal(runs.length, 1, 'Unauthorized 4-period run on Monday must be flagged even for Dr Gunasekaran');
    assert.equal(runs[0].periods.length, 4);
  });

  // 14. Period placement remains 100%
  test('Condition 14: Period placement remains exactly 100% (237/237 slots placed)', () => {
    let placedCount = 0;
    for (const cid of Object.keys(optResult.grid)) {
      for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
        for (let p = 1; p <= 6; p++) {
          const s = optResult.grid[cid]?.[d]?.[p];
          if (s && !s.isEmpty && !s.isBreak && s.subjectCode) placedCount++;
        }
      }
    }
    assert.equal(placedCount, 237, 'Total academic placed slots must remain exactly 237');
  });

  // 15. All independent validators pass
  test('Condition 15: All four independent validators report zero hard violations', () => {
    const valOut = validateOutput(optResult.grid, data, []);
    assert.equal(valOut.valid, true);
    assert.equal(valOut.hardViolationsCount, 0);

    const valGlob = validateGlobalTimetable(optResult.grid, data);
    assert.equal(valGlob.valid, true);
    assert.equal(valGlob.hardViolationsCount, 0);

    const auditVal = auditTimetable(optResult.grid, data);
    assert.equal(auditVal.hardViolations?.length || 0, 0);

    assert.equal(optResult.finalFourConsecutive, 0);
  });
});