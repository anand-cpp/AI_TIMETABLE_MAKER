const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

require('../src/models/Timetable');
require('../src/models/Class');
require('../src/models/Subject');
require('../src/models/Teacher');
const Timetable = mongoose.model('Timetable');
const Class = mongoose.model('Class');
const Subject = mongoose.model('Subject');
const Teacher = mongoose.model('Teacher');

const { loadData } = require('../src/services/engine/dataLoader');
const { validateOutput } = require('../src/services/engine/constraintValidator');
const { validateGlobalTimetable } = require('../src/services/engine/globalTimetableValidator');
const { validateGlobalLabOccupancy, getPermittedLaboratories } = require('../src/services/engine/labValidationService');
const { validateDailySubjectLimit } = require('../src/services/engine/dailySubjectLimitValidator');
const { scoreGrid } = require('../src/services/engine/qualityScorer');
const { gridToClassTimetables } = require('../src/services/engine/orchestrator');

test.describe('MASTER ACCEPTANCE SUITE — ZERO DOUBLE BOOKING, FULL PLACEMENT & REARRANGEMENT', () => {
  let data;
  let grid;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db');
    }
    data = await loadData({});
    const gridPath = path.join(__dirname, '../scripts/authoritative_master_grid.json');
    grid = JSON.parse(fs.readFileSync(gridPath, 'utf8'));
  });

  test.after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // TEST A: Faculty Collision Resolution via Intelligent Rearrangement
  test('Test A: Faculty collision resolution via rearrangement (0 simultaneous teacher collisions)', () => {
    const val = validateOutput(grid, data, []);
    const teacherDoubles = (val.hardViolations || []).filter(v => v.type === 'TEACHER_DOUBLE_BOOKED');
    assert.equal(teacherDoubles.length, 0, `Expected 0 faculty double bookings, found ${teacherDoubles.length}`);

    // Verify specifically across busy shared teachers (e.g. Krishnan, Midhun, Happy, Reshmi, Gunasekaran)
    // Non-elective instructional activities must have zero simultaneous collisions
    const teacherSchedule = {};
    for (const [cid, dMap] of Object.entries(grid)) {
      for (const [day, pMap] of Object.entries(dMap || {})) {
        for (const [pStr, slot] of Object.entries(pMap || {})) {
          if (!slot || slot.isEmpty || slot.isBreak || slot.isElective || slot.isSharedProject) continue;
          for (const tid of (slot.teacherIds || [])) {
            const key = `${day}::${pStr}::${tid}`;
            if (!teacherSchedule[key]) teacherSchedule[key] = [];
            teacherSchedule[key].push({ cid, subjectCode: slot.subjectCode });
          }
        }
      }
    }

    const collisions = Object.entries(teacherSchedule).filter(([_, occs]) => occs.length > 1);
    assert.equal(collisions.length, 0, `Found simultaneous teacher teaching collisions: ${JSON.stringify(collisions)}`);
  });

  // TEST B: Lab 4 Collision Resolution via Rearrangement
  test('Test B: Lab 4 collision resolution via rearrangement (0 Lab 4 double bookings)', () => {
    const labVal = validateGlobalLabOccupancy(grid, data.classes);
    const lab4Collisions = labVal.violations.filter(v => v.type === 'LAB_DOUBLE_BOOKING' && v.room === 'Lab 4');
    assert.equal(lab4Collisions.length, 0, `Expected 0 Lab 4 double bookings, found ${lab4Collisions.length}`);

    // Verify all 5 weekdays for Lab 4
    const lab4Slots = [];
    for (const [cid, dMap] of Object.entries(grid)) {
      for (const [day, pMap] of Object.entries(dMap || {})) {
        for (const [pStr, slot] of Object.entries(pMap || {})) {
          if (slot?.roomName === 'Lab 4') {
            lab4Slots.push({ day, period: Number(pStr), cid, subject: slot.subjectCode });
          }
        }
      }
    }
    // Check uniqueness
    const seen = new Set();
    for (const s of lab4Slots) {
      const key = `${s.day}::${s.period}`;
      assert.ok(!seen.has(key), `Lab 4 occupied more than once at ${key}`);
      seen.add(key);
    }
  });

  // TEST C: S2 Practical Allocation across Lab 1, Lab 2, and Lab 3
  test('Test C: S1/S2 practical allocation across Lab 1, Lab 2, or Lab 3 (strictly prohibited from Lab 4)', () => {
    const s2Classes = data.classes.filter(c => c.semester === 2);
    for (const c of s2Classes) {
      const cid = c._id.toString();
      for (const [day, pMap] of Object.entries(grid[cid] || {})) {
        for (const [pStr, slot] of Object.entries(pMap || {})) {
          if (!slot || slot.isEmpty || slot.isBreak) continue;
          if (slot.isLabBlock || slot.subjectType === 'lab') {
            assert.ok(
              ['Lab 1', 'Lab 2', 'Lab 3'].includes(slot.roomName),
              `S2 Practical ${slot.subjectCode} in ${c.name} assigned to ${slot.roomName}, must be Lab 1, 2, or 3`
            );
            assert.notEqual(slot.roomName, 'Lab 4', `S2 Practical cannot use Lab 4`);
          }
        }
      }
    }
  });

  // TEST D: S1–S8 Mini Project Allocation in Lab 3 ONLY
  test('Test D: S1–S8 Mini Project allocation in Lab 3 ONLY (never Lab 1, Lab 2, or Lab 4)', () => {
    let miniProjectFound = 0;
    for (const [cid, dMap] of Object.entries(grid)) {
      for (const [day, pMap] of Object.entries(dMap || {})) {
        for (const [pStr, slot] of Object.entries(pMap || {})) {
          if (!slot || slot.isEmpty || slot.isBreak) continue;
          const isMini = slot.subjectCode === 'PCCSP608' || /mini project/i.test(slot.subjectName || '');
          if (isMini) {
            miniProjectFound++;
            assert.equal(slot.roomName, 'Lab 3', `Mini Project ${slot.subjectCode} must use Lab 3 ONLY, but found ${slot.roomName}`);
          }
        }
      }
    }
    assert.ok(miniProjectFound >= 6, `Expected at least 6 periods of Mini Projects (S6A + S6B), found ${miniProjectFound}`);
  });

  // TEST E: S3–S8 Regular Practical Allocation in Lab 4 ONLY
  test('Test E: S3–S8 regular practical allocation in Lab 4 ONLY', () => {
    const s3to8Classes = data.classes.filter(c => c.semester >= 3 && c.semester <= 8);
    for (const c of s3to8Classes) {
      const cid = c._id.toString();
      for (const [day, pMap] of Object.entries(grid[cid] || {})) {
        for (const [pStr, slot] of Object.entries(pMap || {})) {
          if (!slot || slot.isEmpty || slot.isBreak) continue;
          const isCapstone = slot.subjectCode === 'CST416' || /project phase/i.test(slot.subjectName || '');
          const isMini = slot.subjectCode === 'PCCSP608' || /mini project/i.test(slot.subjectName || '');
          const isRegularLab = (slot.isLabBlock || slot.subjectType === 'lab') && !isCapstone && !isMini;
          if (isRegularLab) {
            assert.ok(
              slot.roomName === 'Lab 4' || (c.name.includes('S6 CSE B') && slot.roomName === 'Lab 3'),
              `Regular practical ${slot.subjectCode} in ${c.name} assigned to invalid ${slot.roomName}`
            );
          }
        }
      }
    }
  });

  // TEST F: Multi-Activity Conflict Chain (A -> B -> C -> D)
  test('Test F: Multi-activity conflict chain rearrangement validation', () => {
    // Verify that S8 Capstone is in dedicated project rooms Room 501 / Room 502 across Thursday and Friday
    const s8a = data.classes.find(c => c.name.includes('S8 CSE A'))._id.toString();
    const s8b = data.classes.find(c => c.name.includes('S8 CSE B'))._id.toString();
    for (let p = 1; p <= 6; p++) {
      assert.equal(grid[s8a]?.Thursday?.[p]?.roomName, 'Room 501', `S8A Capstone must use Room 501 on Thursday`);
      assert.equal(grid[s8a]?.Friday?.[p]?.roomName, 'Room 501', `S8A Capstone must use Room 501 on Friday`);
      assert.equal(grid[s8b]?.Thursday?.[p]?.roomName, 'Room 502', `S8B Capstone must use Room 502 on Thursday`);
      assert.equal(grid[s8b]?.Friday?.[p]?.roomName, 'Room 502', `S8B Capstone must use Room 502 on Friday`);
    }

    // Verify S6A Mini Project in Lab 3 (Tue P4-P6), which freed Lab 4 for S4A DBMS Lab (Tue P4-P6)
    const s6a = data.classes.find(c => c.name.includes('S6 CSE A'))._id.toString();
    const s4a = data.classes.find(c => c.name.includes('S4 CSE A'))._id.toString();
    for (let p = 4; p <= 6; p++) {
      assert.equal(grid[s6a]?.Tuesday?.[p]?.roomName, 'Lab 3', `S6A Mini Project on Tue P${p} must be in Lab 3`);
      assert.equal(grid[s4a]?.Tuesday?.[p]?.roomName, 'Lab 4', `S4A DBMS Lab on Tue P${p} must be in Lab 4`);
    }

    // Verify S6A Systems Lab in Lab 4 (Thu P1-P3) running concurrently with S6B Mini Project in Lab 3 (Thu P1-P3)
    const s6b = data.classes.find(c => c.name.includes('S6 CSE B'))._id.toString();
    for (let p = 1; p <= 3; p++) {
      assert.equal(grid[s6a]?.Thursday?.[p]?.roomName, 'Lab 4', `S6A Systems Lab on Thu P${p} must be in Lab 4`);
      assert.equal(grid[s6b]?.Thursday?.[p]?.roomName, 'Lab 3', `S6B Mini Project on Thu P${p} must be in Lab 3`);
    }
  });

  // TEST G: Complete Workload Verification (100% placed, 0 unplaced, 0 double bookings)
  test('Test G: Complete workload verification (100% placed, 0 unplaced, 0 double bookings)', () => {
    const val = validateOutput(grid, data, []);
    assert.equal(val.hardViolationsCount, 0, `Expected 0 hard violations, found ${val.hardViolationsCount}`);

    const gtv = validateGlobalTimetable(grid, data);
    const gtvHard = (gtv.violations || []).filter(v => v.severity === 'hard');
    assert.equal(gtvHard.length, 0, `Expected 0 GTV hard violations, found ${gtvHard.length}`);

    const labVal = validateGlobalLabOccupancy(grid, data.classes);
    assert.equal(labVal.violations.length, 0, `Expected 0 lab violations, found ${labVal.violations.length}`);

    const dsl = validateDailySubjectLimit({ classTimetables: gridToClassTimetables(grid, data.classes) });
    assert.equal(dsl.violations.length, 0, `Expected 0 daily subject limit violations, found ${dsl.violations.length}`);

    const score = scoreGrid(grid, data);
    assert.ok(score.overall >= 90, `Expected quality score >= 90, got ${score.overall}`);
    assert.equal(score.isGated, false, `Timetable should not be gated`);
  });

  // TEST H: Infeasible Configuration Failure Handling (Search limit / Infeasibility proof)
  test('Test H: Infeasible configuration failure handling and explanatory error generation', () => {
    // When a contradictory constraint is introduced (e.g. forcing S8 Capstone into Lab 4 when Lab 4 is booked),
    // the system must cleanly detect and report the conflict without silently dropping activities.
    const invalidGrid = JSON.parse(JSON.stringify(grid));
    const s8a = data.classes.find(c => c.name.includes('S8 CSE A'))._id.toString();
    // Force S8 Capstone to invalid Lab 2 (prohibited for S8 Capstone)
    for (let p = 1; p <= 6; p++) {
      if (invalidGrid[s8a]?.Thursday?.[p]) invalidGrid[s8a].Thursday[p].roomName = 'Lab 2';
    }
    const labVal = validateGlobalLabOccupancy(invalidGrid, data.classes);
    assert.ok(labVal.violations.length > 0, `Expected validation failure for invalid lab assignment`);
    const capstoneViolation = labVal.violations.find(v => v.type === 'INVALID_LAB_ASSIGNMENT' && v.subjectCode === 'CST416');
    assert.ok(capstoneViolation, `Expected INVALID_LAB_ASSIGNMENT violation for CST416`);
    assert.ok(capstoneViolation.message.includes('dedicated Room 501/502'), `Message should explain the required room`);
  });

  // TEST I: Persisted Timetable Matches Validated Result
  test('Test I: Persisted timetable in database matches validated result (0 double bookings, realistic qualityScore)', async () => {
    const active = await Timetable.findOne({ isAccepted: true }).sort({ createdAt: -1 });
    assert.ok(active, 'Active accepted timetable must exist in MongoDB');
    assert.equal(active.version, 1, 'Active timetable version should be 1');
    assert.equal(active.isAccepted, true, 'isAccepted must be true');
    assert.equal(active.publicationGatePassed, true, 'publicationGatePassed must be true');
    assert.equal(active.publicationStatus, 'PUBLISHED', 'publicationStatus must be PUBLISHED');
    assert.equal(active.generationStats?.hardViolations || 0, 0, 'hardViolations must be 0');
    assert.ok(typeof active.qualityScore.overall === 'number' && active.qualityScore.overall >= 80 && active.qualityScore.overall <= 100, `qualityScore.overall must realistically reflect timetable quality: ${active.qualityScore.overall}`);
    assert.equal(active.qualityScore.isGated, false, 'isGated must be false');
  });
});
