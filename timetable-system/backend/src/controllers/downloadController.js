const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const { sendError } = require('../utils/responseHelpers');
const pdfService = require('../services/pdfService');
const excelService = require('../services/excelService');

// ─── Helper: get accepted timetable ──────────────────────────────────────────
const getAcceptedTimetable = async (res) => {
  const timetable = await Timetable.findOne({ isAccepted: true });
  if (!timetable) {
    sendError(res, 404, 'No accepted timetable found');
    return null;
  }
  return timetable;
};

// ─── DOWNLOAD Class Timetable PDF ─────────────────────────────────────────────
// GET /api/download/pdf/class/:classId
const downloadClassPdf = async (req, res) => {
  try {
    const timetable = await getAcceptedTimetable(res);
    if (!timetable) return;

    const cls = await Class.findById(req.params.classId)
      .populate('departmentId', 'name code');
    if (!cls) return sendError(res, 404, 'Class not found');

    const classTimetable = timetable.classTimetables.find(
      (ct) => ct.classId.toString() === req.params.classId
    );
    if (!classTimetable) return sendError(res, 404, 'Timetable not found for this class');

    const pdfBuffer = await pdfService.generateClassPdf(cls, classTimetable, timetable);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timetable-${cls.departmentId.code}-S${cls.semester}${cls.section}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DOWNLOAD All Classes PDF ─────────────────────────────────────────────────
// GET /api/download/pdf/all-classes
const downloadAllClassesPdf = async (req, res) => {
  try {
    const timetable = await getAcceptedTimetable(res);
    if (!timetable) return;

    const classes = await Class.find().populate('departmentId', 'name code');

    const pdfBuffer = await pdfService.generateAllClassesPdf(classes, timetable);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="all-timetables.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DOWNLOAD Teacher Timetable PDF ──────────────────────────────────────────
// GET /api/download/pdf/teacher/:teacherId
const downloadTeacherPdf = async (req, res) => {
  try {
    const timetable = await getAcceptedTimetable(res);
    if (!timetable) return;

    const teacher = await Teacher.findById(req.params.teacherId)
      .select('-password')
      .populate('departmentId', 'name code');
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    const pdfBuffer = await pdfService.generateTeacherPdf(teacher, timetable);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timetable-${teacher.username}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DOWNLOAD All Teachers PDF ────────────────────────────────────────────────
// GET /api/download/pdf/all-teachers
const downloadAllTeachersPdf = async (req, res) => {
  try {
    const timetable = await getAcceptedTimetable(res);
    if (!timetable) return;

    const teachers = await Teacher.find({ isActive: true })
      .select('-password')
      .populate('departmentId', 'name code');

    const pdfBuffer = await pdfService.generateAllTeachersPdf(teachers, timetable);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="all-teacher-timetables.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DOWNLOAD Class Timetable Excel ──────────────────────────────────────────
// GET /api/download/excel/class/:classId
const downloadClassExcel = async (req, res) => {
  try {
    const timetable = await getAcceptedTimetable(res);
    if (!timetable) return;

    const cls = await Class.findById(req.params.classId)
      .populate('departmentId', 'name code');
    if (!cls) return sendError(res, 404, 'Class not found');

    const classTimetable = timetable.classTimetables.find(
      (ct) => ct.classId.toString() === req.params.classId
    );
    if (!classTimetable) return sendError(res, 404, 'Timetable not found for this class');

    const excelBuffer = await excelService.generateClassExcel(cls, classTimetable, timetable);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timetable-${cls.departmentId.code}-S${cls.semester}${cls.section}.xlsx"`
    );
    res.send(excelBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DOWNLOAD All Classes Excel ───────────────────────────────────────────────
// GET /api/download/excel/all-classes
const downloadAllClassesExcel = async (req, res) => {
  try {
    const timetable = await getAcceptedTimetable(res);
    if (!timetable) return;

    const classes = await Class.find().populate('departmentId', 'name code');

    const excelBuffer = await excelService.generateAllClassesExcel(classes, timetable);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="all-timetables.xlsx"');
    res.send(excelBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  downloadClassPdf,
  downloadAllClassesPdf,
  downloadTeacherPdf,
  downloadAllTeachersPdf,
  downloadClassExcel,
  downloadAllClassesExcel,
};