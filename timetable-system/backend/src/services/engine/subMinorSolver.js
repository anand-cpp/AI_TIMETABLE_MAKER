
function arePeriodsConsecutiveWithoutRest(p1, p2, day) {
  if (p2 !== p1 + 1) return false;
  if (day === 'Friday') {
    if (p1 === 4 && p2 === 5) return false;
  } else {
    if (p1 === 3 && p2 === 4) return false;
  }
  return true;
}

/**
 * Sub-Minor Permutation Constraint Solver
 *
 * Distributes configured sub-minor subjects across the 4 fixed minor periods:
 * - Monday Period 3
 * - Thursday Period 3
 * - Friday Period 4
 * - Friday Period 6
 *
 * Solves joint allocation across sections (e.g. S4 CSE A and S4 CSE B) to ensure:
 * 1. Zero teacher collisions (if the same faculty teaches both sections, they are placed in different slots)
 * 2. Teacher availability constraints (no scheduled slot overlaps with teacher unavailability)
 * 3. External commitments (faculty not teaching elsewhere at that slot in the active grid)
 * 4. Deterministic, mathematically verified assignment.
 */

const DEFAULT_FIXED_SLOTS = [
  { day: 'Monday', period: 3, label: 'Monday Period 3 (11:20 AM - 12:20 PM)' },
  { day: 'Thursday', period: 3, label: 'Thursday Period 3 (11:20 AM - 12:20 PM)' },
  { day: 'Friday', period: 4, label: 'Friday Period 4 (12:00 PM - 12:50 PM)' },
  { day: 'Friday', period: 6, label: 'Friday Period 6 (03:30 PM - 04:20 PM)' },
];

/**
 * Generate all unique permutations of an array
 */
function getPermutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  const seen = new Set();

  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const key = `${current.subjectCode || current.subjectName}_${(current.teacherIds || []).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = getPermutations(remaining);
    for (const p of perms) {
      result.push([current, ...p]);
    }
  }
  return result;
}

/**
 * Validates a class's sub-minor configuration
 */
function validateSubMinorConfig(subMinors) {
  if (!Array.isArray(subMinors) || subMinors.length === 0) {
    return { valid: false, message: 'No sub-minor subjects configured.' };
  }

  let totalHours = 0;
  for (let idx = 0; idx < subMinors.length; idx++) {
    const sm = subMinors[idx];
    if (!sm.subjectName || !sm.subjectName.trim()) {
      return { valid: false, message: `Subject at index ${idx + 1} is missing a name.` };
    }
    const hours = Number(sm.weeklyHours) || 0;
    if (hours < 1) {
      return { valid: false, message: `Subject "${sm.subjectName}" must have at least 1 weekly hour.` };
    }
    totalHours += hours;
  }

  if (totalHours !== 4) {
    return {
      valid: false,
      message: `Total sub-minor weekly hours must equal exactly 4 hours (currently ${totalHours}h).`,
      totalHours,
    };
  }

  return { valid: true, totalHours };
}

/**
 * Solves the sub-minor allocation problem across all class configurations
 *
 * @param {Array} classConfigs - Array of { classId, className, section, subMinors }
 * @param {Array} [fixedSlots] - Array of { day, period }
 * @param {Object} [context] - { teacherMap, grid, classMap }
 * @returns {Object} { success, allocationsByClass, totalPermutationsEvaluated, errors }
 */
function solveSubMinorAllocation(classConfigs, fixedSlots = DEFAULT_FIXED_SLOTS, context = {}) {
  const { teacherMap = {}, grid = null } = context;
  const targetSlots = fixedSlots.slice(0, 4);

  if (targetSlots.length !== 4) {
    return {
      success: false,
      error: `Fixed slots must have exactly 4 periods (received ${targetSlots.length}).`,
    };
  }

  // 1. Validate each class configuration
  const classUnitsMap = {};
  for (const cfg of classConfigs) {
    const validation = validateSubMinorConfig(cfg.subMinors);
    if (!validation.valid) {
      return {
        success: false,
        error: `Class "${cfg.className || cfg.section || cfg.classId}": ${validation.message}`,
      };
    }

    // Expand sub-minors into 4 1-hour units
    const units = [];
    for (const sm of cfg.subMinors) {
      const hours = Number(sm.weeklyHours) || 1;
      for (let h = 0; h < hours; h++) {
        units.push({
          subjectId: sm.subjectId || null,
          subjectCode: sm.subjectCode || '',
          subjectName: sm.subjectName.trim(),
          teacherIds: Array.isArray(sm.teacherIds) ? sm.teacherIds.map(t => (t._id ? t._id.toString() : t.toString())) : [],
          teacherNames: Array.isArray(sm.teacherNames) ? sm.teacherNames : [],
          roomName: sm.roomName || 'Classroom',
          unitIndex: h,
        });
      }
    }
    classUnitsMap[(cfg.classId?._id ? cfg.classId._id.toString() : cfg.classId.toString())] = units;
  }

  // 2. Generate permutations for each class
  const classCandidatesMap = {};
  for (const cfg of classConfigs) {
    const classIdStr = (cfg.classId?._id ? cfg.classId._id.toString() : cfg.classId.toString());
    const units = classUnitsMap[classIdStr];
    const perms = getPermutations(units);

    // Filter permutations that violate teacher unavailability or external grid commitments
    const viablePerms = [];
    for (const perm of perms) {
      let isViable = true;
      for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
        const slot = targetSlots[slotIdx];
        const assignedUnit = perm[slotIdx];

        // Check teacher availability
        for (const tId of assignedUnit.teacherIds) {
          const teacher = teacherMap[tId];
          if (teacher && teacher.unavailability) {
            const isUnavail = teacher.unavailability.some(
              u => u.day === slot.day && Number(u.period) === Number(slot.period)
            );
            if (isUnavail) {
              isViable = false;
              break;
            }
          }

          // Check if teacher is busy elsewhere in the grid & rest gaps
          if (grid) {
            const teacherPeriodsOnDay = [];
            for (const [otherClassId, daySlots] of Object.entries(grid)) {
              for (const [pStr, otherSlot] of Object.entries(daySlots?.[slot.day] || {})) {
                if (otherSlot && !otherSlot.isEmpty && !otherSlot.isBreak) {
                  if (otherSlot.teacherIds && otherSlot.teacherIds.includes(tId)) {
                    if (Number(pStr) === Number(slot.period)) {
                      isViable = false;
                      break;
                    }
                    teacherPeriodsOnDay.push(Number(pStr));
                  }
                }
              }
              if (!isViable) break;
            }
            if (!isViable) break;

            // Rest-gap check: guarantee no > 2 consecutive teaching periods
            teacherPeriodsOnDay.push(Number(slot.period));
            const sorted = [...new Set(teacherPeriodsOnDay)].sort((a, b) => a - b);
            let run = 0;
            let last = null;
            for (const cp of sorted) {
              if (last !== null && arePeriodsConsecutiveWithoutRest(last, cp, slot.day)) {
                run++;
              } else {
                run = 1;
              }
              last = cp;
              if (run > 2) {
                isViable = false;
                break;
            if (!isViable) break;
          }
            }
          }
          if (!isViable) break;
        }
        if (!isViable) break;
      }

      if (isViable) {
        viablePerms.push(perm);
      }
    }

    if (viablePerms.length === 0) {
      return {
        success: false,
        error: `Could not find a conflict-free slot combination for class ${cfg.className || cfg.section} due to teacher unavailability or existing commitments.`,
      };
    }

    classCandidatesMap[classIdStr] = viablePerms;
  }

  // 3. Joint backtracking search across all classes to guarantee 0 teacher collisions
  const classIds = classConfigs.map(c => (c.classId?._id ? c.classId._id.toString() : c.classId.toString()));
  let solution = null;
  let evaluations = 0;

  function search(classIdx, currentAssignment) {
    if (classIdx >= classIds.length) {
      solution = { ...currentAssignment };
      return true;
    }

    const currentClassId = classIds[classIdx];
    const candidatePerms = classCandidatesMap[currentClassId];

    for (const perm of candidatePerms) {
      evaluations++;
      // Check collision with already assigned classes in currentAssignment
      let hasCollision = false;

      for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
        const currentTeachers = perm[slotIdx].teacherIds;
        if (!currentTeachers || currentTeachers.length === 0) continue;

        for (let prevIdx = 0; prevIdx < classIdx; prevIdx++) {
          const prevClassId = classIds[prevIdx];
          const prevPerm = currentAssignment[prevClassId];
          const prevTeachers = prevPerm[slotIdx].teacherIds;

          if (!prevTeachers || prevTeachers.length === 0) continue;

          // Check intersection
          const collision = currentTeachers.some(tId => prevTeachers.includes(tId));
          if (collision) {
            hasCollision = true;
            break;
          }
        }
        if (hasCollision) break;
      }

      if (!hasCollision) {
        currentAssignment[currentClassId] = perm;
        if (search(classIdx + 1, currentAssignment)) {
          return true;
        }
        delete currentAssignment[currentClassId];
      }
    }

    return false;
  }

  const found = search(0, {});

  if (!found || !solution) {
    return {
      success: false,
      totalPermutationsEvaluated: evaluations,
      error: 'Joint assignment failed: Faculty collision detected between classes (e.g. shared teacher assigned to both classes cannot be scheduled at the same slot in both sections). Please ensure different teachers or check subject requirements.',
    };
  }

  // 4. Construct authoritative allocationsByClass
  const allocationsByClass = {};
  for (const cfg of classConfigs) {
    const classIdStr = (cfg.classId?._id ? cfg.classId._id.toString() : cfg.classId.toString());
    const assignedPerm = solution[classIdStr];
    const allocatedSlots = [];

    for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
      const slot = targetSlots[slotIdx];
      const unit = assignedPerm[slotIdx];
      allocatedSlots.push({
        day: slot.day,
        period: slot.period,
        subjectId: unit.subjectId,
        subjectCode: unit.subjectCode,
        subjectName: unit.subjectName,
        teacherIds: unit.teacherIds,
        teacherNames: unit.teacherNames,
        roomName: unit.roomName || 'Classroom',
      });
    }

    allocationsByClass[classIdStr] = allocatedSlots;
  }

  return {
    success: true,
    allocationsByClass,
    totalPermutationsEvaluated: evaluations,
    fixedSlots: targetSlots,
  };
}

module.exports = {
  DEFAULT_FIXED_SLOTS,
  validateSubMinorConfig,
  getPermutations,
  solveSubMinorAllocation,
};
