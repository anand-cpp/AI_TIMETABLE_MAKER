/**
 * Independent Validator for Daily Subject Occurrence Limits (Phase 3)
 *
 * Rules:
 * 1. Applicable Minor and Elective theory subjects must occur <= 1 period per day per class.
 * 2. Regular theory subjects must occur <= 1 period per day per class (unless class has < 5 available days e.g. S8).
 * 3. Laboratory / practical blocks are exempt from the 1-period theory limit when configured as a multi-period practical block.
 * 4. CST416 Project Phase-2 authorized blocks are exempt.
 */

function isPhase2Project(slot) {
  if (!slot || slot.isEmpty || slot.isBreak) return false;
  const code = (slot.subjectCode || '').toUpperCase();
  const name = (slot.subjectName || '').toUpperCase();
  return code === 'CST416' || code === 'CSD416' || name.includes('PROJECT PHASE-2') || name.includes('PHASE II');
}

function isLaboratory(slot) {
  if (!slot || slot.isEmpty || slot.isBreak) return false;
  return Boolean(
    slot.isLabBlock ||
    slot.subjectType === 'lab' ||
    slot.subjectType === 'practical' ||
    (Array.isArray(slot.allowedLabs) && slot.allowedLabs.length > 0)
  );
}

function validateDailySubjectLimit(timetableDoc, options = {}) {
  const violations = [];
  const classTimetables = timetableDoc.classTimetables || [];

  for (const ct of classTimetables) {
    const className = ct.className || 'Unknown Class';
    const isS8OrFullProject = className.includes('S8') || Boolean(ct.semester === 8);
    const availableDays = isS8OrFullProject ? 3 : 5;

    // Group non-empty, non-break slots by day
    const dayMap = {};
    for (const slot of (ct.slots || [])) {
      if (slot.isEmpty || slot.isBreak) continue;
      if (!slot.subjectCode && !slot.subjectName && !slot.subjectId) continue;
      const day = slot.day;
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(slot);
    }

    for (const [day, slots] of Object.entries(dayMap)) {
      const subjectSlots = {};

      for (const slot of slots) {
        // Exemption checks:
        if (isPhase2Project(slot) || isLaboratory(slot)) continue;

        // Identity key:
        // For Minor: group by minorSubjectCode or code
        // For Elective: group by electiveGroupId or code
        // For Regular Theory: group by subjectCode
        const isMinor = Boolean(slot.isMinor || slot.subjectType === 'minor');
        const isElective = Boolean(slot.isElective || slot.subjectType === 'elective');

        let key;
        if (isMinor) {
          key = 'MINOR_' + (slot.minorSubjectCode || slot.subjectCode || slot.subjectName || 'SESSION');
        } else if (isElective) {
          key = 'ELECTIVE_' + (slot.electiveGroupId || slot.subjectCode || slot.subjectName);
        } else {
          key = 'THEORY_' + (slot.subjectCode || slot.subjectName || String(slot.subjectId));
        }

        if (!subjectSlots[key]) subjectSlots[key] = [];
        subjectSlots[key].push(slot);
      }

      for (const [key, occurrenceSlots] of Object.entries(subjectSlots)) {
        const first = occurrenceSlots[0];
        const isMinor = Boolean(first.isMinor || first.subjectType === 'minor');
        const isElective = Boolean(first.isElective || first.subjectType === 'elective');

        let maxAllowed = 1;
        if (isS8OrFullProject && !isMinor) {
          // In S8, 4h non-minor/elective theory subjects across 3 days allow max 2 occurrences
          maxAllowed = Math.ceil(4 / availableDays); // 2
        }

        if (occurrenceSlots.length > maxAllowed) {
          const subCode = first.minorSubjectCode || first.subjectCode || '';
          const subName = first.subjectName || subCode || 'Unknown Subject';
          const periods = occurrenceSlots.map(s => s.period).sort((a,b) => a - b);

          violations.push({
            classId: ct.classId,
            className,
            day,
            subjectCode: subCode,
            subjectName: subName,
            isMinor,
            isElective,
            occurrences: occurrenceSlots.length,
            maxAllowed,
            periods,
            message: `${className} on ${day}: '${subName}' (${subCode}) scheduled ${occurrenceSlots.length} times (periods ${periods.join(', ')}). Exceeds daily limit of ${maxAllowed}.`
          });
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violationCount: violations.length,
    violations
  };
}

module.exports = {
  validateDailySubjectLimit,
  isPhase2Project,
  isLaboratory
};
