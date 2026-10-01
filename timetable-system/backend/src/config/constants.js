const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
};

const SUBJECT_TYPES = {
  THEORY: 'theory',
  LAB: 'lab',
  ELECTIVE: 'elective',
};

const ELECTIVE_TYPES = {
  LINKED: 'linked',
  OPEN: 'open',
};

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const MAX_PERIODS_PER_DAY = 10;

const DEFAULT_SETTINGS = {
  collegeName: 'ASET College of Engineering, KTU, Kerala',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  periodsPerDay: 6,
  periodDuration: 55,
  teacherDailyLimit: 4,
  periodTimeline: [
    { periodNumber: 1, startTime: '09:00', endTime: '09:55', isBreak: false, label: 'Period 1' },
    { periodNumber: 2, startTime: '09:55', endTime: '10:50', isBreak: false, label: 'Period 2' },
    { periodNumber: 3, startTime: '10:50', endTime: '11:45', isBreak: false, label: 'Period 3' },
    { periodNumber: 0, startTime: '11:45', endTime: '12:30', isBreak: true,  label: 'Lunch Break' },
    { periodNumber: 4, startTime: '12:30', endTime: '13:25', isBreak: false, label: 'Period 4' },
    { periodNumber: 5, startTime: '13:25', endTime: '14:20', isBreak: false, label: 'Period 5' },
    { periodNumber: 6, startTime: '14:20', endTime: '15:15', isBreak: false, label: 'Period 6' },
  ],
  fridaySeparate: false,
  fridayTimeline: [],
};

module.exports = {
  DAYS,
  ROLES,
  SUBJECT_TYPES,
  ELECTIVE_TYPES,
  SEMESTERS,
  MAX_PERIODS_PER_DAY,
  DEFAULT_SETTINGS,
};