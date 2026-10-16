/**
 * Optimize the DEMO timetable using the REAL engine and publish it through the
 * REAL acceptance gate. Non-destructive:
 *   - Never deletes or mutates the existing accepted version.
 *   - Creates a NEW timetable version (draft) with a distinct label.
 *   - Re-validates the PERSISTED document from the DB.
 *   - With --accept, publishes it via PATCH /api/timetable/versions/:id/accept
 *     (requires the backend to be running; prints before/after warnings).
 *
 * Usage:
 *   node scripts/optimizeDemoTimetable.js --dry      (generate only, no writes)
 *   node scripts/optimizeDemoTimetable.js            (create new draft version)
 *   node scripts/optimizeDemoTimetable.js --accept   (create + publish via gate)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Timetable = require('../src/models/Timetable');
const Class = require('../src/models/Class');
const Department = require('../src/models/Department');
const { run } = require('../src/services/engine/orchestrator');
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
const { loadData } = require('../src/services/engine/dataLoader');
const { scoreGrid } = require('../src/services/engine/qualityScorer');

const BASE_LABEL = 'DEMO College Timetable (S1-S7)';
const OPT_LABEL = BASE_LABEL + ' [optimized]';
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000';
const ADMIN_USER = 'demo.admin';
const ADMIN_PASS = 'DemoAdmin123!';

const DRY = process.argv.includes('--dry');
const ACCEPT = process.argv.includes('--accept');
const LABEL = (() => {
  const idx = process.argv.indexOf('--label');
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : OPT_LABEL;
})();
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

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  // Baseline (the currently accepted version).
  const baseline = await Timetable.findOne({ isAccepted: true }) || await Timetable.findOne({ label: BASE_LABEL });
  if (baseline) {
    const bv = await validatePersistedTimetable(baseline);
    line('=== BASELINE (before) ===');
    line(`label=${baseline.label} version=${baseline.version} accepted=${baseline.isAccepted}`);
    line(`hard=${bv.hardViolationsCount} soft=${bv.softViolationsCount} empty=${bv.emptySlotsCount} valid=${bv.valid}`);
    for (const v of bv.softViolations || []) line(`  SOFT ${v.type}: ${v.message}`);
  }

  line('\nRunning the real engine...');
  const result = await run({});
  if (!result.success) throw new Error('Engine failed: ' + result.error);

  line('=== ENGINE RESULT (after) ===');
  line(`isComplete=${result.isComplete} hard=${result.validationChecks?.hardViolationsCount} soft=${result.validationChecks?.softViolationsCount}`);
  line(`subjectsPlaced=${result.generationStats?.subjectsPlaced} emptySlots=${result.generationStats?.emptySlotsCount}`);
  line(`qualityScore=${JSON.stringify(result.qualityScore)}`);
  line(`unplaced=${(result.unplacedSubjects || []).length}`);
  for (const v of result.softViolations || []) line(`  SOFT ${v.type}: ${v.message}`);

  if (DRY) {
    line('\n--dry: nothing written.');
    await mongoose.disconnect();
    return;
  }

  // Compute readable className labels (Class schema has no name field).
  const dept = await Department.findOne({ code: 'CSE' });
  const classes = await Class.find({ departmentId: dept._id }).lean();
  const idToLabel = {};
  for (const c of classes) idToLabel[c._id.toString()] = dept.code + ' S' + c.semester + c.section;

  const classTimetables = result.classTimetables.map((ct) => ({
    ...ct,
    className: idToLabel[ct.classId.toString()] || ct.className || '',
  }));

  const payload = {
    label: LABEL,
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

  const existing = await Timetable.findOne({ label: LABEL });
  let saved;
  if (existing) {
    saved = await Timetable.findByIdAndUpdate(existing._id, { $set: payload }, { new: true, returnDocument: 'after' });
    line(`\nUpdated optimized version ${saved.version} (_id=${saved._id})`);
  } else {
    const latest = await Timetable.findOne().sort({ version: -1 });
    saved = await Timetable.create({ ...payload, version: (latest ? latest.version : 0) + 1 });
    line(`\nCreated optimized version ${saved.version} (_id=${saved._id})`);
  }

  const pv = await validatePersistedTimetable(saved);
  line('=== PERSISTED VALIDATION (after) ===');
  line(`valid=${pv.valid} hard=${pv.hardViolationsCount} soft=${pv.softViolationsCount} empty=${pv.emptySlotsCount}`);
  for (const v of pv.softViolations || []) line(`  SOFT ${v.type}: ${v.message}`);

  if (ACCEPT) {
    const baselineValidation = baseline ? await validatePersistedTimetable(baseline) : null;
    const baselineSoft = baselineValidation ? baselineValidation.softViolationsCount : null;
    if (!pv.valid || pv.hardViolationsCount > 0) {
      throw new Error(`Refusing to publish: persisted validation not clean (valid=${pv.valid} hard=${pv.hardViolationsCount}).`);
    }

    let publishOk = baselineSoft === null || pv.softViolationsCount < baselineSoft;
    if (!publishOk && baselineValidation && pv.softViolationsCount === baselineSoft) {
      // No change in soft warnings: allow publishing only if overall quality
      // (computed with the CURRENT scorer) does not regress. This lets
      // quality-only improvements (e.g. teacher-comfort) through while still
      // blocking regressions. Both are scored with the same scorer, so the
      // comparison is apples-to-apples.
      const data = await loadData({});
      const baseOverall = scoreGrid(baselineValidation.grid, data).overall;
      const newOverall = scoreGrid(pv.grid, data).overall;
      line(`\nquality before=${baseOverall} after=${newOverall}`);
      publishOk = newOverall >= baseOverall;
    }
    if (!publishOk) {
      throw new Error(`Refusing to publish: soft warnings did not improve (before=${baselineSoft} after=${pv.softViolationsCount}) and quality did not improve.`);
    }
    line('\nPublishing via the real acceptance gate...');
    const login = await http('/api/auth/admin/login', { method: 'POST', body: { username: ADMIN_USER, password: ADMIN_PASS } });
    const token = login.body?.data?.token || login.body?.token;
    if (!token) throw new Error('Admin login failed: ' + JSON.stringify(login.body));
    const acc = await http('/api/timetable/versions/' + saved._id + '/accept', { method: 'PATCH', token });
    line(`accept status=${acc.status} body=${JSON.stringify(acc.body)}`);
    if (acc.status >= 300) throw new Error('Accept failed.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('OPTIMIZE FAILED:', err);
  process.exit(1);
});
