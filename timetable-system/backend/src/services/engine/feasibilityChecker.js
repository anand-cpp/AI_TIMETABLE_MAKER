const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * Feasibility Checker
 * Runs BEFORE generation to detect impossible constraints
 * Returns { feasible: bool, errors: [], warnings: [] }
 */
const checkFeasibility = (data) => {
  const errors = [];
  const warnings = [];

  const {
    classes,
    subjects,
    teachers,
    teacherMap,
    subjectsByClass,
    workingDays,
    periodsPerDayMap,
    breakPeriodsPerDayMap,
    settings,
    timeline,
    fridayTimeline,
  } = data;

  // ── 1. No classes or subjects ──────────────────────────────────────────────
  if (!classes || classes.length === 0) {
    errors.push('No classes found');
    return { feasible: false, errors, warnings };
  }
  if (!subjects || subjects.length === 0) {
    errors.push('No subjects found');
    return { feasible: false, errors, warnings };
  }

  // ── 2. Per-class subject feasibility ──────────────────────────────────────
  for (const cls of classes) {
    const classId = cls._id.toString();
    const classLabel = `${cls.departmentId?.code || 'UNK'} S${cls.semester}${cls.section}`;
    const classSubjects = subjectsByClass[classId] || [];

    if (classSubjects.length === 0) {
      warnings.push(`Class ${classLabel} has no subjects assigned`);
      continue;
    }

    // Count total teaching periods available per week for this class
    let totalTeachingPeriodsPerWeek = 0;
    for (const day of workingDays) {
      totalTeachingPeriodsPerWeek += (periodsPerDayMap[day] || []).length;
    }

    // Count total periods needed
    let totalPeriodsNeeded = 0;
    for (const subject of classSubjects) {
      if (subject.type === 'theory' || subject.type === 'elective') {
        totalPeriodsNeeded += subject.weeklyHours || 0;
      } else if (subject.type === 'lab') {
        totalPeriodsNeeded += subject.labDetails?.duration || 2;
      }
    }

    if (totalPeriodsNeeded > totalTeachingPeriodsPerWeek) {
      errors.push(
        `Class ${classLabel}: needs ${totalPeriodsNeeded} periods/week but only ${totalTeachingPeriodsPerWeek} teaching periods available`
      );
    }

    // ── 3. Check each subject's teachers exist ─────────────────────────────
    for (const subject of classSubjects) {
      const subLabel = `${classLabel} - ${subject.name}`;

      if (subject.type === 'theory') {
        if (!subject.teachers || subject.teachers.length === 0) {
          errors.push(`${subLabel}: no teacher assigned`);
          continue;
        }
        for (const t of subject.teachers) {
          const teacherId = t._id ? t._id.toString() : t.toString();
          if (!teacherMap[teacherId]) {
            errors.push(`${subLabel}: assigned teacher does not exist`);
          }
        }
      }

      if (subject.type === 'lab') {
        if (!subject.labDetails) {
          errors.push(`${subLabel}: missing lab details`);
          continue;
        }

        const duration = subject.labDetails.duration || 2;

        // Check lab block doesn't cross breaks for any day
        let hasValidSlot = false;
        for (const day of workingDays) {
          const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
          const periods = periodsPerDayMap[day] || [];
          for (const startPeriod of periods) {
            if (!crossesBreak(startPeriod, duration, tl)) {
              hasValidSlot = true;
              break;
            }
          }
          if (hasValidSlot) break;
        }

        if (!hasValidSlot) {
          errors.push(
            `${subLabel}: lab duration ${duration} cannot fit without crossing a break in any day`
          );
        }

        if (subject.labDetails.isBatchSplit) {
          // Batch split needs 2 teachers + 2 rooms
          if (!subject.labDetails.batch1Teacher) {
            errors.push(`${subLabel}: batch-split lab missing batch 1 teacher`);
          }
          if (!subject.labDetails.batch2Teacher) {
            errors.push(`${subLabel}: batch-split lab missing batch 2 teacher`);
          }
          if (!subject.labDetails.batch1Room) {
            errors.push(`${subLabel}: batch-split lab missing batch 1 room`);
          }
          if (!subject.labDetails.batch2Room) {
            errors.push(`${subLabel}: batch-split lab missing batch 2 room`);
          }
        } else {
          if (!subject.teachers || subject.teachers.length === 0) {
            errors.push(`${subLabel}: lab has no teacher assigned`);
          }
          if (!subject.labDetails.roomName) {
            errors.push(`${subLabel}: lab has no room assigned`);
          }
        }
      }

      if (subject.type === 'elective') {
        if (!subject.electiveDetails) {
          errors.push(`${subLabel}: missing elective details`);
          continue;
        }

        if (subject.electiveDetails.electiveType === 'open') {
          const options = subject.electiveDetails.openElectiveOptions || [];
          if (options.length === 0) {
            errors.push(`${subLabel}: open elective has no options`);
          }
          for (const opt of options) {
            if (!opt.teacherId) {
              errors.push(`${subLabel} option '${opt.optionName}': no teacher assigned`);
            }
          }
        }

        if (subject.electiveDetails.electiveType === 'linked') {
          if (!subject.teachers || subject.teachers.length === 0) {
            errors.push(`${subLabel}: linked elective has no teacher assigned`);
          }
        }
      }
    }
  }

  // ── 4. Teacher overload check ──────────────────────────────────────────────
  const teacherWeeklyLoad = {}; // teacherId -> total periods assigned

  for (const subject of subjects) {
    const addLoad = (teacherId, periods) => {
      if (!teacherId) return;
      const id = teacherId._id ? teacherId._id.toString() : teacherId.toString();
      teacherWeeklyLoad[id] = (teacherWeeklyLoad[id] || 0) + periods;
    };

    if (subject.type === 'theory') {
      for (const t of subject.teachers || []) {
        addLoad(t, subject.weeklyHours || 0);
      }
    } else if (subject.type === 'lab') {
      const duration = subject.labDetails?.duration || 2;
      if (subject.labDetails?.isBatchSplit) {
        addLoad(subject.labDetails.batch1Teacher, duration);
        addLoad(subject.labDetails.batch2Teacher, duration);
      } else {
        for (const t of subject.teachers || []) {
          addLoad(t, duration);
        }
      }
    } else if (subject.type === 'elective') {
      if (subject.electiveDetails?.electiveType === 'open') {
        for (const opt of subject.electiveDetails.openElectiveOptions || []) {
          addLoad(opt.teacherId, subject.weeklyHours || 1);
        }
      } else {
        for (const t of subject.teachers || []) {
          addLoad(t, subject.weeklyHours || 0);
        }
      }
    }
  }

  // Calculate max weekly periods available per teacher
  let maxWeeklyPeriods = 0;
  for (const day of workingDays) {
    maxWeeklyPeriods += (periodsPerDayMap[day] || []).length;
  }

  for (const [teacherId, load] of Object.entries(teacherWeeklyLoad)) {
    const teacher = teacherMap[teacherId];
    if (!teacher) continue;

    // Account for unavailability
    const unavailableCount = (teacher.unavailability || []).length;
    const effectiveMax = maxWeeklyPeriods - unavailableCount;

    if (load > effectiveMax) {
      errors.push(
        `Teacher ${teacher.name}: assigned ${load} periods/week but only ${effectiveMax} available (after unavailability)`
      );
    } else if (load > maxWeeklyPeriods * 0.8) {
      warnings.push(
        `Teacher ${teacher.name}: heavily loaded with ${load}/${effectiveMax} periods per week`
      );
    }
  }

  // ── 5. Lab room conflicts (same room used by multiple classes at same time) ─
  // This is a potential issue - just warn about shared lab rooms
  const labRoomUsage = {}; // roomName -> [subjectNames]
  for (const subject of subjects) {
    if (subject.type === 'lab') {
      const room = subject.labDetails?.roomName || '';
      if (room) {
        if (!labRoomUsage[room]) labRoomUsage[room] = [];
        labRoomUsage[room].push(subject.name);
      }
    }
  }

  for (const [room, subjectNames] of Object.entries(labRoomUsage)) {
    if (subjectNames.length > workingDays.length) {
      warnings.push(
        `Lab room '${room}' is used by ${subjectNames.length} subjects — may be difficult to schedule without conflicts`
      );
    }
  }

  // ── 6. Linked elective feasibility ────────────────────────────────────────
  const linkedGroups = {};
  for (const subject of subjects) {
    if (
      subject.type === 'elective' &&
      subject.electiveDetails?.electiveType === 'linked' &&
      subject.electiveDetails?.linkedGroupId
    ) {
      const gid = subject.electiveDetails.linkedGroupId;
      if (!linkedGroups[gid]) linkedGroups[gid] = [];
      linkedGroups[gid].push(subject);
    }
  }

  for (const [gid, groupSubjects] of Object.entries(linkedGroups)) {
    if (groupSubjects.length < 2) {
      warnings.push(`Linked elective group '${gid}' has only 1 subject — needs at least 2 classes`);
    }
  }

  return {
    feasible: errors.length === 0,
    errors,
    warnings,
  };
};

module.exports = { checkFeasibility };