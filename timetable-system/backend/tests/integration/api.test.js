/* Integration tests: real Express app + real MongoDB (isolated test database).
 * Run with: npm test  (requires a local mongod on 127.0.0.1:27017) */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_test_secret_test_secret_1234';
process.env.CLIENT_URL = 'http://localhost:5173';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const TEST_URI = 'mongodb://127.0.0.1:27017/timetable_audit_test';

let server;
let baseURL;
let models;

const api = async (path, { method = 'GET', token, body } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseURL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, headers: res.headers };
};

const adminToken = (id) => jwt.sign({ id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const teacherToken = (id) => jwt.sign({ id, role: 'teacher' }, process.env.JWT_SECRET, { expiresIn: '1h' });

before(async () => {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();

  // Require models/app only after the connection exists.
  const Admin = require('../../src/models/Admin');
  const Department = require('../../src/models/Department');
  const Class = require('../../src/models/Class');
  const Teacher = require('../../src/models/Teacher');
  const Subject = require('../../src/models/Subject');
  const Timetable = require('../../src/models/Timetable');
  const CollegeSettings = require('../../src/models/CollegeSettings');
  const { DEFAULT_SETTINGS } = require('../../src/config/constants');
  models = { Admin, Department, Class, Teacher, Subject, Timetable, CollegeSettings, DEFAULT_SETTINGS };

  const app = require('../../src/app');
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('GET /api/health responds', async () => {
  const res = await api('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('protected route requires authentication', async () => {
  const res = await api('/api/teachers');
  assert.equal(res.status, 401);
});

test('admin setup is atomic under concurrent requests (exactly one wins)', async () => {
  const [a, b] = await Promise.all([
    api('/api/auth/setup', { method: 'POST', body: { username: 'admin', password: 'password123' } }),
    api('/api/auth/setup', { method: 'POST', body: { username: 'admin', password: 'password123' } }),
  ]);
  const created = [a, b].filter((r) => r.status === 201);
  assert.equal(created.length, 1, `expected exactly one 201, got ${a.status}/${b.status}`);
  const count = await models.Admin.countDocuments();
  assert.equal(count, 1);
});

test('admin login works after setup', async () => {
  const res = await api('/api/auth/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: 'password123' },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.token);
});

test('PUT /api/settings accepts a break with periodNumber 0', async () => {
  const admin = await models.Admin.findOne();
  const res = await api('/api/settings', {
    method: 'PUT',
    token: adminToken(admin._id),
    body: { periodTimeline: models.DEFAULT_SETTINGS.periodTimeline },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test('teacher cannot access another teacher\'s timetable (403)', async () => {
  const dept = await models.Department.create({ name: 'CSE', code: 'CSE' });
  const t1 = await models.Teacher.create({ name: 'T1', username: 't1', password: 'password123', departmentId: dept._id });
  const t2 = await models.Teacher.create({ name: 'T2', username: 't2', password: 'password123', departmentId: dept._id });
  const res = await api(`/api/timetable/teacher/${t2._id}`, { token: teacherToken(t1._id) });
  assert.equal(res.status, 403);
});

test('generation → accept gate → publish → anonymous download', async () => {
  const admin = await models.Admin.findOne();
  const dept = await models.Department.findOne({ code: 'CSE' });
  const teacher = await models.Teacher.findOne({ username: 't1' });

  const cls = await models.Class.create({ departmentId: dept._id, semester: 3, section: 'A' });
  await models.Subject.create([
    { name: 'Math', code: 'MA', classId: cls._id, type: 'theory', weeklyHours: 4, teachers: [teacher._id] },
    { name: 'Physics', code: 'PH', classId: cls._id, type: 'theory', weeklyHours: 3, teachers: [teacher._id] },
  ]);

  // Run the real engine
  const orchestrator = require('../../src/services/engine/orchestrator');
  const gen = await orchestrator.run({});
  assert.equal(gen.success, true, gen.error);
  assert.ok(gen.classTimetables.length >= 1);

  const valid = await models.Timetable.create({
    version: 1,
    label: 'V1',
    isAccepted: false,
    isComplete: gen.isComplete,
    classTimetables: gen.classTimetables,
    validationChecks: gen.validationChecks,
    qualityScore: gen.qualityScore,
    generationStats: gen.generationStats,
  });

  // Draft must NOT be publicly downloadable
  const anonDraft = await api(`/api/download/excel/all-classes?versionId=${valid._id}`);
  assert.equal(anonDraft.status, 404, 'draft must not be exposed to anonymous users');

  // Accept a valid version → 200
  const accept = await api(`/api/timetable/versions/${valid._id}/accept`, {
    method: 'PATCH',
    token: adminToken(admin._id),
  });
  assert.equal(accept.status, 200, JSON.stringify(accept.body));

  // Now public accepted endpoint returns it
  const accepted = await api('/api/timetable/accepted');
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.data.timetable.version, 1);

  // Public download of accepted works
  const anonAccepted = await api('/api/download/excel/all-classes');
  assert.equal(anonAccepted.status, 200);
});

test('an invalid version (over-scheduled subject) cannot be accepted', async () => {
  const admin = await models.Admin.findOne();
  const cls = await models.Class.findOne({ section: 'A' });
  const subject = await models.Subject.findOne({ code: 'MA' });
  const teacher = await models.Teacher.findOne({ username: 't1' });

  const makeSlot = (day, period) => ({
    day, period,
    subjectId: subject._id, subjectName: 'Math', subjectCode: 'MA', subjectType: 'theory',
    teacherIds: [teacher._id], teacherNames: ['T1'], roomName: '',
    isEmpty: false, isBreak: false, isLabBlock: false, isEstive: false, isElective: false,
  });

  // 5 Math periods but weeklyHours is 4 → SUBJECT_OVER_SCHEDULED
  const slots = [
    makeSlot('Monday', 1), makeSlot('Monday', 2), makeSlot('Tuesday', 1),
    makeSlot('Wednesday', 1), makeSlot('Thursday', 1),
  ];

  const invalid = await models.Timetable.create({
    version: 2,
    label: 'V2-bad',
    isAccepted: false,
    classTimetables: [{ classId: cls._id, className: 'CSE S3A', slots }],
  });

  const res = await api(`/api/timetable/versions/${invalid._id}/accept`, {
    method: 'PATCH',
    token: adminToken(admin._id),
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.ok(Array.isArray(res.body.data?.violations) || res.body.message);

  const still = await models.Timetable.findById(invalid._id);
  assert.equal(still.isAccepted, false);
});

test('manual edit that introduces a conflict is rejected', async () => {
  const admin = await models.Admin.findOne();
  const accepted = await models.Timetable.findOne({ isAccepted: true });
  assert.ok(accepted);

  const classTT = accepted.classTimetables[0];
  const cls = classTT.classId.toString();

  // Find an empty/break-free slot and try to place a subject with NO teacher —
  // which the edit guard must reject (INVALID_SLOT_NO_TEACHER).
  const target = classTT.slots.find((s) => !s.isBreak);

  const res = await api(`/api/timetable/versions/${accepted._id}/edit/set`, {
    method: 'PATCH',
    token: adminToken(admin._id),
    body: {
      classId: cls,
      day: target.day,
      period: target.period,
      slotData: {
        subjectName: 'Injected', subjectType: 'theory', teacherIds: [], teacherNames: [],
        isEmpty: false, isBreak: false,
      },
    },
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('POST /api/subjects/bulk assigns one subject across multiple classes', async () => {
  const admin = await models.Admin.findOne();
  const dept = await models.Department.findOne({ code: 'CSE' });
  const teacher = await models.Teacher.findOne({ username: 't1' });

  const c1 = await models.Class.create({ departmentId: dept._id, semester: 5, section: 'A' });
  const c2 = await models.Class.create({ departmentId: dept._id, semester: 5, section: 'B' });

  const res = await api('/api/subjects/bulk', {
    method: 'POST',
    token: adminToken(admin._id),
    body: {
      name: 'Operating Systems', code: 'OS501', type: 'theory', weeklyHours: 3,
      teachers: [String(teacher._id)], classIds: [String(c1._id), String(c2._id)],
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.createdCount, 2);
  assert.equal(res.body.data.skippedCount, 0);
  assert.equal(await models.Subject.countDocuments({ code: 'OS501' }), 2);

  // Each class is linked to its own subject doc.
  const cls1 = await models.Class.findById(c1._id);
  assert.equal(cls1.subjects.length, 1);
});

test('POST /api/subjects/bulk skips classes that already have the subject code', async () => {
  const admin = await models.Admin.findOne();
  const dept = await models.Department.findOne({ code: 'CSE' });
  const teacher = await models.Teacher.findOne({ username: 't1' });
  const c1 = await models.Class.findOne({ semester: 5, section: 'A' });
  const c3 = await models.Class.create({ departmentId: dept._id, semester: 5, section: 'C' });

  const res = await api('/api/subjects/bulk', {
    method: 'POST',
    token: adminToken(admin._id),
    body: {
      name: 'Operating Systems', code: 'OS501', type: 'theory', weeklyHours: 3,
      teachers: [String(teacher._id)], classIds: [String(c1._id), String(c3._id)],
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.createdCount, 1, 'only the class without OS501 is created');
  assert.equal(res.body.data.skippedCount, 1);
  assert.equal(res.body.data.skipped[0].classId, String(c1._id));
  assert.equal(await models.Subject.countDocuments({ code: 'OS501' }), 3);
});

test('POST /api/subjects/bulk requires admin and at least one class', async () => {
  const admin = await models.Admin.findOne();
  const teacher = await models.Teacher.findOne({ username: 't1' });

  const forbidden = await api('/api/subjects/bulk', {
    method: 'POST',
    token: teacherToken(teacher._id),
    body: { name: 'X', code: 'X1', type: 'theory', weeklyHours: 2, teachers: [], classIds: [] },
  });
  assert.equal(forbidden.status, 403);

  const empty = await api('/api/subjects/bulk', {
    method: 'POST',
    token: adminToken(admin._id),
    body: {
      name: 'X', code: 'X1', type: 'theory', weeklyHours: 2,
      teachers: [String(teacher._id)], classIds: [],
    },
  });
  assert.equal(empty.status, 400);
});
