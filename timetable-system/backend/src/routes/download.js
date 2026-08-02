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

const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin only
router.get('/pdf/class/:classId', authenticate, requireAdmin, downloadClassPdf);
router.get('/pdf/all-classes', authenticate, requireAdmin, downloadAllClassesPdf);
router.get('/pdf/teacher/:teacherId', authenticate, requireAdmin, downloadTeacherPdf);
router.get('/pdf/all-teachers', authenticate, requireAdmin, downloadAllTeachersPdf);
router.get('/excel/class/:classId', authenticate, requireAdmin, downloadClassExcel);
router.get('/excel/all-classes', authenticate, requireAdmin, downloadAllClassesExcel);

module.exports = router;