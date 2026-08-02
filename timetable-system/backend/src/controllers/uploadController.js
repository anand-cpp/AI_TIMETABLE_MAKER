const path = require('path');
const fs = require('fs');
const UploadedFile = require('../models/UploadedFile');
const { sendSuccess, sendError } = require('../utils/responseHelpers');
const ocrService = require('../services/ocrService');

// ─── UPLOAD File ──────────────────────────────────────────────────────────────
// POST /api/upload
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }

    const { originalname, filename, path: filePath, mimetype, size } = req.file;

    // Save file record to DB
    const uploadedFile = await UploadedFile.create({
      originalName: originalname,
      storedName: filename,
      filePath,
      mimeType: mimetype,
      size,
      ocrStatus: 'pending',
      uploadedBy: req.user?.username || 'admin',
    });

    // Trigger OCR in background (non-blocking)
    ocrService.processFile(uploadedFile._id, filePath, mimetype).catch((err) => {
      console.error('OCR background error:', err.message);
    });

    return sendSuccess(
      res,
      201,
      { file: uploadedFile },
      'File uploaded successfully. OCR processing started in background.'
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET All Uploaded Files ───────────────────────────────────────────────────
// GET /api/upload
const getUploadedFiles = async (req, res) => {
  try {
    const files = await UploadedFile.find().sort({ createdAt: -1 });
    return sendSuccess(res, 200, { files });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Single File with OCR Result ─────────────────────────────────────────
// GET /api/upload/:id
const getUploadedFile = async (req, res) => {
  try {
    const file = await UploadedFile.findById(req.params.id);
    if (!file) return sendError(res, 404, 'File not found');
    return sendSuccess(res, 200, { file });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DELETE Uploaded File ─────────────────────────────────────────────────────
// DELETE /api/upload/:id
const deleteUploadedFile = async (req, res) => {
  try {
    const file = await UploadedFile.findById(req.params.id);
    if (!file) return sendError(res, 404, 'File not found');

    // Delete physical file
    if (fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }

    await UploadedFile.findByIdAndDelete(req.params.id);

    return sendSuccess(res, 200, {}, 'File deleted successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── RETRY OCR ────────────────────────────────────────────────────────────────
// POST /api/upload/:id/retry-ocr
const retryOcr = async (req, res) => {
  try {
    const file = await UploadedFile.findById(req.params.id);
    if (!file) return sendError(res, 404, 'File not found');

    if (!fs.existsSync(file.filePath)) {
      return sendError(res, 400, 'Physical file not found on server');
    }

    // Reset OCR status
    await UploadedFile.findByIdAndUpdate(req.params.id, {
      $set: { ocrStatus: 'pending', ocrResult: null, ocrError: '' },
    });

    // Trigger OCR again
    ocrService.processFile(file._id, file.filePath, file.mimeType).catch((err) => {
      console.error('OCR retry error:', err.message);
    });

    return sendSuccess(res, 200, {}, 'OCR retry started');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  uploadFile,
  getUploadedFiles,
  getUploadedFile,
  deleteUploadedFile,
  retryOcr,
};