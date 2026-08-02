const { DAYS, SUBJECT_TYPES, SEMESTERS } = require('../config/constants');
const mongoose = require('mongoose');

// Check valid MongoDB ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Check valid day name
const isValidDay = (day) => {
  return DAYS.includes(day);
};

// Check valid semester
const isValidSemester = (sem) => {
  return SEMESTERS.includes(Number(sem));
};

// Check valid subject type
const isValidSubjectType = (type) => {
  return Object.values(SUBJECT_TYPES).includes(type);
};

// Check valid email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Check valid time format HH:MM
const isValidTimeFormat = (time) => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
};

// Validate unavailability array
// Each entry must have valid day and period >= 1
const validateUnavailability = (unavailability) => {
  if (!Array.isArray(unavailability)) return 'Unavailability must be an array';

  for (const item of unavailability) {
    if (!item.day || !isValidDay(item.day)) {
      return `Invalid day: ${item.day}`;
    }
    if (!item.period || item.period < 1) {
      return `Invalid period: ${item.period}`;
    }
  }

  return null; // null means valid
};

// Validate period timeline entries
const validatePeriodTimeline = (timeline) => {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return 'Period timeline must be a non-empty array';
  }

  for (const period of timeline) {
    if (!period.periodNumber || period.periodNumber < 1) {
      return `Invalid period number: ${period.periodNumber}`;
    }
    if (!period.startTime || !period.endTime) {
      return `Period ${period.periodNumber} missing start or end time`;
    }
  }

  return null;
};

// Sanitize string (trim + lowercase optional)
const sanitizeString = (str, lowercase = false) => {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim();
  return lowercase ? trimmed.toLowerCase() : trimmed;
};

module.exports = {
  isValidObjectId,
  isValidDay,
  isValidSemester,
  isValidSubjectType,
  isValidEmail,
  isValidTimeFormat,
  validateUnavailability,
  validatePeriodTimeline,
  sanitizeString,
};