const express = require('express');
const router = express.Router();
const ElectiveGroup = require('../models/ElectiveGroup');
const Subject = require('../models/Subject');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/responseHelpers');

// GET /api/elective-groups
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.query.departmentId) filter.departmentId = req.query.departmentId;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const groups = await ElectiveGroup.find(filter)
      .populate('departmentId', 'name code')
      .populate('options.subjectId', 'name code type weeklyHours')
      .populate('options.teacherIds', 'name username')
      .sort({ semester: 1, name: 1 });

    return sendSuccess(res, 200, { groups });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// GET /api/elective-groups/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const group = await ElectiveGroup.findById(req.params.id)
      .populate('departmentId', 'name code')
      .populate('options.subjectId', 'name code type weeklyHours')
      .populate('options.teacherIds', 'name username');

    if (!group) return sendError(res, 404, 'Elective group not found');
    return sendSuccess(res, 200, { group });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// POST /api/elective-groups
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, departmentId, semester, sections, options, fixedSlot, isActive } = req.body;
    if (!name || !departmentId || !semester) {
      return sendError(res, 400, 'Name, departmentId, and semester are required');
    }

    // Clean options: filter out any entries missing subjectId
    const cleanOptions = (options || []).filter(opt => opt && opt.subjectId);

    const group = await ElectiveGroup.create({
      name: name.trim(),
      departmentId,
      semester: Number(semester),
      sections: Array.isArray(sections) ? sections : [],
      options: cleanOptions,
      fixedSlot: fixedSlot || { day: '', period: 0, isMandatory: false },
      isActive: isActive !== undefined ? isActive : true,
    });

    const populated = await ElectiveGroup.findById(group._id)
      .populate('departmentId', 'name code')
      .populate('options.subjectId', 'name code type weeklyHours')
      .populate('options.teacherIds', 'name username');

    return sendSuccess(res, 201, { group: populated }, 'Elective group created successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// PUT /api/elective-groups/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, departmentId, semester, sections, options, fixedSlot, isActive } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (semester !== undefined) updateData.semester = Number(semester);
    if (sections !== undefined) updateData.sections = Array.isArray(sections) ? sections : [];
    if (options !== undefined) {
      updateData.options = (options || []).filter(opt => opt && opt.subjectId);
    }
    if (fixedSlot !== undefined) updateData.fixedSlot = fixedSlot;
    if (isActive !== undefined) updateData.isActive = isActive;

    const group = await ElectiveGroup.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('departmentId', 'name code')
      .populate('options.subjectId', 'name code type weeklyHours')
      .populate('options.teacherIds', 'name username');

    if (!group) return sendError(res, 404, 'Elective group not found');
    return sendSuccess(res, 200, { group }, 'Elective group updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// DELETE /api/elective-groups/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const group = await ElectiveGroup.findById(req.params.id);
    if (!group) return sendError(res, 404, 'Elective group not found');

    // Safely unset electiveGroupId on any referencing subjects
    await Subject.updateMany(
      { 'electiveDetails.electiveGroupId': group._id },
      { $set: { 'electiveDetails.electiveGroupId': null } }
    );

    await ElectiveGroup.findByIdAndDelete(req.params.id);
    return sendSuccess(res, 200, null, 'Elective group deleted successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

module.exports = router;
