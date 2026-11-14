const { slotTeacherIds } = require('./constraintValidator');

/**
 * CENTRALIZED GLOBAL TIMETABLE VALIDATOR & PUBLICATION GATE SERVICE
 * 
 * Strict academic integrity enforcement:
 * - One faculty member = Maximum one independent teaching assignment per slot.
 * - Shared teaching is permitted ONLY via explicitly authorized shared sessions
 *   carrying a verified sharedSessionId (synchronized electives or S8 Thu/Fri project).
 * - Matching text fields (subjectCodeA === subjectCodeB) NEVER bypasses collision checks.
 * - Full global inspection across all 9 classes and all faculty members.
 */

const isOccupied = (slot) => Boolean(slot && !slot.isEmpty && !slot.isBreak);

/**
 * Validates a complete timetable grid or persisted timetable document
 * @param {Object} grid - Engine grid or timetable classTimetables array
 * @param {Object} data - Data bundle containing teachers, subjects, classes, electiveGroups
 * @param {Object} options - Validation options
 */
function validateGlobalTimetable(gridOrTimetable, data, options = {}) {
  const { classes = [], teachers = [], subjects = [], electiveGroups = [] } = data;
  
  // Normalize input to engine-style grid { classId: { day: { period: slot } } }
  let grid = {};
  if (gridOrTimetable.classTimetables && Array.isArray(gridOrTimetable.classTimetables)) {
    for (const ct of gridOrTimetable.classTimetables) {
      const cid = (ct.classId?._id || ct.classId || '').toString();
      grid[cid] = {};
      for (const slot of ct.slots || []) {
        if (!grid[cid][slot.day]) grid[cid][slot.day] = {};
        grid[cid][slot.day][slot.period] = slot;
      }
    }
  } else {
    grid = gridOrTimetable;
  }

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const PERIODS = [1, 2, 3, 4, 5, 6];

  const teacherMap = {};
  const teacherNameToId = {};
  for (const t of teachers) {
    const tidStr = t._id.toString();
    teacherMap[tidStr] = t;
    if (t.name) {
      teacherNameToId[t.name.trim().toLowerCase()] = tidStr;
    }
  }

  const getSlotTeacherIds = (slot) => {
    const ids = new Set();
    for (const id of slotTeacherIds(slot)) {
      ids.add(id.toString());
    }
    for (const name of slot.teacherNames || []) {
      const matchId = teacherNameToId[name.trim().toLowerCase()];
      if (matchId) ids.add(matchId);
    }
    return Array.from(ids);
  };

  const classMap = {};
  for (const c of classes) {
    classMap[c._id.toString()] = c;
  }

  const subjectMap = {};
  for (const s of subjects) {
    subjectMap[s._id.toString()] = s;
  }

  const electiveGroupMap = {};
  for (const eg of electiveGroups) {
    electiveGroupMap[eg._id.toString()] = eg;
  }

  const violations = [];
  const report = {
    facultyCollisions: { total: 0, passed: 0, failed: 0, details: [] },
    classCollisions: { total: 0, passed: 0, failed: 0, details: [] },
    electiveChecks: { total: 0, passed: 0, failed: 0, details: [] },
    projectChecks: { total: 0, passed: 0, failed: 0, details: [] },
    laboratoryChecks: { total: 0, passed: 0, failed: 0, details: [] },
    workloadChecks: { total: 0, passed: 0, failed: 0, details: [] },
    persistedChecks: { total: 0, passed: 0, failed: 0, details: [] },
    publicationGate: { passed: false, blockers: [] },
  };

  // -------------------------------------------------------------
  // CATEGORY 1: GLOBAL FACULTY COLLISION VALIDATION
  // -------------------------------------------------------------
  for (const day of DAYS) {
    for (const period of PERIODS) {
      // Map: teacherId -> array of { classId, className, slot }
      const facultyAssignmentsInSlot = {};

      for (const [classId, dayMap] of Object.entries(grid)) {
        const slot = dayMap[day]?.[period];
        if (!isOccupied(slot)) continue;

        const tids = getSlotTeacherIds(slot);
        for (const tid of tids) {
          const tidStr = tid.toString();
          if (!facultyAssignmentsInSlot[tidStr]) facultyAssignmentsInSlot[tidStr] = [];
          facultyAssignmentsInSlot[tidStr].push({
            classId,
            className: classMap[classId]?.name || slot.className || classId,
            slot,
          });
        }
      }

      for (const [tid, assignments] of Object.entries(facultyAssignmentsInSlot)) {
        report.facultyCollisions.total++;
        const teacher = teacherMap[tid];
        const teacherName = teacher?.name || assignments[0]?.slot?.teacherNames?.[0] || tid;

        if (assignments.length === 1) {
          report.facultyCollisions.passed++;
          continue;
        }

        // Multiple assignments in the same time slot: verify explicit shared session authorization
        const firstSlot = assignments[0].slot;
        const sharedSessionId = firstSlot.sharedSessionId;

        let isAuthorized = false;
        let authorizationReason = '';

        if (sharedSessionId) {
          // Check 1: S8 Phase-2 Project authorized shared session
          if (
            sharedSessionId.startsWith('SHARED_S8_PROJECT_') &&
            (day === 'Thursday' || day === 'Friday') &&
            (teacherName.includes('Gunasekaran') || tid === '6aeccf3cbb1e84200c3db02b')
          ) {
            const participatingClasses = assignments.map(a => a.className);
            const isS8Classes = participatingClasses.every(name => name.includes('S8 CSE'));
            if (isS8Classes) {
              isAuthorized = true;
              authorizationReason = 'Authorized S8 Project Phase-2 full-day joint supervision';
            }
          }

          // Check 2: Authorized Synchronized Elective Session
          // Check 3: Authorized Synchronized Minor Session
          if (sharedSessionId.startsWith('SHARED_MINOR_')) {
            const allShareSessionId = assignments.every(a => a.slot.sharedSessionId === sharedSessionId);
            if (allShareSessionId) {
              isAuthorized = true;
              authorizationReason = `Authorized Synchronized Minor session (${sharedSessionId})`;
            }
          }

          if (sharedSessionId.startsWith('SHARED_ELECTIVE_') || sharedSessionId.startsWith('SHARED_OPEN_ELECTIVE_')) {
            const allShareSessionId = assignments.every(a => a.slot.sharedSessionId === sharedSessionId);
            if (allShareSessionId) {
              isAuthorized = true;
              authorizationReason = `Authorized Synchronized Elective session (${sharedSessionId})`;
            }
          }
        }

        if (isAuthorized) {
          report.facultyCollisions.passed++;
        } else {
          report.facultyCollisions.failed++;
          const conflictSummary = assignments.map(a => `${a.className}: ${a.slot.subjectCode || a.slot.subjectName}`).join(' vs ');
          const violationObj = {
            code: 'FACULTY_COLLISION',
            severity: 'hard',
            facultyId: tid,
            facultyName: teacherName,
            day,
            period,
            conflictSummary,
            assignments: assignments.map(a => ({
              classId: a.classId,
              className: a.className,
              subjectCode: a.slot.subjectCode,
              subjectName: a.slot.subjectName,
              sharedSessionId: a.slot.sharedSessionId || null,
            })),
            authorizedSharedElective: false,
            verdict: 'INVALID PROHIBITED FACULTY COLLISION',
            recommendedAction: `Reschedule ${teacherName} so they teach only ONE independent class on ${day} P${period}`,
          };
          violations.push(violationObj);
          report.facultyCollisions.details.push(violationObj);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // CATEGORY 2: CLASS COLLISION VALIDATION
  // -------------------------------------------------------------
  for (const [classId, dayMap] of Object.entries(grid)) {
    const className = classMap[classId]?.name || classId;
    for (const day of DAYS) {
      for (const period of PERIODS) {
        report.classCollisions.total++;
        const slot = dayMap[day]?.[period];
        if (!slot) {
          report.classCollisions.failed++;
          violations.push({
            code: 'CLASS_MISSING_SLOT',
            severity: 'hard',
            classId,
            className,
            day,
            period,
            message: `Class ${className} has no slot entry on ${day} P${period}`,
          });
          continue;
        }

        // Must have at most one activity
        report.classCollisions.passed++;
      }
    }
  }

  // -------------------------------------------------------------
  // CATEGORY 3: S8 PROJECT VALIDATION
  // -------------------------------------------------------------
  const s8Classes = classes.filter(c => (c.name || '').includes('S8 CSE'));
  for (const s8c of s8Classes) {
    const cid = s8c._id.toString();
    const cname = s8c.name;
    const isSecA = s8c.section === 'A' || cname.includes(' A');
    const targetDay = isSecA ? 'Thursday' : 'Friday';

    for (let p = 1; p <= 6; p++) {
      report.projectChecks.total++;
      const slot = grid[cid]?.[targetDay]?.[p];
      const isProject = slot && (slot.subjectCode === 'CST416' || slot.subjectCode === 'CSD416' || slot.subjectName?.includes('Project Phase'));
      const hasGuna = slot && (slot.teacherNames || []).some(n => n.includes('Gunasekaran'));

      if (isProject && hasGuna) {
        report.projectChecks.passed++;
      } else {
        report.projectChecks.failed++;
        violations.push({
          code: 'INVALID_PROJECT_SCHEDULE',
          severity: 'hard',
          classId: cid,
          className: cname,
          day: targetDay,
          period: p,
          message: `S8 Project Phase-2 must be scheduled on ${targetDay} P${p} under Dr. S. Gunasekaran for ${cname}`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // CATEGORY 4: LABORATORY & PRACTICAL CONTINUITY VALIDATION
  // -------------------------------------------------------------
  for (const [classId, dayMap] of Object.entries(grid)) {
    const className = classMap[classId]?.name || classId;
    for (const day of DAYS) {
      let currentLabBlock = [];
      for (let p = 1; p <= 6; p++) {
        const slot = dayMap[day]?.[p];
        if (slot && slot.isLabBlock) {
          currentLabBlock.push({ period: p, slot });
        } else {
          if (currentLabBlock.length > 0) {
            report.laboratoryChecks.total++;
            // Check continuity
            const expectedDuration = currentLabBlock[0].slot.labBlockDuration || currentLabBlock.length;
            if (currentLabBlock.length >= 2 || currentLabBlock[0].slot.subjectCode?.includes('PCCSP')) {
              report.laboratoryChecks.passed++;
            } else {
              report.laboratoryChecks.failed++;
              violations.push({
                code: 'DISCONTINUOUS_LAB_BLOCK',
                severity: 'hard',
                classId,
                className,
                day,
                message: `Lab block in ${className} on ${day} is fragmented`,
              });
            }
            currentLabBlock = [];
          }
        }
      }
      if (currentLabBlock.length > 0) {
        report.laboratoryChecks.total++;
        report.laboratoryChecks.passed++;
      }
    }
  }

  // -------------------------------------------------------------
  // CATEGORY 5: WORKLOAD INTEGRITY CHECKS
  // -------------------------------------------------------------
  for (const cls of classes) {
    const cid = cls._id.toString();
    const classSubs = subjects.filter(
      s => (s.classId?._id || s.classId || '').toString() === cid && !s.isElective && s.type !== 'elective'
    );
    
    for (const sub of classSubs) {
      report.workloadChecks.total++;
      const expectedHours = sub.weeklyHours || (sub.L || 0) + (sub.T || 0) + (sub.P || 0);
      let scheduledHours = 0;

      for (const day of DAYS) {
        for (let p = 1; p <= 6; p++) {
          const slot = grid[cid]?.[day]?.[p];
          if (slot && slot.subjectCode === sub.code) {
            scheduledHours++;
          }
        }
      }

      if (scheduledHours === expectedHours) {
        report.workloadChecks.passed++;
      } else {
        report.workloadChecks.failed++;
        violations.push({
          code: 'WORKLOAD_MISMATCH',
          severity: 'hard',
          classId: cid,
          className: cls.name,
          subjectCode: sub.code,
          expectedHours,
          scheduledHours,
          message: `${sub.code} in ${cls.name}: expected ${expectedHours} hrs, found ${scheduledHours} hrs`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  
  // -------------------------------------------------------------
  // CATEGORY 6: ELECTIVE SYNCHRONIZATION ACROSS PAIRED CLASSES (RULE 1)
  // -------------------------------------------------------------
  for (const eg of electiveGroups) {
    if (!eg.isActive) continue;
    const sem = eg.semester;
    const sections = eg.sections || ['A', 'B'];
    const participatingClasses = classes.filter(c => {
      if (c.semester !== sem) return false;
      if (sections.includes(c.section)) return true;
      if (sections.some(sec => (c.name || '').includes(sec))) return true;
      return false;
    });

    if (participatingClasses.length < 2) continue;

    const classPositions = {};
    for (const cls of participatingClasses) {
      const cid = cls._id.toString();
      classPositions[cid] = new Set();
      const dayMap = grid[cid] || {};
      for (const [day, periodMap] of Object.entries(dayMap)) {
        for (const [pStr, slot] of Object.entries(periodMap)) {
          if (!isOccupied(slot)) continue;
          const isMatch = (
            (slot.isElective && (slot.electiveGroupId === eg._id.toString() || slot.linkedGroupId === eg._id.toString())) ||
            (eg.options && eg.options.some(opt => {
              const optSid = opt.subjectId?._id ? opt.subjectId._id.toString() : opt.subjectId?.toString();
              return optSid && optSid === slot.subjectId?.toString();
            }))
          );
          if (isMatch) {
            classPositions[cid].add(`${day}|${pStr}`);
          }
        }
      }
    }

    const baseCid = participatingClasses[0]._id.toString();
    const baseName = participatingClasses[0].name;
    const baseSet = classPositions[baseCid] || new Set();

    for (let i = 1; i < participatingClasses.length; i++) {
      const otherCid = participatingClasses[i]._id.toString();
      const otherName = participatingClasses[i].name;
      const otherSet = classPositions[otherCid] || new Set();

      for (const pos of baseSet) {
        if (!otherSet.has(pos)) {
          const [d, p] = pos.split('|');
          violations.push({
            type: 'ELECTIVE_DESYNCHRONIZATION',
            code: 'ELECTIVE_DESYNCHRONIZATION',
            severity: 'hard',
            classId: otherCid,
            className: otherName,
            day: d,
            period: Number(p),
            message: `Elective group '${eg.name}' desynchronization: ${baseName} has elective at ${d} P${p}, but ${otherName} does not.`,
          });
        }
      }

      for (const pos of otherSet) {
        if (!baseSet.has(pos)) {
          const [d, p] = pos.split('|');
          violations.push({
            type: 'ELECTIVE_DESYNCHRONIZATION',
            code: 'ELECTIVE_DESYNCHRONIZATION',
            severity: 'hard',
            classId: baseCid,
            className: baseName,
            day: d,
            period: Number(p),
            message: `Elective group '${eg.name}' desynchronization: ${otherName} has elective at ${d} P${p}, but ${baseName} does not.`,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // CATEGORY 7: DAILY SUBJECT UNIQUENESS (RULE 2 & 3)
  // -------------------------------------------------------------
  for (const [classId, dayMap] of Object.entries(grid)) {
    const cls = classMap[classId];
    const className = cls?.name || `Class ${classId}`;

    for (const [day, periodMap] of Object.entries(dayMap)) {
      const subjectSlotsMap = {};

      for (const [periodStr, slot] of Object.entries(periodMap)) {
        if (!isOccupied(slot) || !slot.subjectId) continue;
        const period = Number(periodStr);

        // Check if exempt (Exception A: Phase 2 Project, Exception B: Laboratory)
        const isProject = (slot.subjectCode === 'CSD416' || slot.subjectCode === 'CST416' || (slot.subjectName || '').toLowerCase().includes('project phase') || Boolean(slot.isSharedProject));
        const isLab = (slot.subjectType === 'lab' || slot.isLabBlock || (Array.isArray(slot.allowedLabs) && slot.allowedLabs.length > 0));
        if (isProject || isLab) continue;

        const subjectKey = (slot.isElective && (slot.electiveGroupId || slot.linkedGroupId))
          ? `ELECTIVE_${slot.electiveGroupId || slot.linkedGroupId}`
          : (slot.isMinor || slot.subjectType === 'minor')
          ? `MINOR_${slot.minorGroupId || ''}_${slot.minorSubjectCode || slot.subjectCode || 'SESSION'}`
          : (slot.subjectCode || slot.subjectName || slot.subjectId.toString());

        if (!subjectSlotsMap[subjectKey]) subjectSlotsMap[subjectKey] = [];
        subjectSlotsMap[subjectKey].push({ period, slot });
      }

      const isS8OrFullProjectClass = Boolean(cls?.semester === 8 || (cls?.name || '').includes('S8'));
      const availableDaysCount = isS8OrFullProjectClass ? 3 : 5;
      const maxAllowed = availableDaysCount >= 5 ? 1 : Math.ceil(4 / availableDaysCount);

      for (const [key, slots] of Object.entries(subjectSlotsMap)) {
        if (slots.length > maxAllowed) {
          const subName = slots[0].slot.subjectName || slots[0].slot.subjectCode || key;
          const periods = slots.map(s => s.period);
          violations.push({
            type: 'DAILY_SUBJECT_UNIQUENESS_VIOLATION',
            code: 'DAILY_SUBJECT_UNIQUENESS_VIOLATION',
            severity: 'hard',
            classId,
            className,
            day,
            subjectKey: key,
            periods,
            count: slots.length,
            message: `${className} on ${day}: '${subName}' appears ${slots.length} times (periods ${periods.join(', ')}). Hard constraint: non-exempt subjects may appear only once per day.`,
          });
        }
      }
    }
  }

  // CATEGORY 8: PUBLICATION GATE EVALUATION
  // -------------------------------------------------------------
  const hardViolations = violations.filter(v => v.severity === 'hard');
  const gatePassed = hardViolations.length === 0;

  report.publicationGate.passed = gatePassed;
  report.publicationGate.blockers = hardViolations;

  return {
    valid: gatePassed,
    hardViolationsCount: hardViolations.length,
    softViolationsCount: violations.filter(v => v.severity !== 'hard').length,
    violations,
    report,
  };
}

module.exports = {
  validateGlobalTimetable,
  isOccupied,
};
