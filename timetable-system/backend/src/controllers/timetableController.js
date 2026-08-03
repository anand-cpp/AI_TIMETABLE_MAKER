const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const { sendSuccess, sendError } = require('../utils/responseHelpers');
const orchestrator = require('../services/engine/orchestrator');

// ─── GET All Timetable Versions ───────────────────────────────────────────────
// GET /api/timetable/versions
const getVersions = async (req, res) => {
  try {
    const versions = await Timetable.find()
      .select('version label isAccepted generatedAt acceptedAt qualityScore warnings unplacedSubjects generationStats')
      .sort({ version: -1 });

    return sendSuccess(res, 200, { versions });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Single Timetable Version ─────────────────────────────────────────────
// GET /api/timetable/versions/:id
const getVersion = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');
    return sendSuccess(res, 200, { timetable });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Accepted Timetable ───────────────────────────────────────────────────
// GET /api/timetable/accepted
const getAccepted = async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ isAccepted: true });
    if (!timetable) {
      return sendError(res, 404, 'No accepted timetable found');
    }
    return sendSuccess(res, 200, { timetable });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Teacher's Personal Timetable ────────────────────────────────────────
// GET /api/timetable/teacher/:teacherId
const getTeacherTimetable = async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Teachers can only view their own timetable
    if (req.user.role === 'teacher' && req.user._id.toString() !== teacherId) {
      return sendError(res, 403, 'You can only view your own timetable');
    }

    const teacher = await Teacher.findById(teacherId).select('-password');
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    const timetable = await Timetable.findOne({ isAccepted: true });
    if (!timetable) {
      return sendError(res, 404, 'No timetable has been published yet');
    }

    // Extract all slots across all classes where this teacher appears
    const teacherSlots = [];

    for (const classTT of timetable.classTimetables) {
      for (const slot of classTT.slots) {
        if (slot.isBreak) continue;

        const isInSlot =
          (slot.teacherIds && slot.teacherIds.some((id) => id.toString() === teacherId)) ||
          (slot.isBatchSplit &&
            ((slot.batch1?.teacherId && slot.batch1.teacherId.toString() === teacherId) ||
              (slot.batch2?.teacherId && slot.batch2.teacherId.toString() === teacherId)));

        if (isInSlot) {
          teacherSlots.push({
            classId: classTT.classId,
            className: classTT.className,
            day: slot.day,
            period: slot.period,
            subjectName: slot.subjectName,
            subjectCode: slot.subjectCode,
            subjectType: slot.subjectType,
            roomName: slot.roomName,
            isLabBlock: slot.isLabBlock,
            isBatchSplit: slot.isBatchSplit,
          });
        }
      }
    }

    return sendSuccess(res, 200, {
      teacher: {
        id: teacher._id,
        name: teacher.name,
        username: teacher.username,
      },
      slots: teacherSlots,
      version: timetable.version,
      generatedAt: timetable.generatedAt,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GENERATE Timetable ───────────────────────────────────────────────────────
// POST /api/timetable/generate
const generateTimetable = async (req, res) => {
  try {
    const { label } = req.body;

    // Get next version number
    const lastVersion = await Timetable.findOne().sort({ version: -1 }).select('version');
    const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

    // Run engine orchestrator with options (departmentId, year, semester, section, teacherAvailability, etc.)
    const result = await orchestrator.run(req.body);

    if (!result.success) {
      return sendError(res, 400, result.error || 'Timetable generation failed');
    }

    // Save generated timetable
    const timetable = await Timetable.create({
      version: nextVersion,
      label: label || `Version ${nextVersion}`,
      isAccepted: false,
      classTimetables: result.classTimetables,
      qualityScore: result.qualityScore,
      warnings: result.warnings || [],
      unplacedSubjects: result.unplacedSubjects || [],
      generationStats: result.generationStats || {},
    });

    return sendSuccess(
      res,
      201,
      {
        timetable: {
          _id: timetable._id,
          version: timetable.version,
          label: timetable.label,
          qualityScore: timetable.qualityScore,
          warnings: timetable.warnings,
          unplacedSubjects: timetable.unplacedSubjects,
          generationStats: timetable.generationStats,
        },
      },
      'Timetable generated successfully'
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── ACCEPT Timetable Version ─────────────────────────────────────────────────
// PATCH /api/timetable/versions/:id/accept
const acceptVersion = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    // Un-accept ALL other versions atomically
    await Timetable.updateMany(
      { _id: { $ne: req.params.id } },
      { $set: { isAccepted: false, acceptedAt: null } }
    );

    // Accept this version
    const accepted = await Timetable.findByIdAndUpdate(
      req.params.id,
      { $set: { isAccepted: true, acceptedAt: new Date() } },
      { new: true }
    );

    return sendSuccess(
      res,
      200,
      { timetable: { _id: accepted._id, version: accepted.version, isAccepted: true } },
      `Version ${accepted.version} is now the official timetable`
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── UN-ACCEPT Timetable Version ──────────────────────────────────────────────
// PATCH /api/timetable/versions/:id/unaccept
const unacceptVersion = async (req, res) => {
  try {
    const timetable = await Timetable.findByIdAndUpdate(
      req.params.id,
      { $set: { isAccepted: false, acceptedAt: null } },
      { new: true }
    );

    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    return sendSuccess(res, 200, {}, 'Timetable un-accepted successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── DELETE Timetable Version ─────────────────────────────────────────────────
// DELETE /api/timetable/versions/:id
const deleteVersion = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    if (timetable.isAccepted) {
      return sendError(res, 400, 'Cannot delete the accepted timetable. Un-accept it first.');
    }

    await Timetable.findByIdAndDelete(req.params.id);

    return sendSuccess(res, 200, {}, 'Timetable version deleted successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── MANUAL EDIT: Set Slot ────────────────────────────────────────────────────
// PATCH /api/timetable/versions/:id/edit/set
const editSetSlot = async (req, res) => {
  try {
    const { classId, day, period, slotData } = req.body;

    if (!classId || !day || !period) {
      return sendError(res, 400, 'classId, day, and period are required');
    }

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    // Find class timetable
    const classTTIndex = timetable.classTimetables.findIndex(
      (ct) => ct.classId.toString() === classId
    );
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');

    // Find slot
    const slotIndex = timetable.classTimetables[classTTIndex].slots.findIndex(
      (s) => s.day === day && s.period === Number(period)
    );

    const before = slotIndex !== -1
      ? { ...timetable.classTimetables[classTTIndex].slots[slotIndex].toObject() }
      : null;

    // Check if slot is locked
    if (before && before.isLocked) {
      return sendError(res, 400, 'This slot is locked and cannot be edited. Unlock it first.');
    }

    if (slotIndex !== -1) {
      // Update existing slot - preserve lock status
      Object.assign(timetable.classTimetables[classTTIndex].slots[slotIndex], {
        ...slotData,
        day,
        period: Number(period),
        isLocked: before.isLocked,
      });
    } else {
      // Add new slot
      timetable.classTimetables[classTTIndex].slots.push({
        day,
        period: Number(period),
        ...slotData,
      });
    }

    // Record edit history
    timetable.editHistory.push({
      action: 'set',
      classId,
      day,
      period: Number(period),
      before,
      after: slotData,
      editedBy: req.user?.username || 'admin',
    });

    await timetable.save();

    return sendSuccess(res, 200, {}, 'Slot updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── MANUAL EDIT: Clear Slot ──────────────────────────────────────────────────
// PATCH /api/timetable/versions/:id/edit/clear
const editClearSlot = async (req, res) => {
  try {
    const { classId, day, period } = req.body;

    if (!classId || !day || !period) {
      return sendError(res, 400, 'classId, day, and period are required');
    }

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    const classTTIndex = timetable.classTimetables.findIndex(
      (ct) => ct.classId.toString() === classId
    );
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');

    const slotIndex = timetable.classTimetables[classTTIndex].slots.findIndex(
      (s) => s.day === day && s.period === Number(period)
    );

    if (slotIndex === -1) return sendError(res, 404, 'Slot not found');

    const before = { ...timetable.classTimetables[classTTIndex].slots[slotIndex].toObject() };

    if (before.isLocked) {
      return sendError(res, 400, 'This slot is locked. Unlock it first before clearing.');
    }

    // Clear slot content but keep the slot entry
    timetable.classTimetables[classTTIndex].slots[slotIndex] = {
      day,
      period: Number(period),
      subjectId: null,
      subjectName: '',
      subjectCode: '',
      subjectType: 'empty',
      teacherIds: [],
      teacherNames: [],
      roomName: '',
      isLocked: false,
      isBreak: before.isBreak,
      isLabBlock: false,
      labBlockIndex: 0,
      isBatchSplit: false,
      isElective: false,
      electiveGroupId: '',
      notes: '',
    };

    timetable.editHistory.push({
      action: 'clear',
      classId,
      day,
      period: Number(period),
      before,
      after: null,
      editedBy: req.user?.username || 'admin',
    });

    await timetable.save();

    return sendSuccess(res, 200, {}, 'Slot cleared successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── MANUAL EDIT: Swap Slots ──────────────────────────────────────────────────
// PATCH /api/timetable/versions/:id/edit/swap
const editSwapSlots = async (req, res) => {
  try {
    const { classId, slot1, slot2 } = req.body;
    // slot1, slot2: { day, period }

    if (!classId || !slot1 || !slot2) {
      return sendError(res, 400, 'classId, slot1, and slot2 are required');
    }

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    const classTTIndex = timetable.classTimetables.findIndex(
      (ct) => ct.classId.toString() === classId
    );
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');

    const slots = timetable.classTimetables[classTTIndex].slots;

    const idx1 = slots.findIndex(
      (s) => s.day === slot1.day && s.period === Number(slot1.period)
    );
    const idx2 = slots.findIndex(
      (s) => s.day === slot2.day && s.period === Number(slot2.period)
    );

    if (idx1 === -1 || idx2 === -1) {
      return sendError(res, 404, 'One or both slots not found');
    }

    // Check locks
    if (slots[idx1].isLocked || slots[idx2].isLocked) {
      return sendError(res, 400, 'Cannot swap locked slots. Unlock them first.');
    }

    // Check breaks - cannot swap break slots
    if (slots[idx1].isBreak || slots[idx2].isBreak) {
      return sendError(res, 400, 'Cannot swap break slots');
    }

    // Cannot swap lab slots (labs are consecutive blocks)
    if (slots[idx1].isLabBlock || slots[idx2].isLabBlock) {
      return sendError(res, 400, 'Cannot swap lab block slots individually');
    }

    const before1 = { ...slots[idx1].toObject() };
    const before2 = { ...slots[idx2].toObject() };

    // Swap subject content, preserve day/period/isBreak
    const temp = {
      subjectId: slots[idx1].subjectId,
      subjectName: slots[idx1].subjectName,
      subjectCode: slots[idx1].subjectCode,
      subjectType: slots[idx1].subjectType,
      teacherIds: slots[idx1].teacherIds,
      teacherNames: slots[idx1].teacherNames,
      roomName: slots[idx1].roomName,
      isElective: slots[idx1].isElective,
      electiveGroupId: slots[idx1].electiveGroupId,
      notes: slots[idx1].notes,
    };

    slots[idx1].subjectId = slots[idx2].subjectId;
    slots[idx1].subjectName = slots[idx2].subjectName;
    slots[idx1].subjectCode = slots[idx2].subjectCode;
    slots[idx1].subjectType = slots[idx2].subjectType;
    slots[idx1].teacherIds = slots[idx2].teacherIds;
    slots[idx1].teacherNames = slots[idx2].teacherNames;
    slots[idx1].roomName = slots[idx2].roomName;
    slots[idx1].isElective = slots[idx2].isElective;
    slots[idx1].electiveGroupId = slots[idx2].electiveGroupId;
    slots[idx1].notes = slots[idx2].notes;

    slots[idx2].subjectId = temp.subjectId;
    slots[idx2].subjectName = temp.subjectName;
    slots[idx2].subjectCode = temp.subjectCode;
    slots[idx2].subjectType = temp.subjectType;
    slots[idx2].teacherIds = temp.teacherIds;
    slots[idx2].teacherNames = temp.teacherNames;
    slots[idx2].roomName = temp.roomName;
    slots[idx2].isElective = temp.isElective;
    slots[idx2].electiveGroupId = temp.electiveGroupId;
    slots[idx2].notes = temp.notes;

    timetable.editHistory.push({
      action: 'swap',
      classId,
      day: slot1.day,
      period: slot1.period,
      before: { slot1: before1, slot2: before2 },
      after: { slot1: slots[idx1].toObject(), slot2: slots[idx2].toObject() },
      editedBy: req.user?.username || 'admin',
    });

    await timetable.save();

    return sendSuccess(res, 200, {}, 'Slots swapped successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── MANUAL EDIT: Lock Slot ───────────────────────────────────────────────────
// PATCH /api/timetable/versions/:id/edit/lock
const editLockSlot = async (req, res) => {
  try {
    const { classId, day, period } = req.body;

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    const classTTIndex = timetable.classTimetables.findIndex(
      (ct) => ct.classId.toString() === classId
    );
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');

    const slotIndex = timetable.classTimetables[classTTIndex].slots.findIndex(
      (s) => s.day === day && s.period === Number(period)
    );
    if (slotIndex === -1) return sendError(res, 404, 'Slot not found');

    timetable.classTimetables[classTTIndex].slots[slotIndex].isLocked = true;

    timetable.editHistory.push({
      action: 'lock',
      classId,
      day,
      period: Number(period),
      editedBy: req.user?.username || 'admin',
    });

    await timetable.save();

    return sendSuccess(res, 200, {}, 'Slot locked successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── MANUAL EDIT: Unlock Slot ─────────────────────────────────────────────────
// PATCH /api/timetable/versions/:id/edit/unlock
const editUnlockSlot = async (req, res) => {
  try {
    const { classId, day, period } = req.body;

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    const classTTIndex = timetable.classTimetables.findIndex(
      (ct) => ct.classId.toString() === classId
    );
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');

    const slotIndex = timetable.classTimetables[classTTIndex].slots.findIndex(
      (s) => s.day === day && s.period === Number(period)
    );
    if (slotIndex === -1) return sendError(res, 404, 'Slot not found');

    timetable.classTimetables[classTTIndex].slots[slotIndex].isLocked = false;

    timetable.editHistory.push({
      action: 'unlock',
      classId,
      day,
      period: Number(period),
      editedBy: req.user?.username || 'admin',
    });

    await timetable.save();

    return sendSuccess(res, 200, {}, 'Slot unlocked successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Edit History for a Version ──────────────────────────────────────────
// GET /api/timetable/versions/:id/history
const getEditHistory = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id).select('editHistory version');
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    return sendSuccess(res, 200, {
      version: timetable.version,
      editHistory: timetable.editHistory,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── UPDATE Version Label ─────────────────────────────────────────────────────
// PATCH /api/timetable/versions/:id/label
const updateVersionLabel = async (req, res) => {
  try {
    const { label } = req.body;
    if (!label || !label.trim()) {
      return sendError(res, 400, 'Label is required');
    }

    const timetable = await Timetable.findByIdAndUpdate(
      req.params.id,
      { $set: { label: label.trim() } },
      { new: true }
    ).select('version label isAccepted');

    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    return sendSuccess(res, 200, { timetable }, 'Label updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── GET Cross-Department Teachers for a Department ───────────────────────────
// GET /api/timetable/cross-dept-teachers/:departmentId
const getCrossDeptTeachers = async (req, res) => {
  try {
    const { departmentId } = req.params;
    if (!departmentId) return sendError(res, 400, 'Department ID is required');

    const Subject = require('../models/Subject');
    const Department = require('../models/Department');
    const TeacherAvailability = require('../models/TeacherAvailability');

    // Find all classes in this department
    const classes = await Class.find({ departmentId }).select('_id name semester section');
    const classIds = classes.map((c) => c._id);

    // Find all subjects for these classes
    const subjects = await Subject.find({ classId: { $in: classIds } })
      .populate('teachers', 'name username departmentId unavailability')
      .populate('labDetails.batch1Teacher', 'name username departmentId unavailability')
      .populate('labDetails.batch2Teacher', 'name username departmentId unavailability')
      .populate('classId', 'semester section')
      .lean();

    const teacherMap = {};
    for (const sub of subjects) {
      const allTeachers = [
        ...(sub.teachers || []),
        ...(sub.labDetails?.batch1Teacher ? [sub.labDetails.batch1Teacher] : []),
        ...(sub.labDetails?.batch2Teacher ? [sub.labDetails.batch2Teacher] : []),
      ];

      for (const t of allTeachers) {
        if (!t || !t._id) continue;
        const tDeptId = t.departmentId?._id ? t.departmentId._id.toString() : t.departmentId?.toString();
        if (tDeptId && tDeptId !== departmentId.toString()) {
          const key = t._id.toString();
          if (!teacherMap[key]) {
            teacherMap[key] = {
              _id: t._id,
              name: t.name,
              username: t.username,
              homeDepartmentId: tDeptId,
              unavailability: t.unavailability || [],
              subjects: [],
            };
          }
          teacherMap[key].subjects.push({
            name: sub.name,
            code: sub.code,
            classInfo: `Sem ${sub.classId?.semester} Sec ${sub.classId?.section}`,
          });
        }
      }
    }

    const crossDeptTeachers = Object.values(teacherMap);
    const publishedTimetable = await Timetable.findOne({ isAccepted: true }).lean();

    for (const t of crossDeptTeachers) {
      if (t.homeDepartmentId) {
        const homeDept = await Department.findById(t.homeDepartmentId).select('name code').lean();
        t.homeDepartmentName = homeDept ? homeDept.name : 'Other Department';
        t.homeDepartmentCode = homeDept ? homeDept.code : '';
      }

      const savedAvail = await TeacherAvailability.findOne({ teacherId: t._id, departmentId }).lean();
      if (savedAvail && savedAvail.unavailability) {
        t.savedUnavailability = savedAvail.unavailability;
        t.savedSource = savedAvail.source;
      }

      const publishedBusySlots = [];
      if (publishedTimetable) {
        for (const classTT of publishedTimetable.classTimetables) {
          for (const slot of classTT.slots) {
            if (slot.isBreak) continue;
            const isInSlot =
              (slot.teacherIds && slot.teacherIds.some((id) => id.toString() === t._id.toString())) ||
              (slot.isBatchSplit &&
                ((slot.batch1?.teacherId && slot.batch1.teacherId.toString() === t._id.toString()) ||
                  (slot.batch2?.teacherId && slot.batch2.teacherId.toString() === t._id.toString())));
            if (isInSlot) {
              publishedBusySlots.push({ day: slot.day, period: slot.period });
            }
          }
        }
      }
      t.publishedBusySlots = publishedBusySlots;
    }

    return sendSuccess(res, 200, { crossDeptTeachers });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// ─── SAVE Teacher Availability for Department ───────────────────────────
// POST /api/timetable/teacher-availability
const saveTeacherAvailability = async (req, res) => {
  try {
    const { teacherId, departmentId, unavailability, source } = req.body;
    if (!teacherId || !departmentId) {
      return sendError(res, 400, 'teacherId and departmentId are required');
    }

    const TeacherAvailability = require('../models/TeacherAvailability');
    const record = await TeacherAvailability.findOneAndUpdate(
      { teacherId, departmentId },
      { unavailability, source: source || 'manual' },
      { upsert: true, new: true }
    );

    return sendSuccess(res, 200, { record }, 'Teacher availability saved successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getVersions,
  getVersion,
  getAccepted,
  getTeacherTimetable,
  generateTimetable,
  acceptVersion,
  unacceptVersion,
  deleteVersion,
  editSetSlot,
  editClearSlot,
  editSwapSlots,
  editLockSlot,
  editUnlockSlot,
  getEditHistory,
  updateVersionLabel,
  getCrossDeptTeachers,
  saveTeacherAvailability,
};