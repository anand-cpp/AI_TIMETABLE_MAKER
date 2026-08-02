const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const { sendSuccess, sendError } = require('../utils/responseHelpers');

// Generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ─── Admin Setup (one-time) ───────────────────────────────────────────────────
// POST /api/auth/setup
const setupAdmin = async (req, res) => {
  try {
    // Block if admin already exists
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      return sendError(res, 400, 'Admin already exists. Setup is only allowed once.');
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return sendError(res, 400, 'Username and password are required');
    }

    if (username.trim().length < 3) {
      return sendError(res, 400, 'Username must be at least 3 characters');
    }

    if (password.length < 6) {
      return sendError(res, 400, 'Password must be at least 6 characters');
    }

    const admin = await Admin.create({
      username: username.trim().toLowerCase(),
      password,
    });

    const token = generateToken(admin._id, 'admin');

    return sendSuccess(res, 201, {
      token,
      user: {
        id: admin._id,
        username: admin.username,
        role: 'admin',
      },
    }, 'Admin account created successfully');

  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'Username already taken');
    }
    return sendError(res, 500, error.message);
  }
};

// ─── Check if admin exists (for first-run detection) ──────────────────────────
// GET /api/auth/setup-status
const getSetupStatus = async (req, res) => {
  try {
    const admin = await Admin.findOne().select('_id');
    return sendSuccess(res, 200, {
      adminExists: !!admin,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── Admin Login ──────────────────────────────────────────────────────────────
// POST /api/auth/admin/login
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return sendError(res, 400, 'Username and password are required');
    }

    // Find admin
    const admin = await Admin.findOne({
      username: username.trim().toLowerCase(),
    });

    if (!admin) {
      return sendError(res, 401, 'Invalid username or password');
    }

    // Compare password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid username or password');
    }

    const token = generateToken(admin._id, 'admin');

    return sendSuccess(res, 200, {
      token,
      user: {
        id: admin._id,
        username: admin.username,
        role: 'admin',
      },
    }, 'Login successful');

  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── Teacher Login ────────────────────────────────────────────────────────────
// POST /api/auth/teacher/login
const teacherLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return sendError(res, 400, 'Username and password are required');
    }

    // Find teacher
    const teacher = await Teacher.findOne({
      username: username.trim().toLowerCase(),
    });

    if (!teacher) {
      return sendError(res, 401, 'Invalid username or password');
    }

    if (!teacher.isActive) {
      return sendError(res, 401, 'Your account has been deactivated. Contact admin.');
    }

    // Compare password
    const isMatch = await teacher.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid username or password');
    }

    const token = generateToken(teacher._id, 'teacher');

    return sendSuccess(res, 200, {
      token,
      user: {
        id: teacher._id,
        username: teacher.username,
        name: teacher.name,
        role: 'teacher',
        departmentId: teacher.departmentId,
      },
    }, 'Login successful');

  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── Get Current User ─────────────────────────────────────────────────────────
// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    return sendSuccess(res, 200, { user: req.user });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  setupAdmin,
  getSetupStatus,
  adminLogin,
  teacherLogin,
  getMe,
};