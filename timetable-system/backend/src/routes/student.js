const express = require('express');
const router = express.Router();

const {
  getStudentTimetable,
  getPublicDepartments,
  getPublicSemesters,
  getPublicSections,
} = require('../controllers/studentController');

// All public - no auth required
router.get('/departments', getPublicDepartments);
router.get('/semesters/:departmentId', getPublicSemesters);
router.get('/sections/:departmentId/:semester', getPublicSections);
router.get('/timetable/:departmentId/:semester/:section', getStudentTimetable);

module.exports = router;