const express = require('express');
const router = express.Router();

const {
  getEmailConfig,
  updateEmailConfig,
  testEmailConfig,
  sendTimetableEmails,
} = require('../controllers/emailController');

const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin only
router.get('/config', authenticate, requireAdmin, getEmailConfig);
router.put('/config', authenticate, requireAdmin, updateEmailConfig);
router.post('/test', authenticate, requireAdmin, testEmailConfig);
router.post('/send', authenticate, requireAdmin, sendTimetableEmails);

module.exports = router;