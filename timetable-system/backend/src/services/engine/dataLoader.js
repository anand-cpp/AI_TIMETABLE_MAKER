const Class = require('../../models/Class');
const Subject = require('../../models/Subject');
const Teacher = require('../../models/Teacher');
const CollegeSettings = require('../../models/CollegeSettings');
const { DEFAULT_SETTINGS } = require('../../config/constants');
const { getTeachingPeriods } = require('../../utils/timeHelpers');

/**
 * Loads all data needed for timetable generation from DB
 * Returns a structured data object used by all engine modules
 */
const loadData = async () => {
  // ── Load settings ──────────────────────────────────────────────────────────
  let settings = await CollegeSettings.findOne({ singleton: 'singleton' });
  if (!settings) {
    settings = DEFAULT_SETTINGS;
  } else {
    settings = settings.toObject();
  }

  // ── Load classes ───────────────────────────────────────────────────────────
  const classes = await Class.find()
    .populate('departmentId', 'name code building floor travelOptimization')
    .lean();

  if (!classes || classes.length === 0) {
    throw new Error('No classes found. Add classes before generating a timetable.');
  }

  // ── Load subjects ──────────────────────────────────────────────────────────
  const subjects = await Subject.find()
    .populate('teachers', 'name username unavailability morningLabPreference maxPeriodsPerDay')
    .populate('labDetails.batch1Teacher', 'name username unavailability')
    .populate('labDetails.batch2Teacher', 'name username unavailability')
    .populate('electiveDetails.linkedClasses', 'semester section departmentId')
    .populate('electiveDetails.participatingClasses', 'semester section departmentId')
    .lean();

  if (!subjects || subjects.length === 0) {
    throw new Error('No subjects found. Add subjects before generating a timetable.');
  }

  // ── Load teachers ──────────────────────────────────────────────────────────
  const teachers = await Teacher.find({ isActive: true })
    .select('-password')
    .lean();

  // ── Build helper maps ──────────────────────────────────────────────────────

  // classId -> class object
  const classMap = {};
  for (const cls of classes) {
    classMap[cls._id.toString()] = cls;
  }

  // subjectId -> subject object
  const subjectMap = {};
  for (const sub of subjects) {
    subjectMap[sub._id.toString()] = sub;
  }

  // teacherId -> teacher object
  const teacherMap = {};
  for (const t of teachers) {
    teacherMap[t._id.toString()] = t;
  }

  // classId -> [subjects]
  const subjectsByClass = {};
  for (const cls of classes) {
    subjectsByClass[cls._id.toString()] = subjects.filter(
      (s) => s.classId.toString() === cls._id.toString()
    );
  }

  // ── Build timeline info ────────────────────────────────────────────────────
  const timeline = settings.periodTimeline || DEFAULT_SETTINGS.periodTimeline;
  const fridayTimeline =
    settings.fridaySeparate && settings.fridayTimeline && settings.fridayTimeline.length > 0
      ? settings.fridayTimeline
      : timeline;

  // Teaching periods (non-break) per day
  const teachingPeriods = getTeachingPeriods(timeline);
  const fridayTeachingPeriods = getTeachingPeriods(fridayTimeline);

  // All working days
  const workingDays = settings.workingDays || DEFAULT_SETTINGS.workingDays;

  // Periods per day map (day -> [period numbers that are teaching periods])
  const periodsPerDayMap = {};
  for (const day of workingDays) {
    if (day === 'Friday' && settings.fridaySeparate) {
      periodsPerDayMap[day] = fridayTeachingPeriods;
    } else {
      periodsPerDayMap[day] = teachingPeriods;
    }
  }

  // All period numbers (including breaks) per day
  const allPeriodsPerDayMap = {};
  for (const day of workingDays) {
    const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
    allPeriodsPerDayMap[day] = tl.map((p) => p.periodNumber);
  }

  // Break periods per day
  const breakPeriodsPerDayMap = {};
  for (const day of workingDays) {
    const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
    breakPeriodsPerDayMap[day] = tl.filter((p) => p.isBreak).map((p) => p.periodNumber);
  }

  return {
    settings,
    classes,
    subjects,
    teachers,
    classMap,
    subjectMap,
    teacherMap,
    subjectsByClass,
    workingDays,
    periodsPerDayMap,
    allPeriodsPerDayMap,
    breakPeriodsPerDayMap,
    timeline,
    fridayTimeline,
  };
};

module.exports = { loadData };