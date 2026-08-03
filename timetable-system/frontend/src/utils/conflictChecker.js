export const checkSlotConflict = (timetable, sourceSlot, targetSlot) => {
  if (!timetable || !timetable.classTimetables) return null;
  if (!sourceSlot || sourceSlot.isEmpty || sourceSlot.isBreak) return null;
  if (!targetSlot) return null;

  const targetDay = targetSlot.day;
  const targetPeriod = targetSlot.period;
  const sourceTeachers = sourceSlot.teacherNames || [];
  const sourceTeacherIds = (sourceSlot.teacherIds || []).map((id) => id.toString());

  if (sourceTeacherIds.length === 0) return null;

  for (const ct of timetable.classTimetables) {
    for (const slot of ct.slots) {
      if (slot.isBreak || slot.isEmpty) continue;
      if (slot.day === targetDay && slot.period === targetPeriod) {
        // Exclude the source slot itself if in same class
        if (
          ct.classId?.toString() === sourceSlot.classId?.toString() &&
          slot.period === sourceSlot.period &&
          slot.day === sourceSlot.day
        ) {
          continue;
        }

        const slotTeacherIds = (slot.teacherIds || []).map((id) => id.toString());
        const conflictingTeacherId = sourceTeacherIds.find((id) => slotTeacherIds.includes(id));

        if (conflictingTeacherId) {
          const teacherName = sourceTeachers[0] || 'Teacher';
          return {
            teacherName,
            subjectName: slot.subjectName,
            className: ct.className,
            day: targetDay,
            period: targetPeriod,
            message: `${teacherName} is already teaching "${slot.subjectName}" to ${ct.className} on ${targetDay} Period ${targetPeriod}.`,
          };
        }
      }
    }
  }

  return null;
};
