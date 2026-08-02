const { sendError } = require('../utils/responseHelpers');

// 404 handler - unknown routes
const notFound = (req, res, next) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 400, messages.join(', '));
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    return sendError(res, 409, `Duplicate value: ${field} '${value}' already exists`);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, 400, `Invalid ID format: ${err.value}`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Token expired');
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 400, 'File too large. Maximum size is 10MB');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return sendError(res, 400, 'Unexpected file field');
  }

  // Default server error
  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return sendError(res, statusCode, message);
};

module.exports = { notFound, errorHandler };