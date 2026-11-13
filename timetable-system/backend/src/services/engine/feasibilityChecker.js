const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * Feasibility Checker - ASET 2026-27 EVEN Semester
 * Six-Period System, 5 working days
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

    // Count student instructional periods needed.
    // For electives, multiple options in the same elective group occupy ONE student timetable slot.
    let totalPeriodsNeeded = 0;
    const seenElectiveGroups = new Set();
    for (const subject of classSubjects) {
      const subHours = subject.weeklyHours || ((subject.L || 0) + (subject.T || 0) + (subject.P || 0));

      if (subject.type === 'elective' || subject.isElective) {
        const egId = subject.electiveDetails?.electiveGroupId?._id
          ? subject.electiveDetails.electiveGroupId._id.toString()
          : (subject.electiveDetails?.electiveGroupId?.toString() || subject.electiveDetails?.linkedGroupId || subject._id.toString());
        if (!seenElectiveGroups.has(egId)) {
          seenElectiveGroups.add(egId);
          totalPeriodsNeeded += subHours;
        }
      } else {
        totalPeriodsNeeded += subHours;
      }
    }

    // Also account for elective groups belonging to this semester & section
    if (Array.isArray(data.electiveGroups)) {
      for (const eg of data.electiveGroups) {
        if (eg.semester === cls.semester && (eg.sections || []).includes(cls.section)) {
          const egId = eg._id ? eg._id.toString() : eg.toString();
          if (!seenElectiveGroups.has(egId)) {
            seenElectiveGroups.add(egId);
            const egHours = Math.max(...(eg.options || []).map(o => o.weeklyHours || 4), 4);
            totalPeriodsNeeded += egHours;
          }
        }
      }
    }

    if (totalPeriodsNeeded > totalTeachingPeriodsPerWeek) {
      const overload = totalPeriodsNeeded - totalTeachingPeriodsPerWeek;
      errors.push(
        `Class ${classLabel}: needs ${totalPeriodsNeeded} periods/week but only ${totalTeachingPeriodsPerWeek} teaching periods available (Overload: +${overload} periods)`
      );
    }

    // ── 3. Check each subject's teachers exist ─────────────────────────────
    for (const subject of classSubjects) {
      const subLabel = `${classLabel} - ${subject.name}`;

      if (subject.type === 'theory') {
        if (!subject.teachers || subject.teachers.length === 0) {
          const isPending = subject.code === 'UCEST206' || subject.code === 'CST468' || subject.isPendingFaculty || subject.name?.includes('Intellectual Property Rights');
          if (isPending) {
            warnings.push(`${subLabel}: no teacher assigned (pending verification)`);
          } else {
            errors.push(`${subLabel}: no teacher assigned`);
          }
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
        const P = subject.P || subject.weeklyHours || subject.labDetails?.duration || 0;
        if (P === 0) {
          errors.push(`${subLabel}: lab has no P (practical) hours specified`);
          continue;
        }

        const room = subject.labRoom || subject.labDetails?.roomName;
        if (!room) {
          errors.push(`${subLabel}: no room assigned`);
        }

        const isP6 = P >= 6;
        const blockDuration = isP6 ? 3 : P;
        const numBlocks = isP6 ? 2 : 1;

        // Check lab block doesn't cross breaks for any day (Mon-Thu only for 3-period)
        let hasValidSlot = false;
        for (const day of workingDays) {
          if (day === 'Friday' && blockDuration >= 3) {
            continue;
          }

          const tl = day === 'Friday' && settings.fridaySeparate ? fridayTimeline : timeline;
          const periods = periodsPerDayMap[day] || [];
          for (const startPeriod of periods) {
            if (!crossesBreak(startPeriod, blockDuration, tl)) {
              let allExist = true;
              for (let p = startPeriod; p < startPeriod + blockDuration; p++) {
                if (!periods.includes(p)) {
                  allExist = false;
                  break;
                }
              }
              if (allExist) {
                hasValidSlot = true;
                break;
              }
            }
          }
          if (hasValidSlot) break;
        }

        if (!hasValidSlot) {
          errors.push(
            `${subLabel}: lab block (${blockDuration} periods × ${numBlocks} blocks) cannot fit without crossing a break on any allowed day`
          );
        }

        // Co-instructor support check
        const allTeachers = [...(subject.teachers || []), ...(subject.coInstructors || [])];
        if (allTeachers.length === 0) {
          errors.push(`${subLabel}: lab has no teacher assigned`);
        }
        for (const t of allTeachers) {
          const teacherId = t._id ? t._id.toString() : t.toString();
          if (!teacherMap[teacherId]) {
            errors.push(`${subLabel}: assigned teacher does not exist`);
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
            const isPending = subject.code === 'CST468' || subject.code === 'UCEST206' || subject.isPendingFaculty || subject.name?.includes('Internet of Things');
            if (isPending) {
              warnings.push(`${subLabel}: linked elective has no teacher assigned (pending verification)`);
            } else {
              errors.push(`${subLabel}: linked elective has no teacher assigned`);
            }
          }
        }
      }
    }
  }

  // ── 4. Teacher overload check (L + T + P + R) ─────────────────────────────
  const teacherWeeklyLoad = {};
  const teacherSubjectCounted = {};

  for (const subject of subjects) {
    const addLoad = (teacherId, periods) => {
      if (!teacherId) return;
      const id = teacherId._id ? teacherId._id.toString() : teacherId.toString();
      const key = `${id}_${subject.code || subject.name}`;
      if (
        subject.code === 'CST416' ||
        subject.code === 'CST404' ||
        subject.name?.includes('Project Phase-2') ||
        subject.name?.includes('Comprehensive Course Viva') ||
        subject.isShared
      ) {
        if (teacherSubjectCounted[key]) return;
        teacherSubjectCounted[key] = true;
      }

      teacherWeeklyLoad[id] = (teacherWeeklyLoad[id] || 0) + periods;
    };


    if (subject.type === 'theory') {
      for (const t of subject.teachers || []) {
        addLoad(t, (subject.L || 0) + (subject.T || 0) || subject.weeklyHours || 0);
      }
    } else if (subject.type === 'lab') {
      const P = subject.P || subject.labDetails?.duration || 0;
      for (const t of [...(subject.teachers || []), ...(subject.coInstructors || [])]) {
        addLoad(t, P);
      }
    } else if (subject.type === 'elective') {
      if (subject.electiveDetails?.electiveType === 'open') {
        for (const opt of subject.electiveDetails.openElectiveOptions || []) {
          addLoad(opt.teacherId, (subject.L || 0) + (subject.T || 0) || subject.weeklyHours || 0);
        }
      } else {
        for (const t of subject.teachers || []) {
          addLoad(t, (subject.L || 0) + (subject.T || 0) || subject.weeklyHours || 0);
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

    const maxAllowed = teacher.maxPeriodsPerWeek || maxWeeklyPeriods;
    if (load > maxWeeklyPeriods) {
      errors.push(
        `Teacher ${teacher.name}: assigned ${load} periods/week but week only has ${maxWeeklyPeriods} teaching periods`
      );
    } else if (load > maxAllowed) {
      warnings.push(
        `Teacher ${teacher.name}: assigned ${load} periods/week which exceeds preference of ${maxAllowed}`
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

  // ── 7. Fixed slot teacher collision check ─────────────────────────────────
  const fixedSlotTeacherUsage = {};
  for (const subject of subjects || []) {
    const fixedSlots = (subject.fixedSlots || []).filter(fs => fs && fs.day && fs.period && fs.isMandatory !== false);
    if (fixedSlots.length === 0) continue;
    const cls = (data.classMap || {})[subject.classId?.toString()];
    const classLabel = cls ? `${cls.departmentId?.code || 'UNK'} S${cls.semester}${cls.section}` : 'UNK';
    const sTeacherIds = (subject.teachers || []).map(t => (t._id ? t._id.toString() : t.toString()));

    for (const fs of fixedSlots) {
      for (const tId of sTeacherIds) {
        const key = `${fs.day}|${fs.period}|${tId}`;
        const tObj = teacherMap[tId];
        const teacherName = tObj?.name || tId;
        if (fixedSlotTeacherUsage[key]) {
          const prev = fixedSlotTeacherUsage[key];
          const isSharedBatchSession = (prev.subjectCode === 'CST416' && subject.code === 'CST416') || (prev.subjectCode === 'CST402' && subject.code === 'CST402');
          if (!isSharedBatchSession) {
            errors.push(
              `Fixed slot conflict: Teacher ${teacherName} is assigned to simultaneous mandatory fixed slots in ${prev.classLabel} (${prev.subjectCode}) and ${classLabel} (${subject.code}) on ${fs.day} P${fs.period}`
            );
          }
        } else {
          fixedSlotTeacherUsage[key] = { classLabel, subjectCode: subject.code };
        }
      }
    }
  }

  return {
    feasible: errors.length === 0,
    errors,
    warnings,
  };
};

module.exports = { checkFeasibility };
