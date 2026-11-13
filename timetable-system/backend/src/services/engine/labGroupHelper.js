/**
 * labGroupHelper.js
 * Atomic Group-Based Laboratory Management & Swapping Service
 *
 * Provides authoritative group detection, validation, and atomic swapping
 * for multi-period laboratory sessions and project blocks.
 */

function isLabSlot(s) {
  if (!s) return false;
  if (s.isEmpty) return false;
  return !!(
    s.isLabBlock ||
    s.subjectType === 'lab' ||
    ['CSD416', 'CST416'].includes(s.subjectCode) ||
    (s.subjectName && /\b(lab|laboratory|workshop|mini project|project phase)\b/i.test(s.subjectName))
  );
}

/**
 * Identify complete contiguous laboratory group on the given day containing `period`.
 * If the slot is not a laboratory, returns single-period non-lab descriptor.
 */
function findLabGroup(slots, day, period) {
  const pNum = Number(period);
  const target = slots.find((s) => s.day === day && s.period === pNum);
  if (!target) return null;

  if (!isLabSlot(target)) {
    return {
      isLab: false,
      duration: 1,
      startPeriod: pNum,
      endPeriod: pNum,
      periods: [pNum],
      slots: [target],
      day,
      subjectId: target.subjectId || null,
      subjectName: target.subjectName || '',
      subjectCode: target.subjectCode || '',
    };
  }

  const targetSubId = target.subjectId ? target.subjectId.toString() : null;
  const targetCode = target.subjectCode;

  const matchesLab = (s) => {
    if (!s || !isLabSlot(s)) return false;
    if (targetSubId && s.subjectId && s.subjectId.toString() === targetSubId) return true;
    if (targetCode && s.subjectCode === targetCode) return true;
    return false;
  };

  const daySlots = slots.filter((s) => s.day === day);

  // Expand left
  let startP = pNum;
  while (startP > 1) {
    const prev = daySlots.find((s) => s.period === startP - 1);
    if (prev && matchesLab(prev)) {
      startP--;
    } else {
      break;
    }
  }

  // Expand right
  let endP = pNum;
  while (endP < 6) {
    const next = daySlots.find((s) => s.period === endP + 1);
    if (next && matchesLab(next)) {
      endP++;
    } else {
      break;
    }
  }

  const groupSlots = [];
  const periods = [];
  for (let p = startP; p <= endP; p++) {
    const s = daySlots.find((sl) => sl.period === p);
    if (s) {
      groupSlots.push(s);
      periods.push(p);
    }
  }

  return {
    isLab: true,
    duration: groupSlots.length,
    startPeriod: startP,
    endPeriod: endP,
    periods,
    slots: groupSlots,
    day,
    subjectId: target.subjectId || null,
    subjectName: target.subjectName || '',
    subjectCode: target.subjectCode || '',
    roomName: target.roomName || '',
    teacherIds: target.teacherIds || [],
    teacherNames: target.teacherNames || [],
  };
}

function resolveLabStartPeriod(K, targetDay, period) {
  const p = Number(period);
  if (p + K - 1 > 6) {
    const adjusted = 7 - K;
    return adjusted >= 1 ? adjusted : p;
  }
  return p;
}

/**
 * Validate whether a laboratory block of duration K can be moved to targetDay starting at targetStartPeriod.
 */
