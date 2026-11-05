const Class = require('../../models/Class');
const Subject = require('../../models/Subject');
const Teacher = require('../../models/Teacher');
const Department = require('../../models/Department');
const CollegeSettings = require('../../models/CollegeSettings');
const ElectiveGroup = require('../../models/ElectiveGroup');
const { DEFAULT_SETTINGS } = require('../../config/constants');
const { getTeachingPeriods } = require('../../utils/timeHelpers');

/**
 * Loads all data needed for timetable generation from DB
 * Supports: L/T/P/R breakdown, co-instructors, lab rooms, Friday separate timeline
 */
const loadData = async (options = {}) => {
  // ── Load settings ──────────────────────────────────────────────────────────
  let settings = await CollegeSettings.findOne({ singleton: 'singleton' });
  if (!settings) {
    settings = DEFAULT_SETTINGS;
  } else {
    settings = settings.toObject();
  }

  // ── Build class filter query ──────────────────────────────────────────────
  const classQuery = {};
  if (options.departmentId) {
    classQuery.departmentId = options.departmentId;
  }
  if (options.semester) {
    classQuery.semester = Number(options.semester);
  } else if (options.year) {
    const yearNum = Number(options.year);
    const startSem = (yearNum - 1) * 2 + 1;
    const endSem = yearNum * 2;
    classQuery.semester = { $gte: startSem, $lte: endSem };
  }
  if (options.section) {
    classQuery.section = options.section;
  }

  // ── Load classes ───────────────────────────────────────────────────────────
  let classes = await Class.find(classQuery)
    .populate('departmentId', 'name code building floor travelOptimization')
    .lean();

  if (!classes || classes.length === 0) {
    throw new Error('No classes found matching the selected generation criteria.');
  }

  const classIds = classes.map((c) => c._id);

  // ── Load subjects for filtered classes ─────────────────────────────────────
  let subjects = await Subject.find({ classId: { $in: classIds } })
    .populate('teachers', 'name username unavailability morningLabPreference maxPeriodsPerDay maxPeriodsPerWeek departmentId')
    .populate('coInstructors', 'name username unavailability morningLabPreference maxPeriodsPerDay maxPeriodsPerWeek departmentId')
    .populate('labDetails.batch1Teacher', 'name username unavailability departmentId')
    .populate('labDetails.batch2Teacher', 'name username unavailability departmentId')
    .populate('electiveDetails.linkedClasses', 'semester section departmentId')
    .populate('electiveDetails.participatingClasses', 'semester section departmentId')
    .populate('electiveDetails.electiveGroupId', 'name departmentId semester sections options')
    .lean();

  // ── Load elective groups for the filtered classes ──────────────────────────
  const departmentIds = classes.map(c => c.departmentId._id.toString());
  const semesters = [...new Set(classes.map(c => c.semester))];
  let electiveGroups = await ElectiveGroup.find({
    departmentId: { $in: departmentIds },
    semester: { $in: semesters },
    isActive: true,
  })
    .populate('options.subjectId', 'name code type weeklyHours')
    .populate('options.teacherIds', 'name username unavailability morningLabPreference maxPeriodsPerDay maxPeriodsPerWeek departmentId')
    .lean();

  if (!subjects || subjects.length === 0) {
    throw new Error('No subjects found for the selected classes.');
  }

  // Add class semester info to subjects for lab room validation
  const classMap = {};
  for (const cls of classes) {
    classMap[cls._id.toString()] = cls;
  }
  for (const sub of subjects) {
    const cls = classMap[sub.classId.toString()];
    if (cls) {
      sub.classSemester = cls.semester;
      sub.classSection = cls.section;
    }
  }

  // ── Load teachers ──────────────────────────────────────────────────────────
  let teachers = await Teacher.find({ isActive: true })
    .select('-password')
    .lean();

  // ── Merge custom teacherAvailability constraints if provided ────────────────
  if (options.teacherAvailability && Array.isArray(options.teacherAvailability)) {
    const customUnavailMap = {};
    for (const item of options.teacherAvailability) {
      const tId = item.teacherId || item.teacher_id;
      if (!tId) continue;
      customUnavailMap[tId.toString()] = item.unavailability || [];
    }

    for (const t of teachers) {
      const extraUnavail = customUnavailMap[t._id.toString()];
      if (extraUnavail && Array.isArray(extraUnavail)) {
        const existing = new Set(t.unavailability.map((u) => `${u.day}_${u.period}`));
        for (const slot of extraUnavail) {
          const key = `${slot.day}_${slot.period}`;
          if (!existing.has(key)) {
            existing.add(key);
            t.unavailability.push({ day: slot.day, period: Number(slot.period) });
          }
        }
      }
    }
  }

  // ── Build helper maps ──────────────────────────────────────────────────────
  const subjectMap = {};
  for (const sub of subjects) {
    subjectMap[sub._id.toString()] = sub;
  }

  const teacherMap = {};
  for (const t of teachers) {
    teacherMap[t._id.toString()] = t;
  }

  const subjectsByClass = {};
  for (const cls of classes) {
    subjectsByClass[cls._id.toString()] = subjects.filter(
      (s) => s.classId.toString() === cls._id.toString()
    );
  }

  // ── Build timeline info ────────────────────────────────────────────────────
  const monThuTimeline = settings.periodTimeline || DEFAULT_SETTINGS.periodTimeline;
  const fridayTimeline = settings.fridaySeparate && settings.fridayTimeline && settings.fridayTimeline.length > 0
    ? settings.fridayTimeline
    : monThuTimeline;

  const teachingPeriods = getTeachingPeriods(monThuTimeline);
  const fridayTeachingPeriods = getTeachingPeriods(fridayTimeline);

  const workingDays = settings.workingDays || DEFAULT_SETTINGS.workingDays;

  const periodsPerDayMap = {};
  for (const day of workingDays) {
    if (day === 'Friday' && settings.fridaySeparate) {
      periodsPerDayMap[day] = fridayTeachingPeriods;
    } else {
      periodsPerDayMap[day] = teachingPeriods;
    }
  }

  const allPeriodsPerDayMap = {};
  for (const day of workingDays) {
    const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : monThuTimeline;
    allPeriodsPerDayMap[day] = tl.map((p) => p.periodNumber);
  }

  const breakPeriodsPerDayMap = {};
  for (const day of workingDays) {
    const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : monThuTimeline;
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
    timeline: monThuTimeline,
    fridayTimeline,
    electiveGroups,
  };
};

module.exports = { loadData };