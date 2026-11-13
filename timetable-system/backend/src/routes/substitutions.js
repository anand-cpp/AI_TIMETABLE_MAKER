const express = require('express');
const router = express.Router();
const Substitution = require('../models/Substitution');
const { authenticate } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/responseHelpers');

// GET /api/substitutions/teacher/:teacherId
router.get('/teacher/:teacherId', authenticate, async (req, res) => {
  try {
    const substitutions = await Substitution.find({
      $or: [
        { originalTeacherId: req.params.teacherId },
        { substituteTeacherId: req.params.teacherId },
      ],
    })
      .populate('originalTeacherId', 'name username')
      .populate('substituteTeacherId', 'name username')
      .populate('classId', 'semester section departmentId')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, { substitutions });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// POST /api/substitutions
router.post('/', authenticate, async (req, res) => {
  try {
    const { originalTeacherId, substituteTeacherId, classId, subjectId, date, day, period, notes } = req.body;
    if (!originalTeacherId || !substituteTeacherId) {
      return sendError(res, 400, 'Original and substitute teacher IDs are required');
    }
    const substitution = await Substitution.create({
      originalTeacherId,
      substituteTeacherId,
      classId,
      subjectId,
      date: date || new Date(),
      day: day || '',
      period: period || 0,
      notes: notes || '',
      status: 'pending',
    });
    return sendSuccess(res, 201, { substitution }, 'Substitution created successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// DELETE /api/substitutions/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const substitution = await Substitution.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );
    if (!substitution) {
      return sendError(res, 404, 'Substitution not found');
    }
    return sendSuccess(res, 200, { substitution }, 'Substitution cancelled');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

module.exports = router;
