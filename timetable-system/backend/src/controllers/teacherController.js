const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const ElectiveGroup = require('../models/ElectiveGroup');
const Department = require('../models/Department');
const Timetable = require('../models/Timetable');
const Substitution = require('../models/Substitution');
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
      designation,
      morningLabPreference,
      maxPeriodsPerDay,
      maxPeriodsPerWeek,
      isActive,
      password,
      unavailability,
    } = req.body;

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (designation !== undefined) updateData.designation = designation.trim();
    if (morningLabPreference !== undefined) updateData.morningLabPreference = morningLabPreference;
    if (maxPeriodsPerDay !== undefined) updateData.maxPeriodsPerDay = maxPeriodsPerDay ? Number(maxPeriodsPerDay) : null;
    if (maxPeriodsPerWeek !== undefined) updateData.maxPeriodsPerWeek = maxPeriodsPerWeek ? Number(maxPeriodsPerWeek) : null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (Array.isArray(unavailability)) updateData.unavailability = unavailability;

    const oldName = teacher.name;

    // Password update - will be re-hashed by pre-save hook
    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return sendError(res, 400, 'Password must be at least 6 characters');
      }
      teacher.password = password.trim();
      Object.assign(teacher, updateData);
      await teacher.save();

      if (updateData.name && updateData.name !== oldName) {
        const Timetable = require('../models/Timetable');
        await Timetable.updateMany(
          { 'classTimetables.slots.teacherIds': teacher._id },
          { $set: { 'classTimetables.$[].slots.$[slot].teacherNames.$[tName]': updateData.name } },
          {
            arrayFilters: [
              { 'slot.teacherIds': teacher._id },
              { 'tName': oldName }
            ]
          }
        ).catch(() => {});
      }

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

    if (updateData.name && updateData.name !== oldName) {
      const Timetable = require('../models/Timetable');
      await Timetable.updateMany(
        { 'classTimetables.slots.teacherIds': teacher._id },
        { $set: { 'classTimetables.$[].slots.$[slot].teacherNames.$[tName]': updateData.name } },
        {
          arrayFilters: [
            { 'slot.teacherIds': teacher._id },
            { 'tName': oldName }
          ]
        }
      ).catch(() => {});
    }

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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return sendError(res, 404, 'Teacher profile not found');
    }

    const teacher = await Teacher.findById(req.params.id)
      .select('-password')
      .populate('departmentId', 'name code');

    if (!teacher) return sendError(res, 404, 'Teacher profile not found');

    // Get all subjects where this teacher is assigned (direct, co-instructor, batch1, batch2)
    const subjects = await Subject.find({
      $or: [
        { teachers: req.params.id },
        { coInstructors: req.params.id },
        { 'labDetails.batch1Teacher': req.params.id },
        { 'labDetails.batch2Teacher': req.params.id },
      ],
    })
      .populate({
        path: 'classId',
        select: 'name semester section departmentId',
        populate: { path: 'departmentId', select: 'name code' }
      })
      .populate('teachers', 'name username')
      .populate('coInstructors', 'name username')
      .populate('labDetails.batch1Teacher', 'name username')
      .populate('labDetails.batch2Teacher', 'name username')
      .populate('electiveDetails.electiveGroupId', 'name')
      .populate({
        path: 'electiveDetails.participatingClasses',
        select: 'name semester section departmentId',
        populate: { path: 'departmentId', select: 'name code' }
      })
      .lean();

    // Also check ElectiveGroups where teacher is assigned in options
    const electiveGroups = await ElectiveGroup.find({
      'options.teacherIds': req.params.id
    }).populate({
      path: 'options.subjectId',
      populate: {
        path: 'classId',
        select: 'name semester section departmentId',
        populate: { path: 'departmentId', select: 'name code' }
      }
    }).lean();

    const existingSubjectIds = new Set(subjects.map(s => s._id.toString()));
    for (const eg of electiveGroups) {
      for (const opt of eg.options || []) {
        if (opt.subjectId && opt.teacherIds?.some(tid => tid.toString() === req.params.id)) {
          const sId = (opt.subjectId._id || opt.subjectId).toString();
          if (!existingSubjectIds.has(sId)) {
            existingSubjectIds.add(sId);
            const subDoc = opt.subjectId;
            subDoc.electiveDetails = subDoc.electiveDetails || {};
            subDoc.electiveDetails.electiveGroupId = { _id: eg._id, name: eg.name };
            subjects.push(subDoc);
          }
        }
      }
    }

    // Organize allocations and calculate exact workload
    const allocations = [];
    const semesterMap = {};
    let totalWeeklyHours = 0;
    let theoryHours = 0;
    let tutorialHours = 0;
    let labHours = 0;
    let electiveHours = 0;
    let projectHours = 0;
    let placementHours = 0;

    const uniqueSubjectCodes = new Set();
    const uniqueSections = new Set();

    for (const subject of subjects) {
      const cls = subject.classId;
      if (!cls) continue;

      const dept = cls.departmentId || { code: 'CSE', name: 'Computer Science and Engineering' };
      const isMainTeacher = subject.teachers?.some(t => (t._id || t).toString() === req.params.id) || false;
      const isCoInstructor = subject.coInstructors?.some(t => (t._id || t).toString() === req.params.id) || false;
      const isBatch1 = (subject.labDetails?.batch1Teacher?._id || subject.labDetails?.batch1Teacher)?.toString() === req.params.id;
      const isBatch2 = (subject.labDetails?.batch2Teacher?._id || subject.labDetails?.batch2Teacher)?.toString() === req.params.id;

      let facultyRole = 'Assigned Faculty';
      if (isMainTeacher && isBatch1) facultyRole = 'Main Faculty (Batch 1)';
      else if (isMainTeacher) facultyRole = 'Main Faculty';
      else if (isCoInstructor && isBatch2) facultyRole = 'Co-Instructor (Batch 2)';
      else if (isCoInstructor) facultyRole = 'Co-Instructor';
      else if (isBatch1) facultyRole = 'Batch 1 Faculty';
      else if (isBatch2) facultyRole = 'Batch 2 Faculty';

      // Mathematical breakdown according to authoritative category
      let th = 0;
      let tut = 0;
      let lab = 0;
      let el = 0;
      let total = 0;

      if (subject.type === 'lab') {
        th = 0;
        tut = 0;
        lab = subject.P || subject.labDetails?.duration || subject.weeklyHours || 0;
        total = lab;
        labHours += lab;
      } else if (subject.type === 'elective' || subject.isElective) {
        // Dedicated elective classification: elective hours are partitioned into electiveHours
        // without duplicating them as separate theory or tutorial lecture hours
        th = 0;
        tut = 0;
        lab = 0;
        el = subject.weeklyHours || ((subject.L || 0) + (subject.T || 0) + (subject.P || 0)) || 4;
        total = el;
        electiveHours += el;
      } else {
        // Core theory subjects
        th = subject.L !== undefined ? subject.L : (subject.weeklyHours || 0);
        tut = subject.T || 0;
        lab = subject.P || 0;
        total = th + tut + lab;
        theoryHours += th;
        tutorialHours += tut;
        labHours += lab;
      }

      totalWeeklyHours += total;

      const className = cls.name || `S${cls.semester} ${dept.code || 'CSE'} ${cls.section}`;
      const sectionIdentifier = `${dept.code || 'CSE'} S${cls.semester}${cls.section}`;
      uniqueSubjectCodes.add(subject.code);
      uniqueSections.add(sectionIdentifier);

      const semKey = `S${cls.semester}`;
      if (!semesterMap[semKey]) {
        semesterMap[semKey] = {
          semester: cls.semester,
          subjects: [],
          theoryHours: 0,
          tutorialHours: 0,
          labHours: 0,
          electiveHours: 0,
          totalHours: 0,
          sections: new Set(),
          subjectCodes: new Set(),
        };
      }

      const allocation = {
        courseCode: subject.code,
        subjectCode: subject.code,
        subjectName: subject.name,
        semester: cls.semester,
        branch: dept.code || 'CSE',
        section: cls.section,
        className,
        type: subject.type,
        facultyRole,
        theoryHours: th,
        tutorialHours: tut,
        labHours: lab,
        electiveHours: el,
        totalHours: total,
        hours: total,
        L: subject.L || 0,
        T: subject.T || 0,
        P: subject.P || 0,
        R: subject.R || 0,
        labRoom: subject.labRoom || subject.labDetails?.roomName || '',
        requiresConsecutivePeriods: subject.requiresConsecutivePeriods || false,
        consecutivePeriodsCount: subject.consecutivePeriodsCount || 1,
        fixedSlots: subject.fixedSlots || [],
        isMainTeacher,
        isCoInstructor,
        isBatchSplit: subject.labDetails?.isBatchSplit || false,
        batch: isBatch1 ? 'Batch 1' : isBatch2 ? 'Batch 2' : (subject.labDetails?.isBatchSplit ? 'Batch Split' : ''),
        isElective: subject.type === 'elective' || subject.isElective,
        electiveGroup: subject.electiveDetails?.electiveGroupId?.name || '',
        subjectId: subject._id,
      };

      allocations.push(allocation);
      semesterMap[semKey].subjects.push(allocation);
      semesterMap[semKey].theoryHours += th;
      semesterMap[semKey].tutorialHours += tut;
      semesterMap[semKey].labHours += lab;
      semesterMap[semKey].electiveHours += el;
      semesterMap[semKey].totalHours += total;
      semesterMap[semKey].sections.add(sectionIdentifier);
      semesterMap[semKey].subjectCodes.add(subject.code);

      const nameLower = subject.name.toLowerCase();
      const codeLower = subject.code.toLowerCase();
      if (nameLower.includes('project') || codeLower.includes('project') || nameLower.includes('phase')) {
        projectHours += total;
      }
      if (nameLower.includes('placement') || codeLower.includes('placement') || nameLower.includes('training')) {
        placementHours += total;
      }
    }

    // Sort allocations by semester, then section, then subject name
    allocations.sort((a, b) => {
      if (a.semester !== b.semester) return a.semester - b.semester;
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.subjectName.localeCompare(b.subjectName);
    });

    const sortedSemesters = Object.keys(semesterMap)
      .sort((a, b) => semesterMap[a].semester - semesterMap[b].semester)
      .map(key => ({
        semester: semesterMap[key].semester,
        theoryHours: semesterMap[key].theoryHours,
        tutorialHours: semesterMap[key].tutorialHours,
        labHours: semesterMap[key].labHours,
        electiveHours: semesterMap[key].electiveHours,
        totalWeeklyHours: semesterMap[key].totalHours,
        assignedSubjectsCount: semesterMap[key].subjectCodes.size,
        sectionsHandledCount: semesterMap[key].sections.size,
        subjects: semesterMap[key].subjects,
      }));

    // Dedicated Laboratory Breakdown
    const labAllocations = allocations
      .filter(a => a.type === 'lab' || a.labHours > 0)
      .map(a => ({
        subjectName: a.subjectName,
        subjectCode: a.courseCode || a.subjectCode,
        semester: a.semester,
        section: a.section,
        className: a.className,
        facultyAllocation: a.facultyRole,
        weeklyLabHours: a.labHours,
        labRoom: a.labRoom || '—',
        batch: a.batch || (a.isBatchSplit ? 'Batch Split' : 'All Batches'),
      }));

    // Real substitutions count
    const substitutionCount = await Substitution.countDocuments({
      $or: [
        { originalTeacherId: req.params.id },
        { substituteTeacherId: req.params.id },
      ],
    });

    // Scheduled timetable workload from active published timetable
    const activeTimetable = await Timetable.findOne({ isAccepted: true }).sort({ version: -1 }).lean();
    let scheduledWorkload = {
      totalWeeklyHours: 0,
      theoryHours: 0,
      labHours: 0,
      electiveHours: 0,
      distinctSlotsCount: 0,
      scheduledSlots: [],
    };

    if (activeTimetable) {
      let schedTheory = 0;
      let schedLab = 0;
      let schedElective = 0;
      const distinctSlots = new Set();
      const scheduledSlots = [];

      for (const ct of activeTimetable.classTimetables || []) {
        for (const slot of ct.slots || []) {
          if (slot.isBreak) continue;
          const isTeacherInSlot = (slot.teacherIds || []).some(tid => tid?.toString() === req.params.id) ||
                                  (slot.teacherNames || []).includes(teacher.name) ||
                                  (slot.batch1?.teacherId?.toString() === req.params.id) ||
                                  (slot.batch2?.teacherId?.toString() === req.params.id);
          if (isTeacherInSlot) {
            const slotKey = `${slot.day}-${slot.period}`;
            scheduledSlots.push({
              day: slot.day,
              period: slot.period,
              className: ct.className,
              subjectCode: slot.subjectCode,
              subjectName: slot.subjectName,
              type: slot.subjectType || (slot.isLabBlock ? 'lab' : slot.isElective ? 'elective' : 'theory'),
              room: slot.roomName,
            });
            if (!distinctSlots.has(slotKey)) {
              distinctSlots.add(slotKey);
              if (slot.isLabBlock || slot.subjectType === 'lab') schedLab++;
              else if (slot.isElective || slot.subjectType === 'elective') schedElective++;
              else schedTheory++;
            }
          }
        }
      }

      scheduledWorkload = {
        totalWeeklyHours: distinctSlots.size,
        theoryHours: schedTheory,
        labHours: schedLab,
        electiveHours: schedElective,
        distinctSlotsCount: distinctSlots.size,
        scheduledSlots,
      };
    }

    const profile = {
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        username: teacher.username,
        email: teacher.email,
        phone: teacher.phone,
        designation: teacher.designation,
        department: teacher.departmentId,
        maxPeriodsPerDay: teacher.maxPeriodsPerDay,
        maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
      },
      summary: {
        totalWeeklyHours,
        theoryHours,
        tutorialHours,
        labHours,
        practicalHours: labHours,
        electiveHours,
        projectHours,
        placementHours,
        totalSubjects: uniqueSubjectCodes.size,
        assignedSubjectsCount: uniqueSubjectCodes.size,
        subjectsAssigned: uniqueSubjectCodes.size,
        totalSections: uniqueSections.size,
        sectionsHandledCount: uniqueSections.size,
        sectionsHandled: uniqueSections.size,
        substitutions: substitutionCount,
        totalSemesters: sortedSemesters.length,
      },
      assignedWorkload: {
        totalWeeklyHours,
        theoryHours,
        tutorialHours,
        labHours,
        practicalHours: labHours,
        electiveHours,
        subjectsCount: uniqueSubjectCodes.size,
        sectionsCount: uniqueSections.size,
      },
      scheduledWorkload,
      semesterBreakdown: sortedSemesters,
      allocations,
      labAllocations,
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

    // Find the specific subject allocation by allocId
    const subject = await Subject.findById(allocId);

    if (!subject) {
      return sendError(res, 404, 'Subject allocation not found');
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


// GET /api/teachers/workload-overview
const getFacultyWorkloadOverview = async (req, res) => {
  try {
    const teachers = await Teacher.find().select('-password').populate('departmentId').sort({ name: 1 }).lean();
    const Timetable = require('../models/Timetable');
    const Subject = require('../models/Subject');
    const timetable = await Timetable.findOne({ isAccepted: true }) || await Timetable.findOne().sort({ version: -1 });

    const allSubjects = await Subject.find().populate('classId').lean();

    // Calculate teacher scheduled hours from timetable
    const scheduledHoursMap = {};
    const classesTaughtMap = {};
    if (timetable) {
      for (const ct of timetable.classTimetables || []) {
        for (const slot of ct.slots || []) {
          if (slot.isBreak || slot.isEmpty) continue;
          const tIds = (slot.teacherIds || []).map(id => id.toString());
          const tNames = (slot.teacherNames || []).map(n => (n || '').trim().toLowerCase());
          
          for (const tid of tIds) {
            if (!scheduledHoursMap[tid]) scheduledHoursMap[tid] = new Set();
            scheduledHoursMap[tid].add(`${slot.day}_${slot.period}`);
            if (!classesTaughtMap[tid]) classesTaughtMap[tid] = new Set();
            classesTaughtMap[tid].add(ct.className);
          }

          // Also match teachers by name if teacherIds was not populated
          for (const teacher of teachers) {
            const tid = teacher._id.toString();
            const tNameLower = (teacher.name || '').trim().toLowerCase();
            if (tNames.some(tn => tn === tNameLower || tn.includes(tNameLower) || tNameLower.includes(tn))) {
              if (!scheduledHoursMap[tid]) scheduledHoursMap[tid] = new Set();
              scheduledHoursMap[tid].add(`${slot.day}_${slot.period}`);
              if (!classesTaughtMap[tid]) classesTaughtMap[tid] = new Set();
              classesTaughtMap[tid].add(ct.className);
            }
          }
        }
      }
    }

    const report = teachers.map(t => {
      const tid = t._id.toString();
      const teacherSubjects = allSubjects.filter(s =>
        (s.teachers || []).some(id => (id._id || id).toString() === tid) ||
        (s.coInstructors || []).some(id => (id._id || id).toString() === tid)
      );

      const uniqueCodes = new Set();
      let totalAssignedHours = 0;
      const assignedSubjects = [];

      for (const s of teacherSubjects) {
        const classLabel = s.classId ? (s.classId.name || `S${s.classId.semester} ${s.classId.section}`) : 'General';
        assignedSubjects.push({
          _id: s._id,
          code: s.code,
          name: s.name,
          weeklyHours: s.weeklyHours || 0,
          classLabel,
        });

        const assignmentKey = s._id ? s._id.toString() : (s.code + '__' + (s.classId?._id || s.classId || ''));
        if (!uniqueCodes.has(assignmentKey)) {
          uniqueCodes.add(assignmentKey);
          totalAssignedHours += s.weeklyHours || 0;
        }
      }

      const totalScheduledHours = scheduledHoursMap[tid] ? scheduledHoursMap[tid].size : 0;
      const remainingWorkload = Math.max(0, totalAssignedHours - totalScheduledHours);
      const classesTaught = classesTaughtMap[tid] ? Array.from(classesTaughtMap[tid]) : [];

      let status = 'Balanced';
      if (totalScheduledHours < totalAssignedHours) status = 'Underload';
      else if (totalScheduledHours > (t.maxHoursPerWeek || 20)) status = 'Overload';

      return {
        _id: t._id,
        name: t.name,
        username: t.username,
        email: t.email,
        phone: t.phone,
        department: t.departmentId?.name || t.department || 'Computer Science',
        departmentCode: t.departmentId?.code || 'CSE',
        maxHoursPerWeek: t.maxHoursPerWeek || 20,
        maxHoursPerDay: t.maxHoursPerDay || 4,
        assignedSubjects,
        classesTaught,
        totalAssignedHours,
        totalScheduledHours,
        remainingWorkload,
        status,
        isActive: t.isActive !== false,
      };
    });

    return sendSuccess(res, 200, { faculty: report });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getFacultyWorkloadOverview,
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