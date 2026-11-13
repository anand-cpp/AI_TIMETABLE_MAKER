const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const ElectiveGroup = require('../models/ElectiveGroup');
const MinorGroup = require('../models/MinorGroup');
const { sendSuccess, sendError } = require('../utils/responseHelpers');
const orchestrator = require('../services/engine/orchestrator');
const { computeTeacherMetrics } = require('../services/engine/teacherPersonalTimetableValidator');
const {
  validatePersistedTimetable,
  summarizeViolations,
} = require('../services/engine/persistedValidator');
const {
  isLabSlot,
  findLabGroup,
  resolveLabStartPeriod,
  validateLabBlockDestination,
  extractSlotPayload,
  applyAtomicSlotSwap,
} = require('../services/engine/labGroupHelper');
const { isDailyUniquenessExempt } = require('../services/engine/constraintValidator');
const { scoreGrid } = require('../services/engine/qualityScorer');

// Violation types that must never be introduced by a manual edit. Subject-hour
// under/over scheduling and empty slots are intentionally excluded: an admin is
// allowed to clear/adjust a slot, but not to create a real conflict.
const EDIT_BLOCKING_TYPES = new Set([
  'TEACHER_DOUBLE_BOOKED',
  'LAB_ROOM_CONFLICT',
  'LAB_DOUBLE_BOOKING',
  'INVALID_LAB_ASSIGNMENT',
  'FACULTY_REST_GAP',
  'TEACHER_UNAVAILABLE',
  'INVALID_SLOT_NO_TEACHER',
  'LAB_BLOCK_SPLIT',
  'LAB_BLOCK_NON_CONSECUTIVE',
  'LAB_BREAK_CROSSED',
  'SLOT_OUT_OF_TIMELINE',
  'BREAK_SLOT_USED',
  'FIXED_SLOT_VIOLATION',
  'FIXED_SLOT_CONFLICT',
  'S6_OPEN_ELECTIVE_PROHIBITED_SLOT',
  'FRIDAY_P3_LAB_PROHIBITED',
  'LAB_ROOM_MISMATCH',
  'DAILY_SUBJECT_UNIQUENESS_VIOLATION',
  'ELECTIVE_DESYNCHRONIZATION',
  'MINOR_TRACK_DESYNCHRONIZATION',
]);

// Validate the (already mutated) in-memory timetable.
// For manual swaps (isManualSwap = true), structural violations, faculty rest gaps,
// and laboratory conflicts strictly block.
const checkEdit = async (timetable, isManualSwap = false) => {
  const validation = await validatePersistedTimetable(timetable);
  const blockingTypes = isManualSwap
    ? new Set([
        'LAB_BLOCK_SPLIT',
        'LAB_BLOCK_NON_CONSECUTIVE',
        'LAB_BREAK_CROSSED',
        'SLOT_OUT_OF_TIMELINE',
        'BREAK_SLOT_USED',
        'FRIDAY_P3_LAB_PROHIBITED',
        'DAILY_SUBJECT_UNIQUENESS_VIOLATION',
        'ELECTIVE_DESYNCHRONIZATION',
        'FACULTY_REST_GAP',
        'LAB_DOUBLE_BOOKING',
        'LAB_ROOM_CONFLICT',
        'INVALID_LAB_ASSIGNMENT',
      ])
    : EDIT_BLOCKING_TYPES;

  const blocking = (validation.hardViolations || []).filter((v) =>
    blockingTypes.has(v.type)
  );
  if (blocking.length > 0) {
    return {
      error: {
        message: 'This edit would create a conflict and was rejected',
        violations: summarizeViolations(blocking),
      },
      validation,
    };
  }
  return { error: null, validation };
};

