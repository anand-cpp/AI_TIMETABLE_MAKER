/**
 * Timetable Slot Conflict Checker
 * Validates whether swapping or moving a slot introduces a teacher double-booking
 * across all classes in the active timetable.
 */
export const checkSlotConflict = (timetable, sourceSlot, targetSlot, currentClassId = null) => {
  if (!timetable || !timetable.classTimetables) return null;
  if (!sourceSlot || !targetSlot) return null;

  const classIdStr = (currentClassId || sourceSlot.classId || '').toString();

  // Check Direction 1: sourceSlot placed at targetSlot (day, period)
  if (!sourceSlot.isEmpty && !sourceSlot.isBreak && (sourceSlot.teacherIds || []).length > 0) {
    const srcTids = (sourceSlot.teacherIds || []).map((id) => id.toString());
    for (const ct of timetable.classTimetables) {
      const isSameClass = classIdStr && ct.classId?.toString() === classIdStr;
      if (isSameClass) continue; // In current class, target slot will be displaced

      for (const slot of ct.slots || []) {
        if (slot.isBreak || slot.isEmpty) continue;
        if (slot.day === targetSlot.day && slot.period === targetSlot.period) {
          const slotTids = (slot.teacherIds || []).map((id) => id.toString());
          const match = srcTids.find((id) => slotTids.includes(id));
          if (match) {
            const teacherName = sourceSlot.teacherNames?.[0] || 'Faculty';
            return {
              teacherName,
              subjectName: slot.subjectName,
              className: ct.className,
              day: targetSlot.day,
              period: targetSlot.period,
              message: `Swap rejected: ${teacherName} is already teaching "${slot.subjectName}" to ${ct.className} on ${targetSlot.day} Period ${targetSlot.period}.`,
            };
          }
        }
      }
    }
  }

  // Check Direction 2: targetSlot placed at sourceSlot (day, period)
  if (!targetSlot.isEmpty && !targetSlot.isBreak && (targetSlot.teacherIds || []).length > 0) {
    const dstTids = (targetSlot.teacherIds || []).map((id) => id.toString());
    for (const ct of timetable.classTimetables) {
      const isSameClass = classIdStr && ct.classId?.toString() === classIdStr;
      if (isSameClass) continue;

      for (const slot of ct.slots || []) {
        if (slot.isBreak || slot.isEmpty) continue;
        if (slot.day === sourceSlot.day && slot.period === sourceSlot.period) {
          const slotTids = (slot.teacherIds || []).map((id) => id.toString());
          const match = dstTids.find((id) => slotTids.includes(id));
          if (match) {
            const teacherName = targetSlot.teacherNames?.[0] || 'Faculty';
            return {
              teacherName,
              subjectName: slot.subjectName,
              className: ct.className,
              day: sourceSlot.day,
              period: sourceSlot.period,
              message: `Swap rejected: ${teacherName} is already teaching "${slot.subjectName}" to ${ct.className} on ${sourceSlot.day} Period ${sourceSlot.period}.`,
            };
          }
        }
      }
    }
  }

  return null;
};

export default checkSlotConflict;
