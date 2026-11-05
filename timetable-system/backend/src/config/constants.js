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

// ASET 2026-27 EVEN Semester Timelines
const MON_THU_TIMELINE = [
  { periodNumber: 1, startTime: '09:00', endTime: '10:00', isBreak: false, label: 'Period 1' },
  { periodNumber: 2, startTime: '10:00', endTime: '11:00', isBreak: false, label: 'Period 2' },
  { periodNumber: 0, startTime: '11:00', endTime: '11:20', isBreak: true, label: 'Short Break' },
  { periodNumber: 3, startTime: '11:20', endTime: '12:20', isBreak: false, label: 'Period 3' },
  { periodNumber: 0, startTime: '12:20', endTime: '13:10', isBreak: true, label: 'Lunch Break' },
  { periodNumber: 4, startTime: '13:10', endTime: '14:10', isBreak: false, label: 'Period 4' },
  { periodNumber: 5, startTime: '14:10', endTime: '15:10', isBreak: false, label: 'Period 5' },
  { periodNumber: 0, startTime: '15:10', endTime: '15:20', isBreak: true, label: 'Short Break' },
  { periodNumber: 6, startTime: '15:20', endTime: '16:20', isBreak: false, label: 'Period 6' },
];

const FRIDAY_TIMELINE = [
  { periodNumber: 1, startTime: '09:00', endTime: '10:00', isBreak: false, label: 'Period 1' },
  { periodNumber: 2, startTime: '10:00', endTime: '11:00', isBreak: false, label: 'Period 2' },
  { periodNumber: 0, startTime: '11:00', endTime: '11:10', isBreak: true, label: 'Short Break' },
  { periodNumber: 3, startTime: '11:10', endTime: '12:00', isBreak: false, label: 'Period 3' },
  { periodNumber: 4, startTime: '12:00', endTime: '12:50', isBreak: false, label: 'Period 4' },
  { periodNumber: 0, startTime: '12:50', endTime: '14:30', isBreak: true, label: 'Lunch Break' },
  { periodNumber: 5, startTime: '14:30', endTime: '15:20', isBreak: false, label: 'Period 5' },
  { periodNumber: 0, startTime: '15:20', endTime: '15:30', isBreak: true, label: 'Short Break' },
  { periodNumber: 6, startTime: '15:30', endTime: '16:20', isBreak: false, label: 'Period 6' },
];

const DEFAULT_SETTINGS = {
  collegeName: 'AHALIA SCHOOL OF ENGINEERING & TECHNOLOGY',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  periodsPerDay: 6,
  periodDuration: 60,
  teacherDailyLimit: 6,
  periodTimeline: MON_THU_TIMELINE,
  fridaySeparate: true,
  fridayTimeline: FRIDAY_TIMELINE,
};

module.exports = {
  DAYS,
  ROLES,
  SUBJECT_TYPES,
  ELECTIVE_TYPES,
  SEMESTERS,
  MAX_PERIODS_PER_DAY,
  DEFAULT_SETTINGS,
  MON_THU_TIMELINE,
  FRIDAY_TIMELINE,
};