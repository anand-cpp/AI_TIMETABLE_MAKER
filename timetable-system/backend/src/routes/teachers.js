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
  getFacultyProfile,
  addAllocation,
  removeAllocation,
  editAllocation,
} = require('../controllers/teacherController');

const {
  authenticate,
  requireAdmin,
  requireTeacher,
  requireOwnDataOrAdmin,
} = require('../middleware/auth');

// Teacher own profile
router.get('/me/profile', authenticate, requireTeacher, getMyProfile);

// Faculty profile with complete teaching allocations (admin and teacher can view)
router.get('/:id/profile', authenticate, requireOwnDataOrAdmin, getFacultyProfile);

// Admin only - list all
router.get('/', authenticate, requireAdmin, getTeachers);

// Admin or own teacher
router.get('/:id', authenticate, requireOwnDataOrAdmin, getTeacher);

// ═══════════════════════════════════════════════════════════════
// TEACHER SUBJECT ALLOCATIONS
// ═══════════════════════════════════════════════════════════════

// Add a new subject allocation for a teacher
// POST /api/teachers/:id/allocations
router.post(
  '/:id/allocations',
  authenticate,
  requireOwnDataOrAdmin,
  addAllocation
);

// Remove a subject allocation for a teacher
// DELETE /api/teachers/:id/allocations/:allocId
router.delete(
  '/:id/allocations/:allocId',
  authenticate,
  requireOwnDataOrAdmin,
  removeAllocation
);

// Edit a subject allocation for a teacher
// PUT /api/teachers/:id/allocations/:allocId
router.put(
  '/:id/allocations/:allocId',
  authenticate,
  requireOwnDataOrAdmin,
  editAllocation
);

// Admin only - list all
router.get('/', authenticate, requireAdmin, getTeachers);

module.exports = router;