const { loadData } = require('./dataLoader');
const { validateOutput } = require('./constraintValidator');

/**
 * Rebuild an engine-style grid from a persisted timetable document, then run the
 * full hard-constraint validator against it. This is the authoritative gate used
 * before a version may be published (accepted) and after manual edits.
 */

const gridFromTimetable = (timetable) => {
  const grid = {};

  for (const classTT of timetable.classTimetables || []) {
    const classId = classTT.classId.toString();
    grid[classId] = grid[classId] || {};

    for (const slot of classTT.slots || []) {
      const day = slot.day;
      if (!day) continue;
      grid[classId][day] = grid[classId][day] || {};
      grid[classId][day][slot.period] = {
        subjectId: slot.subjectId ? slot.subjectId.toString() : null,
        subjectName: slot.subjectName || '',
        subjectCode: slot.subjectCode || '',
        subjectType: slot.subjectType || 'empty',
        teacherIds: (slot.teacherIds || []).map((id) => id.toString()),
        teacherNames: slot.teacherNames || [],
        roomName: slot.roomName || '',
        isLocked: !!slot.isLocked,
        isBreak: !!slot.isBreak,
        isLabBlock: !!slot.isLabBlock,
        labBlockIndex: slot.labBlockIndex || 0,
        isBatchSplit: !!slot.isBatchSplit,
        batch1: slot.batch1 || { teacherId: null, teacherName: '', roomName: '' },
        batch2: slot.batch2 || { teacherId: null, teacherName: '', roomName: '' },
        isElective: !!slot.isElective,
        electiveGroupId: slot.electiveGroupId || '',
        isAutoFill: !!slot.isAutoFill,
        autoFillType: slot.autoFillType || '',
        isEmpty: slot.isEmpty !== undefined ? !!slot.isEmpty : !slot.subjectId,
        isOverride: !!slot.isOverride,
      };
    }
  }

  return grid;
};

const validatePersistedTimetable = async (timetable) => {
  let data;
  try {
    data = await loadData({});
  } catch (err) {
    return {
      valid: false,
      checks: { data_available: false },
      hardViolationsCount: 1,
      hardViolations: [
        {
          type: 'DATA_UNAVAILABLE',
          message: `Cannot validate timetable: ${err.message}`,
        },
      ],
      violations: [],
      emptySlotsCount: 0,
      error: err.message,
    };
  }

  const grid = gridFromTimetable(timetable);
  const presentClassIds = new Set(Object.keys(grid).filter((id) => grid[id] && Object.keys(grid[id]).length > 0));

  // Classes referenced by the timetable that no longer exist in the database.
  const missingClassViolations = [];
  const classById = {};
  for (const cls of data.classes) classById[cls._id.toString()] = cls;

  const presentClasses = [];
  for (const cid of presentClassIds) {
    if (classById[cid]) presentClasses.push(classById[cid]);
    else {
      missingClassViolations.push({
        type: 'MISSING_CLASS_DATA',
        message: `Timetable references class ${cid} which no longer exists`,
        classId: cid,
      });
    }
  }

  const valData = { ...data, classes: presentClasses };
  const result = validateOutput(grid, valData, []);

  const hardViolations = [...result.hardViolations, ...missingClassViolations];
  const valid = result.valid && missingClassViolations.length === 0;

  return {
    ...result,
    valid,
    hardViolations,
    hardViolationsCount: result.hardViolationsCount + missingClassViolations.length,
    checks: {
      ...result.checks,
      classes_present_in_db: missingClassViolations.length === 0,
    },
    grid,
  };
};

const summarizeViolations = (violations, limit = 12) => {
  const list = (violations || []).slice(0, limit).map((v) => v.message);
  if ((violations || []).length > limit) {
    list.push(`…and ${violations.length - limit} more`);
  }
  return list;
};

module.exports = { validatePersistedTimetable, gridFromTimetable, summarizeViolations };
