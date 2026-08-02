const Suggestion = require('../models/Suggestion');
const { sendSuccess, sendError } = require('../utils/responseHelpers');

// ─── CREATE Suggestion (Teacher only) ────────────────────────────────────────
// POST /api/suggestions
const createSuggestion = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return sendError(res, 400, 'Suggestion message is required');
    }

    if (message.trim().length < 10) {
      return sendError(res, 400, 'Suggestion must be at least 10 characters');
    }

    if (message.trim().length > 1000) {
      return sendError(res, 400, 'Suggestion must not exceed 1000 characters');
    }

    const suggestion = await Suggestion.create({
      teacherId: req.user._id,
      teacherName: req.user.name,
      message: message.trim(),
    });

    return sendSuccess(res, 201, { suggestion }, 'Suggestion submitted successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET All Suggestions (Admin only) ────────────────────────────────────────
// GET /api/suggestions
const getAllSuggestions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === 'true';
    }

    const suggestions = await Suggestion.find(filter)
      .populate('teacherId', 'name username email')
      .sort({ createdAt: -1 });

    const unreadCount = await Suggestion.countDocuments({ isRead: false });

    return sendSuccess(res, 200, { suggestions, unreadCount });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Own Suggestions (Teacher only) ──────────────────────────────────────
// GET /api/suggestions/mine
const getMySuggestions = async (req, res) => {
  try {
    const suggestions = await Suggestion.find({ teacherId: req.user._id }).sort({
      createdAt: -1,
    });

    return sendSuccess(res, 200, { suggestions });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── MARK Single Suggestion as Read (Admin only) ─────────────────────────────
// PATCH /api/suggestions/:id/read
const markAsRead = async (req, res) => {
  try {
    const suggestion = await Suggestion.findByIdAndUpdate(
      req.params.id,
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!suggestion) return sendError(res, 404, 'Suggestion not found');

    return sendSuccess(res, 200, { suggestion }, 'Marked as read');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── MARK ALL Suggestions as Read (Admin only) ───────────────────────────────
// PATCH /api/suggestions/read-all
const markAllAsRead = async (req, res) => {
  try {
    const result = await Suggestion.updateMany(
      { isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return sendSuccess(
      res,
      200,
      { modifiedCount: result.modifiedCount },
      `${result.modifiedCount} suggestion(s) marked as read`
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DELETE Suggestion (Admin only) ──────────────────────────────────────────
// DELETE /api/suggestions/:id
const deleteSuggestion = async (req, res) => {
  try {
    const suggestion = await Suggestion.findByIdAndDelete(req.params.id);
    if (!suggestion) return sendError(res, 404, 'Suggestion not found');

    return sendSuccess(res, 200, {}, 'Suggestion deleted successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  createSuggestion,
  getAllSuggestions,
  getMySuggestions,
  markAsRead,
  markAllAsRead,
  deleteSuggestion,
};