const Subject = require('../models/Subject');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const { sendSuccess, sendError } = require('../utils/responseHelpers');

// ─── GET All Subjects ─────────────────────────────────────────────────────────
// GET /api/subjects
const getSubjects = async (req, res) => {
  try {
    const filter = {};
    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.type) filter.type = req.query.type;

    const subjects = await Subject.find(filter)
      .populate('classId', 'semester section departmentId')
      .populate('teachers', 'name username')
      .populate('labDetails.batch1Teacher', 'name username')
      .populate('labDetails.batch2Teacher', 'name username')
      .populate('electiveDetails.linkedClasses', 'semester section departmentId')
      .populate('electiveDetails.participatingClasses', 'semester section departmentId')
      .sort({ name: 1 });

    return sendSuccess(res, 200, { subjects });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Single Subject ───────────────────────────────────────────────────────
// GET /api/subjects/:id
const getSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate('classId', 'semester section departmentId')
      .populate('teachers', 'name username email')
      .populate('labDetails.batch1Teacher', 'name username')
      .populate('labDetails.batch2Teacher', 'name username')
      .populate('electiveDetails.linkedClasses', 'semester section')
      .populate('electiveDetails.participatingClasses', 'semester section');

    if (!subject) return sendError(res, 404, 'Subject not found');
    return sendSuccess(res, 200, { subject });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Unique Lab Room Names ────────────────────────────────────────────────
// GET /api/subjects/lab-rooms
const getLabRooms = async (req, res) => {
  try {
    const rooms = await Subject.distinct('labDetails.roomName', {
      type: 'lab',
      'labDetails.roomName': { $ne: '' },
    });

    // Also get batch rooms
    const batch1Rooms = await Subject.distinct('labDetails.batch1Room', {
      type: 'lab',
      'labDetails.batch1Room': { $ne: '' },
    });
    const batch2Rooms = await Subject.distinct('labDetails.batch2Room', {
      type: 'lab',
      'labDetails.batch2Room': { $ne: '' },
    });

    const allRooms = [...new Set([...rooms, ...batch1Rooms, ...batch2Rooms])]
      .filter(Boolean)
      .sort();

    return sendSuccess(res, 200, { rooms: allRooms });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── Validate subject data before create/update ───────────────────────────────
const validateSubjectData = async (body, existingSubjectId = null) => {
  const errors = [];
  const {
    name,
    code,
    classId,
    type,
    weeklyHours,
    teachers,
    labDetails,
    electiveDetails,
  } = body;

  // Basic required fields
  if (!name || !name.trim()) errors.push('Subject name is required');
  if (!code || !code.trim()) errors.push('Subject code is required');
  if (!classId) errors.push('Class is required');
  if (!type) errors.push('Subject type is required');
  if (!['theory', 'lab', 'elective'].includes(type)) {
    errors.push('Subject type must be theory, lab, or elective');
  }

  if (errors.length > 0) return errors;

  // Check class exists
  const cls = await Class.findById(classId);
  if (!cls) errors.push('Class not found');

  // Weekly hours
  if (type === 'theory' || type === 'elective') {
    if (!weeklyHours || Number(weeklyHours) < 1) {
      errors.push('Weekly hours must be at least 1');
    }
  }

  // Theory specific
  if (type === 'theory') {
    if (!teachers || !Array.isArray(teachers) || teachers.length === 0) {
      errors.push('At least one teacher is required for theory subjects');
    }
  }

  // Lab specific
  if (type === 'lab') {
    if (!labDetails) {
      errors.push('Lab details are required for lab subjects');
    } else {
      if (!labDetails.roomName && !labDetails.isBatchSplit) {
        errors.push('Lab room name is required');
      }
      if (!labDetails.duration || ![2, 3].includes(Number(labDetails.duration))) {
        errors.push('Lab duration must be 2 or 3 consecutive periods');
      }

      if (labDetails.isBatchSplit) {
        if (!labDetails.batch1Teacher) errors.push('Batch 1 teacher is required for batch-split labs');
        if (!labDetails.batch2Teacher) errors.push('Batch 2 teacher is required for batch-split labs');
        if (!labDetails.batch1Room) errors.push('Batch 1 room is required for batch-split labs');
        if (!labDetails.batch2Room) errors.push('Batch 2 room is required for batch-split labs');
      } else {
        if (!teachers || !Array.isArray(teachers) || teachers.length === 0) {
          errors.push('At least one teacher is required for lab subjects');
        }
      }
    }
  }

  // Elective specific
  if (type === 'elective') {
    if (!electiveDetails) {
      errors.push('Elective details are required for elective subjects');
    } else {
      if (!['linked', 'open'].includes(electiveDetails.electiveType)) {
        errors.push('Elective type must be linked or open');
      }

      if (electiveDetails.electiveType === 'open') {
        if (
          !electiveDetails.openElectiveOptions ||
          electiveDetails.openElectiveOptions.length === 0
        ) {
          errors.push('Open elective must have at least one option');
        } else {
          for (const opt of electiveDetails.openElectiveOptions) {
            if (!opt.optionName || !opt.optionName.trim()) {
              errors.push('Each open elective option must have a name');
            }
            if (!opt.teacherId) {
              errors.push(`Option '${opt.optionName}' must have a teacher assigned`);
            }
          }
        }
      }

      if (electiveDetails.electiveType === 'linked') {
        if (!teachers || teachers.length === 0) {
          errors.push('At least one teacher required for linked elective');
        }
      }
    }
  }

  return errors;
};

// ─── CREATE Subject ───────────────────────────────────────────────────────────
// POST /api/subjects
const createSubject = async (req, res) => {
  try {
    const {
      name,
      code,
      classId,
      type,
      weeklyHours,
      teachers,
      labDetails,
      electiveDetails,
      isElective,
    } = req.body;

    // Validate
    const errors = await validateSubjectData(req.body);
    if (errors.length > 0) {
      return sendError(res, 400, errors.join(', '));
    }

    // Check class exists
    const cls = await Class.findById(classId);
    if (!cls) return sendError(res, 404, 'Class not found');

    // Build subject data
    const subjectData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      classId,
      type,
      weeklyHours: type === 'lab' ? null : Number(weeklyHours),
      teachers: teachers || [],
      isElective: type === 'elective' || isElective || false,
    };

    // Lab details
    if (type === 'lab' && labDetails) {
      subjectData.labDetails = {
        roomName: labDetails.roomName || '',
        duration: Number(labDetails.duration) || 2,
        isBatchSplit: labDetails.isBatchSplit || false,
        batch1Teacher: labDetails.batch1Teacher || null,
        batch2Teacher: labDetails.batch2Teacher || null,
        batch1Room: labDetails.batch1Room || '',
        batch2Room: labDetails.batch2Room || '',
        morningPreference: labDetails.morningPreference || false,
      };
    }

    // Elective details
    if (type === 'elective' && electiveDetails) {
      subjectData.electiveDetails = {
        electiveType: electiveDetails.electiveType || 'linked',
        linkedGroupId: electiveDetails.linkedGroupId || '',
        linkedClasses: electiveDetails.linkedClasses || [],
        openElectiveOptions: electiveDetails.openElectiveOptions || [],
        participatingClasses: electiveDetails.participatingClasses || [],
      };
    }

    const subject = await Subject.create(subjectData);

    // Add subject reference to parent class
    await Class.findByIdAndUpdate(classId, {
      $addToSet: { subjects: subject._id },
    });

    const populated = await Subject.findById(subject._id)
      .populate('classId', 'semester section')
      .populate('teachers', 'name username')
      .populate('labDetails.batch1Teacher', 'name username')
      .populate('labDetails.batch2Teacher', 'name username');

    return sendSuccess(res, 201, { subject: populated }, 'Subject created successfully');
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'Subject with this code already exists in this class');
    }
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Subject ───────────────────────────────────────────────────────────
// PUT /api/subjects/:id
const updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return sendError(res, 404, 'Subject not found');

    const {
      name,
      code,
      weeklyHours,
      teachers,
      labDetails,
      electiveDetails,
    } = req.body;

    // Validate with existing type (type cannot be changed)
    const dataToValidate = {
      ...req.body,
      type: subject.type,
      classId: subject.classId,
    };
    const errors = await validateSubjectData(dataToValidate, req.params.id);
    if (errors.length > 0) {
      return sendError(res, 400, errors.join(', '));
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim().toUpperCase();
    if (weeklyHours !== undefined) updateData.weeklyHours = Number(weeklyHours);
    if (teachers !== undefined) updateData.teachers = teachers;

    if (labDetails !== undefined && subject.type === 'lab') {
      updateData.labDetails = {
        roomName: labDetails.roomName || '',
        duration: Number(labDetails.duration) || 2,
        isBatchSplit: labDetails.isBatchSplit || false,
        batch1Teacher: labDetails.batch1Teacher || null,
        batch2Teacher: labDetails.batch2Teacher || null,
        batch1Room: labDetails.batch1Room || '',
        batch2Room: labDetails.batch2Room || '',
        morningPreference: labDetails.morningPreference || false,
      };
    }

    if (electiveDetails !== undefined && subject.type === 'elective') {
      updateData.electiveDetails = {
        electiveType: electiveDetails.electiveType || 'linked',
        linkedGroupId: electiveDetails.linkedGroupId || '',
        linkedClasses: electiveDetails.linkedClasses || [],
        openElectiveOptions: electiveDetails.openElectiveOptions || [],
        participatingClasses: electiveDetails.participatingClasses || [],
      };
    }

    const updated = await Subject.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('classId', 'semester section')
      .populate('teachers', 'name username')
      .populate('labDetails.batch1Teacher', 'name username')
      .populate('labDetails.batch2Teacher', 'name username');

    return sendSuccess(res, 200, { subject: updated }, 'Subject updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DELETE Subject ───────────────────────────────────────────────────────────
// DELETE /api/subjects/:id
const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return sendError(res, 404, 'Subject not found');

    // Remove subject reference from parent class
    await Class.findByIdAndUpdate(subject.classId, {
      $pull: { subjects: subject._id },
    });

    await Subject.findByIdAndDelete(req.params.id);

    return sendSuccess(res, 200, {}, 'Subject deleted successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getSubjects,
  getSubject,
  getLabRooms,
  createSubject,
  updateSubject,
  deleteSubject,
};