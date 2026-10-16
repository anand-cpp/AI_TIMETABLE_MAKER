/**
 * READ-ONLY demo verification + (optional) publish.
 *
 *  - Re-prints per-section completeness from the PERSISTED demo timetable.
 *  - Runs persisted hard-constraint validation again.
 *  - Lists soft (quality) violations.
 *  - If the demo timetable is a draft, publishes it through the REAL API accept
 *    gate (so the teacher/published views work in the demo).
 *  - Probes teacher-to-teacher privacy over the real HTTP API.
 *
 * It never deletes anything. Requires the backend to be running for API checks
 * (set API_BASE, default http://127.0.0.1:5000).
 *
 * Usage: node scripts/verifyDemoData.js            (report + publish + probes)
 *        node scripts/verifyDemoData.js --no-publish
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Timetable = require('../src/models/Timetable');
const Class = require('../src/models/Class');
const Department = require('../src/models/Department');
const Teacher = require('../src/models/Teacher');
const Subject = require('../src/models/Subject');
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');

const LABEL = 'DEMO College Timetable (S1-S7)';
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000';
const NO_PUBLISH = process.argv.includes('--no-publish');
const DEMO_PASSWORD = 'DemoPass123!';
const DEMO_ADMIN_PASSWORD = 'DemoAdmin123!';

const line = (s) => console.log(s);

async function http(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

async function login(path, username, password) {
  return http(path, { method: 'POST', body: { username, password } });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  // Prefer the OFFICIAL (accepted) timetable; fall back to the base demo label.
  // Prevents accidentally re-publishing a stale draft that shares the label.
  const tt = (await Timetable.findOne({ isAccepted: true })) || (await Timetable.findOne({ label: LABEL }));
  if (!tt) throw new Error('Demo timetable not found. Run scripts/seedDemoData.js first.');

  const dept = await Department.findOne({ code: 'CSE' });
  const classes = await Class.find({ departmentId: dept._id }).sort({ semester: 1, section: 1 }).lean();
  const classesById = {};
  for (const c of classes) classesById[c._id.toString()] = 'CSE S' + c.semester + c.section;

  line('=== DEMO TIMETABLE ===');
  line('label: ' + tt.label + '  version: ' + tt.version + '  isAccepted: ' + tt.isAccepted + '  isComplete: ' + tt.isComplete);

  // Subject-hour completion per section, computed from persisted slots.
  const subjects = await Subject.find({ classId: { $in: classes.map((c) => c._id) } }).lean();
  const subjectsByClass = {};
  for (const s of subjects) {
    const k = s.classId.toString();
    (subjectsByClass[k] = subjectsByClass[k] || []).push(s);
  }

  line('\n=== PER-SECTION SUBJECT-HOUR COMPLETION ===');
  let allHoursMet = true;
  for (const ct of tt.classTimetables) {
    const cid = ct.classId.toString();
    const label = classesById[cid] || cid;
    const placed = {};
    let autofill = 0;
    for (const slot of ct.slots) {
      if (slot.isBreak) continue;
      if (slot.isAutoFill || slot.subjectType === 'autofill') { autofill++; continue; }
      if (slot.subjectId) {
        const sid = slot.subjectId.toString();
        placed[sid] = (placed[sid] || 0) + 1;
      }
    }
    const list = (subjectsByClass[cid] || []).map((s) => {
      const expected = s.type === 'lab' ? (s.labDetails?.duration || s.weeklyHours) : s.weeklyHours;
      const got = placed[s._id.toString()] || 0;
      if (got !== expected) allHoursMet = false;
      return s.code + ':' + got + '/' + expected + (got === expected ? '' : ' <-- MISMATCH');
    });
    line(label.padEnd(9) + ' subjects=' + list.length + '  teaching slots=' + (ct.slots.length) +
         '  autofill=' + autofill + '  hoursOK=' + list.every((x) => !x.includes('MISMATCH')));
    if (list.some((x) => x.includes('MISMATCH'))) line('   ' + list.filter((x) => x.includes('MISMATCH')).join(', '));
  }
  line('All subject hours met: ' + allHoursMet);

  const validation = await validatePersistedTimetable(tt);
  line('\n=== PERSISTED HARD-CONSTRAINT VALIDATION ===');
  line('valid: ' + validation.valid + '  hardViolations: ' + validation.hardViolationsCount);
  line('checks: ' + JSON.stringify(validation.checks));
  for (const v of (validation.hardViolations || []).slice(0, 20)) line('   HARD ' + v.type + ': ' + v.message);

  line('\n=== SOFT (QUALITY) VIOLATIONS: ' + (validation.softViolations || []).length + ' ===');
  const softByType = {};
  for (const v of validation.softViolations || []) softByType[v.type] = (softByType[v.type] || 0) + 1;
  line(JSON.stringify(softByType));
  for (const v of validation.softViolations || []) line('   SOFT ' + v.type + ': ' + v.message);

  // ---- Publish via the real accept gate ----
  if (!NO_PUBLISH && !tt.isAccepted) {
    line('\n=== PUBLISH (real /accept gate) ===');
    const adminLogin = await login('/api/auth/admin/login', 'demo.admin', DEMO_ADMIN_PASSWORD);
    if (adminLogin.status !== 200) {
      line('admin login failed: ' + adminLogin.status + ' ' + JSON.stringify(adminLogin.body) + ' (is the backend running on ' + API_BASE + '?)');
    } else {
      const adminToken = adminLogin.body.data.token;
      const acc = await http('/api/timetable/versions/' + tt._id + '/accept', { method: 'PATCH', token: adminToken });
      line('accept status: ' + acc.status + ' ' + JSON.stringify(acc.body.message || acc.body));
    }
  } else if (tt.isAccepted) {
    line('\n(demo timetable already published)');
  }

  // ---- Teacher-to-teacher privacy probes (real HTTP API) ----
  line('\n=== TEACHER-TO-TEACHER PRIVACY PROBES ===');
  const aLogin = await login('/api/auth/teacher/login', 'ananya.nair', DEMO_PASSWORD);
  const bLogin = await login('/api/auth/teacher/login', 'rahul.menon', DEMO_PASSWORD);
  if (aLogin.status !== 200 || bLogin.status !== 200) {
    line('teacher login failed (A=' + aLogin.status + ', B=' + bLogin.status + '). Backend running?');
  } else {
    const aId = aLogin.body.data.user.id;
    const bId = bLogin.body.data.user.id;
    const aTok = aLogin.body.data.token;
    const bTok = bLogin.body.data.token;

    const probes = [];
    probes.push(['Teacher A: own timetable (expect 200)', (await http('/api/timetable/teacher/' + aId, { token: aTok })).status, 200]);
    probes.push(['Teacher A: Teacher B timetable (expect 403)', (await http('/api/timetable/teacher/' + bId, { token: aTok })).status, 403]);
    probes.push(['Teacher A: admin versions list (expect 403)', (await http('/api/timetable/versions', { token: aTok })).status, 403]);
    probes.push(['Teacher A: admin generate (expect 403)', (await http('/api/timetable/generate', { method: 'POST', token: aTok, body: {} })).status, 403]);
    probes.push(['Teacher A: own PDF download (expect 200)', (await http('/api/download/pdf/teacher/' + aId, { token: aTok })).status, 200]);
    probes.push(['Teacher A: Teacher B PDF download (expect 403)', (await http('/api/download/pdf/teacher/' + bId, { token: aTok })).status, 403]);
    probes.push(['Anonymous: accepted timetable (expect 200)', (await http('/api/timetable/accepted')).status, 200]);
    probes.push(['Anonymous: accepted Excel download (expect 200)', (await http('/api/download/excel/all-classes')).status, 200]);

    let pass = true;
    for (const [name, got, want] of probes) {
      const ok = got === want;
      if (!ok) pass = false;
      line((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + ' want=' + want);
    }
    line('Privacy probes overall: ' + (pass ? 'PASS' : 'FAIL'));
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error('VERIFY ERROR:', e.message); process.exit(1); });
