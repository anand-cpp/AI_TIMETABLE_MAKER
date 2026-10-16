/**
 * Set the per-teacher maxPeriodsPerDay override to a target value (default 4).
 *
 * Context: the demo seed historically set every teacher's maxPeriodsPerDay to 5,
 * which SHADOWS the college-wide CollegeSettings.teacherDailyLimit (4). This
 * script aligns the per-teacher override with the college default so the
 * effective teacher daily limit is honoured by the engine.
 *
 * Safe + idempotent:
 *   - Only touches teachers whose maxPeriodsPerDay differs from the target.
 *   - Prints a before/after distribution.
 *   - --dry runs make no writes.
 *
 * Usage:
 *   node scripts/setTeacherDailyLimit.js --dry
 *   node scripts/setTeacherDailyLimit.js             (limit 4)
 *   node scripts/setTeacherDailyLimit.js --limit 4
 *   node scripts/setTeacherDailyLimit.js --limit 4 --only-over   (only lower values > target)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Teacher = require('../src/models/Teacher');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const ONLY_OVER = argv.includes('--only-over');
const limitArgIdx = argv.indexOf('--limit');
const TARGET = limitArgIdx !== -1 ? Number(argv[limitArgIdx + 1]) : 4;

const line = (s) => console.log(s);

const distribution = (teachers) => {
  const dist = {};
  for (const t of teachers) {
    const k = t.maxPeriodsPerDay === undefined || t.maxPeriodsPerDay === null ? 'unset' : String(t.maxPeriodsPerDay);
    dist[k] = (dist[k] || 0) + 1;
  }
  return dist;
};

async function main() {
  if (!Number.isFinite(TARGET) || TARGET < 1) {
    throw new Error('Invalid --limit value: ' + argv[limitArgIdx + 1]);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const teachers = await Teacher.find({}).select('name username maxPeriodsPerDay').lean();
  line('Target teacher daily limit: ' + TARGET + (ONLY_OVER ? ' (only lowering values above target)' : ''));
  line('Teachers total: ' + teachers.length);
  line('Before distribution: ' + JSON.stringify(distribution(teachers)));

  const toUpdate = teachers.filter((t) => {
    if (ONLY_OVER) return typeof t.maxPeriodsPerDay === 'number' && t.maxPeriodsPerDay > TARGET;
    return t.maxPeriodsPerDay !== TARGET;
  });

  line('Teachers needing update: ' + toUpdate.length);
  for (const t of toUpdate) {
    line('  ' + t.name + ' (' + t.username + '): ' + (t.maxPeriodsPerDay ?? 'unset') + ' -> ' + TARGET);
  }

  if (DRY) {
    line('\n--dry: no writes performed.');
    await mongoose.disconnect();
    return;
  }

  let modified = 0;
  for (const t of toUpdate) {
    const res = await Teacher.updateOne({ _id: t._id }, { $set: { maxPeriodsPerDay: TARGET } });
    if (res.modifiedCount) modified++;
  }
  line('\nUpdated ' + modified + ' teacher(s).');

  const after = await Teacher.find({}).select('maxPeriodsPerDay').lean();
  line('After distribution: ' + JSON.stringify(distribution(after)));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('SET LIMIT FAILED:', err);
  process.exit(1);
});
