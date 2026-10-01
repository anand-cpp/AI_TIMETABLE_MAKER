const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const { sendSuccess, sendError } = require('../utils/responseHelpers');
const orchestrator = require('../services/engine/orchestrator');

// GET All Timetable Versions (GET /api/timetable/versions)
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

// GET Single Timetable Version (GET /api/timetable/versions/:id)
const getVersion = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');
    return sendSuccess(res, 200, { timetable });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// GET Accepted Timetable (GET /api/timetable/accepted)
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

// GET Teacher's Personal Timetable (GET /api/timetable/teacher/:teacherId)
const getTeacherTimetable = async (req, res) => {
  try {
    const { teacherId } = req.params;

    if (req.user.role === 'teacher' && req.user._id.toString() !== teacherId) {
      return sendError(res, 403, 'You can only view your own timetable');
    }

    const teacher = await Teacher.findById(teacherId).select('-password');
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    const timetable = await Timetable.findOne({ isAccepted: true }) || await Timetable.findOne().sort({ version: -1 });
    if (!timetable) {
      return sendError(res, 404, 'No timetable available yet');
    }

    const teacherGrid = {};

    for (const classTT of timetable.classTimetables || []) {
      for (const slot of classTT.slots || []) {
        if (slot.isBreak || slot.isEmpty) continue;

        const tIds = (slot.teacherIds || []).map((id) => id.toString());
        const isAssigned =
          tIds.includes(teacherId) ||
          (slot.isBatchSplit &&
            (slot.batch1?.teacherId?.toString() === teacherId ||
              slot.batch2?.teacherId?.toString() === teacherId));

        if (isAssigned) {
          const key = `${slot.day}_${slot.period}`;
          if (!teacherGrid[key]) {
            teacherGrid[key] = {
              day: slot.day,
              period: slot.period,
              subjectName: slot.subjectName,
              subjectCode: slot.subjectCode,
              subjectType: slot.subjectType,
              className: classTT.className,
              roomName: slot.roomName,
              isLabBlock: slot.isLabBlock,
              isBatchSplit: slot.isBatchSplit,
            };
          }
        }
      }
    }

    return sendSuccess(res, 200, {
      teacher,
      timetable: teacherGrid,
      generatedAt: timetable.generatedAt,
      version: timetable.version,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// GET Version Edit History (GET /api/timetable/versions/:id/history)
const getEditHistory = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id).select('version editHistory');
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    return sendSuccess(res, 200, { history: timetable.editHistory || [] });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// GET Cross-Dept Teachers
const getCrossDeptTeachers = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const teachers = await Teacher.find({ departmentId: { $ne: departmentId }, isActive: true })
      .select('-password')
      .populate('departmentId', 'name code');

    return sendSuccess(res, 200, { crossDeptTeachers: teachers });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Save Teacher Availability
const saveTeacherAvailability = async (req, res) => {
  try {
    const { teacherId, unavailability, source } = req.body;
    const teacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { $set: { unavailability: unavailability || [], savedSource: source || 'manual' } },
      { new: true }
    );
    return sendSuccess(res, 200, { teacher }, 'Teacher availability saved successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// GENERATE Timetable Version (POST /api/timetable/generate)
const generateTimetable = async (req, res) => {
  try {
    const {
      departmentId,
      year,
      semester,
      section,
      periodsPerDay,
      periodDuration,
      workingDays,
      teacherDailyLimit,
      includeSaturday,
      avoidConsecutiveHard,
      balanceTeacherLoad,
      subjectOverrides,
      teacherAvailability,
    } = req.body;

    const options = {
      departmentId,
      year,
      semester,
      section,
      periodsPerDay,
      periodDuration,
      workingDays,
      teacherDailyLimit,
      includeSaturday,
      avoidConsecutiveHard,
      balanceTeacherLoad,
      adminOverrides: { subjectOverrides },
      teacherAvailability,
    };

    const engineResult = await orchestrator.run(options);

    if (!engineResult.success) {
      return sendError(res, 400, engineResult.error || 'Generation failed', {
        feasibilityErrors: engineResult.feasibilityErrors || [],
        warnings: engineResult.warnings || [],
      });
    }

    const latestVersionDoc = await Timetable.findOne().sort({ version: -1 });
    const nextVersionNumber = latestVersionDoc ? latestVersionDoc.version + 1 : 1;

    const newTimetable = await Timetable.create({
      version: nextVersionNumber,
      label: `Version ${nextVersionNumber}`,
      isAccepted: false,
      classTimetables: engineResult.classTimetables,
      qualityScore: engineResult.qualityScore,
      validationChecks: engineResult.validationChecks || {},
      autoFillStats: engineResult.autoFillStats || {},
      warnings: engineResult.warnings || [],
      unplacedSubjects: engineResult.unplacedSubjects || [],
      permissionRequests: engineResult.permissionRequests || [],
      generationStats: engineResult.generationStats || {},
    });

    return sendSuccess(
      res,
      201,
      {
        timetable: newTimetable,
        permissionRequests: engineResult.permissionRequests || [],
        validationChecks: engineResult.validationChecks || {},
        autoFillStats: engineResult.autoFillStats || {},
      },
      `Timetable Version ${nextVersionNumber} generated successfully`
    );
  } catch (error) {
    console.error('❌ Controller generate error:', error);
    return sendError(res, 500, error.message);
  }
};

// ACCEPT Timetable Version (PATCH /api/timetable/versions/:id/accept)
const acceptVersion = async (req, res) => {
  try {
    const timetableToAccept = await Timetable.findById(req.params.id);
    if (!timetableToAccept) return sendError(res, 404, 'Timetable version not found');

    await Timetable.updateMany(
      { _id: { $ne: req.params.id } },
      { $set: { isAccepted: false, acceptedAt: null } }
    );

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

// UN-ACCEPT Timetable Version (PATCH /api/timetable/versions/:id/unaccept)
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

// UPDATE Version Label
const updateVersionLabel = async (req, res) => {
  try {
    const { label } = req.body;
    const timetable = await Timetable.findByIdAndUpdate(
      req.params.id,
      { $set: { label } },
      { new: true }
    );
    if (!timetable) return sendError(res, 404, 'Timetable version not found');
    return sendSuccess(res, 200, { timetable }, 'Label updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// DELETE Timetable Version (DELETE /api/timetable/versions/:id)
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

// MANUAL EDIT: Set Slot
const editSetSlot = async (req, res) => {
  try {
    const { classId, day, period, slotData } = req.body;
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    const classTTIndex = timetable.classTimetables.findIndex((ct) => ct.classId.toString() === classId);
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');

    const slotIndex = timetable.classTimetables[classTTIndex].slots.findIndex(
      (s) => s.day === day && s.period === Number(period)
    );
    if (slotIndex === -1) return sendError(res, 404, 'Slot not found');

    timetable.classTimetables[classTTIndex].slots[slotIndex] = {
      ...timetable.classTimetables[classTTIndex].slots[slotIndex].toObject(),
      ...slotData,
      day,
      period: Number(period),
    };

    await timetable.save();
    return sendSuccess(res, 200, { timetable }, 'Slot updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// MANUAL EDIT: Clear Slot
const editClearSlot = async (req, res) => {
  try {
    const { classId, day, period } = req.body;
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    const classTTIndex = timetable.classTimetables.findIndex((ct) => ct.classId.toString() === classId);
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');

    const slotIndex = timetable.classTimetables[classTTIndex].slots.findIndex(
      (s) => s.day === day && s.period === Number(period)
    );
    if (slotIndex === -1) return sendError(res, 404, 'Slot not found');

    timetable.classTimetables[classTTIndex].slots[slotIndex] = {
      day,
      period: Number(period),
      subjectId: null,
      subjectName: '',
      subjectCode: '',
      subjectType: 'empty',
      isEmpty: true,
      teacherIds: [],
      teacherNames: [],
      roomName: '',
      isLocked: false,
      isBreak: timetable.classTimetables[classTTIndex].slots[slotIndex].isBreak,
      isLabBlock: false,
      labBlockIndex: 0,
      isBatchSplit: false,
      isElective: false,
      electiveGroupId: '',
      notes: '',
    };

    await timetable.save();
    return sendSuccess(res, 200, { timetable }, 'Slot cleared successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// MANUAL EDIT: Lock / Unlock Slot
const editLockSlot = async (req, res) => {
  try {
    const { classId, day, period } = req.body;
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    const classTTIndex = timetable.classTimetables.findIndex((ct) => ct.classId.toString() === classId);
    const slotIndex = timetable.classTimetables[classTTIndex].slots.findIndex(
      (s) => s.day === day && s.period === Number(period)
    );

    timetable.classTimetables[classTTIndex].slots[slotIndex].isLocked = true;
    await timetable.save();
    return sendSuccess(res, 200, { timetable }, 'Slot locked successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const editUnlockSlot = async (req, res) => {
  try {
    const { classId, day, period } = req.body;
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    const classTTIndex = timetable.classTimetables.findIndex((ct) => ct.classId.toString() === classId);
    const slotIndex = timetable.classTimetables[classTTIndex].slots.findIndex(
      (s) => s.day === day && s.period === Number(period)
    );

    timetable.classTimetables[classTTIndex].slots[slotIndex].isLocked = false;
    await timetable.save();
    return sendSuccess(res, 200, { timetable }, 'Slot unlocked successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// MANUAL EDIT: Swap Slots (PATCH /api/timetable/versions/:id/edit/swap)
const editSwapSlots = async (req, res) => {
  try {
    const { classId, slot1, slot2 } = req.body;

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

    if (slots[idx1].isLocked || slots[idx2].isLocked) {
      return sendError(res, 400, 'Cannot swap locked slots. Unlock them first.');
    }

    if (slots[idx1].isBreak || slots[idx2].isBreak) {
      return sendError(res, 400, 'Cannot swap break slots');
    }

    if (slots[idx1].isLabBlock || slots[idx2].isLabBlock) {
      return sendError(res, 400, 'Cannot swap lab block slots individually');
    }

    const before1 = { ...slots[idx1].toObject() };
    const before2 = { ...slots[idx2].toObject() };

    // Complete swap of all slot properties while preserving day, period, and _id
    const temp1 = { ...before1 };
    delete temp1.day;
    delete temp1.period;
    delete temp1._id;

    const temp2 = { ...before2 };
    delete temp2.day;
    delete temp2.period;
    delete temp2._id;

    const slot1Day = slots[idx1].day;
    const slot1Period = slots[idx1].period;
    const slot1Id = slots[idx1]._id;

    const slot2Day = slots[idx2].day;
    const slot2Period = slots[idx2].period;
    const slot2Id = slots[idx2]._id;

    slots[idx1] = { _id: slot1Id, day: slot1Day, period: slot1Period, ...temp2 };
    slots[idx2] = { _id: slot2Id, day: slot2Day, period: slot2Period, ...temp1 };

    timetable.markModified('classTimetables');

    timetable.editHistory.push({
      action: 'swap',
      classId,
      day: slot1.day,
      period: slot1.period,
      before: { slot1: before1, slot2: before2 },
      after: { slot1: before1, slot2: before2 },
      editedBy: req.user?.username || 'admin',
    });

    await timetable.save();

    return sendSuccess(res, 200, { timetable }, 'Slots swapped successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getVersions,
  getVersion,
  getAccepted,
  getTeacherTimetable,
  getEditHistory,
  getCrossDeptTeachers,
  saveTeacherAvailability,
  generateTimetable,
  acceptVersion,
  unacceptVersion,
  updateVersionLabel,
  deleteVersion,
  editSetSlot,
  editClearSlot,
  editLockSlot,
  editUnlockSlot,
  editSwapSlots,
};