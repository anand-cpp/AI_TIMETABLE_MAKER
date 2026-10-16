/**
 * READ-ONLY workload analysis for a persisted timetable.
 *
 *  - Loads a timetable (default: the accepted one, or --version N / --label "...")
 *  - Runs persisted hard-constraint validation
 *  - Prints per-teacher weekly + per-day teaching loads
 *  - Lists every teacher whose daily load exceeds their limit, with the exact
 *    (class, period, subject) slots that make up the overloaded day.
 *
 * Never writes anything. Usage:
 *   node scripts/analyzeWorkloads.js
 *   node scripts/analyzeWorkloads.js --version 1
 *   node scripts/analyzeWorkloads.js --label "DEMO College Timetable (S1-S7)"
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Timetable = require('../src/models/Timetable');
const Class = require('../src/models/Class');
const Teacher = require('../src/models/Teacher');
const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};

const line = (s) => console.log(s);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const wantVersion = argOf('--version');
  const wantLabel = argOf('--label');

  let tt;
  if (wantVersion) tt = await Timetable.findOne({ version: Number(wantVersion) });
  else if (wantLabel) tt = await Timetable.findOne({ label: wantLabel });
  else tt = await Timetable.findOne({ isAccepted: true });
  if (!tt) tt = await Timetable.findOne().sort({ version: -1 });

  if (!tt) throw new Error('No timetable found in database.');

  line('=== TIMETABLE UNDER ANALYSIS ===');
  line(`label: ${tt.label}  version: ${tt.version}  isAccepted: ${tt.isAccepted}  isComplete: ${tt.isComplete}`);
  line(`generationStats: ${JSON.stringify(tt.generationStats || {})}`);
  line(`stored qualityScore: ${JSON.stringify(tt.qualityScore || {})}`);

  const result = await validatePersistedTimetable(tt);
  line('');
  line('=== PERSISTED VALIDATION ===');
  line(`valid: ${result.valid}  hardViolations: ${result.hardViolationsCount}  softViolations: ${result.softViolationsCount}  emptySlots: ${result.emptySlotsCount}`);
  for (const [k, v] of Object.entries(result.checks || {})) line(`  ${k}: ${v}`);

  const soft = (result.violations || []).filter((v) => !result.hardViolations.includes(v));
  const daily = soft.filter((v) => v.type === 'TEACHER_DAILY_LIMIT_EXCEEDED');
  line('');
  line(`=== SOFT VIOLATIONS (${soft.length}) ===`);
  for (const v of soft) line(`  [${v.type}] ${v.message || JSON.stringify(v)}`);

  // ---- Build per-teacher daily workloads from the persisted grid ----
  const classes = await Class.find({}).lean();
  const classLabel = {};
  for (const c of classes) classLabel[c._id.toString()] = `S${c.semester}${c.section}`;

  const teachers = await Teacher.find({}).lean();
  const teacherName = {};
  const teacherLimit = {};
  for (const t of teachers) {
    teacherName[t._id.toString()] = t.name;
    teacherLimit[t._id.toString()] = t.maxPeriodsPerDay || 4;
  }

  const teacherIdsInSlot = (slot) => {
    const ids = [];
    if (Array.isArray(slot.teacherIds)) slot.teacherIds.forEach((id) => id && ids.push(id.toString()));
    if (slot.isBatchSplit) {
      if (slot.batch1 && slot.batch1.teacherId) ids.push(slot.batch1.teacherId.toString());
      if (slot.batch2 && slot.batch2.teacherId) ids.push(slot.batch2.teacherId.toString());
    }
    return ids;
  };

  const weekly = {}; // tid -> total
  const perDay = {}; // tid -> { day -> [ {class, period, subject, type} ] }

  for (const ct of tt.classTimetables || []) {
    const cid = ct.classId.toString();
    for (const slot of ct.slots || []) {
      if (!slot.day) continue;
      if (slot.isEmpty || slot.isBreak || !slot.subjectId) continue;
      for (const tid of teacherIdsInSlot(slot)) {
        weekly[tid] = (weekly[tid] || 0) + 1;
        perDay[tid] = perDay[tid] || {};
        perDay[tid][slot.day] = perDay[tid][slot.day] || [];
        perDay[tid][slot.day].push({
          class: classLabel[cid] || cid.slice(-4),
          period: slot.period,
          subject: slot.subjectName || slot.subjectCode || '',
          type: slot.subjectType || '',
        });
      }
    }
  }

  line('');
  line('=== PER-TEACHER WEEKLY LOAD & DAILY BREAKDOWN ===');
  const tids = Object.keys(weekly).sort((a, b) => weekly[b] - weekly[a]);
  let overloaded = 0;
  for (const tid of tids) {
    const name = teacherName[tid] || tid;
    const limit = teacherLimit[tid] || 5;
    const days = perDay[tid] || {};
    const parts = [];
    let isOver = false;
    for (const day of Object.keys(days).sort()) {
      const list = days[day].sort((a, b) => a.period - b.period);
      const flag = list.length > limit ? '  <-- OVER LIMIT ' + limit : '';
      if (list.length > limit) isOver = true;
      parts.push(`    ${day} (${list.length})${flag}: ` + list.map((s) => `P${s.period} ${s.class} ${s.subject}`).join(' | '));
    }
    if (isOver) overloaded++;
    line(`  ${name} [${tid.slice(-6)}] weekly=${weekly[tid]} limit/day=${limit}${isOver ? '   *** OVERLOADED ***' : ''}`);
    for (const p of parts) line(p);
  }

  line('');
  line(`=== SUMMARY ===`);
  line(`teachers with an over-limit day: ${overloaded}`);
  line(`TEACHER_DAILY_LIMIT_EXCEEDED soft violations reported: ${daily.length}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('ANALYSIS FAILED:', err);
  process.exit(1);
});
