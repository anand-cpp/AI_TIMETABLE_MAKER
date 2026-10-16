const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();

// Default timeline mirrors config/constants.DEFAULT_SETTINGS (break numbered 0).
const defaultTimeline = () => [
  { periodNumber: 1, startTime: '09:00', endTime: '09:55', isBreak: false, label: 'Period 1' },
  { periodNumber: 2, startTime: '09:55', endTime: '10:50', isBreak: false, label: 'Period 2' },
  { periodNumber: 3, startTime: '10:50', endTime: '11:45', isBreak: false, label: 'Period 3' },
  { periodNumber: 0, startTime: '11:45', endTime: '12:30', isBreak: true, label: 'Lunch Break' },
  { periodNumber: 4, startTime: '12:30', endTime: '13:25', isBreak: false, label: 'Period 4' },
  { periodNumber: 5, startTime: '13:25', endTime: '14:20', isBreak: false, label: 'Period 5' },
  { periodNumber: 6, startTime: '14:20', endTime: '15:15', isBreak: false, label: 'Period 6' },
];

const makeTeacher = (name, extra = {}) => ({
  _id: oid(),
  name,
  username: name.toLowerCase(),
  unavailability: [],
  maxPeriodsPerDay: extra.maxPeriodsPerDay || 4,
  isActive: true,
  departmentId: extra.departmentId || null,
  ...extra,
});

const makeClass = (name, extra = {}) => ({
  _id: oid(),
  name,
  semester: extra.semester || 3,
  section: extra.section || 'A',
  departmentId: extra.departmentId || { _id: oid(), name: 'CSE', code: 'CSE' },
});

const makeTheory = (classId, teachers, weeklyHours, extra = {}) => ({
  _id: oid(),
  classId,
  name: extra.name || 'Theory Subject',
  code: extra.code || 'TH',
  type: 'theory',
  weeklyHours,
  teachers,
  ...extra,
});

const makeLab = (classId, teachers, duration, extra = {}) => ({
  _id: oid(),
  classId,
  name: extra.name || 'Lab Subject',
  code: extra.code || 'LAB',
  type: 'lab',
  weeklyHours: extra.weeklyHours || duration,
  teachers,
  labDetails: {
    duration,
    isBatchSplit: false,
    roomName: extra.roomName || 'CS-LAB-1',
    ...(extra.labDetails || {}),
  },
  ...extra,
});

const makeOpenElective = (participatingClassIds, options, extra = {}) => ({
  _id: oid(),
  classId: participatingClassIds[0],
  name: extra.name || 'Open Elective',
  code: extra.code || 'OE',
  type: 'elective',
  weeklyHours: extra.weeklyHours || 1,
  teachers: [],
  electiveDetails: {
    electiveType: 'open',
    participatingClasses: participatingClassIds,
    openElectiveOptions: options, // [{ teacherId, optionName }]
    ...(extra.electiveDetails || {}),
  },
  ...extra,
});

const makeLinkedElective = (classId, teachers, groupId, extra = {}) => ({
  _id: oid(),
  classId,
  name: extra.name || 'Linked Elective',
  code: extra.code || 'LE',
  type: 'elective',
  weeklyHours: extra.weeklyHours || 1,
  teachers,
  electiveDetails: {
    electiveType: 'linked',
    linkedGroupId: groupId,
    linkedClasses: extra.linkedClasses || [],
    ...(extra.electiveDetails || {}),
  },
  ...extra,
});

/**
 * Build a data object shaped exactly like dataLoader.loadData() output.
 */
const buildData = ({ classes, subjects, teachers, settings = {}, timeline, workingDays } = {}) => {
  const tl = timeline || defaultTimeline();
  const days = workingDays || settings.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const teachingPeriods = tl.filter((p) => !p.isBreak).map((p) => p.periodNumber);
  const allPeriods = tl.map((p) => p.periodNumber);
  const breakPeriods = tl.filter((p) => p.isBreak).map((p) => p.periodNumber);

  const classMap = {};
  for (const c of classes) classMap[c._id.toString()] = c;

  const teacherMap = {};
  for (const t of teachers) teacherMap[t._id.toString()] = t;

  const subjectsByClass = {};
  for (const c of classes) {
    subjectsByClass[c._id.toString()] = subjects.filter(
      (s) => s.classId.toString() === c._id.toString()
    );
  }

  const subjectMap = {};
  for (const s of subjects) subjectMap[s._id.toString()] = s;

  const periodsPerDayMap = {};
  const allPeriodsPerDayMap = {};
  const breakPeriodsPerDayMap = {};
  for (const day of days) {
    periodsPerDayMap[day] = teachingPeriods;
    allPeriodsPerDayMap[day] = allPeriods;
    breakPeriodsPerDayMap[day] = breakPeriods;
  }

  return {
    settings: { teacherDailyLimit: 4, fridaySeparate: false, workingDays: days, ...settings },
    classes,
    subjects,
    teachers,
    classMap,
    subjectMap,
    teacherMap,
    subjectsByClass,
    workingDays: days,
    periodsPerDayMap,
    allPeriodsPerDayMap,
    breakPeriodsPerDayMap,
    timeline: tl,
    fridayTimeline: tl,
  };
};

module.exports = {
  oid,
  defaultTimeline,
  makeTeacher,
  makeClass,
  makeTheory,
  makeLab,
  makeOpenElective,
  makeLinkedElective,
  buildData,
};
