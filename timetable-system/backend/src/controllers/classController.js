const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Department = require('../models/Department');
const { sendSuccess, sendError } = require('../utils/responseHelpers');

// ─── GET All Classes ──────────────────────────────────────────────────────────
// GET /api/classes
const getClasses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.departmentId) filter.departmentId = req.query.departmentId;
    if (req.query.semester) filter.semester = Number(req.query.semester);

    const classes = await Class.find(filter)
      .populate('departmentId', 'name code')
      .populate('subjects', 'name code type weeklyHours')
      .sort({ semester: 1, section: 1 });

    return sendSuccess(res, 200, { classes });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Single Class ─────────────────────────────────────────────────────────
// GET /api/classes/:id
const getClass = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('departmentId', 'name code building')
      .populate({
        path: 'subjects',
        populate: [
          { path: 'teachers', select: 'name username' },
          { path: 'labDetails.batch1Teacher', select: 'name username' },
          { path: 'labDetails.batch2Teacher', select: 'name username' },
        ],
      });

    if (!cls) return sendError(res, 404, 'Class not found');
    return sendSuccess(res, 200, { class: cls });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── CREATE Class ─────────────────────────────────────────────────────────────
// POST /api/classes
const createClass = async (req, res) => {
  try {
    const {
      departmentId,
      semester,
      section,
      strength,
      classRepName,
      classRepEmail,
      hodEmail,
    } = req.body;

    // Required fields
    if (!departmentId) return sendError(res, 400, 'Department is required');
    if (!semester) return sendError(res, 400, 'Semester is required');
    if (!section || !section.trim()) return sendError(res, 400, 'Section is required');

    // Validate semester
    const semNum = Number(semester);
    if (isNaN(semNum) || semNum < 1 || semNum > 8) {
      return sendError(res, 400, 'Semester must be between 1 and 8');
    }

    // Check department exists
    const department = await Department.findById(departmentId);
    if (!department) return sendError(res, 404, 'Department not found');

    // Check duplicate: same department + semester + section
    const existing = await Class.findOne({
      departmentId,
      semester: semNum,
      section: section.trim().toUpperCase(),
    });
    if (existing) {
      return sendError(
        res,
        409,
        `Class ${department.code} S${semNum} ${section.trim().toUpperCase()} already exists`
      );
    }

    const cls = await Class.create({
      departmentId,
      semester: semNum,
      section: section.trim().toUpperCase(),
      strength: strength ? Number(strength) : 60,
      classRepName: classRepName ? classRepName.trim() : '',
      classRepEmail: classRepEmail ? classRepEmail.trim().toLowerCase() : '',
      hodEmail: hodEmail ? hodEmail.trim().toLowerCase() : '',
      subjects: [],
    });

    const populated = await Class.findById(cls._id).populate('departmentId', 'name code');

    return sendSuccess(res, 201, { class: populated }, 'Class created successfully');
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'Class already exists with same department, semester and section');
    }
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Class ─────────────────────────────────────────────────────────────
// PUT /api/classes/:id
const updateClass = async (req, res) => {
  try {
    const {
      strength,
      classRepName,
      classRepEmail,
      hodEmail,
      section,
    } = req.body;

    const cls = await Class.findById(req.params.id);
    if (!cls) return sendError(res, 404, 'Class not found');

    // If section changed, check for duplicate
    if (section && section.trim().toUpperCase() !== cls.section) {
      const existing = await Class.findOne({
        departmentId: cls.departmentId,
        semester: cls.semester,
        section: section.trim().toUpperCase(),
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return sendError(res, 409, 'A class with this section already exists for this department and semester');
      }
    }

    const updateData = {};
    if (section !== undefined) updateData.section = section.trim().toUpperCase();
    if (strength !== undefined) updateData.strength = Number(strength);
    if (classRepName !== undefined) updateData.classRepName = classRepName.trim();
    if (classRepEmail !== undefined) updateData.classRepEmail = classRepEmail.trim().toLowerCase();
    if (hodEmail !== undefined) updateData.hodEmail = hodEmail.trim().toLowerCase();

    const updated = await Class.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('departmentId', 'name code');

    return sendSuccess(res, 200, { class: updated }, 'Class updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DELETE Class ─────────────────────────────────────────────────────────────
// DELETE /api/classes/:id
const deleteClass = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return sendError(res, 404, 'Class not found');

    // Cascade delete all subjects belonging to this class
    const deletedSubjects = await Subject.deleteMany({ classId: req.params.id });

    await Class.findByIdAndDelete(req.params.id);

    return sendSuccess(
      res,
      200,
      { deletedSubjectsCount: deletedSubjects.deletedCount },
      `Class deleted successfully along with ${deletedSubjects.deletedCount} subject(s)`
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Semesters by Department (for dropdown) ───────────────────────────────
// GET /api/classes/semesters/:departmentId
const getSemestersByDepartment = async (req, res) => {
  try {
    const semesters = await Class.distinct('semester', {
      departmentId: req.params.departmentId,
    });
    return sendSuccess(res, 200, { semesters: semesters.sort((a, b) => a - b) });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Sections by Department + Semester (for dropdown) ─────────────────────
// GET /api/classes/sections/:departmentId/:semester
const getSectionsByDepartmentAndSemester = async (req, res) => {
  try {
    const { departmentId, semester } = req.params;
    const classes = await Class.find({
      departmentId,
      semester: Number(semester),
    }).select('_id section strength classRepName');

    return sendSuccess(res, 200, { classes });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  getSemestersByDepartment,
  getSectionsByDepartmentAndSemester,
};