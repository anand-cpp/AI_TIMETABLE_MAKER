const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const { sendSuccess, sendError } = require('../utils/responseHelpers');
const { generateUniqueUsername, generateDefaultPassword } = require('../utils/generateCredentials');
const { validateUnavailability } = require('../utils/validators');

// ─── GET All Teachers ─────────────────────────────────────────────────────────
// GET /api/teachers
const getTeachers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.departmentId) filter.departmentId = req.query.departmentId;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const teachers = await Teacher.find(filter)
      .select('-password')
      .populate('departmentId', 'name code')
      .sort({ name: 1 });

    return sendSuccess(res, 200, { teachers });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Single Teacher ───────────────────────────────────────────────────────
// GET /api/teachers/:id
const getTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .select('-password')
      .populate('departmentId', 'name code');

    if (!teacher) return sendError(res, 404, 'Teacher not found');
    return sendSuccess(res, 200, { teacher });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── CREATE Teacher ───────────────────────────────────────────────────────────
// POST /api/teachers
const createTeacher = async (req, res) => {
  try {
    const {
      name,
      departmentId,
      email,
      phone,
      unavailability,
      morningLabPreference,
      maxPeriodsPerDay,
    } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Teacher name is required');
    }

    // Validate unavailability if provided
    if (unavailability) {
      const unavailError = validateUnavailability(unavailability);
      if (unavailError) return sendError(res, 400, unavailError);
    }

    // Auto-generate username and password
    const username = await generateUniqueUsername(name.trim());
    const rawPassword = generateDefaultPassword(name.trim());

    const teacher = await Teacher.create({
      name: name.trim(),
      username,
      password: rawPassword,
      departmentId: departmentId || null,
      email: email ? email.trim().toLowerCase() : '',
      phone: phone ? phone.trim() : '',
      unavailability: unavailability || [],
      morningLabPreference: morningLabPreference || false,
      maxPeriodsPerDay: maxPeriodsPerDay ? Number(maxPeriodsPerDay) : null,
    });

    const populated = await Teacher.findById(teacher._id)
      .select('-password')
      .populate('departmentId', 'name code');

    return sendSuccess(
      res,
      201,
      {
        teacher: populated,
        credentials: {
          username,
          password: rawPassword,
        },
      },
      'Teacher created successfully'
    );
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'Username already exists');
    }
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Teacher ───────────────────────────────────────────────────────────
// PUT /api/teachers/:id
const updateTeacher = async (req, res) => {
  try {
    const {
      name,
      departmentId,
      email,
      phone,
      morningLabPreference,
      maxPeriodsPerDay,
      isActive,
      password,
    } = req.body;

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (morningLabPreference !== undefined) updateData.morningLabPreference = morningLabPreference;
    if (maxPeriodsPerDay !== undefined) updateData.maxPeriodsPerDay = maxPeriodsPerDay ? Number(maxPeriodsPerDay) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Password update - will be re-hashed by pre-save hook
    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return sendError(res, 400, 'Password must be at least 6 characters');
      }
      teacher.password = password.trim();
      Object.assign(teacher, updateData);
      await teacher.save();

      const populated = await Teacher.findById(teacher._id)
        .select('-password')
        .populate('departmentId', 'name code');

      return sendSuccess(res, 200, { teacher: populated }, 'Teacher updated successfully');
    }

    // No password change - use findByIdAndUpdate
    const updated = await Teacher.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('departmentId', 'name code');

    return sendSuccess(res, 200, { teacher: updated }, 'Teacher updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Teacher Unavailability ────────────────────────────────────────────
// PUT /api/teachers/:id/unavailability
const updateUnavailability = async (req, res) => {
  try {
    const { unavailability } = req.body;

    if (!Array.isArray(unavailability)) {
      return sendError(res, 400, 'Unavailability must be an array');
    }

    const unavailError = validateUnavailability(unavailability);
    if (unavailError) return sendError(res, 400, unavailError);

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { $set: { unavailability } },
      { new: true }
    ).select('-password');

    if (!teacher) return sendError(res, 404, 'Teacher not found');

    return sendSuccess(res, 200, { teacher }, 'Unavailability updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DELETE Teacher ───────────────────────────────────────────────────────────
// DELETE /api/teachers/:id
const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    // Warn if teacher is assigned to any subjects
    const subjectCount = await Subject.countDocuments({
      $or: [
        { teachers: req.params.id },
        { 'labDetails.batch1Teacher': req.params.id },
        { 'labDetails.batch2Teacher': req.params.id },
      ],
    });

    await Teacher.findByIdAndDelete(req.params.id);

    return sendSuccess(
      res,
      200,
      { warning: subjectCount > 0 ? `Teacher was assigned to ${subjectCount} subject(s). Please reassign those subjects.` : null },
      'Teacher deleted successfully'
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Teacher's own profile ────────────────────────────────────────────────
// GET /api/teachers/me/profile
const getMyProfile = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user._id)
      .select('-password')
      .populate('departmentId', 'name code');

    if (!teacher) return sendError(res, 404, 'Teacher not found');
    return sendSuccess(res, 200, { teacher });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  updateUnavailability,
  deleteTeacher,
  getMyProfile,
};