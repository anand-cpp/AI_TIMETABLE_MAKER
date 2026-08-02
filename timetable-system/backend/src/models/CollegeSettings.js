const mongoose = require('mongoose');
const { DEFAULT_SETTINGS } = require('../config/constants');

const periodTimelineSchema = new mongoose.Schema(
  {
    periodNumber: { type: Number, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isBreak: { type: Boolean, default: false },
    label: { type: String, default: '' },
  },
  { _id: false }
);

const collegeSettingsSchema = new mongoose.Schema(
  {
    collegeName: {
      type: String,
      default: DEFAULT_SETTINGS.collegeName,
      trim: true,
    },
    workingDays: {
      type: [String],
      default: DEFAULT_SETTINGS.workingDays,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    periodsPerDay: {
      type: Number,
      default: DEFAULT_SETTINGS.periodsPerDay,
      min: 1,
      max: 12,
    },
    periodDuration: {
      type: Number,
      default: DEFAULT_SETTINGS.periodDuration,
    },
    teacherDailyLimit: {
      type: Number,
      default: DEFAULT_SETTINGS.teacherDailyLimit,
      min: 1,
    },
    periodTimeline: {
      type: [periodTimelineSchema],
      default: DEFAULT_SETTINGS.periodTimeline,
    },
    fridaySeparate: {
      type: Boolean,
      default: false,
    },
    fridayTimeline: {
      type: [periodTimelineSchema],
      default: [],
    },
    singleton: {
      type: String,
      default: 'singleton',
      immutable: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CollegeSettings', collegeSettingsSchema);