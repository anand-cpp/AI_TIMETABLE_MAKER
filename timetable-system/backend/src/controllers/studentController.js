const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const Department = require('../models/Department');
const { sendSuccess, sendError } = require('../utils/responseHelpers');

// ─── GET Student Timetable ────────────────────────────────────────────────────
// GET /api/student/timetable/:departmentId/:semester/:section
const getStudentTimetable = async (req, res) => {
  try {
    const { departmentId, semester, section } = req.params;

    // Find the class
    const cls = await Class.findOne({
      departmentId,
      semester: Number(semester),
      section: section.toUpperCase(),
    }).populate('departmentId', 'name code');

    if (!cls) {
      return sendError(res, 404, 'Class not found. Check department, semester, and section.');
    }

    // Find accepted timetable
    const timetable = await Timetable.findOne({ isAccepted: true });
    if (!timetable) {
      return sendError(res, 404, 'No timetable has been published yet. Please check back later.');
    }

    // Find this class's timetable grid
    const classTimetable = timetable.classTimetables.find(
      (ct) => ct.classId.toString() === cls._id.toString()
    );

    if (!classTimetable) {
      return sendError(res, 404, 'Timetable not found for this class.');
    }

    return sendSuccess(res, 200, {
      class: {
        id: cls._id,
        department: cls.departmentId,
        semester: cls.semester,
        section: cls.section,
      },
      timetable: {
        version: timetable.version,
        generatedAt: timetable.generatedAt,
        acceptedAt: timetable.acceptedAt,
        slots: classTimetable.slots,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Departments (public dropdown) ───────────────────────────────────────
// GET /api/student/departments
const getPublicDepartments = async (req, res) => {
  try {
    const departments = await Department.find().select('name code').sort({ name: 1 });
    return sendSuccess(res, 200, { departments });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Semesters by Department (public dropdown) ────────────────────────────
// GET /api/student/semesters/:departmentId
const getPublicSemesters = async (req, res) => {
  try {
    const semesters = await Class.distinct('semester', {
      departmentId: req.params.departmentId,
    });

    if (!semesters.length) {
      return sendError(res, 404, 'No classes found for this department');
    }

    return sendSuccess(res, 200, { semesters: semesters.sort((a, b) => a - b) });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Sections by Department + Semester (public dropdown) ──────────────────
// GET /api/student/sections/:departmentId/:semester
const getPublicSections = async (req, res) => {
  try {
    const { departmentId, semester } = req.params;

    const classes = await Class.find({
      departmentId,
      semester: Number(semester),
    }).select('section _id');

    if (!classes.length) {
      return sendError(res, 404, 'No classes found for this semester');
    }

    return sendSuccess(res, 200, { sections: classes });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getStudentTimetable,
  getPublicDepartments,
  getPublicSemesters,
  getPublicSections,
};