// GET All Timetable Versions (GET /api/timetable/versions)
const getVersions = async (req, res) => {
  try {
    const versions = await Timetable.find()
      .select('version label isAccepted generatedAt acceptedAt qualityScore warnings unplacedSubjects generationStats')
      .sort({ version: -1 });

    const sanitizedVersions = versions.map(v => {
      const vObj = v.toObject ? v.toObject() : v;
      const hardCount = vObj.generationStats?.hardViolations || 0;
      const softCount = vObj.generationStats?.softViolations || (vObj.warnings?.length || 0);
      const unplacedCount = (vObj.unplacedSubjects?.length || 0);

      // Never give 100/100 if there are warnings, unplaced slots, or hard conflicts
      let score = 100;
      if (hardCount > 0) {
        score = Math.max(15, 48 - (hardCount - 1) * 4);
      } else {
        const softPenalty = Math.round(softCount * 0.6);
        const unplacedPenalty = unplacedCount * 10;
        score = Math.max(20, Math.min(100, 100 - softPenalty - unplacedPenalty));
        if (typeof vObj.qualityScore?.overall === 'number' && vObj.qualityScore.overall < score) {
          score = vObj.qualityScore.overall;
        }
      }
      vObj.qualityScore = { ...(vObj.qualityScore || {}), overall: score };
      return vObj;
    });

    return sendSuccess(res, 200, { versions: sanitizedVersions });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// GET Single Timetable Version (GET /api/timetable/versions/:id)
const getVersion = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    if (timetable.qualityScore) {
      const hCount = timetable.generationStats?.hardViolations || 0;
      const sCount = timetable.generationStats?.softViolations || (timetable.warnings?.length || 0);
      const uCount = (timetable.unplacedSubjects?.length || 0);
      let score = 100;
      if (hCount > 0) {
        score = Math.max(15, 48 - (hCount - 1) * 4);
      } else {
        const sPenalty = Math.round(sCount * 0.6);
        const uPenalty = uCount * 10;
        score = Math.max(20, Math.min(100, 100 - sPenalty - uPenalty));
        if (typeof timetable.qualityScore?.overall === 'number' && timetable.qualityScore.overall < score) {
          score = timetable.qualityScore.overall;
        }
      }
      timetable.qualityScore.overall = score;
    }

    return sendSuccess(res, 200, { timetable });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// GET Accepted Timetable (GET /api/timetable/accepted)
const getAccepted = async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ isAccepted: true }).sort({ version: -1 });
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

    if (req.user && req.user.role === 'teacher' && req.user._id.toString() !== teacherId) {
      return sendError(res, 403, 'You can only view your own timetable');
    }

    const teacher = await Teacher.findById(teacherId).select('-password').populate('departmentId');
    if (!teacher) return sendError(res, 404, 'Teacher not found');

    const { versionId } = req.query || {};
    let timetable = null;
    if (versionId) {
      timetable = await Timetable.findById(versionId);
    }
    if (!timetable) {
      timetable = await Timetable.findOne({ isAccepted: true }) || await Timetable.findOne().sort({ version: -1 });
    }
    if (!timetable) {
      return sendError(res, 404, 'No timetable available yet');
    }

    // Load Subject assignments for this teacher
    const Subject = require('../models/Subject');
    const Class = require('../models/Class');
    const allSubjects = await Subject.find({
      $or: [{ teachers: teacherId }, { coInstructors: teacherId }]
    }).populate('classId').lean();

    const assignedSubjects = allSubjects.map(s => ({
      _id: s._id,
      code: s.code,
      name: s.name,
      weeklyHours: s.weeklyHours || 0,
      className: s.classId ? (s.classId.name || `S${s.classId.semester} ${s.classId.section}`) : 'General',
    }));

    // Deduplicate shared sessions (e.g. CST402 shared across S8A & S8B)
    const uniqueSubjectCodes = new Set();
    let totalAssignedHours = 0;
    for (const sub of assignedSubjects) {
      if (!uniqueSubjectCodes.has(sub.code)) {
        uniqueSubjectCodes.add(sub.code);
        totalAssignedHours += sub.weeklyHours;
      }
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periods = [1, 2, 3, 4, 5, 6];

    // Build complete 5-day x 6-period personal schedule grid
    const scheduleGrid = {};
    const scheduledSlots = [];
    const classesTaughtSet = new Set();
    const countedScheduledSessions = new Set();
    let totalScheduledHours = 0;

    for (const d of days) {
      scheduleGrid[d] = {};
      for (const p of periods) {
        scheduleGrid[d][p] = {
          day: d,
          period: p,
          isFree: true,
          subjectCode: 'FREE',
          subjectName: '—',
          className: '—',
          roomName: '—',
        };
      }
    }

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
          const sessionKey = `${slot.day}_${slot.period}`;
          classesTaughtSet.add(classTT.className);

          if (!countedScheduledSessions.has(sessionKey)) {
            countedScheduledSessions.add(sessionKey);
            totalScheduledHours++;
          }

          const existingSlot = scheduleGrid[slot.day]?.[slot.period];
          const classLabel = existingSlot && !existingSlot.isFree && existingSlot.className !== classTT.className
            ? `${existingSlot.className} / ${classTT.className}`
            : classTT.className;

          const slotInfo = {
            day: slot.day,
            period: slot.period,
            subjectName: slot.subjectName,
            subjectCode: slot.subjectCode,
            subjectType: slot.subjectType,
            className: classLabel,
            roomName: slot.roomName || '—',
            isLabBlock: slot.isLabBlock || false,
            isElective: slot.isElective || false,
            isLocked: slot.isLocked || false,
            isFree: false,
          };

          scheduleGrid[slot.day][slot.period] = slotInfo;
        }
      }
    }

    for (const d of days) {
      for (const p of periods) {
        scheduledSlots.push(scheduleGrid[d][p]);
      }
    }

    const totalFreePeriods = 30 - totalScheduledHours;

    // Convert classTimetables to grid to compute centralized teacher distribution & balance metrics
    const fullGrid = {};
    const allDbClasses = await Class.find().lean();
    for (const ct of timetable.classTimetables || []) {
      const cid = ct.classId.toString();
      fullGrid[cid] = {};
      for (const d of days) fullGrid[cid][d] = {};
      for (const s of ct.slots || []) fullGrid[cid][s.day][s.period] = s;
    }
    const metrics = computeTeacherMetrics(teacher, fullGrid, { classes: allDbClasses });

    const summary = {
      teacherName: teacher.name,
      department: teacher.departmentId?.name || teacher.department || 'Computer Science and Engineering',
      assignedSubjects,
      classesTaught: Array.from(classesTaughtSet),
      totalAssignedHours,
      totalScheduledHours,
      totalFreePeriods,
      weeklyCapacity: teacher.maxHoursPerWeek || 20,
      dailyLoads: metrics.dailyLoads,
      dailyVariance: metrics.dailyVariance,
      maxConsecutiveTeaching: metrics.maxConsecutiveTeaching,
      totalIdleGaps: metrics.totalIdleGaps,
      isolatedPeriods: metrics.isolatedPeriods,
      rule1Violations: metrics.hardRule1Violations.length,
      isRule1Compliant: metrics.hardRule1Violations.length === 0,
      metrics: {
        dailyLoads: metrics.dailyLoads,
        meanDailyLoad: metrics.meanDailyLoad,
        dailyVariance: metrics.dailyVariance,
        maxConsecutiveTeaching: metrics.maxConsecutiveTeaching,
        totalIdleGaps: metrics.totalIdleGaps,
        isolatedPeriods: metrics.isolatedPeriods,
        repeatedOrdinaryClassPeriods: metrics.repeatedOrdinaryClassPeriods,
        hardRule1Violations: metrics.hardRule1Violations,
      },
    };

    return sendSuccess(res, 200, {
      teacher,
      summary,
      metrics,
      scheduleGrid,
      slots: scheduledSlots,
      timetable: scheduleGrid,
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

    let latestVersionDoc = await Timetable.findOne().sort({ version: -1 });
    let nextVersionNumber = latestVersionDoc ? latestVersionDoc.version + 1 : 1;

    const buildDoc = (version) => ({
      version,
      label: `Version ${version}`,
      isAccepted: false,
      isComplete: !!engineResult.isComplete,
      publicationStatus: engineResult.isComplete ? 'READY_TO_PUBLISH' : 'VALIDATION_FAILED',
      publicationGatePassed: !!engineResult.isComplete,
      classTimetables: engineResult.classTimetables,
      qualityScore: engineResult.qualityScore,
      validationChecks: engineResult.validationChecks || {},
      autoFillStats: engineResult.autoFillStats || {},
      warnings: engineResult.warnings || [],
      unplacedSubjects: engineResult.unplacedSubjects || [],
      permissionRequests: engineResult.permissionRequests || [],
      generationStats: engineResult.generationStats || {},
      pipelineStages: engineResult.pipelineStages || [],
      repairsAuditTrail: engineResult.repairsAuditTrail || [],
    });

    let newTimetable;
    let attempts = 0;
    // Retry on a version collision (concurrent generation) instead of silently
    // creating duplicate version numbers.
    for (;;) {
      try {
        newTimetable = await Timetable.create(buildDoc(nextVersionNumber));
        break;
      } catch (err) {
        if (err && err.code === 11000 && attempts < 5) {
          attempts++;
          latestVersionDoc = await Timetable.findOne().sort({ version: -1 });
          nextVersionNumber = latestVersionDoc ? latestVersionDoc.version + 1 : 1;
          continue;
        }
        throw err;
      }
    }

    // Assess initial realistic diagnostics and score
    try {
      const initialDiags = await generateTimetableDiagnostics(newTimetable);
      if (initialDiags && initialDiags.summary) {
        newTimetable.qualityScore = newTimetable.qualityScore || {};
        newTimetable.qualityScore.overall = initialDiags.summary.qualityScore;
        newTimetable.generationStats = newTimetable.generationStats || {};
        newTimetable.generationStats.hardViolations = initialDiags.summary.hardConflictsCount;
        newTimetable.generationStats.softViolations = initialDiags.summary.softWarningsCount;
        await Timetable.findByIdAndUpdate(newTimetable._id, {
          $set: {
            'qualityScore.overall': initialDiags.summary.qualityScore,
            'generationStats.hardViolations': initialDiags.summary.hardConflictsCount,
            'generationStats.softViolations': initialDiags.summary.softWarningsCount,
          },
        });
      }
    } catch (e) {
      console.warn('Initial diagnostics assessment notice:', e.message);
    }

    return sendSuccess(
      res,
      201,
      {
        timetable: newTimetable,
        permissionRequests: (newTimetable.unplacedSubjects?.length === 0 || newTimetable.isComplete) ? [] : (engineResult.permissionRequests || []),
        validationChecks: engineResult.validationChecks || {},
        autoFillStats: engineResult.autoFillStats || {},
        isComplete: engineResult.isComplete,
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

    // Publishing gate: never accept a timetable that violates hard constraints.
    const validation = await validatePersistedTimetable(timetableToAccept);
    const blockingViolations = (validation.hardViolations || []).filter(v =>
      EDIT_BLOCKING_TYPES.has(v.type) || v.type === 'SUBJECT_OVER_SCHEDULED'
    );
    if (blockingViolations.length > 0) {
      return sendError(res, 400, 'Cannot publish this timetable — it has unresolved conflicts', {
        validationChecks: validation.checks,
        hardViolationsCount: blockingViolations.length,
        violations: summarizeViolations(blockingViolations),
      });
    }

    await Timetable.updateMany(
      { _id: { $ne: req.params.id } },
      { $set: { isAccepted: false, acceptedAt: null } }
    );

    const accepted = await Timetable.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isAccepted: true,
          publicationStatus: 'PUBLISHED',
          publicationGatePassed: true,
          publishedAt: new Date(),
          acceptedAt: new Date(),
          validationChecks: {
            ...(timetableToAccept.validationChecks || {}),
            ...validation.checks,
            hardViolationsCount: validation.hardViolationsCount,
            revalidatedAt: new Date().toISOString(),
          },
        },
      },
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

    const preEditClassTimetables = JSON.parse(JSON.stringify(timetable.classTimetables));

    timetable.classTimetables[classTTIndex].slots[slotIndex] = {
      ...timetable.classTimetables[classTTIndex].slots[slotIndex].toObject(),
      ...slotData,
      day,
      period: Number(period),
    };

    timetable.markModified('classTimetables');
    const { error: editError, validation } = await checkEdit(timetable);
    if (editError) return sendError(res, 400, editError.message, { violations: editError.violations });

    if (validation) {
      timetable.validationChecks = validation.checks || {};
      timetable.markModified('validationChecks');
      if (validation.grid && validation.valData) {
        timetable.qualityScore = scoreGrid(validation.grid, validation.valData, validation);
        timetable.markModified('qualityScore');
      }
    }

    timetable.undoStack = timetable.undoStack || [];
    timetable.undoStack.push({
      timestamp: new Date(),
      action: 'set_slot',
      description: 'Set slot',
      classTimetables: preEditClassTimetables,
      revision: timetable.revision || 1,
    });
    if (timetable.undoStack.length > 50) timetable.undoStack.shift();
    timetable.redoStack = [];
    timetable.markModified('undoStack');
    timetable.markModified('redoStack');

    await timetable.save();
    return sendSuccess(res, 200, { timetable, canUndo: true, canRedo: false }, 'Slot updated successfully');
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

    const preEditClassTimetables = JSON.parse(JSON.stringify(timetable.classTimetables));

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

    timetable.markModified('classTimetables');
    const { error: editError, validation } = await checkEdit(timetable);
    if (editError) return sendError(res, 400, editError.message, { violations: editError.violations });

    if (validation) {
      timetable.validationChecks = validation.checks || {};
      timetable.markModified('validationChecks');
      if (validation.grid && validation.valData) {
        timetable.qualityScore = scoreGrid(validation.grid, validation.valData, validation);
        timetable.markModified('qualityScore');
      }
    }

    timetable.undoStack = timetable.undoStack || [];
    timetable.undoStack.push({
      timestamp: new Date(),
      action: 'clear_slot',
      description: 'Clear slot',
      classTimetables: preEditClassTimetables,
      revision: timetable.revision || 1,
    });
    if (timetable.undoStack.length > 50) timetable.undoStack.shift();
    timetable.redoStack = [];
    timetable.markModified('undoStack');
    timetable.markModified('redoStack');

    await timetable.save();
    return sendSuccess(res, 200, { timetable, canUndo: true, canRedo: false }, 'Slot cleared successfully');
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
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');
    const slots = timetable.classTimetables[classTTIndex].slots;

    const group = findLabGroup(slots, day, Number(period));
    if (group && group.isLab) {
      for (const s of group.slots) {
        s.isLocked = true;
      }
    } else {
      const slotIndex = slots.findIndex((s) => s.day === day && s.period === Number(period));
      if (slotIndex === -1) return sendError(res, 404, 'Slot not found');
      slots[slotIndex].isLocked = true;
    }

    timetable.markModified('classTimetables');
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
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');
    const slots = timetable.classTimetables[classTTIndex].slots;

    const group = findLabGroup(slots, day, Number(period));
    if (group && group.isLab) {
      for (const s of group.slots) {
        s.isLocked = false;
      }
    } else {
      const slotIndex = slots.findIndex((s) => s.day === day && s.period === Number(period));
      if (slotIndex === -1) return sendError(res, 404, 'Slot not found');
      slots[slotIndex].isLocked = false;
    }

    timetable.markModified('classTimetables');
    await timetable.save();
    return sendSuccess(res, 200, { timetable }, 'Slot unlocked successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// MANUAL EDIT: Swap Slots (PATCH /api/timetable/versions/:id/edit/swap)
const editSwapSlots = async (req, res) => {
  try {
    const {
      classId,
      slot1,
      slot2,
      expectedUpdatedAt,
      expectedRevision,
      idempotencyKey,
      adminOverride,
      force,
    } = req.body;

    const allowOverride = Boolean(adminOverride || force);

    if (!classId || !slot1 || !slot2) {
      return sendError(res, 400, 'classId, slot1, and slot2 are required');
    }

    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable version not found');

    const currentRevision = timetable.revision || 1;

    // Idempotency check: if this operation was already successfully committed, return cached state
    if (idempotencyKey) {
      const alreadyApplied = (timetable.appliedIdempotencyKeys || []).find((k) => k.key === idempotencyKey);
      if (alreadyApplied) {
        return sendSuccess(
          res,
          200,
          {
            timetable,
            revision: currentRevision,
            updatedAt: timetable.updatedAt,
            alreadyApplied: true,
          },
          'Swap already persisted (idempotent retry)'
        );
      }
    }

    // Optimistic Concurrency Control: Revision & Timestamp check
    if (expectedRevision !== undefined && Number(expectedRevision) !== currentRevision) {
      return sendError(
        res,
        409,
        `Conflict: timetable revision mismatch (expected revision ${expectedRevision}, current is ${currentRevision}). Timetable was modified by another operation. Please reload.`,
        { currentRevision, latestTimetable: timetable }
      );
    }

    if (expectedUpdatedAt && timetable.updatedAt) {
      if (new Date(timetable.updatedAt).toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
        return sendError(
          res,
          409,
          'Conflict: timetable was updated concurrently by another operation. Please reload.',
          { currentRevision, currentUpdatedAt: timetable.updatedAt, latestTimetable: timetable }
        );
      }
    }

    const classTTIndex = timetable.classTimetables.findIndex(
      (ct) => ct.classId.toString() === classId
    );
    if (classTTIndex === -1) return sendError(res, 404, 'Class not found in timetable');

    const slots = timetable.classTimetables[classTTIndex].slots;

    const group1 = findLabGroup(slots, slot1.day, Number(slot1.period));
    const group2 = findLabGroup(slots, slot2.day, Number(slot2.period));

    if (!group1 || !group2) {
      return sendError(res, 404, 'One or both slots not found in class timetable');
    }

    // Check self-swap
    if (slot1.day === slot2.day && Number(slot1.period) === Number(slot2.period)) {
      return sendError(res, 400, 'Cannot swap a slot with itself');
    }

    // Capture deep backup before mutation in case of rollback
    const originalSlotsBackup = JSON.parse(JSON.stringify(slots));
    const preEditClassTimetables = JSON.parse(JSON.stringify(timetable.classTimetables));

    let swapType = 'SINGLE_SLOT';
    let responsePayload = {};
    let auditDetails = null;
    let beforeState = null;
    let afterState = null;
    let successMessage = 'Slots swapped and saved successfully';
    let lastValidation = null;

    // Case 1: Both are non-lab slots
    if (!group1.isLab && !group2.isLab) {
      const s1 = group1.slots[0];
      const s2 = group2.slots[0];

      if (s1.isBreak || s2.isBreak) {
        return sendError(res, 400, 'Cannot swap break slots');
      }

      // RULE: MANDATORY MINOR FIXED-PERIOD CONSTRAINT ENFORCEMENT
      const isMinorSlot = (s) => Boolean(s && !s.isEmpty && !s.isBreak && (s.isMinor || s.minorGroupId || s.subjectType === 'minor'));
      const isMinorSwap = isMinorSlot(s1) || isMinorSlot(s2);

      if (isMinorSwap) {
        const activeMinor = await MinorGroup.findOne({ isActive: true, isArchived: false });
        if (activeMinor && activeMinor.fixedSlots && activeMinor.fixedSlots.length > 0) {
          const fixedMinorPeriods = activeMinor.fixedSlots.map(fs => ({ day: fs.day, period: Number(fs.period) }));
          const isFixedMinorPeriod = (day, period) =>
            fixedMinorPeriods.some(fs => fs.day === day && fs.period === Number(period));

          const fixedListStr = fixedMinorPeriods.map(f => `${f.day} P${f.period}`).join(', ');

          if (isMinorSlot(s1) && !isFixedMinorPeriod(slot2.day, slot2.period) && !allowOverride) {
            return sendError(
              res,
              400,
              `Cannot swap: Minor subject '${s1.minorSubjectName || s1.subjectName || s1.subjectCode || 'Minor'}' is restricted to configured fixed minor periods (${fixedListStr}). Hard constraint: fixed period allocation.`
            );
          }

          if (isMinorSlot(s2) && !isFixedMinorPeriod(slot1.day, slot1.period) && !allowOverride) {
            return sendError(
              res,
              400,
              `Cannot swap: Minor subject '${s2.minorSubjectName || s2.subjectName || s2.subjectCode || 'Minor'}' is restricted to configured fixed minor periods (${fixedListStr}). Hard constraint: fixed period allocation.`
            );
          }
        }
      }

      if (s1.isLocked || s2.isLocked) {
        return sendError(res, 400, 'Cannot swap locked slots. Unlock them first.');
      }

      const isElectiveSlot = (s) => Boolean(s && !s.isEmpty && !s.isBreak && (s.isElective || s.electiveGroupId || s.subjectType === 'elective'));
      const isElectiveSwap = isElectiveSlot(s1) || isElectiveSlot(s2);

      if (isElectiveSwap) {
        // RULE 1: MANDATORY ELECTIVE SYNCHRONIZATION ACROSS PAIRED CLASSES
        const egIds = new Set();
        if (isElectiveSlot(s1) && s1.electiveGroupId) egIds.add(s1.electiveGroupId.toString());
        if (isElectiveSlot(s2) && s2.electiveGroupId) egIds.add(s2.electiveGroupId.toString());

        let matchedGroups = [];
        if (egIds.size > 0) {
          matchedGroups = await ElectiveGroup.find({ _id: { $in: Array.from(egIds) } });
        }
        if (matchedGroups.length === 0) {
          const allActiveGroups = await ElectiveGroup.find({ isActive: true });
          matchedGroups = allActiveGroups.filter(eg =>
            eg.options.some(opt => {
              const optId = opt.subjectId?._id ? opt.subjectId._id.toString() : opt.subjectId?.toString();
              return (s1.subjectId && optId === s1.subjectId.toString()) || (s2.subjectId && optId === s2.subjectId.toString());
            })
          );
        }

        const allClasses = await Class.find();
        const participatingClassIds = new Set([classId.toString()]);

        for (const eg of matchedGroups) {
          const sem = eg.semester;
          const sections = eg.sections || ['A', 'B'];
          for (const cls of allClasses) {
            if (cls.semester === sem) {
              if (sections.includes(cls.section) || sections.some(sec => (cls.name || '').includes(sec))) {
                participatingClassIds.add(cls._id.toString());
              }
            }
          }
          for (const ct of timetable.classTimetables) {
            const hasGroupSlot = ct.slots.some(
              s => (s.electiveGroupId && s.electiveGroupId.toString() === eg._id.toString())
            );
            if (hasGroupSlot) {
              participatingClassIds.add(ct.classId.toString());
            }
          }
        }

        // Verify pre-conditions across all participating classes
        for (const cid of participatingClassIds) {
          const ct = timetable.classTimetables.find(t => t.classId.toString() === cid);
          if (!ct) continue;
          const ps1 = ct.slots.find(s => s.day === slot1.day && s.period === Number(slot1.period));
          const ps2 = ct.slots.find(s => s.day === slot2.day && s.period === Number(slot2.period));
          if (!ps1 || !ps2) {
            return sendError(res, 400, `Cannot swap: ${ct.className || 'Class'} is missing target slot.`);
          }
          if (ps1.isLocked || ps2.isLocked) {
            return sendError(
              res,
              400,
              `Cannot synchronize elective move: ${ct.className} has a locked slot at ${ps1.isLocked ? ps1.day + ' P' + ps1.period : ps2.day + ' P' + ps2.period}. Unlock it first.`
            );
          }
          if (ps1.isBreak || ps2.isBreak) {
            return sendError(res, 400, `Cannot synchronize elective move: ${ct.className} target is a break slot.`);
          }
          const labG1 = findLabGroup(ct.slots, slot1.day, Number(slot1.period));
          const labG2 = findLabGroup(ct.slots, slot2.day, Number(slot2.period));
          if (labG1.isLab || labG2.isLab) {
            const labG = labG1.isLab ? labG1 : labG2;
            return sendError(
              res,
              400,
              `Cannot synchronize elective move: ${ct.className} has a laboratory session (${labG.subjectName || labG.subjectCode}) at ${labG.day} P${labG.periods.join(', ')}.`
            );
          }

          // Rule 2: Daily subject uniqueness across target days for this class
          if (slot1.day !== slot2.day) {
            if (isElectiveSlot(ps1)) {
              const alreadyHas = ct.slots.some(
                s => s.day === slot2.day && s.period !== Number(slot2.period) && isElectiveSlot(s) && (s.electiveGroupId === ps1.electiveGroupId || s.subjectCode === ps1.subjectCode)
              );
              if (alreadyHas) {
                return sendError(
                  res,
                  400,
                  `Cannot swap: ${ct.className} already has elective '${ps1.subjectName || ps1.subjectCode}' on ${slot2.day}. Hard constraint: subject uniqueness per day.`
                );
              }
            }
            if (ps2 && !ps2.isEmpty && !ps2.isBreak && !isDailyUniquenessExempt(ps2)) {
              const alreadyHas = ct.slots.some(
                s => s.day === slot1.day && s.period !== Number(slot1.period) && !s.isEmpty && !s.isBreak && !isDailyUniquenessExempt(s) &&
                     (s.subjectId?.toString() === ps2.subjectId?.toString() || (s.subjectCode && s.subjectCode === ps2.subjectCode))
              );
              if (alreadyHas) {
                return sendError(
                  res,
                  400,
                  `Cannot swap: ${ct.className} already has '${ps2.subjectName || ps2.subjectCode}' on ${slot1.day}. Hard constraint: subject uniqueness per day.`
                );
              }
            }
          }
        }

        // Deep backup of all class timetables for atomic rollback
        const fullClassesBackup = JSON.parse(JSON.stringify(timetable.classTimetables));
        beforeState = { slot1: extractSlotPayload(s1), slot2: extractSlotPayload(s2) };

        // Apply synchronized swap to all participating classes
        for (const cid of participatingClassIds) {
          const ct = timetable.classTimetables.find(t => t.classId.toString() === cid);
          if (ct) {
            const ps1 = ct.slots.find(s => s.day === slot1.day && s.period === Number(slot1.period));
            const ps2 = ct.slots.find(s => s.day === slot2.day && s.period === Number(slot2.period));
            applyAtomicSlotSwap([ps1], [ps2], false, false);
          }
        }

        timetable.markModified('classTimetables');
        const checkRes = await checkEdit(timetable, allowOverride);
        if (checkRes.error) {
          timetable.classTimetables = fullClassesBackup;
          timetable.markModified('classTimetables');
          return sendError(res, 400, checkRes.error.message, { violations: checkRes.error.violations });
        }
        lastValidation = checkRes.validation;

        afterState = { slot1: extractSlotPayload(s1), slot2: extractSlotPayload(s2) };
        swapType = 'SYNCHRONIZED_ELECTIVE';
        auditDetails = {
          type: 'SYNCHRONIZED_ELECTIVE_SWAP',
          slot1: { day: slot1.day, period: Number(slot1.period) },
          slot2: { day: slot2.day, period: Number(slot2.period) },
          participatingClasses: Array.from(participatingClassIds),
        };
        responsePayload = {
          swapType: 'SYNCHRONIZED_ELECTIVE',
          synchronizedClassesCount: participatingClassIds.size,
        };
        successMessage = `Elective sessions swapped and synchronized across ${participatingClassIds.size} participating classes`;
      } else {
        // Standard single slot swap with daily uniqueness enforcement
        if (slot1.day !== slot2.day) {
          if (!s1.isEmpty && !s1.isBreak && !isDailyUniquenessExempt(s1)) {
            const alreadyHas = slots.some(
              s => s.day === slot2.day && s.period !== Number(slot2.period) && !s.isEmpty && !s.isBreak && !isDailyUniquenessExempt(s) &&
                   (s.subjectId?.toString() === s1.subjectId?.toString() || (s.subjectCode && s.subjectCode === s1.subjectCode))
            );
            if (alreadyHas) {
              return sendError(
                res,
                400,
                `Cannot swap: Class already has '${s1.subjectName || s1.subjectCode}' on ${slot2.day}. Hard constraint: non-exempt subjects may only appear once per day.`
              );
            }
          }
          if (!s2.isEmpty && !s2.isBreak && !isDailyUniquenessExempt(s2)) {
            const alreadyHas = slots.some(
              s => s.day === slot1.day && s.period !== Number(slot1.period) && !s.isEmpty && !s.isBreak && !isDailyUniquenessExempt(s) &&
                   (s.subjectId?.toString() === s2.subjectId?.toString() || (s.subjectCode && s.subjectCode === s2.subjectCode))
            );
            if (alreadyHas) {
              return sendError(
                res,
                400,
                `Cannot swap: Class already has '${s2.subjectName || s2.subjectCode}' on ${slot1.day}. Hard constraint: non-exempt subjects may only appear once per day.`
              );
            }
          }
        }

        beforeState = { slot1: extractSlotPayload(s1), slot2: extractSlotPayload(s2) };

        applyAtomicSlotSwap([s1], [s2], false, false);

        timetable.markModified('classTimetables');
        const checkRes = await checkEdit(timetable, allowOverride);
        if (checkRes.error) {
          timetable.classTimetables[classTTIndex].slots = originalSlotsBackup;
          return sendError(res, 400, checkRes.error.message, { violations: checkRes.error.violations });
        }
        lastValidation = checkRes.validation;

        afterState = { slot1: extractSlotPayload(s1), slot2: extractSlotPayload(s2) };
        swapType = 'SINGLE_SLOT';
        auditDetails = {
          type: 'SINGLE_PERIOD_SWAP',
          slot1: { day: slot1.day, period: Number(slot1.period) },
          slot2: { day: slot2.day, period: Number(slot2.period) },
        };
        responsePayload = { swapType: 'SINGLE_SLOT' };
        successMessage = 'Slots swapped and auto-saved successfully to database';
      }
    }

    // Case 2: Both are lab slots (Lab-to-Lab swap)
    else if (group1.isLab && group2.isLab) {
      if (group1.duration !== group2.duration) {
        return sendError(
          res,
          400,
          `Cannot swap laboratory of duration ${group1.duration} periods (${group1.subjectName || group1.subjectCode}) with laboratory of duration ${group2.duration} periods (${group2.subjectName || group2.subjectCode}). Laboratory swaps require matching durations.`
        );
      }

      const lockedInGroup1 = group1.slots.find((s) => s.isLocked);
      if (lockedInGroup1) {
        return sendError(
          res,
          400,
          `Cannot swap: laboratory session (${group1.subjectName}) has locked slot at ${lockedInGroup1.day} Period ${lockedInGroup1.period}. Unlock it first.`
        );
      }

      const lockedInGroup2 = group2.slots.find((s) => s.isLocked);
      if (lockedInGroup2) {
        return sendError(
          res,
          400,
          `Cannot swap: laboratory session (${group2.subjectName}) has locked slot at ${lockedInGroup2.day} Period ${lockedInGroup2.period}. Unlock it first.`
        );
      }

      // Check Friday rules
      if (group1.day === 'Friday' || group2.day === 'Friday') {
        const isProj1 = ['CST416', 'CSD416'].includes(group1.subjectCode);
        const isProj2 = ['CST416', 'CSD416'].includes(group2.subjectCode);
        if (group1.duration >= 3) {
          if (group2.day === 'Friday' && !isProj1) {
            return sendError(res, 400, '3-period laboratory session cannot be placed on Friday (50-minute periods; prohibited by academic policy).');
          }
          if (group1.day === 'Friday' && !isProj2) {
            return sendError(res, 400, '3-period laboratory session cannot be placed on Friday (50-minute periods; prohibited by academic policy).');
          }
        }
      }

      beforeState = {
        group1: group1.slots.map(extractSlotPayload),
        group2: group2.slots.map(extractSlotPayload),
      };

      applyAtomicSlotSwap(group1.slots, group2.slots, true, true);

      timetable.markModified('classTimetables');
      const checkRes = await checkEdit(timetable, allowOverride);
      if (checkRes.error) {
        timetable.classTimetables[classTTIndex].slots = originalSlotsBackup;
        return sendError(res, 400, checkRes.error.message, { violations: checkRes.error.violations });
      }
      lastValidation = checkRes.validation;

      afterState = {
        group1: group1.slots.map(extractSlotPayload),
        group2: group2.slots.map(extractSlotPayload),
      };
      swapType = 'ATOMIC_LAB_TO_LAB';
      auditDetails = {
        type: 'LAB_TO_LAB_SWAP',
        duration: group1.duration,
        group1: { subjectCode: group1.subjectCode, day: group1.day, periods: group1.periods },
        group2: { subjectCode: group2.subjectCode, day: group2.day, periods: group2.periods },
      };
      responsePayload = {
        swapType: 'ATOMIC_LAB_TO_LAB',
        group1: { subjectName: group1.subjectName, periods: group1.periods, day: group1.day },
        group2: { subjectName: group2.subjectName, periods: group2.periods, day: group2.day },
      };
      successMessage = `Laboratory sessions (${group1.subjectName || group1.subjectCode} and ${group2.subjectName || group2.subjectCode}) swapped and auto-saved atomically`;
    }

    // Case 3: Exactly one is a lab slot (Lab-to-Block swap)
    else {
      const labGroup = group1.isLab ? group1 : group2;
      const destTarget = group1.isLab ? slot2 : slot1;

      const lockedLabSlot = labGroup.slots.find((s) => s.isLocked);
      if (lockedLabSlot) {
        return sendError(
          res,
          400,
          `Cannot swap: laboratory session (${labGroup.subjectName}) has locked slot at ${lockedLabSlot.day} Period ${lockedLabSlot.period}. Unlock it first.`
        );
      }

      const validation = validateLabBlockDestination({
        labGroup,
        targetDay: destTarget.day,
        targetStartPeriod: Number(destTarget.period),
        allSlots: slots,
      });

      if (!validation.valid) {
        return sendError(res, 400, validation.message);
      }

      beforeState = {
        sourceLab: labGroup.slots.map(extractSlotPayload),
        destinationBlock: validation.destSlots.map(extractSlotPayload),
      };

      // Apply atomic swap between the lab group and the target block
      applyAtomicSlotSwap(labGroup.slots, validation.destSlots, true, false);

      timetable.markModified('classTimetables');
      const checkRes = await checkEdit(timetable, allowOverride);
      if (checkRes.error) {
        timetable.classTimetables[classTTIndex].slots = originalSlotsBackup;
        return sendError(res, 400, checkRes.error.message, { violations: checkRes.error.violations });
      }
      lastValidation = checkRes.validation;

      afterState = {
        sourceLab: labGroup.slots.map(extractSlotPayload),
        destinationBlock: validation.destSlots.map(extractSlotPayload),
      };
      swapType = 'ATOMIC_LAB_TO_BLOCK';
      auditDetails = {
        type: 'LAB_TO_BLOCK_SWAP',
        duration: labGroup.duration,
        source: { day: labGroup.day, periods: labGroup.periods, subjectCode: labGroup.subjectCode },
        destination: { day: destTarget.day, periods: validation.destPeriods },
      };
      responsePayload = {
        swapType: 'ATOMIC_LAB_TO_BLOCK',
        lab: {
          subjectName: labGroup.subjectName,
          subjectCode: labGroup.subjectCode,
          duration: labGroup.duration,
          from: { day: labGroup.day, periods: labGroup.periods },
          to: { day: destTarget.day, periods: validation.destPeriods },
        },
      };
      successMessage = `Laboratory session (${labGroup.subjectName || labGroup.subjectCode}) moved and auto-saved atomically to ${destTarget.day} periods [P${validation.destPeriods[0]}–P${validation.destPeriods[validation.destPeriods.length - 1]}]`;
    }

    // Commit to MongoDB: Increment Revision, Update Idempotency Keys, Audit History
    const newRevision = currentRevision + 1;
    timetable.revision = newRevision;

    if (idempotencyKey) {
      timetable.appliedIdempotencyKeys = timetable.appliedIdempotencyKeys || [];
      timetable.appliedIdempotencyKeys.push({
        key: idempotencyKey,
        appliedAt: new Date(),
      });
      if (timetable.appliedIdempotencyKeys.length > 50) {
        timetable.appliedIdempotencyKeys.shift();
      }
      timetable.markModified('appliedIdempotencyKeys');
    }

    timetable.editHistory.push({
      action: swapType === 'SINGLE_SLOT' ? 'swap' : 'lab_group_swap',
      classId,
      day: slot1.day,
      period: Number(slot1.period),
      targetDay: slot2.day,
      targetPeriod: Number(slot2.period),
      before: beforeState,
      after: afterState,
      details: auditDetails,
      revision: newRevision,
      userId: req.user?._id?.toString() || req.user?.id || null,
      editedBy: req.user?.username || req.user?.name || 'admin',
      editedAt: new Date(),
      result: 'success',
      idempotencyKey: idempotencyKey || null,
    });

    timetable.undoStack = timetable.undoStack || [];
    timetable.undoStack.push({
      timestamp: new Date(),
      action: swapType,
      description: successMessage,
      classTimetables: preEditClassTimetables,
      revision: currentRevision,
    });
    if (timetable.undoStack.length > 50) timetable.undoStack.shift();
    // Clear redo stack on new edit
    timetable.redoStack = [];

    timetable.markModified('classTimetables');
    timetable.markModified('editHistory');
    timetable.markModified('undoStack');
    timetable.markModified('redoStack');

    // Update validation checks and explainable quality score for instant verification sync
    if (lastValidation) {
      timetable.validationChecks = lastValidation.checks || {};
      timetable.markModified('validationChecks');
      if (lastValidation.grid && lastValidation.valData) {
        timetable.qualityScore = scoreGrid(lastValidation.grid, lastValidation.valData, lastValidation);
        timetable.markModified('qualityScore');
      }
    }

    // Immediate database write — Authoritative MongoDB persistence
    await timetable.save();

    return sendSuccess(
      res,
      200,
      {
        timetable,
        revision: newRevision,
        updatedAt: timetable.updatedAt,
        canUndo: true,
        canRedo: false,
        undoCount: timetable.undoStack.length,
        redoCount: 0,
        ...responsePayload,
      },
      successMessage
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};


// PREVIEW CONFLICT-FREE REBALANCE (POST /api/timetable/versions/:id/rebalance/preview)
const previewRebalance = async (req, res) => {
  try {
    const { classId, source, target } = req.body;
    if (!classId || !source || !target) {
      return sendError(res, 400, 'classId, source, and target are required');
    }
    const { simulateRebalance } = require('../services/rebalanceService');
    const result = await simulateRebalance(req.params.id, classId, source, target);
    return sendSuccess(res, 200, result, 'Rebalance simulation completed');
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// COMMIT CONFLICT-FREE REBALANCE (POST /api/timetable/versions/:id/rebalance/commit)
const applyRebalance = async (req, res) => {
  try {
    const { classId, source, target, rebalancedGrid } = req.body;
    if (!classId || !source || !target || !rebalancedGrid) {
      return sendError(res, 400, 'classId, source, target, and rebalancedGrid are required');
    }
    const { commitRebalance } = require('../services/rebalanceService');
    const timetable = await Timetable.findById(req.params.id);
    if (timetable) {
      timetable.undoStack = timetable.undoStack || [];
      timetable.undoStack.push({
        timestamp: new Date(),
        action: 'rebalance',
        description: 'Conflict-Free Rebalance',
        classTimetables: JSON.parse(JSON.stringify(timetable.classTimetables)),
        revision: timetable.revision || 1,
      });
      if (timetable.undoStack.length > 50) timetable.undoStack.shift();
      timetable.redoStack = [];
      timetable.markModified('undoStack');
      timetable.markModified('redoStack');
      await timetable.save();
    }
    const result = await commitRebalance(
      req.params.id,
      classId,
      source,
      target,
      rebalancedGrid,
      req.user?.username || 'admin'
    );
    return sendSuccess(res, 200, result, 'Conflict-Free Rebalance applied successfully');
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// UNDO LAST ACTION (POST /api/timetable/versions/:id/undo)
const undoLastAction = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable not found');

    if (!timetable.undoStack || timetable.undoStack.length === 0) {
      return sendError(res, 400, 'No actions available to undo');
    }

    const snapshot = timetable.undoStack.pop();
    const currentClassTimetables = JSON.parse(JSON.stringify(timetable.classTimetables));

    timetable.redoStack = timetable.redoStack || [];
    timetable.redoStack.push({
      timestamp: new Date(),
      action: snapshot.action || 'edit',
      description: snapshot.description || 'Reversible action',
      classTimetables: currentClassTimetables,
      revision: timetable.revision || 1,
    });
    if (timetable.redoStack.length > 50) timetable.redoStack.shift();

    timetable.classTimetables = snapshot.classTimetables;
    timetable.revision = (timetable.revision || 1) + 1;
    timetable.markModified('classTimetables');
    timetable.markModified('undoStack');
    timetable.markModified('redoStack');

    // Run validation on restored state
    const { validation } = await checkEdit(timetable, true);
    if (validation) {
      timetable.validationChecks = validation.checks || {};
      timetable.markModified('validationChecks');
      if (validation.grid && validation.valData) {
        timetable.qualityScore = scoreGrid(validation.grid, validation.valData, validation);
        timetable.markModified('qualityScore');
      }
    }

    await timetable.save();

    return sendSuccess(
      res,
      200,
      {
        timetable,
        revision: timetable.revision,
        canUndo: timetable.undoStack.length > 0,
        canRedo: timetable.redoStack.length > 0,
        undoCount: timetable.undoStack.length,
        redoCount: timetable.redoStack.length,
      },
      'Action undone successfully'
    );
  } catch (err) {
    return sendError(res, 500, `Undo failed: ${err.message}`);
  }
};

// REDO LAST ACTION (POST /api/timetable/versions/:id/redo)
const redoLastAction = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable not found');

    if (!timetable.redoStack || timetable.redoStack.length === 0) {
      return sendError(res, 400, 'No actions available to redo');
    }

    const snapshot = timetable.redoStack.pop();
    const currentClassTimetables = JSON.parse(JSON.stringify(timetable.classTimetables));

    timetable.undoStack = timetable.undoStack || [];
    timetable.undoStack.push({
      timestamp: new Date(),
      action: snapshot.action || 'edit',
      description: snapshot.description || 'Reversible action',
      classTimetables: currentClassTimetables,
      revision: timetable.revision || 1,
    });
    if (timetable.undoStack.length > 50) timetable.undoStack.shift();

    timetable.classTimetables = snapshot.classTimetables;
    timetable.revision = (timetable.revision || 1) + 1;
    timetable.markModified('classTimetables');
    timetable.markModified('undoStack');
    timetable.markModified('redoStack');

    // Run validation on restored state
    const { validation } = await checkEdit(timetable, true);
    if (validation) {
      timetable.validationChecks = validation.checks || {};
      timetable.markModified('validationChecks');
      if (validation.grid && validation.valData) {
        timetable.qualityScore = scoreGrid(validation.grid, validation.valData, validation);
        timetable.markModified('qualityScore');
      }
    }

    await timetable.save();

    return sendSuccess(
      res,
      200,
      {
        timetable,
        revision: timetable.revision,
        canUndo: timetable.undoStack.length > 0,
        canRedo: timetable.redoStack.length > 0,
        undoCount: timetable.undoStack.length,
        redoCount: timetable.redoStack.length,
      },
      'Action redone successfully'
    );
  } catch (err) {
    return sendError(res, 500, `Redo failed: ${err.message}`);
  }
};

// GET HISTORY STATUS (GET /api/timetable/versions/:id/history-status)
const getHistoryStatus = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendError(res, 404, 'Timetable not found');

    return sendSuccess(res, 200, {
      canUndo: Boolean(timetable.undoStack && timetable.undoStack.length > 0),
      canRedo: Boolean(timetable.redoStack && timetable.redoStack.length > 0),
      undoCount: timetable.undoStack ? timetable.undoStack.length : 0,
      redoCount: timetable.redoStack ? timetable.redoStack.length : 0,
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// GET WORKLOAD READINESS (GET /api/timetable/versions/:id/readiness or /api/timetable/readiness)
const getWorkloadReadiness = async (req, res) => {
  try {
    let timetable = null;
    if (req.params.id && req.params.id !== 'accepted') {
      timetable = await Timetable.findById(req.params.id);
    } else {
      timetable = await Timetable.findOne({ isAccepted: true }) || await Timetable.findOne().sort({ version: -1 });
    }
    if (!timetable) {
      return sendError(res, 404, 'No timetable version available for readiness assessment');
    }

    const { loadData } = require('../services/engine/dataLoader');
    const { validateGlobalTimetable } = require('../services/engine/globalTimetableValidator');
    const { gridFromTimetable } = require('../services/engine/persistedValidator');
    const { validateDailySubjectLimit } = require('../services/engine/dailySubjectLimitValidator');

    const data = await loadData({});
    const grid = gridFromTimetable(timetable);
    const globalVal = validateGlobalTimetable(grid, data);
    const dailyLimitVal = validateDailySubjectLimit(timetable);

    // Per-class assessment
    const classAssessment = [];
    let allClassWorkloadComplete = true;

    for (const cls of data.classes) {
      const cid = cls._id.toString();
      const ct = (timetable.classTimetables || []).find(c => c.classId.toString() === cid);
      const scheduledSlots = ct ? ct.slots.filter(s => !s.isEmpty && !s.isBreak) : [];
      
      const expectedSubjects = cls.subjects || [];
      let totalExpectedHours = 0;
      const subjectBreakdown = [];

      for (const sub of expectedSubjects) {
        const reqHours = sub.weeklyHours || 0;
        totalExpectedHours += reqHours;

        const count = scheduledSlots.filter(s =>
          (s.subjectId && s.subjectId.toString() === sub._id.toString()) ||
          (s.subjectCode && s.subjectCode === sub.code)
        ).length;

        subjectBreakdown.push({
          subjectId: sub._id,
          code: sub.code,
          name: sub.name,
          expectedHours: reqHours,
          scheduledHours: count,
          isComplete: count >= reqHours
        });
      }

      const classComplete = scheduledSlots.length >= totalExpectedHours;
      if (!classComplete) allClassWorkloadComplete = false;

      classAssessment.push({
        classId: cls._id,
        className: cls.name,
        semester: cls.semester,
        totalExpectedHours,
        totalScheduledHours: scheduledSlots.length,
        occupancyRate: Math.round((scheduledSlots.length / 30) * 100),
        isComplete: classComplete,
        subjectBreakdown
      });
    }

    // Determine Status
    let status = 'READY';
    let summaryMessage = 'Timetable is academically complete and structurally valid';
    const issues = [];

    const hardViolations = globalVal.violations.filter(v => v.severity === 'hard');

    if (hardViolations.length > 0) {
      status = 'INVALID';
      summaryMessage = `Timetable contains ${hardViolations.length} hard constraint violations`;
      issues.push(...hardViolations.map(v => v.message));
    } else if (dailyLimitVal.violations.length > 0) {
      status = 'INVALID';
      summaryMessage = `Timetable violates daily subject limits (${dailyLimitVal.violations.length} violations)`;
      issues.push(...dailyLimitVal.violations.map(v => v.message));
    } else if (!allClassWorkloadComplete) {
      status = 'INCOMPLETE';
      summaryMessage = 'Certain classes have unscheduled required subject hours';
      issues.push('Required academic subject hours remain incomplete');
    } else if (globalVal.violations.some(v => v.severity === 'soft')) {
      status = 'WARNING';
      summaryMessage = 'Timetable is valid with minor non-blocking distribution recommendations';
      issues.push(...globalVal.violations.filter(v => v.severity === 'soft').map(v => v.message));
    }

    return sendSuccess(res, 200, {
      status,
      summaryMessage,
      timetableId: timetable._id,
      version: timetable.version,
      isAccepted: timetable.isAccepted,
      metrics: {
        totalClasses: data.classes.length,
        allClassWorkloadComplete,
        facultyCollisions: globalVal.report?.facultyCollisions?.failed || 0,
        classCollisions: globalVal.report?.classCollisions?.failed || 0,
        roomCollisions: 0,
        dailyLimitViolations: dailyLimitVal.violations.length,
        hardViolationsCount: hardViolations.length,
        qualityScore: timetable.qualityScore?.overall || 100,
      },
      classAssessment,
      issues
    });
  } catch (err) {
    return sendError(res, 500, `Workload readiness check failed: ${err.message}`);
  }
};

// GET TIMETABLE DIAGNOSTICS (GET /api/timetable/diagnostics or /api/timetable/versions/:id/diagnostics)
const { generateTimetableDiagnostics } = require('../services/engine/diagnosticService');

const getTimetableDiagnosticsController = async (req, res) => {
  try {
    let timetable = null;
    if (req.params.id && req.params.id !== 'accepted') {
      timetable = await Timetable.findById(req.params.id);
    } else {
      timetable = await Timetable.findOne({ isAccepted: true }) || await Timetable.findOne().sort({ version: -1 });
    }
    if (!timetable) {
      return sendError(res, 404, 'Timetable not found for diagnostics');
    }

    const diagnostics = await generateTimetableDiagnostics(timetable);

    // Sync authoritative quality score & conflict statistics to MongoDB
    if (diagnostics && diagnostics.summary) {
      const qScore = diagnostics.summary.qualityScore;
      const hCount = diagnostics.summary.hardConflictsCount;
      const sCount = diagnostics.summary.softWarningsCount;

      if (timetable.qualityScore?.overall !== qScore || timetable.generationStats?.hardViolations !== hCount) {
        await Timetable.findByIdAndUpdate(timetable._id, {
          $set: {
            'qualityScore.overall': qScore,
            'generationStats.hardViolations': hCount,
            'generationStats.softViolations': sCount,
          },
        });
      }
    }

    return sendSuccess(res, 200, diagnostics, 'Diagnostics generated successfully');
  } catch (err) {
    return sendError(res, 500, `Failed to generate diagnostics: ${err.message}`);
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
  checkEdit,
  previewRebalance,
  applyRebalance,
  undoLastAction,
  redoLastAction,
  getHistoryStatus,
  getWorkloadReadiness,
  getTimetableDiagnostics: getTimetableDiagnosticsController,
};