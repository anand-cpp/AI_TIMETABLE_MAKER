/**
 * DEMO DATA SEEDER - AI Timetable Maker
 * -------------------------------------
 * Seeds a realistic, internally-consistent CSE demo college (8 sections:
 * S1/S3/S5/S7 x sections A & B) into the configured development database and
 * generates a timetable with the REAL engine (services/engine/orchestrator).
 *
 * SAFETY PROPERTIES
 *  - NEVER deletes, truncates or resets anything. It only INSERTS or UPDATES the
 *    demo records it owns, matched by stable keys:
 *      department -> code
 *      teacher    -> username
 *      class      -> departmentId + semester + section
 *      subject    -> code + classId
 *      timetable  -> label
 *  - Refuses to run against a database whose name is not on the allow-list, so it
 *    cannot be pointed at an unknown/production database by accident.
 *  - Idempotent: running it twice does not create duplicate teachers/classes/
 *    subjects, and rewrites the same demo timetable version instead of piling up
 *    new versions.
 *
 * DEV-ONLY CREDENTIALS created here (documented in DEMO_DATA_GUIDE.md):
 *  - Teachers: username = first.last (e.g. `ananya.nair`), password = DEMO_PASSWORD
 *  - Admin:    username = `demo.admin`,                   password = DEMO_ADMIN_PASSWORD
 *  These are sample credentials for a LOCAL DEMO database only and must NOT be
 *  used for any real deployment. The pre-existing `admin` account is left untouched.
 *
 * Usage:  node scripts/seedDemoData.js              (seed + generate + verify)
 *         node scripts/seedDemoData.js --dry-run    (report only, write nothing)
 */
require('dotenv').config();
const mongoose = require('mongoose');

const Department = require('../src/models/Department');
const Teacher = require('../src/models/Teacher');
const Class = require('../src/models/Class');
const Subject = require('../src/models/Subject');
const Timetable = require('../src/models/Timetable');
const Admin = require('../src/models/Admin');
const { run } = require('../src/services/engine/orchestrator');
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');

const DEMO_PASSWORD = 'DemoPass123!';
const DEMO_ADMIN_PASSWORD = 'DemoAdmin123!';
const DEMO_ADMIN_USERNAME = 'demo.admin';
const DEMO_EMAIL_DOMAIN = 'democollege.example.edu';
const TIMETABLE_LABEL = 'DEMO College Timetable (S1-S7)';

// Only these local development databases may be written to.
const ALLOWED_DBS = ['timetable_db', 'timetable_audit_test'];

// Runtime switches (overridable through seedDemoData options for tests).
let DRY_RUN = process.argv.includes('--dry-run');
let LOG = console.log;

// ---------------------------------------------------------------------------
// Demo college definition
// ---------------------------------------------------------------------------
const DEPARTMENT = {
  name: 'Computer Science and Engineering (Demo)',
  code: 'CSE',
  building: 'Block A',
  floor: '2nd Floor',
  travelOptimization: true,
};

// 16 fictional teachers.
const TEACHERS = [
  { first: 'Ananya', last: 'Nair', maxDay: 4 },
  { first: 'Rahul', last: 'Menon', maxDay: 4 },
  { first: 'Meera', last: 'Joseph', maxDay: 4 },
  { first: 'Arjun', last: 'Kumar', maxDay: 4 },
  { first: 'Neha', last: 'Thomas', maxDay: 4 },
  { first: 'Vivek', last: 'Das', maxDay: 4 },
  { first: 'Priya', last: 'Nambiar', maxDay: 4 },
  { first: 'Adithya', last: 'Raj', maxDay: 4 },
  { first: 'Sneha', last: 'Varma', maxDay: 4 },
  { first: 'Nikhil', last: 'Suresh', maxDay: 4 },
  { first: 'Kavya', last: 'Mohan', maxDay: 4 },
  { first: 'Alan', last: 'Mathew', maxDay: 4 },
  { first: 'Diya', last: 'Krishnan', maxDay: 4 },
  { first: 'Akhil', last: 'Dev', maxDay: 4 },
  { first: 'Fathima', last: 'Salim', maxDay: 4, unavailability: [{ day: 'Friday', period: 5 }] },
  { first: 'Rohit', last: 'Pillai', maxDay: 4 },
];

