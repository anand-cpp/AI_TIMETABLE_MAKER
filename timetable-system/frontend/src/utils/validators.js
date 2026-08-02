// Email validation
export const isValidEmail = (email) => {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Required field check
export const isRequired = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

// Minimum length
export const minLength = (value, min) => {
  if (!value) return false;
  return String(value).trim().length >= min;
};

// Maximum length
export const maxLength = (value, max) => {
  if (!value) return true;
  return String(value).trim().length <= max;
};

// Number range
export const inRange = (value, min, max) => {
  const num = Number(value);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
};

// Password strength
export const isStrongPassword = (password) => {
  return password && password.length >= 6;
};

// Username validation
export const isValidUsername = (username) => {
  if (!username) return false;
  const re = /^[a-zA-Z0-9_]{3,30}$/;
  return re.test(username);
};

// Time format HH:MM
export const isValidTime = (time) => {
  if (!time) return false;
  const re = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return re.test(time);
};

// Form field validator helper
// Returns error message or null
export const validateField = (value, rules) => {
  for (const rule of rules) {
    if (rule.required && !isRequired(value)) {
      return rule.message || 'This field is required';
    }
    if (rule.minLength && !minLength(value, rule.minLength)) {
      return rule.message || `Must be at least ${rule.minLength} characters`;
    }
    if (rule.maxLength && !maxLength(value, rule.maxLength)) {
      return rule.message || `Must be at most ${rule.maxLength} characters`;
    }
    if (rule.email && value && !isValidEmail(value)) {
      return rule.message || 'Invalid email address';
    }
    if (rule.custom && !rule.custom(value)) {
      return rule.message || 'Invalid value';
    }
  }
  return null;
};