const mongoose = require('mongoose');
const Timetable = require('../models/Timetable');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const { loadData } = require('./engine/dataLoader');
const { validateOutput, slotTeacherIds, isSlotValid } = require('./engine/constraintValidator');
const { gridToClassTimetables } = require('./engine/orchestrator');
const {
  isLabSlot,
  findLabGroup,
  resolveLabStartPeriod,
  validateLabBlockDestination,
  extractSlotPayload,
  applyAtomicSlotSwap,
} = require('./engine/labGroupHelper');

const EDIT_BLOCKING_TYPES = new Set([
  'TEACHER_DOUBLE_BOOKING',
  'ROOM_DOUBLE_BOOKING',
  'CLASS_DOUBLE_BOOKING',
  'TEACHER_UNAVAILABLE',
  'TEACHER_DAILY_LIMIT_EXCEEDED',
  'LAB_BLOCK_SPLIT',
  'LAB_BLOCK_NON_CONSECUTIVE',
  'LAB_BREAK_CROSSED',
  'SLOT_OUT_OF_TIMELINE',
  'BREAK_SLOT_USED',
  'FRIDAY_P3_LAB_PROHIBITED',
  'DAILY_SUBJECT_UNIQUENESS_VIOLATION',
  'ELECTIVE_DESYNCHRONIZATION',
  'MINOR_DESYNCHRONIZATION',
  'INVALID_SLOT_NO_TEACHER',
]);

function getBlockingViolations(val) {
  return (val.hardViolations || val.violations || []).filter(v => EDIT_BLOCKING_TYPES.has(v.type));
}

function isConflictFree(val) {
  return getBlockingViolations(val).length === 0;
}


/**
 * Builds in-memory grid from a timetable Mongoose document or POJO
 */
function timetableToGrid(timetable) {
  const grid = {};
  for (const ct of timetable.classTimetables || []) {
    const cid = ct.classId.toString();
    grid[cid] = {};
    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      grid[cid][d] = {};
    }
    for (const s of ct.slots || []) {
      const slotObj = s.toObject ? s.toObject() : { ...s };
      if (!grid[cid][slotObj.day]) grid[cid][slotObj.day] = {};
      grid[cid][slotObj.day][slotObj.period] = slotObj;
    }
  }
  return grid;
}

/**
 * Clone grid
 */
function cloneGrid(grid) {
  return JSON.parse(JSON.stringify(grid));
}

/**
 * Simulate or solve Conflict-Free Rebalance for a requested swap/move
 */
