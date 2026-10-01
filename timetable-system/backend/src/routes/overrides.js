const express = require('express');
const router = express.Router();
const {
  getOverrideLogs,
  createOverrideLog,
  revertOverrideLog,
} = require('../controllers/overrideController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, requireAdmin, getOverrideLogs);
router.post('/', authenticate, requireAdmin, createOverrideLog);
router.delete('/:id', authenticate, requireAdmin, revertOverrideLog);

module.exports = router;
