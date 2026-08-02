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
  collegeName: 'My College',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  periodsPerDay: 7,
  periodDuration: 60,
  teacherDailyLimit: 5,
  periodTimeline: [
    { periodNumber: 1, startTime: '09:00', endTime: '10:00', isBreak: false, label: 'Period 1' },
    { periodNumber: 2, startTime: '10:00', endTime: '11:00', isBreak: false, label: 'Period 2' },
    { periodNumber: 0, startTime: '11:00', endTime: '11:15', isBreak: true,  label: 'Tea Break' },
    { periodNumber: 3, startTime: '11:15', endTime: '12:15', isBreak: false, label: 'Period 3' },
    { periodNumber: 4, startTime: '12:15', endTime: '13:15', isBreak: false, label: 'Period 4' },
    { periodNumber: 0, startTime: '13:15', endTime: '14:00', isBreak: true,  label: 'Lunch Break' },
    { periodNumber: 5, startTime: '14:00', endTime: '15:00', isBreak: false, label: 'Period 5' },
    { periodNumber: 6, startTime: '15:00', endTime: '16:00', isBreak: false, label: 'Period 6' },
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