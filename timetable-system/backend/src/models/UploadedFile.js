const mongoose = require('mongoose');

const uploadedFileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
    },
    storedName: {
      type: String,
      required: true,
      unique: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    ocrStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    ocrResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ocrError: {
      type: String,
      default: '',
    },
    uploadedBy: {
      type: String,
      default: 'admin',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UploadedFile', uploadedFileSchema);