function validateLabBlockDestination({ labGroup, targetDay, targetStartPeriod, allSlots }) {
  const K = labGroup.duration;
  const resolvedStart = resolveLabStartPeriod(K, targetDay, targetStartPeriod);
  const targetEndPeriod = resolvedStart + K - 1;

  // 1. Period bounds check
  if (targetEndPeriod > 6) {
    return {
      valid: false,
      message: `Destination periods [P${resolvedStart}–P${targetEndPeriod}] exceed maximum period 6 for the day.`,
    };
  }
  if (resolvedStart < 1) {
    return {
      valid: false,
      message: `Destination start period P${resolvedStart} is invalid (must be >= 1).`,
    };
  }

  // 2. Lunch break crossing check
  // Mon-Thu: Lunch is between Period 3 and Period 4
  if (targetDay !== 'Friday') {
    if (resolvedStart <= 3 && targetEndPeriod >= 4) {
      return {
        valid: false,
        message: `Laboratory session cannot cross lunch break (periods [P${resolvedStart}–P${targetEndPeriod}] span across lunch between P3 and P4).`,
      };
    }
  } else {
    // Friday: Jum'ah / Lunch interval is between Period 4 and Period 5 (or P3/P4)
    if (resolvedStart <= 4 && targetEndPeriod >= 5) {
      return {
        valid: false,
        message: `Laboratory session cannot cross Friday prayer/lunch interval (periods [P${resolvedStart}–P${targetEndPeriod}] span across prayer break).`,
      };
    }

    // Friday P3 prohibition for 3-period labs (except S8 Project Phase-2)
    const isProject = ['CST416', 'CSD416'].includes(labGroup.subjectCode) ||
      (labGroup.subjectName && /project phase/i.test(labGroup.subjectName));
    if (K >= 3 && !isProject) {
      return {
        valid: false,
        message: `3-period laboratory session cannot be scheduled on Friday (50-minute periods; prohibited by academic timetable policy).`,
      };
    }
  }

  // 3. Inspect destination slots in this class
  const destPeriods = [];
  const destSlots = [];
  for (let p = resolvedStart; p <= targetEndPeriod; p++) {
    const s = allSlots.find((sl) => sl.day === targetDay && sl.period === p);
    if (!s) {
      return {
        valid: false,
        message: `Destination slot not found for ${targetDay} Period ${p}.`,
      };
    }
    if (s.isBreak) {
      return {
        valid: false,
        message: `Cannot swap into break slot at ${targetDay} Period ${p}.`,
      };
    }
    if (s.isLocked) {
      return {
        valid: false,
        message: `Cannot swap: destination block contains locked slot at ${targetDay} Period ${p}. Unlock it first.`,
      };
    }
    if (isLabSlot(s)) {
      return {
        valid: false,
        message: `Destination block overlaps with another laboratory session (${s.subjectName || s.subjectCode}). Use lab-to-lab swap instead.`,
      };
    }
    destPeriods.push(p);
    destSlots.push(s);
  }

  return {
    valid: true,
    destPeriods,
    destSlots,
  };
}

/**
 * Deep copy of slot contents excluding spatial coordinates day, period, and _id.
 */
function extractSlotPayload(slot) {
  if (!slot) return {};
  const obj = slot.toObject ? slot.toObject() : { ...slot };
  delete obj.day;
  delete obj.period;
  delete obj._id;
  return obj;
}

/**
 * Apply atomic swap between two sets of equal-length slots.
 */
function applyAtomicSlotSwap(slotsA, slotsB, isALab = false, isBLab = false) {
  if (slotsA.length !== slotsB.length) {
    throw new Error(`Cannot swap slot arrays of unequal length (${slotsA.length} vs ${slotsB.length})`);
  }

  for (let i = 0; i < slotsA.length; i++) {
    const sA = slotsA[i];
    const sB = slotsB[i];

    const payloadA = extractSlotPayload(sA);
    const payloadB = extractSlotPayload(sB);

    const dayA = sA.day;
    const periodA = sA.period;

    const dayB = sB.day;
    const periodB = sB.period;

    // Apply payloadB to slotA position
    Object.assign(sA, payloadB, {
      day: dayA,
      period: periodA,
      isLabBlock: isBLab,
      labBlockIndex: isBLab ? i : 0,
    });

    // Apply payloadA to slotB position
    Object.assign(sB, payloadA, {
      day: dayB,
      period: periodB,
      isLabBlock: isALab,
      labBlockIndex: isALab ? i : 0,
    });
  }
}

module.exports = {
  isLabSlot,
  findLabGroup,
  resolveLabStartPeriod,
  validateLabBlockDestination,
  extractSlotPayload,
  applyAtomicSlotSwap,
};
