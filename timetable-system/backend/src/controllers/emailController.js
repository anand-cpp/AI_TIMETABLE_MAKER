const EmailConfig = require('../models/EmailConfig');
const Timetable = require('../models/Timetable');
const { sendSuccess, sendError } = require('../utils/responseHelpers');
const { verifyTransporter } = require('../config/mailer');
const emailService = require('../services/emailService');

// ─── GET Email Config ─────────────────────────────────────────────────────────
// GET /api/email/config
const getEmailConfig = async (req, res) => {
  try {
    let config = await EmailConfig.findOne({ singleton: 'singleton' });

    if (!config) {
      config = await EmailConfig.create({ singleton: 'singleton' });
    }

    // Never return the SMTP password to client
    const safeConfig = {
      ...config.toObject(),
      smtpConfig: {
        ...config.smtpConfig,
        pass: config.smtpConfig?.pass ? '••••••••' : '',
      },
    };

    return sendSuccess(res, 200, { config: safeConfig });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Email Config ──────────────────────────────────────────────────────
// PUT /api/email/config
const updateEmailConfig = async (req, res) => {
  try {
    const { smtpConfig } = req.body;

    if (!smtpConfig) {
      return sendError(res, 400, 'SMTP configuration is required');
    }

    if (!smtpConfig.user || !smtpConfig.user.trim()) {
      return sendError(res, 400, 'SMTP user (email) is required');
    }

    // Build update - preserve existing password if not provided
    const existingConfig = await EmailConfig.findOne({ singleton: 'singleton' });

    const updatedSmtp = {
      host: smtpConfig.host || 'smtp.gmail.com',
      port: Number(smtpConfig.port) || 587,
      secure: smtpConfig.secure || false,
      user: smtpConfig.user.trim(),
      pass: smtpConfig.pass && smtpConfig.pass !== '••••••••'
        ? smtpConfig.pass
        : existingConfig?.smtpConfig?.pass || '',
      fromName: smtpConfig.fromName || 'Timetable System',
      fromEmail: smtpConfig.fromEmail || smtpConfig.user.trim(),
    };

    const config = await EmailConfig.findOneAndUpdate(
      { singleton: 'singleton' },
      { $set: { smtpConfig: updatedSmtp, isConfigured: true } },
      { new: true, upsert: true }
    );

    return sendSuccess(res, 200, {
      config: {
        ...config.toObject(),
        smtpConfig: { ...config.smtpConfig, pass: '••••••••' },
      },
    }, 'Email configuration updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── TEST Email Config ────────────────────────────────────────────────────────
// POST /api/email/test
const testEmailConfig = async (req, res) => {
  try {
    const config = await EmailConfig.findOne({ singleton: 'singleton' });

    if (!config || !config.isConfigured) {
      return sendError(res, 400, 'Email is not configured yet');
    }

    await verifyTransporter(config.smtpConfig);

    return sendSuccess(res, 200, {}, 'SMTP connection verified successfully');
  } catch (error) {
    return sendError(res, 400, `SMTP verification failed: ${error.message}`);
  }
};

// ─── SEND Timetable Emails ────────────────────────────────────────────────────
// POST /api/email/send
const sendTimetableEmails = async (req, res) => {
  try {
    const { recipients } = req.body;
    // recipients: { teachers: bool, hods: bool, classReps: bool }

    // Check accepted timetable exists
    const timetable = await Timetable.findOne({ isAccepted: true });
    if (!timetable) {
      return sendError(res, 400, 'No accepted timetable found. Accept a timetable first before sending emails.');
    }

    // Check email config
    const config = await EmailConfig.findOne({ singleton: 'singleton' });
    if (!config || !config.isConfigured) {
      return sendError(res, 400, 'Email is not configured. Set up SMTP settings first.');
    }

    const results = await emailService.sendTimetableEmails(
      timetable,
      config,
      recipients || { teachers: true, hods: true, classReps: true }
    );

    return sendSuccess(res, 200, { results }, 'Emails processed');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getEmailConfig,
  updateEmailConfig,
  testEmailConfig,
  sendTimetableEmails,
};