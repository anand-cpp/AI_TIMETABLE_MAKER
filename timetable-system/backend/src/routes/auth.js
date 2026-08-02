const express = require('express');
const router = express.Router();

const {
  setupAdmin,
  getSetupStatus,
  adminLogin,
  teacherLogin,
  getMe,
} = require('../controllers/authController');

const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public routes
router.get('/setup-status', getSetupStatus);
router.post('/setup', authLimiter, setupAdmin);
router.post('/admin/login', authLimiter, adminLogin);
router.post('/teacher/login', authLimiter, teacherLogin);

// Protected route
router.get('/me', authenticate, getMe);

module.exports = router;