const express = require('express');
const router = express.Router();

const {
  getSubjects,
  getSubject,
  getLabRooms,
  createSubject,
  updateSubject,
  deleteSubject,
} = require('../controllers/subjectController');

const { authenticate, requireAdmin } = require('../middleware/auth');

// Public - lab rooms for dropdown
router.get('/lab-rooms', getLabRooms);

// Public GET
router.get('/', getSubjects);
router.get('/:id', getSubject);

// Admin only
router.post('/', authenticate, requireAdmin, createSubject);
router.put('/:id', authenticate, requireAdmin, updateSubject);
router.delete('/:id', authenticate, requireAdmin, deleteSubject);

module.exports = router;