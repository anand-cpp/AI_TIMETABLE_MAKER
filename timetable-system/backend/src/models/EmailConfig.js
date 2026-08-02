const mongoose = require('mongoose');

const smtpConfigSchema = new mongoose.Schema(
  {
    host: { type: String, default: 'smtp.gmail.com' },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, trim: true, default: '' },
    pass: { type: String, default: '' },
    fromName: { type: String, default: 'Timetable System' },
    fromEmail: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const emailConfigSchema = new mongoose.Schema(
  {
    smtpConfig: {
      type: smtpConfigSchema,
      default: () => ({}),
    },
    isConfigured: {
      type: Boolean,
      default: false,
    },
    singleton: {
      type: String,
      default: 'singleton',
      immutable: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailConfig', emailConfigSchema);