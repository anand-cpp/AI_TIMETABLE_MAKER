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
  getFacultyWorkloadOverview,
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

// Faculty Workload Overview Report
router.get('/workload-overview', authenticate, getFacultyWorkloadOverview);

// Teacher own profile
router.get('/me/profile', authenticate, requireTeacher, getMyProfile);

// Faculty profile with complete teaching allocations (admin and teacher can view)
router.get('/:id/profile', authenticate, requireOwnDataOrAdmin, getFacultyProfile);

// Admin only - list all
router.get('/', authenticate, requireAdmin, getTeachers);

// Admin only - create teacher
router.post('/', authenticate, requireAdmin, createTeacher);

// Admin or own teacher
router.get('/:id', authenticate, requireOwnDataOrAdmin, getTeacher);

// Admin only - update teacher
router.put('/:id', authenticate, requireAdmin, updateTeacher);

// Teacher or Admin - update unavailability
router.put('/:id/unavailability', authenticate, requireOwnDataOrAdmin, updateUnavailability);

// Admin only - delete teacher
router.delete('/:id', authenticate, requireAdmin, deleteTeacher);

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

module.exports = router;
