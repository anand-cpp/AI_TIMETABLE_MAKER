const express = require('express');
const router = express.Router();
const MinorGroup = require('../models/MinorGroup');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Department = require('../models/Department');
const Class = require('../models/Class');
const Timetable = require('../models/Timetable');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/responseHelpers');
const { validatePersistedTimetable } = require('../services/engine/persistedValidator');
const { solveSubMinorAllocation } = require('../services/engine/subMinorSolver');

const DEFAULT_FIXED_SLOTS = [
  { day: 'Monday', period: 3, label: 'Monday Period 3 (11:20 AM - 12:20 PM)' },
  { day: 'Thursday', period: 3, label: 'Thursday Period 3 (11:20 AM - 12:20 PM)' },
  { day: 'Friday', period: 4, label: 'Friday Period 4 (12:00 PM - 12:50 PM)' },
  { day: 'Friday', period: 6, label: 'Friday Period 6 (03:30 PM - 04:20 PM)' },
];

// Helper to seed initial default S4 CSE Minor Group if none exists
async function seedDefaultS4MinorGroup() {
  const existing = await MinorGroup.findOne({ semester: 4, isActive: true, isArchived: false });
  if (existing) return existing;

  const cseDept = (await Department.findOne({ code: 'CSE' })) || (await Department.findOne({ name: /computer/i }));
  if (!cseDept) return null;

  const [s4a, s4b] = await Promise.all([
    Class.findOne({ name: /S4 CSE A/i }),
    Class.findOne({ name: /S4 CSE B/i }),
  ]);

  const [mathSub, dbmsSub, osSub, coaSub] = await Promise.all([
    Subject.findOne({ code: 'GAMAT401' }),
    Subject.findOne({ code: 'PCCST402' }),
    Subject.findOne({ code: 'PCCST403' }),
    Subject.findOne({ code: 'PBCST404' }),
  ]);

  const [sunitha, deepthi, nithu, happy] = await Promise.all([
    Teacher.findOne({ name: /Sunitha/i }),
    Teacher.findOne({ name: /Deepthi/i }),
    Teacher.findOne({ name: /Nithu/i }),
    Teacher.findOne({ name: /Happy/i }),
  ]);

  const defaultSubMinorsA = [
    {
      subjectId: mathSub?._id || null,
      subjectCode: 'GAMAT401',
      subjectName: 'Mathematics',
      teacherIds: sunitha ? [sunitha._id] : [],
      teacherNames: sunitha ? [sunitha.name] : [],
      weeklyHours: 1,
      roomName: 'LH 201',
      description: 'Mathematics for Information Science 4 Minor Track',
    },
    {
      subjectId: dbmsSub?._id || null,
      subjectCode: 'PCCST402',
      subjectName: 'DBMS',
      teacherIds: deepthi ? [deepthi._id] : [],
      teacherNames: deepthi ? [deepthi.name] : [],
      weeklyHours: 1,
      roomName: 'LH 201',
      description: 'Database Management Systems Minor Track',
    },
    {
      subjectId: osSub?._id || null,
      subjectCode: 'PCCST403',
      subjectName: 'OS',
      teacherIds: nithu ? [nithu._id] : [],
      teacherNames: nithu ? [nithu.name] : [],
      weeklyHours: 1,
      roomName: 'LH 201',
      description: 'Operating Systems Minor Track',
    },
    {
      subjectId: coaSub?._id || null,
      subjectCode: 'PBCST404',
      subjectName: 'COA',
      teacherIds: happy ? [happy._id] : [],
      teacherNames: happy ? [happy.name] : [],
      weeklyHours: 1,
      roomName: 'LH 201',
      description: 'Computer Organization and Architecture Minor Track',
    },
  ];

  const defaultSubMinorsB = [
    {
      subjectId: mathSub?._id || null,
      subjectCode: 'GAMAT401',
      subjectName: 'Mathematics',
      teacherIds: sunitha ? [sunitha._id] : [],
      teacherNames: sunitha ? [sunitha.name] : [],
      weeklyHours: 1,
      roomName: 'LH 202',
      description: 'Mathematics for Information Science 4 Minor Track',
    },
    {
      subjectId: dbmsSub?._id || null,
      subjectCode: 'PCCST402',
      subjectName: 'DBMS',
      teacherIds: deepthi ? [deepthi._id] : [],
      teacherNames: deepthi ? [deepthi.name] : [],
      weeklyHours: 1,
      roomName: 'LH 202',
      description: 'Database Management Systems Minor Track',
    },
    {
      subjectId: osSub?._id || null,
      subjectCode: 'PCCST403',
      subjectName: 'OS',
      teacherIds: nithu ? [nithu._id] : [],
      teacherNames: nithu ? [nithu.name] : [],
      weeklyHours: 1,
      roomName: 'LH 202',
      description: 'Operating Systems Minor Track',
    },
    {
      subjectId: coaSub?._id || null,
      subjectCode: 'PBCST404',
      subjectName: 'COA',
      teacherIds: happy ? [happy._id] : [],
      teacherNames: happy ? [happy.name] : [],
      weeklyHours: 1,
      roomName: 'LH 202',
      description: 'Computer Organization and Architecture Minor Track',
    },
  ];

  const classConfigs = [];
  if (s4a) {
    classConfigs.push({
      classId: s4a._id,
      className: s4a.name,
      section: 'A',
      subMinors: defaultSubMinorsA,
      allocatedSlots: [
        { day: 'Monday', period: 3, ...defaultSubMinorsA[0] },
        { day: 'Thursday', period: 3, ...defaultSubMinorsA[1] },
        { day: 'Friday', period: 4, ...defaultSubMinorsA[2] },
        { day: 'Friday', period: 6, ...defaultSubMinorsA[3] },
      ],
    });
  }
  if (s4b) {
    classConfigs.push({
      classId: s4b._id,
      className: s4b.name,
      section: 'B',
      subMinors: defaultSubMinorsB,
      allocatedSlots: [
        { day: 'Monday', period: 3, ...defaultSubMinorsB[1] },
        { day: 'Thursday', period: 3, ...defaultSubMinorsB[0] },
        { day: 'Friday', period: 4, ...defaultSubMinorsB[3] },
        { day: 'Friday', period: 6, ...defaultSubMinorsB[2] },
      ],
    });
  }

  const defaultSlots = [
    { day: 'Monday', period: 3, ...defaultSubMinorsA[0] },
    { day: 'Thursday', period: 3, ...defaultSubMinorsA[1] },
    { day: 'Friday', period: 4, ...defaultSubMinorsA[2] },
    { day: 'Friday', period: 6, ...defaultSubMinorsA[3] },
  ];

  const group = await MinorGroup.create({
    name: 'S4 CSE Sub-Minor Group',
    departmentId: cseDept._id,
    semester: 4,
    sections: ['A', 'B'],
    weeklyHours: 4,
    isActive: true,
    isArchived: false,
    slots: defaultSlots,
    options: defaultSubMinorsA,
    classConfigs,
    fixedSlots: DEFAULT_FIXED_SLOTS,
    notes: 'Official KTU S4 CSE Minor Allocation with separate Class Configurations',
  });

  return group;
}

