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
  previewRebalance,
  applyRebalance,
  undoLastAction,
  redoLastAction,
  getHistoryStatus,
  getWorkloadReadiness,
  getTimetableDiagnostics,
} = require('../controllers/timetableController');

const {
  authenticate,
  requireAdmin,
  requireOwnDataOrAdmin,
} = require('../middleware/auth');

const { heavyLimiter } = require('../middleware/rateLimiter');

// Public
router.get('/accepted', getAccepted);
router.get('/readiness', getWorkloadReadiness);
router.get('/diagnostics', getTimetableDiagnostics);

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
router.get('/versions/:id/history-status', authenticate, requireAdmin, getHistoryStatus);
router.get('/versions/:id/readiness', authenticate, requireAdmin, getWorkloadReadiness);
router.get('/versions/:id/diagnostics', authenticate, requireAdmin, getTimetableDiagnostics);
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

// Admin only - undo & redo
router.post('/versions/:id/undo', authenticate, requireAdmin, undoLastAction);
router.post('/versions/:id/redo', authenticate, requireAdmin, redoLastAction);

// Admin only - rebalance
router.post('/versions/:id/rebalance/preview', authenticate, requireAdmin, previewRebalance);
router.post('/versions/:id/rebalance/commit', authenticate, requireAdmin, applyRebalance);

module.exports = router;
