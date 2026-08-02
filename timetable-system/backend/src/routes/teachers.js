const express = require('express');
const router = express.Router();

const {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  updateUnavailability,
  deleteTeacher,
  getMyProfile,
} = require('../controllers/teacherController');

const {
  authenticate,
  requireAdmin,
  requireTeacher,
  requireOwnDataOrAdmin,
} = require('../middleware/auth');

// Teacher own profile
router.get('/me/profile', authenticate, requireTeacher, getMyProfile);

// Admin only - list all
router.get('/', authenticate, requireAdmin, getTeachers);

// Admin or own teacher
router.get('/:id', authenticate, requireOwnDataOrAdmin, getTeacher);

// Admin only - CRUD
router.post('/', authenticate, requireAdmin, createTeacher);
router.put('/:id', authenticate, requireAdmin, updateTeacher);
router.put('/:id/unavailability', authenticate, requireOwnDataOrAdmin, updateUnavailability);
router.delete('/:id', authenticate, requireAdmin, deleteTeacher);

module.exports = router;