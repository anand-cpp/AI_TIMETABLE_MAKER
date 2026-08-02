const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const { sendError } = require('../utils/responseHelpers');

// Verify JWT and attach user to request
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 401, 'Token expired, please login again');
      }
      return sendError(res, 401, 'Invalid token');
    }

    // Attach user based on role
    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id).select('-password');
      if (!admin) return sendError(res, 401, 'Admin not found');
      req.user = { ...admin.toObject(), role: 'admin' };
    } else if (decoded.role === 'teacher') {
      const teacher = await Teacher.findById(decoded.id).select('-password');
      if (!teacher) return sendError(res, 401, 'Teacher not found');
      if (!teacher.isActive) return sendError(res, 401, 'Account is deactivated');
      req.user = { ...teacher.toObject(), role: 'teacher' };
    } else {
      return sendError(res, 401, 'Invalid token role');
    }

    next();
  } catch (error) {
    return sendError(res, 401, 'Authentication failed');
  }
};

// Only admin can access
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return sendError(res, 403, 'Admin access required');
  }
  next();
};

// Only teacher can access
const requireTeacher = (req, res, next) => {
  if (!req.user || req.user.role !== 'teacher') {
    return sendError(res, 403, 'Teacher access required');
  }
  next();
};

// Admin OR teacher can access — but teacher can only access their own data
const requireOwnDataOrAdmin = (req, res, next) => {
  if (!req.user) return sendError(res, 401, 'Not authenticated');

  if (req.user.role === 'admin') return next();

  if (req.user.role === 'teacher') {
    const requestedId = req.params.teacherId || req.params.id;
    if (requestedId && requestedId !== req.user._id.toString()) {
      return sendError(res, 403, 'Access denied: You can only access your own data');
    }
    return next();
  }

  return sendError(res, 403, 'Access denied');
};

module.exports = {
  authenticate,
  requireAdmin,
  requireTeacher,
  requireOwnDataOrAdmin,
};