async function simulateRebalance(timetableId, classId, source, target) {
  const timetable = await Timetable.findById(timetableId);
  if (!timetable) throw new Error('Timetable version not found');

  const data = await loadData({});
  const initialGrid = timetableToGrid(timetable);

  const cid = classId.toString();
  if (!initialGrid[cid]) throw new Error(`Class ${classId} not found in timetable`);

  // Gather class slots array to support findLabGroup
  const classSlots = [];
  for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    for (let p = 1; p <= 6; p++) {
      if (initialGrid[cid][d]?.[p]) classSlots.push(initialGrid[cid][d][p]);
    }
  }

  const group1 = findLabGroup(classSlots, source.day, Number(source.period));
  const group2 = findLabGroup(classSlots, target.day, Number(target.period));

  if (!group1 || !group2) throw new Error('Source or target slot not found in grid');

  if (group1.slots.some((s) => s.isLocked) || group2.slots.some((s) => s.isLocked)) {
    throw new Error('Cannot move or swap locked slots. Unlock them first or respect locked constraints.');
  }

  if (group1.slots.some((s) => s.isBreak) || group2.slots.some((s) => s.isBreak)) {
    throw new Error('Cannot swap break slots.');
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [1, 2, 3, 4, 5, 6];

  // ==========================================
  // CASE 1: Standard Single-Slot to Single-Slot
  // ==========================================
  if (!group1.isLab && !group2.isLab) {
    const srcSlot = group1.slots[0];
    const tgtSlot = group2.slots[0];

    const directGrid = cloneGrid(initialGrid);
    const srcClone = { ...srcSlot, day: target.day, period: target.period };
    const tgtClone = { ...tgtSlot, day: source.day, period: source.period };
    delete srcClone._id;
    delete tgtClone._id;

    directGrid[cid][target.day][target.period] = { ...directGrid[cid][target.day][target.period], ...srcClone };
    directGrid[cid][source.day][source.period] = { ...directGrid[cid][source.day][source.period], ...tgtClone };

    const directVal = validateOutput(directGrid, data, []);
    if (isConflictFree(directVal)) {
      return {
        canDirectSwap: true,
        canRebalance: true,
        actionLabel: 'Direct Swap Available',
        description: 'The proposed period swap is conflict-free and can be applied directly.',
        preview: {
          originalPeriod: { day: source.day, period: source.period, subject: srcSlot.subjectName || srcSlot.subjectCode },
          requestedNewPeriod: { day: target.day, period: target.period, subject: tgtSlot.subjectName || tgtSlot.subjectCode || 'Empty Slot' },
          otherChanges: [],
          facultyAffected: Array.from(new Set([...(srcSlot.teacherNames || []), ...(tgtSlot.teacherNames || [])])),
          classesAffected: [initialGrid[cid][source.day][source.period]?.className || cid],
          validationResult: { valid: true, hardViolationsCount: 0 },
        },
        rebalancedGrid: directGrid,
      };
    }

    // Direct swap creates conflict. Run Conflict-Free Rebalance (Minimal 3-Way Shift)
    let bestRebalanceGrid = null;
    let bestViolations = Infinity;
    let rebalanceChanges = [];

    for (const altDay of days) {
      for (const altPeriod of periods) {
        if (altDay === target.day && altPeriod === target.period) continue;
        if (altDay === source.day && altPeriod === source.period) continue;
        const altSlot = initialGrid[cid][altDay]?.[altPeriod];
        if (!altSlot || altSlot.isBreak || altSlot.isLabBlock || isLabSlot(altSlot) || altSlot.isLocked) continue;

        const testGrid = cloneGrid(initialGrid);

        // Move 1: src -> target
        testGrid[cid][target.day][target.period] = {
          ...testGrid[cid][target.day][target.period],
          ...srcClone,
          day: target.day,
          period: target.period,
        };

        // Move 2: tgt -> alt
        const tgtToAlt = { ...tgtSlot, day: altDay, period: altPeriod };
        delete tgtToAlt._id;
        testGrid[cid][altDay][altPeriod] = {
          ...testGrid[cid][altDay][altPeriod],
          ...tgtToAlt,
        };

        // Move 3: alt -> source
        const altToSrc = { ...altSlot, day: source.day, period: source.period };
        delete altToSrc._id;
        testGrid[cid][source.day][source.period] = {
          ...testGrid[cid][source.day][source.period],
          ...altToSrc,
        };

        const val = validateOutput(testGrid, data, []);
        if (isConflictFree(val)) {
          bestRebalanceGrid = testGrid;
          bestViolations = 0;
          rebalanceChanges = [
            {
              day: target.day,
              period: target.period,
              fromDay: source.day,
              fromPeriod: source.period,
              subject: srcSlot.subjectName || srcSlot.subjectCode,
              faculty: srcSlot.teacherNames || [],
            },
            {
              day: altDay,
              period: altPeriod,
              fromDay: target.day,
              fromPeriod: target.period,
              subject: tgtSlot.subjectName || tgtSlot.subjectCode,
              faculty: tgtSlot.teacherNames || [],
            },
            {
              day: source.day,
              period: source.period,
              fromDay: altDay,
              fromPeriod: altPeriod,
              subject: altSlot.subjectName || altSlot.subjectCode,
              faculty: altSlot.teacherNames || [],
            },
          ];
          break;
        }
      }
      if (bestViolations === 0) break;
    }

    if (bestViolations === 0 && bestRebalanceGrid) {
      const allFaculty = new Set();
      for (const chg of rebalanceChanges) {
        for (const f of chg.faculty) allFaculty.add(f);
      }

      return {
        canDirectSwap: false,
        canRebalance: true,
        actionLabel: 'Conflict-Free Rebalance',
        description: 'Auto-adjusts the displaced period to resolve faculty conflicts without disrupting the rest of the schedule.',
        preview: {
          originalPeriod: { day: source.day, period: source.period, subject: srcSlot.subjectName || srcSlot.subjectCode },
          requestedNewPeriod: { day: target.day, period: target.period, subject: tgtSlot.subjectName || tgtSlot.subjectCode || 'Empty Slot' },
          otherChanges: rebalanceChanges.filter((c) => !(c.day === target.day && c.period === target.period)),
          facultyAffected: Array.from(allFaculty),
          classesAffected: [initialGrid[cid][source.day][source.period]?.className || cid],
          validationResult: { valid: true, hardViolationsCount: 0 },
        },
        rebalancedGrid: bestRebalanceGrid,
      };
    }

    return {
      canDirectSwap: false,
      canRebalance: false,
      reason: `Direct swap creates conflict (${directVal.violations[0]?.message || 'Teacher double-booking'}). No conflict-free adjustment exists without violating constraints.`,
      violations: directVal.violations,
    };
  }

  // ==========================================
  // CASE 2: Both are Laboratory Blocks
  // ==========================================
  if (group1.isLab && group2.isLab) {
    if (group1.duration !== group2.duration) {
      return {
        canDirectSwap: false,
        canRebalance: false,
        reason: `Cannot swap laboratory of duration ${group1.duration} with laboratory of duration ${group2.duration}. Durations must match.`,
      };
    }

    const directGrid = cloneGrid(initialGrid);
    for (let i = 0; i < group1.duration; i++) {
      const s1 = group1.slots[i];
      const s2 = group2.slots[i];
      const p1 = { ...s1, day: s2.day, period: s2.period, isLabBlock: true, labBlockIndex: i };
      const p2 = { ...s2, day: s1.day, period: s1.period, isLabBlock: true, labBlockIndex: i };
      delete p1._id;
      delete p2._id;

      directGrid[cid][s2.day][s2.period] = { ...directGrid[cid][s2.day][s2.period], ...p1 };
      directGrid[cid][s1.day][s1.period] = { ...directGrid[cid][s1.day][s1.period], ...p2 };
    }

    const directVal = validateOutput(directGrid, data, []);
    if (isConflictFree(directVal)) {
      return {
        canDirectSwap: true,
        canRebalance: true,
        actionLabel: 'Direct Swap Available',
        description: 'Laboratory sessions can be swapped directly with 0 conflicts.',
        preview: {
          originalPeriod: { day: source.day, period: source.period, subject: group1.subjectName || group1.subjectCode },
          requestedNewPeriod: { day: target.day, period: target.period, subject: group2.subjectName || group2.subjectCode },
          otherChanges: [],
          facultyAffected: Array.from(new Set([...(group1.slots[0].teacherNames || []), ...(group2.slots[0].teacherNames || [])])),
          classesAffected: [initialGrid[cid][source.day][source.period]?.className || cid],
          validationResult: { valid: true, hardViolationsCount: 0 },
        },
        rebalancedGrid: directGrid,
      };
    }

    return {
      canDirectSwap: false,
      canRebalance: false,
      reason: `Direct laboratory swap creates conflict (${directVal.violations[0]?.message || 'Teacher/Room conflict'}).`,
      violations: directVal.violations,
    };
  }

  // ==========================================
  // CASE 3: Exactly One is Laboratory Block
  // ==========================================
  const labGroup = group1.isLab ? group1 : group2;
  const isSrcLab = group1.isLab;
  const destDay = isSrcLab ? target.day : source.day;
  const rawDestP = Number(isSrcLab ? target.period : source.period);
  const K = labGroup.duration;
  const destStartP = resolveLabStartPeriod(K, destDay, rawDestP);
  const destEndP = destStartP + K - 1;

  if (destEndP > 6) {
    return { canDirectSwap: false, canRebalance: false, reason: `Destination periods [P${destStartP}–P${destEndP}] exceed period 6.` };
  }

  if (destDay !== 'Friday' && destStartP <= 3 && destEndP >= 4) {
    return { canDirectSwap: false, canRebalance: false, reason: 'Laboratory block cannot cross lunch break between P3 and P4.' };
  }

  if (destDay === 'Friday' && destStartP <= 4 && destEndP >= 5) {
    return { canDirectSwap: false, canRebalance: false, reason: 'Laboratory block cannot cross Friday prayer/lunch break between P4 and P5.' };
  }

  const isProj = ['CST416', 'CSD416'].includes(labGroup.subjectCode);
  if (destDay === 'Friday' && K >= 3 && !isProj) {
    return { canDirectSwap: false, canRebalance: false, reason: '3-period laboratory cannot be scheduled on Friday (50-minute periods).' };
  }

  const destSlots = [];
  for (let p = destStartP; p <= destEndP; p++) {
    const ds = initialGrid[cid][destDay]?.[p];
    if (!ds || ds.isBreak || ds.isLocked || isLabSlot(ds) || ds.isLabBlock) {
      return { canDirectSwap: false, canRebalance: false, reason: `Destination slot at ${destDay} P${p} is invalid, locked, or a laboratory.` };
    }
    destSlots.push(ds);
  }

  // Direct block swap: Move lab to destination block, displaced theory slots to lab's original slots
  const directGrid = cloneGrid(initialGrid);
  for (let i = 0; i < K; i++) {
    const srcS = labGroup.slots[i];
    const dstS = destSlots[i];

    const pSrc = { ...srcS, day: destDay, period: destStartP + i, isLabBlock: true, labBlockIndex: i };
    const pDst = { ...dstS, day: labGroup.day, period: labGroup.startPeriod + i, isLabBlock: false, labBlockIndex: 0 };
    delete pSrc._id;
    delete pDst._id;

    directGrid[cid][destDay][destStartP + i] = { ...directGrid[cid][destDay][destStartP + i], ...pSrc };
    directGrid[cid][labGroup.day][labGroup.startPeriod + i] = { ...directGrid[cid][labGroup.day][labGroup.startPeriod + i], ...pDst };
  }

  const directVal = validateOutput(directGrid, data, []);
  if (isConflictFree(directVal)) {
    return {
      canDirectSwap: true,
      canRebalance: true,
      actionLabel: 'Direct Move Available',
      description: `The laboratory session (${labGroup.subjectName}) can move atomically with 0 conflicts.`,
      preview: {
        originalPeriod: { day: labGroup.day, period: labGroup.startPeriod, subject: labGroup.subjectName || labGroup.subjectCode },
        requestedNewPeriod: { day: destDay, period: destStartP, subject: destSlots[0]?.subjectName || 'Theory Slot' },
        otherChanges: destSlots.map((ds, idx) => ({
          day: labGroup.day,
          period: labGroup.startPeriod + idx,
          fromDay: destDay,
          fromPeriod: ds.period,
          subject: ds.subjectName || ds.subjectCode,
          faculty: ds.teacherNames || [],
        })),
        facultyAffected: Array.from(new Set([...(labGroup.slots[0].teacherNames || []), ...destSlots.flatMap((s) => s.teacherNames || [])])),
        classesAffected: [initialGrid[cid][source.day][source.period]?.className || cid],
        validationResult: { valid: true, hardViolationsCount: 0 },
      },
      rebalancedGrid: directGrid,
    };
  }

  // If direct block swap created teacher conflicts for one of the displaced theory slots:
  // Search for an alternate theory slot in the class to cyclic shift that displaced slot
  for (let i = 0; i < K; i++) {
    const displacedSlot = destSlots[i];
    const targetPeriodInLab = labGroup.startPeriod + i;

    for (const altDay of days) {
      for (const altPeriod of periods) {
        if (altDay === destDay && altPeriod >= destStartP && altPeriod <= destEndP) continue;
        if (altDay === labGroup.day && altPeriod >= labGroup.startPeriod && altPeriod <= labGroup.endPeriod) continue;

        const altSlot = initialGrid[cid][altDay]?.[altPeriod];
        if (!altSlot || altSlot.isBreak || altSlot.isLabBlock || isLabSlot(altSlot) || altSlot.isLocked) continue;

        const testGrid = cloneGrid(directGrid);
        // Cyclic move: displacedSlot at targetPeriodInLab swaps with altSlot
        const currentAtSlot = { ...testGrid[cid][labGroup.day][targetPeriodInLab] };
        const altClone = { ...altSlot, day: labGroup.day, period: targetPeriodInLab };
        const dispToAlt = { ...currentAtSlot, day: altDay, period: altPeriod };
        delete altClone._id;
        delete dispToAlt._id;

        testGrid[cid][labGroup.day][targetPeriodInLab] = { ...testGrid[cid][labGroup.day][targetPeriodInLab], ...altClone };
        testGrid[cid][altDay][altPeriod] = { ...testGrid[cid][altDay][altPeriod], ...dispToAlt };

        const testVal = validateOutput(testGrid, data, []);
        if (isConflictFree(testVal)) {
          return {
            canDirectSwap: false,
            canRebalance: true,
            actionLabel: 'Conflict-Free Rebalance',
            description: `Laboratory session moved and displaced period auto-adjusted to resolve conflict cleanly.`,
            preview: {
              originalPeriod: { day: labGroup.day, period: labGroup.startPeriod, subject: labGroup.subjectName || labGroup.subjectCode },
              requestedNewPeriod: { day: destDay, period: destStartP, subject: destSlots[0]?.subjectName || 'Theory Slot' },
              otherChanges: [
                {
                  day: altDay,
                  period: altPeriod,
                  fromDay: destDay,
                  fromPeriod: displacedSlot.period,
                  subject: displacedSlot.subjectName || displacedSlot.subjectCode,
                  faculty: displacedSlot.teacherNames || [],
                },
                {
                  day: labGroup.day,
                  period: targetPeriodInLab,
                  fromDay: altDay,
                  fromPeriod: altPeriod,
                  subject: altSlot.subjectName || altSlot.subjectCode,
                  faculty: altSlot.teacherNames || [],
                },
              ],
              facultyAffected: Array.from(new Set([...(labGroup.slots[0].teacherNames || []), ...destSlots.flatMap((s) => s.teacherNames || []), ...(altSlot.teacherNames || [])])),
              classesAffected: [initialGrid[cid][source.day][source.period]?.className || cid],
              validationResult: { valid: true, hardViolationsCount: 0 },
            },
            rebalancedGrid: testGrid,
          };
        }
      }
    }
  }

  return {
    canDirectSwap: false,
    canRebalance: false,
    reason: `Direct laboratory move creates conflict (${directVal.violations[0]?.message || 'Teacher double-booking'}). No conflict-free adjustment could be found without violating constraints.`,
    violations: directVal.violations,
  };
}

/**
 * Commit a rebalance atomically
 */
async function commitRebalance(timetableId, classId, source, target, rebalancedGrid, username = 'admin') {
  const timetable = await Timetable.findById(timetableId);
  if (!timetable) throw new Error('Timetable version not found');

  const data = await loadData({});
  const val = validateOutput(rebalancedGrid, data, []);
  if (!isConflictFree(val)) {
    throw new Error(`Rebalance validation failed: ${getBlockingViolations(val)[0]?.message || 'Conflict detected'}`);
  }

  const classes = await Class.find().lean();
  const updatedClassTimetables = gridToClassTimetables(rebalancedGrid, classes);

  timetable.classTimetables = updatedClassTimetables;
  timetable.revision = (timetable.revision || 1) + 1;
  timetable.updatedAt = new Date();
  timetable.editHistory.push({
    action: 'rebalance',
    classId,
    day: source.day,
    period: source.period,
    before: { source, target },
    after: { rebalanced: true },
    editedBy: username,
    timestamp: new Date(),
  });

  timetable.markModified('classTimetables');
  timetable.markModified('editHistory');

  await timetable.save();
  return { success: true, timetable };
}

module.exports = {
  timetableToGrid,
  simulateRebalance,
  commitRebalance,
};
