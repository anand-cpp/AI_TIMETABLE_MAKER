const express = require('express');
const router = express.Router();

const {
  getSettings,
  updateSettings,
  resetSettings,
  clearTimetablesOnly,
  clearSubjectsAndTimetables,
  wipeAllSystemData,
} = require('../controllers/settingsController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public GET (student view needs college name)
router.get('/', getSettings);

// Admin only
router.put('/', authenticate, requireAdmin, updateSettings);
router.post('/reset', authenticate, requireAdmin, resetSettings);
router.post('/clear-timetables', authenticate, requireAdmin, clearTimetablesOnly);
router.post('/clear-subjects-timetables', authenticate, requireAdmin, clearSubjectsAndTimetables);
router.post('/wipe-all', authenticate, requireAdmin, wipeAllSystemData);

module.exports = router;