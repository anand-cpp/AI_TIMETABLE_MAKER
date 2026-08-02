const express = require('express');
const router = express.Router();

const {
  uploadFile,
  getUploadedFiles,
  getUploadedFile,
  deleteUploadedFile,
  retryOcr,
} = require('../controllers/uploadController');

const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// All admin only
router.get('/', authenticate, requireAdmin, getUploadedFiles);
router.get('/:id', authenticate, requireAdmin, getUploadedFile);
router.post('/', authenticate, requireAdmin, uploadSingle('file'), uploadFile);
router.delete('/:id', authenticate, requireAdmin, deleteUploadedFile);
router.post('/:id/retry-ocr', authenticate, requireAdmin, retryOcr);

module.exports = router;