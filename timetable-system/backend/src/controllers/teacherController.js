const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const ElectiveGroup = require('../models/ElectiveGroup');
const Department = require('../models/Department');
const { sendSuccess, sendError } = require('../utils/responseHelpers');
const { generateUniqueUsername, generateDefaultPassword } = require('../utils/generateCredentials');
const { validateUnavailability } = require('../utils/validators');

// ─── GET All Teachers ─────────────────────────────────────────────────────────
// GET /api/teachers
const getTeachers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.departmentId) filter.departmentId = req.query.departmentId;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const teachers = await Teacher.find(filter)
      .select('-password')
      .populate('departmentId', 'name code')
      .sort({ name: 1 });

    return sendSuccess(res, 200, { teachers });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Single Teacher ───────────────────────────────────────────────────────
// GET /api/teachers/:id
const getTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .select('-password')
      .populate('departmentId', 'name code');

    if (!teacher) return sendError(res, 404, 'Teacher not found');
    return sendSuccess(res, 200, { teacher });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── CREATE Teacher ───────────────────────────────────────────────────────────
// POST /api/teachers
const createTeacher = async (req, res) => {
  try {
    const {
      name,
      departmentId,
      email,
      phone,
      unavailability,
      morningLabPreference,
      maxPeriodsPerDay,
    } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Teacher name is required');
    }

    // Validate unavailability if provided
    if (unavailability) {
      const unavailError = validateUnavailability(unavailability);
      if (unavailError) return sendError(res, 400, unavailError);
    }

    // Auto-generate username and password
    const username = await generateUniqueUsername(name.trim());
    const rawPassword = generateDefaultPassword(name.trim());

    const teacher = await Teacher.create({
      name: name.trim(),
      username,
      password: rawPassword,
      departmentId: departmentId || null,
      email: email ? email.trim().toLowerCase() : '',
      phone: phone ? phone.trim() : '',
      unavailability: unavailability || [],
      morningLabPreference: morningLabPreference || false,
      maxPeriodsPerDay: maxPeriodsPerDay ? Number(maxPeriodsPerDay) : null,
    });

    const populated = await Teacher.findById(teacher._id)
      .select('-password')
      .populate('departmentId', 'name code');

    return sendSuccess(
      res,
      201,
      {
        teacher: populated,
        credentials: {
          username,
          password: rawPassword,
        },
      },
      'Teacher created successfully'
    );
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'Username already exists');
    }
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Teacher ───────────────────────────────────────────────────────────
// PUT /api/teachers/:id
const updateTeacher = async (req, res) => {
  try {
    const {
      name,
      departmentId,
      email,
      phone,
      morningLabPreference,
      maxPeriodsPerDay,
      isActive,
      password,
    } = req.body;

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (morningLabPreference !== undefined) updateData.morningLabPreference = morningLabPreference;
    if (maxPeriodsPerDay !== undefined) updateData.maxPeriodsPerDay = maxPeriodsPerDay ? Number(maxPeriodsPerDay) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Password update - will be re-hashed by pre-save hook
    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return sendError(res, 400, 'Password must be at least 6 characters');
      }
      teacher.password = password.trim();
      Object.assign(teacher, updateData);
      await teacher.save();

      const populated = await Teacher.findById(teacher._id)
        .select('-password')
        .populate('departmentId', 'name code');

      return sendSuccess(res, 200, { teacher: populated }, 'Teacher updated successfully');
    }

    // No password change - use findByIdAndUpdate
    const updated = await Teacher.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('departmentId', 'name code');

    return sendSuccess(res, 200, { teacher: updated }, 'Teacher updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Teacher Unavailability ────────────────────────────────────────────
// PUT /api/teachers/:id/unavailability
const updateUnavailability = async (req, res) => {
  try {
    const { unavailability } = req.body;

    if (!Array.isArray(unavailability)) {
      return sendError(res, 400, 'Unavailability must be an array');
    }

    const unavailError = validateUnavailability(unavailability);
    if (unavailError) return sendError(res, 400, unavailError);

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { $set: { unavailability } },
      { new: true }
    ).select('-password');

    if (!teacher) return sendError(res, 404, 'Teacher not found');

    return sendSuccess(res, 200, { teacher }, 'Unavailability updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DELETE Teacher ───────────────────────────────────────────────────────────
// DELETE /api/teachers/:id
const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    // Warn if teacher is assigned to any subjects
    const subjectCount = await Subject.countDocuments({
      $or: [
        { teachers: req.params.id },
        { 'labDetails.batch1Teacher': req.params.id },
        { 'labDetails.batch2Teacher': req.params.id },
      ],
    });

    await Teacher.findByIdAndDelete(req.params.id);

    return sendSuccess(
      res,
      200,
      { warning: subjectCount > 0 ? `Teacher was assigned to ${subjectCount} subject(s). Please reassign those subjects.` : null },
      'Teacher deleted successfully'
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Teacher's own profile ────────────────────────────────────────────────
// GET /api/teachers/me/profile
const getMyProfile = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user._id)
      .select('-password')
      .populate('departmentId', 'name code');

    if (!teacher) return sendError(res, 404, 'Teacher not found');
    return sendSuccess(res, 200, { teacher });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Faculty Profile with Complete Teaching Allocations ───────────────────
// GET /api/teachers/:id/profile
const getFacultyProfile = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .select('-password')
      .populate('departmentId', 'name code');

    if (!teacher) return sendError(res, 404, 'Teacher not found');

    // Get all subjects where this teacher is assigned
    const subjects = await Subject.find({
      $or: [
        { teachers: req.params.id },
        { coInstructors: req.params.id },
        { 'labDetails.batch1Teacher': req.params.id },
        { 'labDetails.batch2Teacher': req.params.id },
      ],
    })
      .populate('classId', 'semester section departmentId')
      .populate('teachers', 'name username')
      .populate('coInstructors', 'name username')
      .populate('labDetails.batch1Teacher', 'name username')
      .populate('labDetails.batch2Teacher', 'name username')
      .populate('electiveDetails.electiveGroupId', 'name')
      .populate('electiveDetails.participatingClasses', 'semester section departmentId')
      .lean();

    // Organize allocations
    const allocations = [];
    const semesterMap = {};
    let totalHours = 0;
    let theoryHours = 0;
    let labHours = 0;
    let projectHours = 0;
    let placementHours = 0;
    let electiveHours = 0;

    for (const subject of subjects) {
      const cls = subject.classId;
      if (!cls) continue;

      const dept = cls.departmentId || { code: 'N/A', name: 'Unknown' };
      const isMainTeacher = subject.teachers?.some(t => t._id?.toString() === req.params.id || t.toString() === req.params.id) || false;
      const isCoInstructor = subject.coInstructors?.some(t => t._id?.toString() === req.params.id || t.toString() === req.params.id) || false;
      const isBatch1 = subject.labDetails?.batch1Teacher?._id?.toString() === req.params.id || subject.labDetails?.batch1Teacher?.toString() === req.params.id;
      const isBatch2 = subject.labDetails?.batch2Teacher?._id?.toString() === req.params.id || subject.labDetails?.batch2Teacher?.toString() === req.params.id;

      // Determine hours for this teacher
      let hours = 0;
      let type = subject.type;

      if (subject.type === 'lab') {
        if (subject.labDetails?.isBatchSplit) {
          // For batch-split labs, each teacher gets the full lab duration
          hours = subject.labDetails?.duration || 2;
        } else {
          hours = subject.labDetails?.duration || 2;
        }
      } else {
        // Theory and elective subjects
        hours = subject.weeklyHours || 0;
      }

      const semKey = `S${cls.semester}`;
      if (!semesterMap[semKey]) {
        semesterMap[semKey] = { semester: cls.semester, subjects: [], totalHours: 0 };
      }

      const allocation = {
        courseCode: subject.code,
        subjectName: subject.name,
        semester: cls.semester,
        branch: dept.code,
        section: cls.section,
        type: type,
        hours,
        isMainTeacher,
        isCoInstructor,
        isBatchSplit: subject.labDetails?.isBatchSplit || false,
        batch: isBatch1 ? 'Batch 1' : isBatch2 ? 'Batch 2' : '',
        electiveGroup: subject.electiveDetails?.electiveGroupId?.name || '',
        subjectId: subject._id,
      };

      allocations.push(allocation);
      semesterMap[semKey].subjects.push(allocation);
      semesterMap[semKey].totalHours += hours;

      totalHours += hours;

      // Categorize hours
      if (subject.type === 'theory') {
        theoryHours += hours;
      } else if (subject.type === 'lab') {
        labHours += hours;
      } else if (subject.type === 'elective') {
        electiveHours += hours;
      }

      // Check for project/placement based on subject code/name
      const nameLower = subject.name.toLowerCase();
      const codeLower = subject.code.toLowerCase();
      if (nameLower.includes('project') || codeLower.includes('project') || nameLower.includes('phase')) {
        projectHours += hours;
      }
      if (nameLower.includes('placement') || codeLower.includes('placement') || nameLower.includes('training')) {
        placementHours += hours;
      }
    }

    // Sort allocations by semester, then branch, section, subject
    allocations.sort((a, b) => {
      if (a.semester !== b.semester) return a.semester - b.semester;
      if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.subjectName.localeCompare(b.subjectName);
    });

    // Sort semester map
    const sortedSemesters = Object.keys(semesterMap)
      .sort((a, b) => semesterMap[a].semester - semesterMap[b].semester)
      .map(key => ({
        semester: semesterMap[key].semester,
        subjects: semesterMap[key].subjects,
        totalHours: semesterMap[key].totalHours,
      }));

    const profile = {
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        username: teacher.username,
        email: teacher.email,
        phone: teacher.phone,
        designation: teacher.designation,
        department: teacher.departmentId,
      },
      summary: {
        totalWeeklyHours: totalHours,
        theoryHours,
        labHours,
        projectHours,
        placementHours,
        electiveHours,
        totalSubjects: allocations.length,
        totalSemesters: Object.keys(semesterMap).length,
        totalSections: [...new Set(allocations.map(a => `${a.branch} S${a.semester}${a.section}`))].length,
      },
      semesterBreakdown: sortedSemesters,
      allocations,
    };

    return sendSuccess(res, 200, { profile });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ═══════════════════════════════════════════════════════════════
// TEACHER SUBJECT ALLOCATIONS
// ═══════════════════════════════════════════════════════════════

// Add a new subject allocation for a teacher.
// POST /api/teachers/:id/allocations
const addAllocation = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const {
      subjectCode,
      subjectName,
      classId,
      type,
      weeklyHours,
      L,
      T,
      P,
      semester,
      section,
      electiveGroup,
      academicYear,
    } = req.body;

    // Validation
    if (!subjectCode || !subjectCode.trim()) {
      return sendError(res, 400, 'Subject code is required');
    }
    if (!subjectName || !subjectName.trim()) {
      return sendError(res, 400, 'Subject name is required');
    }
    if (!classId) {
      return sendError(res, 400, 'Class is required');
    }
    if (!type || !['theory', 'lab', 'elective'].includes(type)) {
      return sendError(res, 400, 'Valid subject type is required');
    }

    // Find or create the subject
    const code = subjectCode.trim().toUpperCase();

    // Check if subject with this code already exists in this class
    let subject = await Subject.findOne({ code, classId });

    if (subject) {
      // Subject exists - check if teacher is already assigned
      const alreadyAssigned = subject.teachers?.some(
        t => t.toString() === teacherId || t._id?.toString() === teacherId
      ) || subject.coInstructors?.some(
        t => t.toString() === teacherId || t._id?.toString() === teacherId
      );

      if (alreadyAssigned) {
        return sendError(
          res,
          409,
          'This teacher is already allocated to this subject in this class'
        );
      }
    } else {
      // Create new subject
      const cls = await Class.findById(classId);
      if (!cls) return sendError(res, 404, 'Class not found');

      // Prepare labDetails only for lab subjects
      let labDetails = null;
      if (type === 'lab') {
        labDetails = {
          roomName: '',
          duration: 2,
          isBatchSplit: false,
          batch1Teacher: null,
          batch2Teacher: null,
          batch1Room: '',
          batch2Room: '',
          morningPreference: false,
        };
      }

      // Prepare electiveDetails only for elective subjects
      let electiveDetails = null;
      if (type === 'elective') {
        electiveDetails = {
          electiveType: 'linked',
          linkedGroupId: '',
          linkedClasses: [],
          openElectiveOptions: [],
          participatingClasses: [],
        };
      }

      subject = await Subject.create({
        name: subjectName.trim(),
        code,
        classId,
        type,
        weeklyHours: type !== 'lab' ? (weeklyHours || 3) : 0,
        L: type === 'lab' ? (L || 0) : 0,
        T: type === 'lab' ? (T || 0) : 0,
        P: type === 'lab' ? (P || 0) : 0,
        R: 0,
        teachers: [teacherId],
        coInstructors: [],
        isElective: type === 'elective',
        labDetails,
        electiveDetails,
        requiresConsecutivePeriods: false,
        consecutivePeriodsCount: 1,
        fixedSlots: [],
      });

      // Link subject to class
      await Class.findByIdAndUpdate(classId, {
        $addToSet: { subjects: subject._id },
      });
    }

    // Add teacher to subject's teachers array if not already there
    if (!subject.teachers?.some(t => t.toString() === teacherId || t._id?.toString() === teacherId)) {
      subject.teachers = [...(subject.teachers || []), teacherId];
    }

    await subject.save();

    // Populate the subject for response
    const populated = await Subject.findById(subject._id)
      .populate('classId', 'semester section departmentId')
      .populate('teachers', 'name username')
      .populate('coInstructors', 'name username')
      .populate('labDetails.batch1Teacher', 'name username')
      .populate('labDetails.batch2Teacher', 'name username')
      .lean();

    return sendSuccess(res, 201, { subject: populated }, 'Subject allocation added successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Remove a subject allocation for a teacher.
// DELETE /api/teachers/:id/allocations/:allocId
const removeAllocation = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const { allocId } = req.params;

    // Find the subject where this teacher is assigned
    // Search across teachers, coInstructors, and labDetails batch teachers
    const subject = await Subject.findOne({
      $or: [
        { teachers: teacherId },
        { coInstructors: teacherId },
        { 'labDetails.batch1Teacher': teacherId },
        { 'labDetails.batch2Teacher': teacherId },
      ],
    });

    if (!subject) {
      return sendError(res, 404, 'No subject allocation found for this teacher');
    }

    // Remove teacher from all relevant arrays
    let removed = false;

    // Remove from teachers array
    if (subject.teachers && subject.teachers.length > 0) {
      subject.teachers = subject.teachers.filter(
        t => t.toString() !== teacherId && t._id?.toString() !== teacherId
      );
      removed = true;
    }

    // Remove from coInstructors array
    if (subject.coInstructors && subject.coInstructors.length > 0) {
      subject.coInstructors = subject.coInstructors.filter(
        t => t.toString() !== teacherId && t._id?.toString() !== teacherId
      );
      removed = true;
    }

    // Remove from batch1Teacher in labDetails
    if (subject.labDetails && subject.labDetails.batch1Teacher) {
      if (
        subject.labDetails.batch1Teacher.toString() === teacherId ||
        subject.labDetails.batch1Teacher._id?.toString() === teacherId
      ) {
        subject.labDetails = {
          ...subject.labDetails,
          batch1Teacher: null,
        };
        removed = true;
      }
    }

    // Remove from batch2Teacher in labDetails
    if (subject.labDetails && subject.labDetails.batch2Teacher) {
      if (
        subject.labDetails.batch2Teacher.toString() === teacherId ||
        subject.labDetails.batch2Teacher._id?.toString() === teacherId
      ) {
        subject.labDetails = {
          ...subject.labDetails,
          batch2Teacher: null,
        };
        removed = true;
      }
    }

    // If no teachers left, still save (per requirements: removing teacher allocation must not delete subject)
    if (removed) {
      await subject.save();
    }

    return sendSuccess(res, 200, { subject }, 'Subject allocation removed successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Edit a subject allocation for a teacher.
// PUT /api/teachers/:id/allocations/:allocId
const editAllocation = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const { allocId } = req.params;
    const {
      subjectCode,
      subjectName,
      classId,
      type,
      weeklyHours,
      L,
      T,
      P,
      semester,
      section,
      electiveGroup,
    } = req.body;

    // Validation
    if (!subjectCode || !subjectCode.trim()) {
      return sendError(res, 400, 'Subject code is required');
    }
    if (!subjectName || !subjectName.trim()) {
      return sendError(res, 400, 'Subject name is required');
    }
    if (!classId) {
      return sendError(res, 400, 'Class is required');
    }
    if (!type || !['theory', 'lab', 'elective'].includes(type)) {
      return sendError(res, 400, 'Valid subject type is required');
    }

    const code = subjectCode.trim().toUpperCase();

    // Find the subject being edited
    let subject = await Subject.findById(allocId);
    if (!subject) return sendError(res, 404, 'Subject allocation not found');

    // Update subject fields
    subject.name = subjectName.trim();
    subject.code = code;
    subject.classId = classId;
    subject.type = type;
    subject.weeklyHours = type !== 'lab' ? Number(weeklyHours || 0) : subject.weeklyHours;
    subject.L = type === 'lab' ? Number(L || 0) : subject.L;
    subject.T = type === 'lab' ? Number(T || 0) : subject.T;
    subject.P = type === 'lab' ? Number(P || 0) : subject.P;

    // Handle elective details
    if (type === 'elective' && !subject.electiveDetails) {
      subject.electiveDetails = {
        electiveType: 'linked',
        linkedGroupId: '',
        linkedClasses: [],
        openElectiveOptions: [],
        participatingClasses: [],
      };
    }
    if (type === 'elective' && subject.electiveDetails) {
      subject.electiveDetails.electiveType = electiveGroup || 'linked';
    }

    // Handle lab details
    if (type === 'lab' && !subject.labDetails) {
      subject.labDetails = {
        roomName: '',
        duration: 2,
        isBatchSplit: false,
        batch1Teacher: null,
        batch2Teacher: null,
        batch1Room: '',
        batch2Room: '',
        morningPreference: false,
      };
    }
    if (type === 'lab' && subject.labDetails) {
      if (L !== undefined) subject.labDetails.L = Number(L || 0);
      if (T !== undefined) subject.labDetails.T = Number(T || 0);
      if (P !== undefined) subject.labDetails.P = Number(P || 0);
    }

    await subject.save();

    // Populate and return
    const populated = await Subject.findById(subject._id)
      .populate('classId', 'semester section departmentId')
      .populate('teachers', 'name username')
      .populate('coInstructors', 'name username')
      .populate('labDetails.batch1Teacher', 'name username')
      .populate('labDetails.batch2Teacher', 'name username')
      .lean();

    return sendSuccess(res, 200, { subject: populated }, 'Subject allocation updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  updateUnavailability,
  deleteTeacher,
  getMyProfile,
  getFacultyProfile,
  addAllocation,
  removeAllocation,
  editAllocation,
};