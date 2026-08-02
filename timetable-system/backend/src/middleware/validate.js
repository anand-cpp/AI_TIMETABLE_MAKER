const { sendError } = require('../utils/responseHelpers');

// Generic request body validator
// Pass an array of field rules
const validate = (rules) => (req, res, next) => {
  const errors = [];

  for (const rule of rules) {
    const value = req.body[rule.field];
    const fieldLabel = rule.label || rule.field;

    // Required check
    if (rule.required) {
      if (value === undefined || value === null || value === '') {
        errors.push(`${fieldLabel} is required`);
        continue;
      }
    }

    // Skip further checks if value is empty and not required
    if (value === undefined || value === null || value === '') continue;

    // Type checks
    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push(`${fieldLabel} must be a string`);
    }

    if (rule.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`${fieldLabel} must be a number`);
      } else {
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`${fieldLabel} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`${fieldLabel} must be at most ${rule.max}`);
        }
      }
    }

    if (rule.type === 'array' && !Array.isArray(value)) {
      errors.push(`${fieldLabel} must be an array`);
    }

    // Enum check
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${fieldLabel} must be one of: ${rule.enum.join(', ')}`);
    }

    // Min length for strings
    if (rule.type === 'string' && rule.minLength && value.length < rule.minLength) {
      errors.push(`${fieldLabel} must be at least ${rule.minLength} characters`);
    }

    // Max length for strings
    if (rule.type === 'string' && rule.maxLength && value.length > rule.maxLength) {
      errors.push(`${fieldLabel} must be at most ${rule.maxLength} characters`);
    }
  }

  if (errors.length > 0) {
    return sendError(res, 400, errors.join(', '));
  }

  next();
};

module.exports = { validate };