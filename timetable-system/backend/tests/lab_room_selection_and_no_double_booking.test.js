const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subject = require('../src/models/Subject');
const Class = require('../src/models/Class');
const Timetable = require('../src/models/Timetable');
const { validateOutput } = require('../src/services/engine/constraintValidator');
const { loadData } = require('../src/services/engine/dataLoader');

test('Lab Room Selection (4 Options) & Zero Double-Booking Test Suite', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI);

  const testClass = await Class.findOne();
  assert.ok(testClass, 'Class must exist in database');

  // -------------------------------------------------------------
  // Test 1: Lab subject creation with all 4 lab rooms selected
  // -------------------------------------------------------------
  await t.test('Test 1: Adding lab subject with all 4 labs selected persists allowedLabs in MongoDB', async () => {
    const testCode = `TEST_LAB_${Date.now().toString().slice(-4)}`;
    const newLab = await Subject.create({
      name: 'Advanced Computing Lab',
      code: testCode,
      classId: testClass._id,
      type: 'lab',
      allowedLabs: ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4'],
      labDetails: {
        roomName: 'Lab 1',
        allowedLabs: ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4'],
        duration: 3,
      },
    });

    assert.ok(newLab._id);
    const fetched = await Subject.findById(newLab._id).lean();
    assert.deepEqual(fetched.allowedLabs, ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4']);
    assert.deepEqual(fetched.labDetails.allowedLabs, ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4']);

    // Clean up
    await Subject.findByIdAndDelete(newLab._id);
  });

  // -------------------------------------------------------------
  // Test 2: Lab subject creation with specific subset of labs
  // -------------------------------------------------------------
  await t.test('Test 2: Adding lab subject with a subset of labs (e.g. Lab 2 and Lab 3) saves accurately', async () => {
    const testCode = `TEST_SUBSET_${Date.now().toString().slice(-4)}`;
    const subsetLab = await Subject.create({
      name: 'Microprocessors Lab',
      code: testCode,
      classId: testClass._id,
      type: 'lab',
      allowedLabs: ['Lab 2', 'Lab 3'],
      labDetails: {
        roomName: 'Lab 2',
        allowedLabs: ['Lab 2', 'Lab 3'],
        duration: 2,
      },
    });

    const fetched = await Subject.findById(subsetLab._id).lean();
    assert.deepEqual(fetched.allowedLabs, ['Lab 2', 'Lab 3']);

    // Clean up
    await Subject.findByIdAndDelete(subsetLab._id);
  });

  // -------------------------------------------------------------
  // Test 3: Zero Double-Booking Constraint Check
  // -------------------------------------------------------------
  await t.test('Test 3: Constraint validator detects and rejects any lab room double-booking', async () => {
    const classes = await Class.find().limit(2).lean();
    if (classes.length < 2) return;

    const classA = classes[0]._id.toString();
    const classB = classes[1]._id.toString();

    // Create a mock grid where Class A and Class B are both placed in 'Lab 4' on Monday Period 2
    const mockGrid = {
      [classA]: {
        Monday: {
          2: {
            subjectType: 'lab',
            subjectName: 'Lab A',
            subjectCode: 'LA101',
            roomName: 'Lab 4',
            isEmpty: false,
            isBreak: false,
            teacherIds: [new mongoose.Types.ObjectId().toString()],
          },
        },
      },
      [classB]: {
        Monday: {
          2: {
            subjectType: 'lab',
            subjectName: 'Lab B',
            subjectCode: 'LB101',
            roomName: 'Lab 4', // DOUBLE BOOKED IN LAB 4!
            isEmpty: false,
            isBreak: false,
            teacherIds: [new mongoose.Types.ObjectId().toString()],
          },
        },
      },
    };

    const data = await loadData({});
    const val = validateOutput(mockGrid, data, []);

    const roomConflicts = val.violations.filter((v) => v.type === 'LAB_ROOM_CONFLICT');
    assert.ok(roomConflicts.length > 0, 'Validator MUST flag LAB_ROOM_CONFLICT when Lab 4 is double-booked');
    assert.match(roomConflicts[0].message, /Lab room 'Lab 4' is used by multiple classes/i);
  });

  // -------------------------------------------------------------
  // Test 4: Free Lab Selection Prevents Collision
  // -------------------------------------------------------------
  await t.test('Test 4: Selecting different allowed labs (Lab 1 vs Lab 4) resolves room collision completely', async () => {
    const classes = await Class.find().limit(2).lean();
    if (classes.length < 2) return;

    const classA = classes[0]._id.toString();
    const classB = classes[1]._id.toString();

    // Now Class A uses Lab 1, and Class B uses Lab 4 on Monday Period 2
    const mockGrid = {
      [classA]: {
        Monday: {
          2: {
            subjectType: 'lab',
            subjectName: 'Lab A',
            subjectCode: 'LA101',
            roomName: 'Lab 1', // Disjoint room
            isEmpty: false,
            isBreak: false,
            teacherIds: [new mongoose.Types.ObjectId().toString()],
          },
        },
      },
      [classB]: {
        Monday: {
          2: {
            subjectType: 'lab',
            subjectName: 'Lab B',
            subjectCode: 'LB101',
            roomName: 'Lab 4', // Disjoint room
            isEmpty: false,
            isBreak: false,
            teacherIds: [new mongoose.Types.ObjectId().toString()],
          },
        },
      },
    };

    const data = await loadData({});
    const val = validateOutput(mockGrid, data, []);

    const roomConflicts = val.violations.filter((v) => v.type === 'LAB_ROOM_CONFLICT');
    assert.equal(roomConflicts.length, 0, 'Zero room conflicts when non-overlapping allowed labs are used');
  });

  // -------------------------------------------------------------
  // Test 5: Published timetable zero double-booking audit
  // -------------------------------------------------------------
  await t.test('Test 5: Authoritative timetable has ZERO lab room collisions across all classes and periods', async () => {
    const published = await Timetable.findOne({ isAccepted: true }).lean();
    assert.ok(published, 'Published timetable must exist');

    const labUsage = {}; // room -> day -> period -> [classNames]
    const conflicts = [];

    for (const ct of published.classTimetables || []) {
      for (const slot of ct.slots || []) {
        if (!slot.isEmpty && !slot.isBreak && slot.roomName) {
          const room = slot.roomName;
          const d = slot.day;
          const p = slot.period;

          if (!labUsage[room]) labUsage[room] = {};
          if (!labUsage[room][d]) labUsage[room][d] = {};
          if (!labUsage[room][d][p]) labUsage[room][d][p] = [];

          labUsage[room][d][p].push(ct.className);
          if (labUsage[room][d][p].length > 1) {
            conflicts.push({
              room,
              day: d,
              period: p,
              classes: labUsage[room][d][p],
            });
          }
        }
      }
    }

    assert.equal(conflicts.length, 0, `Published timetable must have 0 lab room double-bookings. Found: ${JSON.stringify(conflicts)}`);
  });

  await mongoose.disconnect();
});
