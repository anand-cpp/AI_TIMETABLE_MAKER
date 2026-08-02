const Department = require('../models/Department');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const { sendSuccess, sendError } = require('../utils/responseHelpers');

// ─── GET All Departments ──────────────────────────────────────────────────────
// GET /api/departments
const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    return sendSuccess(res, 200, { departments });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Single Department ────────────────────────────────────────────────────
// GET /api/departments/:id
const getDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return sendError(res, 404, 'Department not found');
    return sendSuccess(res, 200, { department });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── CREATE Department ────────────────────────────────────────────────────────
// POST /api/departments
const createDepartment = async (req, res) => {
  try {
    const { name, code, building, floor, travelOptimization } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Department name is required');
    }
    if (!code || !code.trim()) {
      return sendError(res, 400, 'Department code is required');
    }

    // Case-insensitive duplicate check for name
    const existingName = await Department.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existingName) {
      return sendError(res, 409, `Department with name '${name.trim()}' already exists`);
    }

    // Case-insensitive duplicate check for code
    const existingCode = await Department.findOne({
      code: { $regex: new RegExp(`^${code.trim()}$`, 'i') },
    });
    if (existingCode) {
      return sendError(res, 409, `Department with code '${code.trim().toUpperCase()}' already exists`);
    }

    const department = await Department.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      building: building ? building.trim() : '',
      floor: floor ? floor.trim() : '',
      travelOptimization: travelOptimization || false,
    });

    return sendSuccess(res, 201, { department }, 'Department created successfully');
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'Department name or code already exists');
    }
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Department ────────────────────────────────────────────────────────
// PUT /api/departments/:id
const updateDepartment = async (req, res) => {
  try {
    const { name, code, building, floor, travelOptimization } = req.body;

    const department = await Department.findById(req.params.id);
    if (!department) return sendError(res, 404, 'Department not found');

    // Check duplicate name (excluding current)
    if (name && name.trim() !== department.name) {
      const existingName = await Department.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: req.params.id },
      });
      if (existingName) {
        return sendError(res, 409, `Department with name '${name.trim()}' already exists`);
      }
    }

    // Check duplicate code (excluding current)
    if (code && code.trim().toUpperCase() !== department.code) {
      const existingCode = await Department.findOne({
        code: { $regex: new RegExp(`^${code.trim()}$`, 'i') },
        _id: { $ne: req.params.id },
      });
      if (existingCode) {
        return sendError(res, 409, `Department with code '${code.trim().toUpperCase()}' already exists`);
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim().toUpperCase();
    if (building !== undefined) updateData.building = building.trim();
    if (floor !== undefined) updateData.floor = floor.trim();
    if (travelOptimization !== undefined) updateData.travelOptimization = travelOptimization;

    const updated = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return sendSuccess(res, 200, { department: updated }, 'Department updated successfully');
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'Department name or code already exists');
    }
    return sendError(res, 500, error.message);
  }
};

// ─── DELETE Department ────────────────────────────────────────────────────────
// DELETE /api/departments/:id
const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return sendError(res, 404, 'Department not found');

    // Check if classes are assigned to this department
    const classCount = await Class.countDocuments({ departmentId: req.params.id });
    if (classCount > 0) {
      return sendError(
        res,
        400,
        `Cannot delete department: ${classCount} class(es) are assigned to it. Remove classes first.`
      );
    }

    // Check if teachers are assigned to this department
    const teacherCount = await Teacher.countDocuments({ departmentId: req.params.id });
    if (teacherCount > 0) {
      return sendError(
        res,
        400,
        `Cannot delete department: ${teacherCount} teacher(s) are assigned to it. Reassign teachers first.`
      );
    }

    await Department.findByIdAndDelete(req.params.id);

    return sendSuccess(res, 200, {}, 'Department deleted successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};