const express = require('express');
const router = express.Router();

const {
  createSuggestion,
  getAllSuggestions,
  getMySuggestions,
  markAsRead,
  markAllAsRead,
  deleteSuggestion,
} = require('../controllers/suggestionController');

const { authenticate, requireAdmin, requireTeacher } = require('../middleware/auth');

// Teacher routes
router.post('/', authenticate, requireTeacher, createSuggestion);
router.get('/mine', authenticate, requireTeacher, getMySuggestions);

// Admin routes
router.get('/', authenticate, requireAdmin, getAllSuggestions);
router.patch('/read-all', authenticate, requireAdmin, markAllAsRead);
router.patch('/:id/read', authenticate, requireAdmin, markAsRead);
router.delete('/:id', authenticate, requireAdmin, deleteSuggestion);

module.exports = router;