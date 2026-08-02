const express = require('express');
const router = express.Router();

const {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/departmentController');

const { authenticate, requireAdmin } = require('../middleware/auth');

// Public - needed for student dropdowns
router.get('/', getDepartments);
router.get('/:id', getDepartment);

// Admin only
router.post('/', authenticate, requireAdmin, createDepartment);
router.put('/:id', authenticate, requireAdmin, updateDepartment);
router.delete('/:id', authenticate, requireAdmin, deleteDepartment);

module.exports = router;