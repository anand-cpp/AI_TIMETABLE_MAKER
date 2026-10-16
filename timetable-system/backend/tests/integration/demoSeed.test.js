/* Regression tests for the DEMO seeder and teacher-to-teacher data isolation.
 *
 * Runs against an ISOLATED test database (its own name, dropped before/after)
 * so it never touches the dev `timetable_db`. Requires a local mongod.
 *
 * Covers:
 *   - The seeder is idempotent (no duplicate teachers/classes/subjects, one
 *     demo timetable version).
 *   - The seeded timetable passes persisted hard-constraint validation.
 *   - Teachers cannot read/modify other teachers' data or admin-only endpoints.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_test_secret_test_secret_1234';
process.env.CLIENT_URL = 'http://localhost:5173';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const TEST_URI = 'mongodb://127.0.0.1:27017/timetable_demo_seed_test';
const TEST_DB = 'timetable_demo_seed_test';

let server;
let baseURL;
let models;
let seedDemoData;
let TIMETABLE_LABEL;
let DEMO_PASSWORD;
let DEMO_ADMIN_PASSWORD;
let initialCounts;

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
  return { status: res.status, body: json };
};

const snapshot = async () => {
  const { Department, Teacher, Class, Subject, Timetable } = models;
  return {
    departments: await Department.countDocuments(),
    teachers: await Teacher.countDocuments(),
    classes: await Class.countDocuments(),
    subjects: await Subject.countDocuments(),
    timetables: await Timetable.countDocuments({ label: TIMETABLE_LABEL }),
    totalTimetables: await Timetable.countDocuments(),
  };
};

const runSeed = () =>
  seedDemoData({ uri: TEST_URI, disconnect: false, allowedDbs: [TEST_DB], log: () => {} });

before(async () => {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();

  models = {
    Department: require('../../src/models/Department'),
    Teacher: require('../../src/models/Teacher'),
    Class: require('../../src/models/Class'),
    Subject: require('../../src/models/Subject'),
    Timetable: require('../../src/models/Timetable'),
    Admin: require('../../src/models/Admin'),
  };

  ({ seedDemoData, TIMETABLE_LABEL, DEMO_PASSWORD, DEMO_ADMIN_PASSWORD } = require('../../scripts/seedDemoData'));

  const app = require('../../src/app');
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseURL = `http://127.0.0.1:${server.address().port}`;

  // First seed (also the fixture used by the isolation tests below).
  const first = await runSeed();
  assert.equal(first.validation.valid, true, 'seeded timetable must be valid after persist');
  initialCounts = await snapshot();
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('seed creates the expected demo footprint', () => {
  assert.equal(initialCounts.departments, 1);
  assert.equal(initialCounts.teachers, 16);
  assert.equal(initialCounts.classes, 8);
  assert.equal(initialCounts.subjects, 56);
  assert.equal(initialCounts.timetables, 1);
});

test('seed is idempotent (re-running creates nothing new)', async () => {
  const beforeRun = await snapshot();
  const second = await runSeed();
  const afterRun = await snapshot();

  assert.deepEqual(afterRun, beforeRun, 'counts must not change on a re-run');
  assert.equal(second.validation.valid, true);
  assert.equal(second.saved.isAccepted, false, 'seeder leaves the demo timetable as a draft');

  // The demo version number must be stable (rewrite, not append).
  const versions = await models.Timetable.find({ label: TIMETABLE_LABEL }).distinct('version');
  assert.equal(versions.length, 1, 'exactly one demo version exists');
  assert.equal(versions[0], 1);
});

test('seed is idempotent even for teacher credentials (password unchanged)', async () => {
  const t = await models.Teacher.findOne({ username: 'ananya.nair' });
  assert.ok(t, 'seeded teacher exists');
  const hashBefore = t.password;
  await runSeed();
  const t2 = await models.Teacher.findOne({ username: 'ananya.nair' });
  assert.equal(t2.password, hashBefore, 're-seed must not change the stored password hash');
});

test('teacher can fetch their own timetable', async () => {
  const login = await api('/api/auth/teacher/login', {
    method: 'POST',
    body: { username: 'ananya.nair', password: DEMO_PASSWORD },
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const { token, user } = login.body.data;
  const res = await api(`/api/timetable/teacher/${user.id}`, { token });
  assert.equal(res.status, 200);
});

test('teacher cannot read another teacher\'s timetable (403)', async () => {
  const a = await api('/api/auth/teacher/login', {
    method: 'POST',
    body: { username: 'ananya.nair', password: DEMO_PASSWORD },
  });
  const b = await api('/api/auth/teacher/login', {
    method: 'POST',
    body: { username: 'rahul.menon', password: DEMO_PASSWORD },
  });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);

  const res = await api(`/api/timetable/teacher/${b.body.data.user.id}`, { token: a.body.data.token });
  assert.equal(res.status, 403);
});

test('teacher cannot reach admin-only endpoints (403)', async () => {
  const a = await api('/api/auth/teacher/login', {
    method: 'POST',
    body: { username: 'ananya.nair', password: DEMO_PASSWORD },
  });
  const token = a.body.data.token;

  const versions = await api('/api/timetable/versions', { token });
  assert.equal(versions.status, 403);

  const generate = await api('/api/timetable/generate', { method: 'POST', token, body: {} });
  assert.equal(generate.status, 403);
});

test('teacher cannot download another teacher\'s PDF (403)', async () => {
  // Drafts are never exposed for download, so publish the demo version first
  // through the REAL admin accept gate (which itself re-validates).
  const adminLogin = await api('/api/auth/admin/login', {
    method: 'POST',
    body: { username: 'demo.admin', password: DEMO_ADMIN_PASSWORD },
  });
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.body));

  const tt = await models.Timetable.findOne({ label: TIMETABLE_LABEL });
  const accept = await api(`/api/timetable/versions/${tt._id}/accept`, {
    method: 'PATCH',
    token: adminLogin.body.data.token,
  });
  assert.equal(accept.status, 200, JSON.stringify(accept.body));

  const a = await api('/api/auth/teacher/login', {
    method: 'POST',
    body: { username: 'ananya.nair', password: DEMO_PASSWORD },
  });
  const b = await api('/api/auth/teacher/login', {
    method: 'POST',
    body: { username: 'rahul.menon', password: DEMO_PASSWORD },
  });
  const token = a.body.data.token;

  const own = await api(`/api/download/pdf/teacher/${a.body.data.user.id}`, { token });
  assert.equal(own.status, 200);

  const other = await api(`/api/download/pdf/teacher/${b.body.data.user.id}`, { token });
  assert.equal(other.status, 403);
});
