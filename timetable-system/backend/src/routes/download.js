const express = require('express');
const router = express.Router();

const {
  downloadClassPdf,
  downloadAllClassesPdf,
  downloadTeacherPdf,
  downloadAllTeachersPdf,
  downloadClassExcel,
  downloadAllClassesExcel,
} = require('../controllers/downloadController');

// Export endpoints (Accessible for direct browser window downloads)
router.get('/pdf/class/:classId', downloadClassPdf);
router.get('/pdf/all-classes', downloadAllClassesPdf);
router.get('/pdf/teacher/:teacherId', downloadTeacherPdf);
router.get('/pdf/all-teachers', downloadAllTeachersPdf);
router.get('/excel/class/:classId', downloadClassExcel);
router.get('/excel/all-classes', downloadAllClassesExcel);

module.exports = router;