// Subject plan per semester. Sections A and B share the SAME subjects AND the SAME
// teachers, so teacher double-booking detection is genuinely exercised. Labs are
// 3-period blocks (must start at P1 or P4 in the 6-period day). Room names come
// from the engine's LAB_ROOM_POOL so the alternative-room fallback works.
const SEMESTER_PLAN = {
  1: {
    theory: [
      { name: 'Mathematics for Computing', code: 'CST101', hours: 4, teacher: 'ananya.nair' },
      { name: 'Engineering Physics', code: 'CST103', hours: 3, teacher: 'meera.joseph' },
      { name: 'Programming in C', code: 'CST105', hours: 4, teacher: 'rahul.menon' },
      { name: 'Basics of Electrical and Electronics Engineering', code: 'CST107', hours: 3, teacher: 'arjun.kumar' },
      { name: 'Engineering Graphics', code: 'CST109', hours: 3, teacher: 'neha.thomas' },
      { name: 'Professional Communications', code: 'CST111', hours: 2, teacher: 'priya.nambiar' },
    ],
    lab: [
      { name: 'Programming Laboratory', code: 'CSL151', duration: 3, teacher: 'rahul.menon', room: 'CS-LAB-1' },
      { name: 'Engineering Workshop', code: 'CSL153', duration: 3, teacher: 'vivek.das', room: 'ME-WORKSHOP' },
    ],
  },
  3: {
    theory: [
      { name: 'Discrete Mathematical Structures', code: 'CST201', hours: 4, teacher: 'sneha.varma' },
      { name: 'Data Structures', code: 'CST203', hours: 4, teacher: 'nikhil.suresh' },
      { name: 'Object Oriented Programming', code: 'CST205', hours: 3, teacher: 'kavya.mohan' },
      { name: 'Digital Logic Design', code: 'CST207', hours: 3, teacher: 'alan.mathew' },
      { name: 'Computer Organization', code: 'CST209', hours: 3, teacher: 'diya.krishnan' },
    ],
    lab: [
      { name: 'Data Structures Laboratory', code: 'CSL251', duration: 3, teacher: 'nikhil.suresh', room: 'CS-LAB-2' },
      { name: 'Object Oriented Programming Laboratory', code: 'CSL253', duration: 3, teacher: 'kavya.mohan', room: 'CS-LAB-1' },
    ],
  },
  5: {
    theory: [
      { name: 'Database Management Systems', code: 'CST301', hours: 4, teacher: 'akhil.dev' },
      { name: 'Operating Systems', code: 'CST303', hours: 4, teacher: 'fathima.salim' },
      { name: 'Computer Networks', code: 'CST305', hours: 3, teacher: 'rohit.pillai' },
      { name: 'Design and Analysis of Algorithms', code: 'CST307', hours: 4, teacher: 'ananya.nair' },
      { name: 'Software Engineering', code: 'CST309', hours: 3, teacher: 'meera.joseph' },
    ],
    lab: [
      { name: 'Database Laboratory', code: 'CSL351', duration: 3, teacher: 'akhil.dev', room: 'CS-LAB-2' },
      { name: 'Networks Laboratory', code: 'CSL353', duration: 3, teacher: 'rohit.pillai', room: 'EC-LAB-1' },
    ],
  },
  7: {
    theory: [
      { name: 'Artificial Intelligence', code: 'CST401', hours: 4, teacher: 'diya.krishnan' },
      { name: 'Compiler Design', code: 'CST403', hours: 3, teacher: 'sneha.varma' },
      { name: 'Distributed Systems', code: 'CST405', hours: 3, teacher: 'alan.mathew' },
      { name: 'Information Security', code: 'CST407', hours: 3, teacher: 'kavya.mohan' },
      { name: 'Seminar and Project Work', code: 'CST409', hours: 2, teacher: 'priya.nambiar' },
    ],
    lab: [
      { name: 'Artificial Intelligence Laboratory', code: 'CSL451', duration: 3, teacher: 'fathima.salim', room: 'AI-LAB' },
    ],
  },
};

