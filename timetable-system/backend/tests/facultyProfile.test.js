const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { getFacultyProfile } = require('../src/controllers/teacherController');
const Teacher = require('../src/models/Teacher');
const Subject = require('../src/models/Subject');

describe('Teacher View Profile & Workload Analytics Integration', () => {
  let createdConnection = false;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/timetable_db');
      createdConnection = true;
    }
  });

  after(async () => {
    if (createdConnection) {
      await mongoose.disconnect();
    }
  });

  test('Dr Rani (Professor, AIML): elective CST448 is classified under Elective Hours (4h), not duplicated in Theory or Tutorial', async () => {
    const teacher = await Teacher.findOne({ name: /Rani/i });
    assert.ok(teacher, 'Dr Rani must exist in database');

    let status = null;
    let json = null;
    const req = { params: { id: teacher._id.toString() } };
    const res = {
      status: (s) => { status = s; return { json: (j) => { json = j; } }; }
    };

    await getFacultyProfile(req, res);
    assert.equal(status, 200);
    assert.ok(json.data.profile);

    const { summary, allocations } = json.data.profile;
    assert.equal(summary.totalWeeklyHours, 4, 'Total weekly hours must be 4');
    assert.equal(summary.theoryHours, 0, 'Theory hours must be 0 (elective hours not duplicated)');
    assert.equal(summary.tutorialHours, 0, 'Tutorial hours must be 0 (elective hours not duplicated)');
    assert.equal(summary.labHours, 0, 'Lab hours must be 0');
    assert.equal(summary.electiveHours, 4, 'Elective hours must be 4');
    assert.equal(summary.subjectsAssigned, 1);
    assert.equal(summary.totalWeeklyHours, summary.theoryHours + summary.tutorialHours + summary.labHours + summary.electiveHours);

    // Verify allocation object
    assert.equal(allocations.length, 1);
    assert.equal(allocations[0].courseCode, 'CST448');
    assert.equal(allocations[0].type, 'elective');
    assert.equal(allocations[0].electiveGroup, 'S8 CSE Elective 3');
  });

  test('Dr S Gunasekaran: theory (2h), lab (12h), elective (4h) total exactly 18h with 0 duplication', async () => {
    const teacher = await Teacher.findOne({ name: /Gunasekaran/i });
    assert.ok(teacher, 'Dr S Gunasekaran must exist in database');

    let status = null;
    let json = null;
    const req = { params: { id: teacher._id.toString() } };
    const res = {
      status: (s) => { status = s; return { json: (j) => { json = j; } }; }
    };

    await getFacultyProfile(req, res);
    assert.equal(status, 200);
    assert.ok(json.data.profile);

    const { summary, labAllocations } = json.data.profile;
    assert.equal(summary.totalWeeklyHours, 18);
    assert.equal(summary.theoryHours, 2);
    assert.equal(summary.tutorialHours, 0);
    assert.equal(summary.labHours, 12);
    assert.equal(summary.practicalHours, 12);
    assert.equal(summary.electiveHours, 4);
    assert.equal(summary.totalWeeklyHours, summary.theoryHours + summary.tutorialHours + summary.labHours + summary.electiveHours);

    // Separated laboratory allocations
    assert.ok(labAllocations.length >= 2, 'Should have dedicated lab allocations');
    for (const lab of labAllocations) {
      assert.ok(lab.weeklyLabHours > 0, 'Lab hours must be > 0');
      assert.ok(lab.facultyAllocation, 'Faculty role must be defined');
    }
  });

  test('Ms Happy A: practical hours (10h) from PBCST404 practicals and labs are separated from theory (6h)', async () => {
    const teacher = await Teacher.findOne({ name: /Happy A/i });
    assert.ok(teacher, 'Ms Happy A must exist in database');

    let status = null;
    let json = null;
    const req = { params: { id: teacher._id.toString() } };
    const res = {
      status: (s) => { status = s; return { json: (j) => { json = j; } }; }
    };

    await getFacultyProfile(req, res);
    assert.equal(status, 200);

    const { summary } = json.data.profile;
    assert.equal(summary.totalWeeklyHours, 16);
    assert.equal(summary.theoryHours, 6);
    assert.equal(summary.tutorialHours, 0);
    assert.equal(summary.labHours, 10);
    assert.equal(summary.totalWeeklyHours, summary.theoryHours + summary.tutorialHours + summary.labHours + summary.electiveHours);
    assert.equal(summary.subjectsAssigned, 3);
    assert.equal(summary.sectionsHandled, 3);
  });

  test('Dr Reshmi B: theory (6h), tutorial (2h), lab (6h) total exactly 14h', async () => {
    const teacher = await Teacher.findOne({ name: /Reshmi B/i });
    assert.ok(teacher, 'Dr Reshmi B must exist in database');

    let status = null;
    let json = null;
    const req = { params: { id: teacher._id.toString() } };
    const res = {
      status: (s) => { status = s; return { json: (j) => { json = j; } }; }
    };

    await getFacultyProfile(req, res);
    assert.equal(status, 200);

    const { summary, semesterBreakdown } = json.data.profile;
    assert.equal(summary.totalWeeklyHours, 14);
    assert.equal(summary.theoryHours, 6);
    assert.equal(summary.tutorialHours, 2);
    assert.equal(summary.labHours, 6);
    assert.equal(summary.totalWeeklyHours, summary.theoryHours + summary.tutorialHours + summary.labHours + summary.electiveHours);
    assert.ok(semesterBreakdown.length >= 3, 'Handles across 3 semesters');
  });

  test('Teacher with no allocations returns 0 with 200 OK without errors', async () => {
    const unassigned = await Teacher.create({
      name: 'Test Unassigned Teacher',
      username: 'testunassigned' + Date.now(),
      password: 'password123',
    });

    let status = null;
    let json = null;
    const req = { params: { id: unassigned._id.toString() } };
    const res = {
      status: (s) => { status = s; return { json: (j) => { json = j; } }; }
    };

    await getFacultyProfile(req, res);
    assert.equal(status, 200);
    const { summary, allocations, labAllocations } = json.data.profile;
    assert.equal(summary.totalWeeklyHours, 0);
    assert.equal(summary.theoryHours, 0);
    assert.equal(summary.labHours, 0);
    assert.equal(summary.subjectsAssigned, 0);
    assert.equal(allocations.length, 0);
    assert.equal(labAllocations.length, 0);

    await Teacher.findByIdAndDelete(unassigned._id);
  });

  test('Invalid teacher ID returns 404 Teacher profile not found', async () => {
    let status = null;
    let json = null;
    const req = { params: { id: 'invalid-id-xyz' } };
    const res = {
      status: (s) => { status = s; return { json: (j) => { json = j; } }; }
    };

    await getFacultyProfile(req, res);
    assert.equal(status, 404);
    assert.match(json.message, /not found/i);
  });
});
