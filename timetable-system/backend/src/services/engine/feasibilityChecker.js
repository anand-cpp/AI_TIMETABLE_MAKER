const { crossesBreak } = require('../../utils/timeHelpers');

/**
 * Feasibility Checker - ASET 2026-27 EVEN Semester
 * Supports: P2, P3 (Mon-Thu only), P6 (2×P3), Co-instructors, Lab 3/4 rooms, Friday separate timeline
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

    // Count total periods needed (L + T + P + R)
    let totalPeriodsNeeded = 0;
    for (const subject of classSubjects) {
      totalPeriodsNeeded += (subject.L || 0) + (subject.T || 0) + (subject.P || 0) + (subject.R || 0);
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
        const P = subject.P || subject.labDetails?.duration || 0;
        if (P === 0) {
          errors.push(`${subLabel}: lab has no P (practical) hours specified`);
          continue;
        }

        const isP6 = P >= 6;
        const blockDuration = isP6 ? 3 : P;
        const numBlocks = isP6 ? 2 : 1;

        // Check lab block doesn't cross breaks for any day (Mon-Thu only for 3-period)
        let hasValidSlot = false;
        for (const day of workingDays) {
          // Friday P3 prohibition
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

        // Lab room check
        const classSem = cls.semester || 0;
        const expectedRoom = classSem === 2 ? 'Lab 3' : (classSem >= 4 ? 'Lab 4' : '');
        if (expectedRoom && subject.labRoom && subject.labRoom !== expectedRoom) {
          warnings.push(`${subLabel}: lab room is ${subject.labRoom} but semester ${classSem} typically uses ${expectedRoom}`);
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

  // ── 4. Teacher overload check (L + T + P + R) ──────────────────────────────────────────────
  const teacherWeeklyLoad = {};

  for (const subject of subjects) {
    const addLoad = (teacherId, periods) => {
      if (!teacherId) return;
      const id = teacherId._id ? teacherId._id.toString() : teacherId.toString();
      teacherWeeklyLoad[id] = (teacherWeeklyLoad[id] || 0) + periods;
    };

    if (subject.type === 'theory') {
      for (const t of subject.teachers || []) {
        addLoad(t, (subject.L || 0) + (subject.T || 0));
      }
    } else if (subject.type === 'lab') {
      const P = subject.P || subject.labDetails?.duration || 0;
      // All teachers (primary + co-instructors) get full P hours
      for (const t of [...(subject.teachers || []), ...(subject.coInstructors || [])]) {
        addLoad(t, P);
      }
    } else if (subject.type === 'elective') {
      if (subject.electiveDetails?.electiveType === 'open') {
        for (const opt of subject.electiveDetails.openElectiveOptions || []) {
          addLoad(opt.teacherId, (subject.L || 0) + (subject.T || 0));
        }
      } else {
        for (const t of subject.teachers || []) {
          addLoad(t, (subject.L || 0) + (subject.T || 0));
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

    const unavailableCount = (teacher.unavailability || []).length;
    const effectiveMax = maxWeeklyPeriods - unavailableCount;
    const teacherMaxWeekly = teacher.maxPeriodsPerWeek || maxWeeklyPeriods;

    if (load > teacherMaxWeekly) {
      errors.push(
        `Teacher ${teacher.name}: assigned ${load} periods/week but max is ${teacherMaxWeekly}`
      );
    } else if (load > effectiveMax) {
      errors.push(
        `Teacher ${teacher.name}: assigned ${load} periods/week but only ${effectiveMax} available (after unavailability)`
      );
    } else if (load > teacherMaxWeekly * 0.8) {
      warnings.push(
        `Teacher ${teacher.name}: heavily loaded with ${load}/${teacherMaxWeekly} periods per week`
      );
    }
  }

  // ── 5. Lab room conflicts ────────────────────────────────────────────────
  const labRoomUsage = {};
  for (const subject of subjects) {
    if (subject.type === 'lab') {
      const room = subject.labRoom || subject.labDetails?.roomName || '';
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

  // ── 6. Lab 3 / Lab 4 capacity check ──────────────────────────────────────
  const lab3Subjects = subjects.filter(s => s.type === 'lab' && (s.labRoom === 'Lab 3' || (s.classId && subjectsByClass[s.classId.toString()]?.[0]?.semester === 2)));
  const lab4Subjects = subjects.filter(s => s.type === 'lab' && (s.labRoom === 'Lab 4' || (s.classId && subjectsByClass[s.classId.toString()]?.[0]?.semester >= 4)));

  // Lab 3: S2 A & B (2 classes)
  if (lab3Subjects.length > workingDays.length * 2) {
    warnings.push(`Lab 3 has ${lab3Subjects.length} lab subjects for S2 (2 classes) - high contention`);
  }
  // Lab 4: S4 A/B, S6 A/B, S8 A/B (6 classes)
  if (lab4Subjects.length > workingDays.length * 3) {
    warnings.push(`Lab 4 has ${lab4Subjects.length} lab subjects for S4/S6/S8 (6 classes) - high contention`);
  }

  // ── 7. Linked elective feasibility ────────────────────────────────────────
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

  // ── 8. Friday separate timeline validation ────────────────────────────────
  if (settings.fridaySeparate) {
    if (!fridayTimeline || fridayTimeline.length === 0) {
      errors.push('Friday separate timeline is enabled but fridayTimeline is empty');
    }
    const friTeachingPeriods = fridayTimeline.filter(p => !p.isBreak).length;
    if (friTeachingPeriods !== 6) {
      warnings.push(`Friday has ${friTeachingPeriods} teaching periods (expected 6)`);
    }
  }

  return {
    feasible: errors.length === 0,
    errors,
    warnings,
  };
};

module.exports = { checkFeasibility };