// GET /api/minor-groups/workload-summary
router.get('/workload-summary', authenticate, async (req, res) => {
  try {
    const s4Classes = await Class.find({ semester: 4, name: /CSE/i }).sort({ name: 1 });
    const minorGroup = (await MinorGroup.findOne({ semester: 4, isActive: true, isArchived: false })) || (await seedDefaultS4MinorGroup());
    const minorHours = minorGroup ? minorGroup.weeklyHours || 4 : 4;

    const summary = [];
    for (const cls of s4Classes) {
      const subjects = await Subject.find({ classId: cls._id });
      let coreHours = 0;
      let electiveHours = 0;
      let labHours = 0;
      let placementHours = 0;

      for (const sub of subjects) {
        const h = sub.weeklyHours || 0;
        if (sub.type === 'lab') {
          labHours += h;
        } else if (sub.type === 'elective') {
          electiveHours = Math.max(electiveHours, h);
        } else if (sub.code?.startsWith('PLACE') || sub.name?.toLowerCase().includes('placement')) {
          placementHours += h;
        } else {
          coreHours += h;
        }
      }

      // 5 working days * 6 periods = 30 total periods per week
      const totalLegitimateWorkload = 30;
      summary.push({
        classId: cls._id,
        className: cls.name,
        semester: cls.semester,
        section: cls.section,
        coreHours,
        electiveHours,
        labHours,
        placementHours,
        minorHours,
        totalLegitimateWorkload,
        emptyPeriods: Math.max(0, 30 - (coreHours + electiveHours + labHours + placementHours + minorHours)),
      });
    }

    return sendSuccess(res, 200, { summary, minorGroup });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// GET /api/minor-groups
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = { isArchived: { $ne: true } };
    if (req.query.departmentId) filter.departmentId = req.query.departmentId;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    let groups = await MinorGroup.find(filter)
      .populate('departmentId', 'name code')
      .populate('slots.subjectId', 'name code type weeklyHours')
      .populate('slots.teacherIds', 'name username')
      .populate('options.subjectId', 'name code type weeklyHours')
      .populate('options.teacherIds', 'name username')
      .populate('classConfigs.classId', 'name code semester section')
      .populate('classConfigs.subMinors.subjectId', 'name code type weeklyHours')
      .populate('classConfigs.subMinors.teacherIds', 'name username')
      .sort({ semester: 1, name: 1 });

    if (groups.length === 0 && (!req.query.semester || Number(req.query.semester) === 4)) {
      const seeded = await seedDefaultS4MinorGroup();
      if (seeded) {
        groups = await MinorGroup.find(filter)
          .populate('departmentId', 'name code')
          .populate('slots.subjectId', 'name code type weeklyHours')
          .populate('slots.teacherIds', 'name username')
          .populate('options.subjectId', 'name code type weeklyHours')
          .populate('options.teacherIds', 'name username')
          .populate('classConfigs.classId', 'name code semester section')
          .populate('classConfigs.subMinors.subjectId', 'name code type weeklyHours')
          .populate('classConfigs.subMinors.teacherIds', 'name username')
          .sort({ semester: 1, name: 1 });
      }
    }

    return sendSuccess(res, 200, { groups });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// GET /api/minor-groups/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const group = await MinorGroup.findById(req.params.id)
      .populate('departmentId', 'name code')
      .populate('slots.subjectId', 'name code type weeklyHours')
      .populate('slots.teacherIds', 'name username')
      .populate('options.subjectId', 'name code type weeklyHours')
      .populate('options.teacherIds', 'name username')
      .populate('classConfigs.classId', 'name code semester section')
      .populate('classConfigs.subMinors.subjectId', 'name code type weeklyHours')
      .populate('classConfigs.subMinors.teacherIds', 'name username');

    if (!group) return sendError(res, 404, 'Minor group not found');

    // Calculate configuration status
    const requiredHours = group.weeklyHours || 4;
    let configuredHours = 0;
    if (group.classConfigs && group.classConfigs.length > 0) {
      // Use max or first class's subMinors sum
      configuredHours = group.classConfigs[0].subMinors.reduce((sum, sm) => sum + (Number(sm.weeklyHours) || 0), 0);
    } else if (group.options && group.options.length > 0) {
      configuredHours = group.options.reduce((sum, opt) => sum + (Number(opt.weeklyHours) || 0), 0);
    } else {
      configuredHours = group.slots ? group.slots.length : 0;
    }

    const remainingHours = requiredHours - configuredHours;
    let status = 'Complete';
    if (configuredHours < requiredHours) status = 'Incomplete';
    else if (configuredHours > requiredHours) status = 'Overconfigured';

    return sendSuccess(res, 200, {
      group,
      accounting: {
        requiredHours,
        configuredHours,
        remainingHours,
        status,
        isComplete: status === 'Complete',
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// POST /api/minor-groups
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, departmentId, semester, sections, weeklyHours, slots, options, classConfigs, fixedSlots, isActive, notes } = req.body;
    if (!name || !departmentId || !semester) {
      return sendError(res, 400, 'Name, departmentId, and semester are required');
    }

    const cleanWeeklyHours = Number(weeklyHours) || 4;

    const group = await MinorGroup.create({
      name: name.trim(),
      departmentId,
      semester: Number(semester),
      sections: Array.isArray(sections) ? sections : ['A', 'B'],
      weeklyHours: cleanWeeklyHours,
      slots: Array.isArray(slots) ? slots : [],
      options: Array.isArray(options) ? options : [],
      classConfigs: Array.isArray(classConfigs) ? classConfigs : [],
      fixedSlots: Array.isArray(fixedSlots) && fixedSlots.length > 0 ? fixedSlots : DEFAULT_FIXED_SLOTS,
      isActive: isActive !== undefined ? isActive : true,
      notes: notes || '',
    });

    const populated = await MinorGroup.findById(group._id)
      .populate('departmentId', 'name code')
      .populate('slots.subjectId', 'name code type weeklyHours')
      .populate('slots.teacherIds', 'name username')
      .populate('classConfigs.classId', 'name code semester section');

    return sendSuccess(res, 201, { group: populated }, 'Minor group created successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// PUT /api/minor-groups/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, departmentId, semester, sections, weeklyHours, slots, options, classConfigs, fixedSlots, isActive, isArchived, notes } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (semester !== undefined) updateData.semester = Number(semester);
    if (sections !== undefined) updateData.sections = Array.isArray(sections) ? sections : [];
    if (weeklyHours !== undefined) updateData.weeklyHours = Number(weeklyHours);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (notes !== undefined) updateData.notes = notes;

    if (slots !== undefined) updateData.slots = slots;
    if (options !== undefined) updateData.options = options;
    if (classConfigs !== undefined) updateData.classConfigs = classConfigs;
    if (fixedSlots !== undefined) updateData.fixedSlots = fixedSlots;

    const group = await MinorGroup.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('departmentId', 'name code')
      .populate('slots.subjectId', 'name code type weeklyHours')
      .populate('slots.teacherIds', 'name username')
      .populate('classConfigs.classId', 'name code semester section');

    if (!group) return sendError(res, 404, 'Minor group not found');
    return sendSuccess(res, 200, { group }, 'Minor group updated successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// POST /api/minor-groups/:id/solve
// Solves sub-minor allocations across class configs using subMinorSolver
router.post('/:id/solve', authenticate, requireAdmin, async (req, res) => {
  try {
    const group = await MinorGroup.findById(req.params.id);
    if (!group) return sendError(res, 404, 'Minor group not found');

    if (!group.classConfigs || group.classConfigs.length === 0) {
      return sendError(res, 400, 'Minor group does not have class configurations to solve.');
    }

    const teachers = await Teacher.find({}).lean();
    const teacherMap = {};
    teachers.forEach(t => { teacherMap[t._id.toString()] = t; });

    const fixedSlots = group.fixedSlots && group.fixedSlots.length > 0 ? group.fixedSlots : DEFAULT_FIXED_SLOTS;
    const solveResult = solveSubMinorAllocation(group.classConfigs, fixedSlots, { teacherMap });

    if (!solveResult.success) {
      return sendError(res, 422, `Constraint solver error: ${solveResult.error}`);
    }

    // Apply allocated slots to classConfigs
    for (const cfg of group.classConfigs) {
      const allocated = solveResult.allocationsByClass[cfg.classId.toString()];
      if (allocated) {
        cfg.allocatedSlots = allocated;
      }
    }

    group.markModified('classConfigs');
    await group.save();

    return sendSuccess(res, 200, {
      message: 'Sub-minor allocation solved successfully with zero faculty conflicts.',
      classConfigs: group.classConfigs,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// DELETE /api/minor-groups/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const group = await MinorGroup.findByIdAndDelete(req.params.id);
    if (!group) return sendError(res, 404, 'Minor group not found');
    return sendSuccess(res, 200, null, 'Minor group deleted successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

// POST /api/minor-groups/sync-published
// Instantly synchronizes the active Minor configuration into the published timetable
router.post('/sync-published', authenticate, requireAdmin, async (req, res) => {
  try {
    const minorGroup = (await MinorGroup.findOne({ semester: 4, isActive: true, isArchived: false })) || (await seedDefaultS4MinorGroup());
    if (!minorGroup) return sendError(res, 404, 'No active S4 Minor group found');

    const published = await Timetable.findOne({ publicationStatus: 'PUBLISHED' }).sort({ version: -1 });
    if (!published) return sendError(res, 404, 'No published timetable found to synchronize');

    const s4Classes = await Class.find({ semester: 4, name: /CSE/i });
    const classIds = new Set(s4Classes.map(c => c._id.toString()));

    // Make sure allocations are solved if classConfigs are used
    if (minorGroup.classConfigs && minorGroup.classConfigs.length > 0) {
      const needsSolving = minorGroup.classConfigs.some(cfg => !cfg.allocatedSlots || cfg.allocatedSlots.length < 4);
      if (needsSolving) {
        const teachers = await Teacher.find({}).lean();
        const teacherMap = {};
        teachers.forEach(t => { teacherMap[t._id.toString()] = t; });
        const fixedSlots = minorGroup.fixedSlots && minorGroup.fixedSlots.length > 0 ? minorGroup.fixedSlots : DEFAULT_FIXED_SLOTS;
        const solveRes = solveSubMinorAllocation(minorGroup.classConfigs, fixedSlots, { teacherMap });
        if (solveRes.success) {
          for (const cfg of minorGroup.classConfigs) {
            cfg.allocatedSlots = solveRes.allocationsByClass[cfg.classId.toString()];
          }
          minorGroup.markModified('classConfigs');
          await minorGroup.save();
        }
      }
    }

    let updatedSlotsCount = 0;
    for (const ct of published.classTimetables) {
      const cid = ct.classId.toString();
      if (!classIds.has(cid)) continue;

      const classConfig = (minorGroup.classConfigs || []).find(c => c.classId.toString() === cid);
      const slotSources = classConfig && classConfig.allocatedSlots?.length > 0
        ? classConfig.allocatedSlots
        : minorGroup.slots;

      for (const slotConfig of slotSources) {
        const slot = ct.slots.find(s => s.day === slotConfig.day && s.period === slotConfig.period);
        if (slot) {
          const rawName = slotConfig.subjectName || slotConfig.subjectCode || 'Minor';
          const displayName = rawName.toLowerCase().startsWith('minor') ? rawName : `Minor / ${rawName}`;

          slot.subjectId = slotConfig.subjectId || null;
          slot.subjectName = displayName;
          slot.subjectCode = slotConfig.subjectCode || 'MINOR';
          slot.minorSubjectName = slotConfig.subjectName || 'Minor';
          slot.minorSubjectCode = slotConfig.subjectCode || 'MINOR';
          slot.subjectType = 'minor';
          slot.teacherIds = slotConfig.teacherIds?.length ? slotConfig.teacherIds : [];
          slot.teacherNames = slotConfig.teacherNames?.length ? slotConfig.teacherNames : [];
          slot.roomName = slotConfig.roomName || 'Classroom';
          slot.isMinor = true;
          slot.isLocked = true;
          slot.isEmpty = false;
          slot.minorGroupId = minorGroup._id.toString();
          slot.sharedSessionId = `MINOR_SESSION_${slotConfig.day}_P${slotConfig.period}`;
          slot.isSharedSession = false;
          updatedSlotsCount++;
        }
      }
    }

    published.revision = (published.revision || 1) + 1;
    published.editHistory.push({
      action: 'SYNC_MINOR_CONFIGURATION',
      details: { minorGroupId: minorGroup._id, updatedSlotsCount },
      revision: published.revision,
      editedBy: req.user?.username || 'admin',
      editedAt: new Date(),
      result: 'success',
    });

    published.markModified('classTimetables');
    await published.save();

    // Verify global validity
    const valResult = await validatePersistedTimetable(published);

    return sendSuccess(res, 200, {
      message: 'Published timetable synchronized with Minor configuration',
      version: published.version,
      revision: published.revision,
      updatedSlotsCount,
      validation: valResult,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

module.exports = router;
