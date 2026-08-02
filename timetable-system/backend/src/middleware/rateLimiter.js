const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again after 15 minutes',
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  },
});

// Strict limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes',
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  },
});

// Heavy operations limiter (timetable generation)
const heavyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many generation requests, please try again after 1 hour',
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  },
});

module.exports = { apiLimiter, authLimiter, heavyLimiter };