const SECTIONS = ['A', 'B'];
const SEMESTERS = [1, 3, 5, 7];

// ---------------------------------------------------------------------------
// Connection + safety guard
// ---------------------------------------------------------------------------
async function connectDB(uri, allowedDbs = ALLOWED_DBS) {
  const effectiveUri = uri || process.env.MONGODB_URI;
  if (!effectiveUri) throw new Error('MONGODB_URI is not set. Refusing to seed without an explicit database.');
  // Extract the database name from the URI (e.g. .../timetable_db?opt -> timetable_db).
  const match = effectiveUri.match(/\/([^/?]+)(\?|$)/);
  const dbName = match ? match[1] : '';
  if (!dbName) throw new Error('Could not parse MONGODB_URI to find the database name.');
  if (!allowedDbs.includes(dbName)) {
    throw new Error(
      "Refusing to seed database '" + dbName + "'. Allowed: " + allowedDbs.join(', ') +
      '. Set MONGODB_URI to a development database first.'
    );
  }
  // Reuse an existing (already-connected) connection, e.g. in tests.
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(effectiveUri, { serverSelectionTimeoutMS: 5000 });
  }
  LOG('Connected to MongoDB database: ' + dbName + (DRY_RUN ? '  (DRY RUN - no writes)' : ''));
  return dbName;
}

// ---------------------------------------------------------------------------
// Idempotent upserts
// ---------------------------------------------------------------------------
async function upsertDepartment() {
  const existing = await Department.findOne({ code: DEPARTMENT.code });
  if (existing) {
    if (!DRY_RUN) await Department.updateOne({ _id: existing._id }, { $set: DEPARTMENT });
    return existing;
  }
  if (DRY_RUN) return new Department(DEPARTMENT);
  return Department.create(DEPARTMENT);
}

async function upsertTeacher(deptId, t) {
  const username = (t.first + '.' + t.last).toLowerCase();
  const doc = {
    name: t.first + ' ' + t.last,
    username,
    departmentId: deptId,
    email: username + '@' + DEMO_EMAIL_DOMAIN,
    phone: '',
    maxPeriodsPerDay: t.maxDay,
    unavailability: t.unavailability || [],
    morningLabPreference: false,
    isActive: true,
  };
  const existing = await Teacher.findOne({ username });
  if (existing) {
    // Do NOT touch the password on re-runs (only profile fields).
    if (!DRY_RUN) await Teacher.updateOne({ _id: existing._id }, { $set: doc });
    return existing;
  }
  if (DRY_RUN) return new Teacher({ ...doc, password: DEMO_PASSWORD });
  return Teacher.create({ ...doc, password: DEMO_PASSWORD });
}

async function upsertClass(deptId, semester, section) {
  const query = { departmentId: deptId, semester, section };
  const existing = await Class.findOne(query);
  if (existing) return existing;
  if (DRY_RUN) {
    return new Class({ ...query, strength: 60, classRepName: '', classRepEmail: '' });
  }
  return Class.create({ ...query, strength: 60, classRepName: '', classRepEmail: '' });
}

async function upsertSubject(classId, data) {
  const query = { code: data.code, classId };
  const existing = await Subject.findOne(query);
  if (existing) {
    if (!DRY_RUN) await Subject.updateOne({ _id: existing._id }, { $set: data });
    return existing;
  }
  if (DRY_RUN) return new Subject({ ...data, classId });
  return Subject.create({ ...data, classId });
}

