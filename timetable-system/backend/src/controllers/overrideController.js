const OverrideLog = require('../models/OverrideLog');
const Timetable = require('../models/Timetable');
const { sendSuccess, sendError } = require('../utils/responseHelpers');

// GET /api/overrides
const getOverrideLogs = async (req, res) => {
  try {
    const logs = await OverrideLog.find()
      .sort({ createdAt: -1 })
      .lean();
    return sendSuccess(res, 200, { logs });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// POST /api/overrides
const createOverrideLog = async (req, res) => {
  try {
    const {
      timetableVersionId,
      requestType,
      teacherId,
      teacherName,
      subjectId,
      subjectName,
      classId,
      className,
      issueDescription,
      selectedOption,
      impact,
      status,
      adminNotes,
    } = req.body;

    const log = await OverrideLog.create({
      timetableVersionId: timetableVersionId || null,
      requestType,
      teacherId: teacherId || null,
      teacherName: teacherName || '',
      subjectId: subjectId || null,
      subjectName: subjectName || '',
      classId: classId || null,
      className: className || '',
      issueDescription,
      selectedOption,
      impact: impact || '',
      status: status || 'APPROVED',
      adminNotes: adminNotes || '',
      approvedBy: req.user?.username || 'Admin',
      appliedAt: new Date(),
    });

    return sendSuccess(res, 201, { log }, 'Override log recorded successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// DELETE /api/overrides/:id (Revert override)
const revertOverrideLog = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await OverrideLog.findById(id);
    if (!log) {
      return sendError(res, 404, 'Override log entry not found');
    }

    log.status = 'REVERTED';
    await log.save();

    return sendSuccess(res, 200, { log }, 'Override status updated to REVERTED');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getOverrideLogs,
  createOverrideLog,
  revertOverrideLog,
};
