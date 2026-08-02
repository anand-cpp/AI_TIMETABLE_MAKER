const express = require('express');
const router = express.Router();

const {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  getSemestersByDepartment,
  getSectionsByDepartmentAndSemester,
} = require('../controllers/classController');

const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes - for student cascading dropdowns
router.get('/semesters/:departmentId', getSemestersByDepartment);
router.get('/sections/:departmentId/:semester', getSectionsByDepartmentAndSemester);

// Public GET
router.get('/', getClasses);
router.get('/:id', getClass);

// Admin only
router.post('/', authenticate, requireAdmin, createClass);
router.put('/:id', authenticate, requireAdmin, updateClass);
router.delete('/:id', authenticate, requireAdmin, deleteClass);

module.exports = router;