// ---------------------------------------------------------------------------
// Seeder (importable)
// ---------------------------------------------------------------------------
/**
 * Seed the demo college and generate a timetable.
 * @param {object}  [opts]
 * @param {string}  [opts.uri]            Mongo URI (defaults to process.env.MONGODB_URI).
 * @param {boolean} [opts.dryRun]         Report only; write nothing.
 * @param {boolean} [opts.disconnect]     Disconnect when done (default true; tests pass false).
 * @param {string[]}[opts.allowedDbs]     Database-name allow-list override (defaults to ALLOWED_DBS).
 * @param {Function}[opts.log]            Logger (default console.log).
 * @returns {Promise<{dryRun:boolean, saved?:object, validation?:object, result?:object}>}
 */
async function seedDemoData(opts = {}) {
  const { uri, dryRun = false, disconnect = true, allowedDbs = ALLOWED_DBS, log = console.log } = opts;
  DRY_RUN = dryRun;
  LOG = log;

  await connectDB(uri, allowedDbs);

  // 1. Department
  const dept = await upsertDepartment();
  LOG('Department: ' + dept.code + ' (' + dept.name + ')');

  // 2. Teachers
  const teacherByUser = {};
  for (const t of TEACHERS) {
    const created = await upsertTeacher(dept._id, t);
    teacherByUser[(t.first + '.' + t.last).toLowerCase()] = created;
  }
  LOG('Teachers: ' + TEACHERS.length + ' (password for all: ' + DEMO_PASSWORD + ')');

  // 3. Optional demo admin (for logging into the admin UI in the demo env).
  const adminExists = await Admin.findOne({ username: DEMO_ADMIN_USERNAME });
  if (!adminExists) {
    if (!DRY_RUN) {
      await Admin.create({ username: DEMO_ADMIN_USERNAME, password: DEMO_ADMIN_PASSWORD });
    }
    LOG('Demo admin created: ' + DEMO_ADMIN_USERNAME + ' (password: ' + DEMO_ADMIN_PASSWORD + ')');
  } else {
    LOG('Demo admin already present: ' + DEMO_ADMIN_USERNAME);
  }

  // 4. Classes + Subjects
  const classByLabel = {};
  let subjectCount = 0;
  for (const sem of SEMESTERS) {
    const plan = SEMESTER_PLAN[sem];
    for (const section of SECTIONS) {
      const cls = await upsertClass(dept._id, sem, section);
      const label = dept.code + ' S' + sem + section;
      classByLabel[label] = cls;

      const subjectIds = [];
      for (const th of plan.theory) {
        const teacher = teacherByUser[th.teacher];
        if (!teacher) throw new Error('Unknown teacher key: ' + th.teacher);
        const s = await upsertSubject(cls._id, {
          name: th.name,
          code: th.code,
          type: 'theory',
          weeklyHours: th.hours,
          teachers: [teacher._id],
          labDetails: null,
          electiveDetails: null,
          isElective: false,
        });
        subjectIds.push(s._id);
        subjectCount++;
      }
      for (const lb of plan.lab) {
        const teacher = teacherByUser[lb.teacher];
        if (!teacher) throw new Error('Unknown teacher key: ' + lb.teacher);
        const s = await upsertSubject(cls._id, {
          name: lb.name,
          code: lb.code,
          type: 'lab',
          weeklyHours: lb.duration,
          teachers: [teacher._id],
          labDetails: {
            roomName: lb.room,
            duration: lb.duration,
            isBatchSplit: false,
            morningPreference: false,
          },
          electiveDetails: null,
          isElective: false,
        });
        subjectIds.push(s._id);
        subjectCount++;
      }

      if (!DRY_RUN) await Class.updateOne({ _id: cls._id }, { $set: { subjects: subjectIds } });
    }
  }
  LOG('Classes: ' + Object.keys(classByLabel).length + '  Subjects: ' + subjectCount);

  if (DRY_RUN) {
    LOG('DRY RUN complete. Nothing was written.');
    if (disconnect) await mongoose.disconnect();
    return { dryRun: true, classes: Object.keys(classByLabel).length, subjects: subjectCount };
  }

  // 5. Generate with the real engine (no filters: all demo classes).
  LOG('\nRunning timetable engine...');
  const result = await run({});

  if (!result.success) {
    LOG('GENERATION FAILED: ' + result.error);
    if (result.feasibility && result.feasibility.errors) {
      for (const e of result.feasibility.errors) LOG('  - ' + e);
    }
    if (disconnect) await mongoose.disconnect();
    throw new Error('Generation failed: ' + result.error);
  }

  // 6. Attach readable className to each class timetable (Class schema has no
  //    `name` field, so the engine leaves it blank; we compute it here).
  const idToLabel = {};
  for (const [label, cls] of Object.entries(classByLabel)) idToLabel[cls._id.toString()] = label;
  const classTimetables = result.classTimetables.map((ct) => ({
    ...ct,
    className: idToLabel[ct.classId.toString()] || ct.className || '',
  }));

  // 7. Persist as a single, idempotent demo version (update if it already exists).
  const existing = await Timetable.findOne({ label: TIMETABLE_LABEL });
  const payload = {
    label: TIMETABLE_LABEL,
    isAccepted: false,
    isComplete: result.isComplete,
    classTimetables,
    qualityScore: result.qualityScore,
    validationChecks: result.validationChecks || {},
    autoFillStats: result.autoFillStats || {},
    warnings: result.warnings || [],
    unplacedSubjects: result.unplacedSubjects || [],
    generationStats: result.generationStats || {},
  };
  let saved;
  if (existing) {
    saved = await Timetable.findByIdAndUpdate(existing._id, { $set: payload }, { new: true, returnDocument: 'after' });
    LOG('Updated existing demo timetable version ' + saved.version);
  } else {
    const latest = await Timetable.findOne().sort({ version: -1 });
    const nextVersion = latest ? latest.version + 1 : 1;
    saved = await Timetable.create({ ...payload, version: nextVersion });
    LOG('Created demo timetable version ' + saved.version);
  }

  // 8. Re-validate the PERSISTED document (not the in-memory result).
  const validation = await validatePersistedTimetable(saved);

  LOG('\n=== GENERATION SUMMARY ===');
  LOG('Engine success: ' + result.success);
  LOG('isComplete (engine): ' + result.isComplete);
  LOG('Hard violations: ' + (result.validationChecks?.hardViolationsCount ?? 'n/a'));
  LOG('Soft violations: ' + (result.validationChecks?.softViolationsCount ?? 'n/a'));
  LOG('Subjects placed: ' + (result.generationStats?.subjectsPlaced || 'n/a'));
  LOG('Empty slots: ' + (result.generationStats?.emptySlotsCount ?? 'n/a'));
  LOG('Warnings: ' + (result.warnings?.length || 0));
  LOG('Unplaced subjects: ' + (result.unplacedSubjects?.length || 0));
  for (const u of result.unplacedSubjects || []) {
    LOG('   UNPLACED ' + u.className + ' / ' + u.subjectName + ' (' + u.placed + '/' + u.expected + ')');
  }
  LOG('\n=== PERSISTED VALIDATION (re-checked from DB) ===');
  LOG('valid: ' + validation.valid);
  LOG('hardViolationsCount: ' + validation.hardViolationsCount);
  LOG('checks: ' + JSON.stringify(validation.checks));
  if (validation.hardViolations && validation.hardViolations.length) {
    for (const v of validation.hardViolations.slice(0, 20)) {
      LOG('   HARD ' + v.type + ': ' + v.message);
    }
  }

  LOG('\nSaved timetable _id: ' + saved._id + '  version: ' + saved.version);
  if (disconnect) await mongoose.disconnect();
  return { dryRun: false, saved, validation, result };
}

module.exports = { seedDemoData, TIMETABLE_LABEL, DEMO_PASSWORD, DEMO_ADMIN_PASSWORD, DEMO_ADMIN_USERNAME };

// CLI entry point.
if (require.main === module) {
  seedDemoData({ dryRun: process.argv.includes('--dry-run') }).catch((err) => {
    console.error('SEED ERROR:', err.message);
    process.exit(1);
  });
}
