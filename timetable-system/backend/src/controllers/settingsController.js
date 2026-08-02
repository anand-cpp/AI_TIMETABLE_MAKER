const CollegeSettings = require('../models/CollegeSettings');
const { sendSuccess, sendError } = require('../utils/responseHelpers');
const { validateTimeline } = require('../utils/timeHelpers');
const { validatePeriodTimeline } = require('../utils/validators');
const { DEFAULT_SETTINGS } = require('../config/constants');

// ─── GET Settings ─────────────────────────────────────────────────────────────
// GET /api/settings
const getSettings = async (req, res) => {
  try {
    let settings = await CollegeSettings.findOne({ singleton: 'singleton' });

    // Auto-create default settings if none exist
    if (!settings) {
      settings = await CollegeSettings.create({
        singleton: 'singleton',
        ...DEFAULT_SETTINGS,
      });
    }

    return sendSuccess(res, 200, { settings });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Settings ──────────────────────────────────────────────────────────
// PUT /api/settings
const updateSettings = async (req, res) => {
  try {
    const {
      collegeName,
      workingDays,
      periodsPerDay,
      periodDuration,
      teacherDailyLimit,
      periodTimeline,
      fridaySeparate,
      fridayTimeline,
    } = req.body;

    // Validate working days
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (workingDays) {
      if (!Array.isArray(workingDays) || workingDays.length === 0) {
        return sendError(res, 400, 'Working days must be a non-empty array');
      }
      for (const day of workingDays) {
        if (!validDays.includes(day)) {
          return sendError(res, 400, `Invalid working day: ${day}`);
        }
      }
    }

    // Validate teacher daily limit
    if (teacherDailyLimit !== undefined && Number(teacherDailyLimit) < 1) {
      return sendError(res, 400, 'Teacher daily period limit must be at least 1');
    }

    // Validate period timeline
    if (periodTimeline) {
      const timelineError = validatePeriodTimeline(periodTimeline);
      if (timelineError) return sendError(res, 400, timelineError);

      const timelineOrderErrors = validateTimeline(periodTimeline);
      if (timelineOrderErrors.length > 0) {
        return sendError(res, 400, timelineOrderErrors.join(', '));
      }
    }

    // Validate friday timeline if separate
    if (fridaySeparate && fridayTimeline && fridayTimeline.length > 0) {
      const fridayError = validatePeriodTimeline(fridayTimeline);
      if (fridayError) return sendError(res, 400, `Friday timeline: ${fridayError}`);

      const fridayOrderErrors = validateTimeline(fridayTimeline);
      if (fridayOrderErrors.length > 0) {
        return sendError(res, 400, `Friday timeline: ${fridayOrderErrors.join(', ')}`);
      }
    }

    // Build update object - only update provided fields
    const updateData = {};
    if (collegeName !== undefined) updateData.collegeName = collegeName.trim();
    if (workingDays !== undefined) updateData.workingDays = workingDays;
    if (periodsPerDay !== undefined) updateData.periodsPerDay = Number(periodsPerDay);
    if (periodDuration !== undefined) updateData.periodDuration = Number(periodDuration);
    if (teacherDailyLimit !== undefined) updateData.teacherDailyLimit = Number(teacherDailyLimit);
    if (periodTimeline !== undefined) updateData.periodTimeline = periodTimeline;
    if (fridaySeparate !== undefined) updateData.fridaySeparate = fridaySeparate;
    if (fridayTimeline !== undefined) updateData.fridayTimeline = fridayTimeline;

    const settings = await CollegeSettings.findOneAndUpdate(
      { singleton: 'singleton' },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    return sendSuccess(res, 200, { settings }, 'Settings updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── RESET Settings to defaults ───────────────────────────────────────────────
// POST /api/settings/reset
const resetSettings = async (req, res) => {
  try {
    const settings = await CollegeSettings.findOneAndUpdate(
      { singleton: 'singleton' },
      { $set: DEFAULT_SETTINGS },
      { new: true, upsert: true }
    );

    return sendSuccess(res, 200, { settings }, 'Settings reset to defaults');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── CLEAR Timetables Only (Semester Reset) ──────────────────────────────────
// POST /api/settings/clear-timetables
const clearTimetablesOnly = async (req, res) => {
  try {
    const Timetable = require('../models/Timetable');
    const Suggestion = require('../models/Suggestion');

    await Timetable.deleteMany({});
    await Suggestion.deleteMany({});

    return sendSuccess(
      res,
      200,
      null,
      'All generated timetable schedules cleared. Departments, classes, teachers, and subjects retained.'
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── CLEAR Subjects & Timetables (Curriculum Reset) ───────────────────────────
// POST /api/settings/clear-subjects-timetables
const clearSubjectsAndTimetables = async (req, res) => {
  try {
    const Timetable = require('../models/Timetable');
    const Subject = require('../models/Subject');
    const Class = require('../models/Class');
    const Suggestion = require('../models/Suggestion');

    await Timetable.deleteMany({});
    await Subject.deleteMany({});
    await Suggestion.deleteMany({});
    await Class.updateMany({}, { $set: { subjects: [] } });

    return sendSuccess(
      res,
      200,
      null,
      'Subjects and timetables cleared. Departments, classes, and teacher profiles retained.'
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── WIPE All System Data (Full Factory Reset) ─────────────────────────────────
// POST /api/settings/wipe-all
const wipeAllSystemData = async (req, res) => {
  try {
    const clearAllData = require('../utils/clearData');
    await clearAllData();
    return sendSuccess(res, 200, null, 'All system data deleted successfully. Admin account retained.');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
  clearTimetablesOnly,
  clearSubjectsAndTimetables,
  wipeAllSystemData,
};