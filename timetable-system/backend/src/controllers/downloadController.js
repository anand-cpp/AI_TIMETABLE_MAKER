const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const { sendError } = require('../utils/responseHelpers');
const pdfService = require('../services/pdfService');
const excelService = require('../services/excelService');

// Helper: resolve the timetable version to download.
//  - admins: may request any versionId, else accepted, else latest.
//  - everyone else (incl. anonymous): only the accepted version, or a
//    specific version that is itself accepted. Drafts are never exposed.
const getTimetableForDownload = async (req, res) => {
  const { versionId } = req.query;
  const isAdmin = req.user && req.user.role === 'admin';
  let timetable = null;

  if (versionId) {
    try {
      const found = await Timetable.findById(versionId);
      if (found && (isAdmin || found.isAccepted)) timetable = found;
    } catch {}
  }
  if (!timetable) {
    timetable = await Timetable.findOne({ isAccepted: true });
  }
  if (!timetable && isAdmin) {
    timetable = await Timetable.findOne().sort({ createdAt: -1 });
  }
  if (!timetable) {
    sendError(res, 404, 'No published timetable is available for download.');
    return null;
  }
  return timetable;
};

// DOWNLOAD Class Timetable PDF (GET /api/download/pdf/class/:classId)
const downloadClassPdf = async (req, res) => {
  try {
    const timetable = await getTimetableForDownload(req, res);
    if (!timetable) return;

    const cls = await Class.findById(req.params.classId).populate('departmentId', 'name code');
    if (!cls) return sendError(res, 404, 'Class not found');

    const classTimetable = timetable.classTimetables.find(
      (ct) => ct.classId.toString() === req.params.classId
    );
    if (!classTimetable) return sendError(res, 404, 'Timetable not found for this class');

    const pdfBuffer = await pdfService.generateClassPdf(cls, classTimetable, timetable);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timetable-${cls.departmentId?.code || 'CLASS'}-S${cls.semester}${cls.section}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// DOWNLOAD All Classes PDF (GET /api/download/pdf/all-classes)
const downloadAllClassesPdf = async (req, res) => {
  try {
    const timetable = await getTimetableForDownload(req, res);
    if (!timetable) return;

    const classes = await Class.find().populate('departmentId', 'name code');
    const pdfBuffer = await pdfService.generateAllClassesPdf(classes, timetable);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="all-classes-timetables.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// DOWNLOAD Teacher Timetable PDF (GET /api/download/pdf/teacher/:teacherId)
const downloadTeacherPdf = async (req, res) => {
  try {
    // A teacher may only download their own timetable; admins may download any.
    if (!req.user) {
      return sendError(res, 401, 'Authentication required to download a teacher timetable');
    }
    if (req.user.role === 'teacher' && req.user._id.toString() !== req.params.teacherId) {
      return sendError(res, 403, 'You can only download your own timetable');
    }

    const timetable = await getTimetableForDownload(req, res);
    if (!timetable) return;

    const teacher = await Teacher.findById(req.params.teacherId)
      .select('-password')
      .populate('departmentId', 'name code');
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    const pdfBuffer = await pdfService.generateTeacherPdf(teacher, timetable);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timetable-${teacher.username || 'teacher'}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// DOWNLOAD All Teachers PDF — admin only (contains every teacher's schedule)
const downloadAllTeachersPdf = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return sendError(res, 403, 'Admin access required to download all teacher timetables');
    }

    const timetable = await getTimetableForDownload(req, res);
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

// DOWNLOAD Class Timetable Excel (GET /api/download/excel/class/:classId)
const downloadClassExcel = async (req, res) => {
  try {
    const timetable = await getTimetableForDownload(req, res);
    if (!timetable) return;

    const cls = await Class.findById(req.params.classId).populate('departmentId', 'name code');
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
      `attachment; filename="timetable-${cls.departmentId?.code || 'CLASS'}-S${cls.semester}${cls.section}.xlsx"`
    );
    res.send(excelBuffer);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// DOWNLOAD All Classes Excel (GET /api/download/excel/all-classes)
const downloadAllClassesExcel = async (req, res) => {
  try {
    const timetable = await getTimetableForDownload(req, res);
    if (!timetable) return;

    const classes = await Class.find().populate('departmentId', 'name code');
    const excelBuffer = await excelService.generateAllClassesExcel(classes, timetable);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="all-classes-timetables.xlsx"');
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