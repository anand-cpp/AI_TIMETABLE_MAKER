const express = require('express');
const router = express.Router();

const {
  getVersions,
  getVersion,
  getAccepted,
  getTeacherTimetable,
  generateTimetable,
  acceptVersion,
  unacceptVersion,
  deleteVersion,
  editSetSlot,
  editClearSlot,
  editSwapSlots,
  editLockSlot,
  editUnlockSlot,
  getEditHistory,
  updateVersionLabel,
  getCrossDeptTeachers,
  saveTeacherAvailability,
} = require('../controllers/timetableController');

const {
  authenticate,
  requireAdmin,
  requireOwnDataOrAdmin,
} = require('../middleware/auth');

const { heavyLimiter } = require('../middleware/rateLimiter');

// Public
router.get('/accepted', getAccepted);

// Teacher + Admin
router.get(
  '/teacher/:teacherId',
  authenticate,
  requireOwnDataOrAdmin,
  getTeacherTimetable
);

// Admin only - versions
router.get('/versions', authenticate, requireAdmin, getVersions);
router.get('/versions/:id', authenticate, requireAdmin, getVersion);
router.get('/versions/:id/history', authenticate, requireAdmin, getEditHistory);
router.get('/cross-dept-teachers/:departmentId', authenticate, requireAdmin, getCrossDeptTeachers);
router.post('/teacher-availability', authenticate, requireAdmin, saveTeacherAvailability);

// Admin only - generate
router.post('/generate', authenticate, requireAdmin, heavyLimiter, generateTimetable);

// Admin only - version management
router.patch('/versions/:id/accept', authenticate, requireAdmin, acceptVersion);
router.patch('/versions/:id/unaccept', authenticate, requireAdmin, unacceptVersion);
router.patch('/versions/:id/label', authenticate, requireAdmin, updateVersionLabel);
router.delete('/versions/:id', authenticate, requireAdmin, deleteVersion);

// Admin only - manual editing
router.patch('/versions/:id/edit/set', authenticate, requireAdmin, editSetSlot);
router.patch('/versions/:id/edit/clear', authenticate, requireAdmin, editClearSlot);
router.patch('/versions/:id/edit/swap', authenticate, requireAdmin, editSwapSlots);
router.patch('/versions/:id/edit/lock', authenticate, requireAdmin, editLockSlot);
router.patch('/versions/:id/edit/unlock', authenticate, requireAdmin, editUnlockSlot);

module.exports = router;