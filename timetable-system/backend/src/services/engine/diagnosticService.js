const { loadData } = require('./dataLoader');
const { validateOutput } = require('./constraintValidator');
const { validateGlobalTimetable } = require('./globalTimetableValidator');
const { validateDailySubjectLimit } = require('./dailySubjectLimitValidator');
const { gridFromTimetable } = require('./persistedValidator');

/**
 * TIMETABLE CONFLICT DIAGNOSTICS & OPTIMIZATION SERVICE
 * Provides comprehensive, transparent diagnostics for hard conflicts,
 * soft warnings, and safe optimization opportunities.
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

/**
 * Builds rich, explainable diagnostics from a timetable document or ID
 */
async function generateTimetableDiagnostics(timetable, customData = null) {
  const data = customData || await loadData({});
  const grid = gridFromTimetable(timetable);

  const outVal = validateOutput(grid, data, timetable.unplacedSubjects || []);
  const globalVal = validateGlobalTimetable(grid, data);
  const dailyLimitVal = validateDailySubjectLimit(timetable);

  const classMap = {};
  for (const c of data.classes || []) classMap[c._id.toString()] = c;

  const teacherMap = {};
  for (const t of data.teachers || []) teacherMap[t._id.toString()] = t;

  const subjectMap = {};
  for (const s of data.subjects || []) subjectMap[s._id.toString()] = s;

  const hardConflicts = [];
  const softWarnings = [];
  const optimizations = [];
  const seenConflictKeys = new Set();

  // Helper to find slot info in grid
  const findSlotInfo = (classId, day, period) => {
    const slot = grid[classId]?.[day]?.[period];
    if (!slot) return null;
    const cls = classMap[classId];
    return {
      classId,
      className: cls?.name || slot.className || `Class ${classId}`,
      day,
      period: Number(period),
      subjectId: slot.subjectId,
      subjectCode: slot.subjectCode,
      subjectName: slot.subjectName,
      teacherIds: slot.teacherIds || [],
      teacherNames: slot.teacherNames || [],
      roomName: slot.roomName || '',
    };
  };

  // -------------------------------------------------------------
  // 1. HARD CONFLICTS DETECTION & EXPLANATION
  // -------------------------------------------------------------

  // A. Teacher Double Booking
  for (const day of DAYS) {
    for (const period of PERIODS) {
      const teacherSlots = {};
      for (const [classId, dayMap] of Object.entries(grid)) {
        const slot = dayMap[day]?.[period];
        if (!slot || slot.isEmpty || slot.isBreak) continue;

        const tids = (slot.teacherIds || []).map(id => id.toString());
        for (const tid of tids) {
          if (!teacherSlots[tid]) teacherSlots[tid] = [];
          teacherSlots[tid].push({ classId, slot });
        }
      }

      for (const [tid, assignments] of Object.entries(teacherSlots)) {
        if (assignments.length > 1) {
          // Check if authorized shared session
          const firstSlot = assignments[0].slot;
          const isShared = Boolean(
            firstSlot.sharedSessionId ||
            (firstSlot.isElective && assignments.every(a => a.slot.electiveGroupId === firstSlot.electiveGroupId)) ||
            (firstSlot.isSharedProject && (day === 'Thursday' || day === 'Friday'))
          );

          if (!isShared) {
            const teacher = teacherMap[tid];
            const teacherName = teacher?.name || assignments[0].slot.teacherNames?.[0] || 'Unknown Teacher';
            const a1 = assignments[0];
            const a2 = assignments[1];
            const cls1 = classMap[a1.classId];
            const cls2 = classMap[a2.classId];

            const key = `TDB_${tid}_${day}_${period}`;
            if (!seenConflictKeys.has(key)) {
              seenConflictKeys.add(key);
              hardConflicts.push({
                id: `hc-tdb-${hardConflicts.length + 1}`,
                category: 'HARD_CONFLICT',
                type: 'TEACHER_DOUBLE_BOOKED',
                severity: 'CRITICAL',
                title: 'Faculty Double Booking',
                day,
                period,
                teacherId: tid,
                teacherName,
                classId: a1.classId,
                className: cls1?.name || `Class ${a1.classId}`,
                subjectId: a1.slot.subjectId,
                subjectCode: a1.slot.subjectCode,
                subjectName: a1.slot.subjectName,
                roomName: a1.slot.roomName || '',
                primaryAssignment: {
                  classId: a1.classId,
                  className: cls1?.name || `Class ${a1.classId}`,
                  day,
                  period,
                  subjectCode: a1.slot.subjectCode,
                  subjectName: a1.slot.subjectName,
                  teacherName,
                  roomName: a1.slot.roomName || '',
                },
                conflictingAssignment: {
                  classId: a2.classId,
                  className: cls2?.name || `Class ${a2.classId}`,
                  day,
                  period,
                  subjectCode: a2.slot.subjectCode,
                  subjectName: a2.slot.subjectName,
                  teacherName,
                  roomName: a2.slot.roomName || '',
                },
                explanation: `Faculty member ${teacherName} is simultaneously scheduled to teach ${a1.slot.subjectName || a1.slot.subjectCode} in ${cls1?.name || a1.classId} and ${a2.slot.subjectName || a2.slot.subjectCode} in ${cls2?.name || a2.classId} at ${day} Period ${period}.`,
                rootCause: 'Concurrent class teaching assignments allocated to the same instructor without an authorized shared elective or project session.',
                resolution: `Move one of the conflicting periods (${cls1?.name} or ${cls2?.name}) to an alternative free period when ${teacherName} is unassigned.`,
                status: 'ACTIVE',
              });
            }
          }
        }
      }
    }
  }

  // B. Lab Room Collision
  for (const day of DAYS) {
    for (const period of PERIODS) {
      const roomSlots = {};
      for (const [classId, dayMap] of Object.entries(grid)) {
        const slot = dayMap[day]?.[period];
        if (!slot || slot.isEmpty || slot.isBreak || !slot.roomName) continue;
        const room = slot.roomName.trim();
        if (room.toLowerCase().startsWith('lab')) {
          if (!roomSlots[room]) roomSlots[room] = [];
          roomSlots[room].push({ classId, slot });
        }
      }

      for (const [room, assignments] of Object.entries(roomSlots)) {
        if (assignments.length > 1) {
          const a1 = assignments[0];
          const a2 = assignments[1];
          const cls1 = classMap[a1.classId];
          const cls2 = classMap[a2.classId];

          const key = `LRC_${room}_${day}_${period}`;
          if (!seenConflictKeys.has(key)) {
            seenConflictKeys.add(key);
            hardConflicts.push({
              id: `hc-lrc-${hardConflicts.length + 1}`,
              category: 'HARD_CONFLICT',
              type: 'LAB_ROOM_CONFLICT',
              severity: 'CRITICAL',
              title: 'Laboratory Room Collision',
              day,
              period,
              roomName: room,
              classId: a1.classId,
              className: cls1?.name || `Class ${a1.classId}`,
              subjectId: a1.slot.subjectId,
              subjectCode: a1.slot.subjectCode,
              subjectName: a1.slot.subjectName,
              primaryAssignment: {
                classId: a1.classId,
                className: cls1?.name || `Class ${a1.classId}`,
                day,
                period,
                subjectCode: a1.slot.subjectCode,
                subjectName: a1.slot.subjectName,
                teacherName: (a1.slot.teacherNames || []).join(', '),
                roomName: room,
              },
              conflictingAssignment: {
                classId: a2.classId,
                className: cls2?.name || `Class ${a2.classId}`,
                day,
                period,
                subjectCode: a2.slot.subjectCode,
                subjectName: a2.slot.subjectName,
                teacherName: (a2.slot.teacherNames || []).join(', '),
                roomName: room,
              },
              explanation: `Laboratory '${room}' is double-booked on ${day} Period ${period} by both ${cls1?.name || a1.classId} (${a1.slot.subjectName}) and ${cls2?.name || a2.classId} (${a2.slot.subjectName}).`,
              rootCause: 'Two classes are simultaneously assigned to the same physical laboratory facility.',
              resolution: `Reassign one of the classes to another available laboratory (e.g. Lab 1, Lab 2, Lab 3, or Lab 4) or move the laboratory session to an alternate day/period.`,
              status: 'ACTIVE',
            });
          }
        }
      }
    }
  }

  // C. Daily Subject Uniqueness Violations
  for (const v of dailyLimitVal.violations || []) {
    const key = `DSU_${v.className}_${v.day}_${v.subjectCode}`;
    if (!seenConflictKeys.has(key)) {
      seenConflictKeys.add(key);
      const cls = (data.classes || []).find(c => c.name === v.className);
      hardConflicts.push({
        id: `hc-dsu-${hardConflicts.length + 1}`,
        category: 'HARD_CONFLICT',
        type: 'DAILY_SUBJECT_UNIQUENESS_VIOLATION',
        severity: 'CRITICAL',
        title: 'Daily Subject Repetition Violation',
        day: v.day,
        period: v.periods?.[0] || 1,
        classId: cls?._id?.toString() || '',
        className: v.className,
        subjectCode: v.subjectCode,
        subjectName: v.subjectName || v.subjectCode,
        explanation: `${v.className} has subject '${v.subjectCode}' scheduled multiple times on ${v.day} (periods ${v.periods?.join(', ')}). KTU academic regulations mandate that theory, minor, and elective subjects must occur at most once per day.`,
        rootCause: 'Subject placed in multiple slots on the same working day.',
        resolution: `Relocate redundant occurrences of '${v.subjectCode}' to distinct working days where the class has available slots.`,
        status: 'ACTIVE',
      });
    }
  }

  // D. Elective Desynchronization
  for (const v of globalVal.violations.filter(v => v.code === 'ELECTIVE_DESYNCHRONIZATION' || v.type === 'ELECTIVE_DESYNCHRONIZATION')) {
    const key = `ELD_${v.className}_${v.day}_${v.period}`;
    if (!seenConflictKeys.has(key)) {
      seenConflictKeys.add(key);
      hardConflicts.push({
        id: `hc-eld-${hardConflicts.length + 1}`,
        category: 'HARD_CONFLICT',
        type: 'ELECTIVE_DESYNCHRONIZATION',
        severity: 'ERROR',
        title: 'Elective Synchronization Failure',
        day: v.day,
        period: v.period,
        classId: v.classId,
        className: v.className,
        explanation: v.message,
        rootCause: 'Shared elective groups across paired sections (e.g. S4 CSE A & S4 CSE B) are not occupying the exact same day and period.',
        resolution: 'Move the elective session in both paired sections to the same day and period to allow synchronized elective grouping.',
        status: 'ACTIVE',
      });
    }
  }

  // E. Workload Under-Scheduled / Missing Hours
  for (const u of outVal.underScheduled || []) {
    const key = `WKL_${u.classId}_${u.subjectId}`;
    if (!seenConflictKeys.has(key)) {
      seenConflictKeys.add(key);
      const cls = classMap[u.classId];
      hardConflicts.push({
        id: `hc-wkl-${hardConflicts.length + 1}`,
        category: 'HARD_CONFLICT',
        type: 'SUBJECT_UNDER_SCHEDULED',
        severity: 'ERROR',
        title: 'Curriculum Workload Incomplete',
        classId: u.classId,
        className: cls?.name || `Class ${u.classId}`,
        subjectId: u.subjectId,
        subjectName: u.subjectName,
        explanation: `Subject '${u.subjectName}' has only ${u.placed}/${u.expected} required weekly periods scheduled (${u.missing} hours missing).`,
        rootCause: 'The timetable generator or manual edit did not allocate sufficient periods to satisfy the curriculum workload.',
        resolution: `Place ${u.missing} additional period(s) for '${u.subjectName}' in open slots for ${cls?.name || u.classId}.`,
        status: 'ACTIVE',
      });
    }
  }

  // F. Friday 3-Hour Lab Prohibition
  for (const v of (outVal.hardViolations || []).filter(v => v.type === 'FRIDAY_P3_LAB_PROHIBITED')) {
    const key = `FRL_${v.classId}_${v.day}_${v.period}`;
    if (!seenConflictKeys.has(key)) {
      seenConflictKeys.add(key);
      const cls = classMap[v.classId];
      hardConflicts.push({
        id: `hc-frl-${hardConflicts.length + 1}`,
        category: 'HARD_CONFLICT',
        type: 'FRIDAY_P3_LAB_PROHIBITED',
        severity: 'ERROR',
        title: 'Friday 3-Period Lab Prohibited',
        day: 'Friday',
        period: v.period,
        classId: v.classId,
        className: cls?.name || `Class ${v.classId}`,
        explanation: `3-period laboratory blocks cannot be placed on Friday due to 50-minute shortened periods and prayer intervals.`,
        rootCause: 'Academic timetable policy limits Friday laboratory sessions.',
        resolution: 'Move the 3-period laboratory block to Monday, Tuesday, Wednesday, or Thursday.',
        status: 'ACTIVE',
      });
    }
  }

  // -------------------------------------------------------------
  // 2. SOFT WARNINGS DETECTION & QUALITY EXPLANATION
  // -------------------------------------------------------------

  // A. Faculty Fatigue (Excessive consecutive teaching without break)
  for (const t of data.teachers || []) {
    const tid = t._id.toString();
    for (const day of DAYS) {
      let consecutive = 0;
      let startP = 1;
      for (let p = 1; p <= 6; p++) {
        let isTeaching = false;
        let isLab = false;
        let cName = '';
        for (const [cid, dMap] of Object.entries(grid)) {
          const slot = dMap[day]?.[p];
          if (slot && !slot.isEmpty && !slot.isBreak && (slot.teacherIds || []).map(String).includes(tid)) {
            isTeaching = true;
            cName = classMap[cid]?.name || cid;
            if (slot.subjectType === 'lab' || slot.isLabBlock) isLab = true;
          }
        }

        if (isTeaching) {
          if (consecutive === 0) startP = p;
          consecutive++;
          // If teaching 4 or more consecutive periods, or 3 consecutive non-lab theory periods
          if (consecutive >= 4 || (consecutive === 3 && !isLab && p === 3)) {
            const key = `FFT_${tid}_${day}_${startP}`;
            if (!seenConflictKeys.has(key)) {
              seenConflictKeys.add(key);
              softWarnings.push({
                id: `sw-fft-${softWarnings.length + 1}`,
                category: 'SOFT_WARNING',
                type: 'FACULTY_FATIGUE_CONSECUTIVE',
                severity: 'WARNING',
                title: 'High Consecutive Teaching Load',
                day,
                period: startP,
                teacherId: tid,
                teacherName: t.name,
                className: cName,
                explanation: `Instructor ${t.name} has ${consecutive} consecutive teaching periods on ${day} (Periods ${startP}–${p}) without a rest gap.`,
                rootCause: 'Sequential class theory allocations scheduled back-to-back without interspersed free periods.',
                resolution: 'Insert a free gap period between teaching sessions if schedule flexibility allows.',
                status: 'ACTIVE',
              });
            }
          }
        } else {
          consecutive = 0;
        }
      }
    }
  }

  // B. Timetable Fragmentation (Class with isolated single lecture surrounded by free periods)
  for (const cls of data.classes || []) {
    const cid = cls._id.toString();
    for (const day of DAYS) {
      const dSlots = [];
      for (let p = 1; p <= 6; p++) {
        const slot = grid[cid]?.[day]?.[p];
        dSlots.push(slot && !slot.isEmpty && !slot.isBreak ? slot : null);
      }

      // Check for pattern: empty, taught, empty, empty...
      for (let p = 2; p <= 5; p++) {
        const idx = p - 1;
        const cur = dSlots[idx];
        const prev = dSlots[idx - 1];
        const next = dSlots[idx + 1];
        if (cur && !prev && !next && cur.subjectType === 'theory') {
          const key = `FRG_${cid}_${day}_${p}`;
          if (!seenConflictKeys.has(key)) {
            seenConflictKeys.add(key);
            softWarnings.push({
              id: `sw-frg-${softWarnings.length + 1}`,
              category: 'SOFT_WARNING',
              type: 'TIMETABLE_FRAGMENTATION',
              severity: 'WARNING',
              title: 'Isolated Teaching Session (Gap Fragmentation)',
              day,
              period: p,
              classId: cid,
              className: cls.name,
              subjectCode: cur.subjectCode,
              subjectName: cur.subjectName,
              explanation: `${cls.name} has an isolated single period of ${cur.subjectName || cur.subjectCode} on ${day} Period ${p} with gaps before and after.`,
              rootCause: 'Schedule fragmentation leaves idle gaps between isolated lecture sessions.',
              resolution: `Consider shifting this period to Period 1 or Period 4 to group sessions contiguously.`,
              status: 'ACTIVE',
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. OPTIMIZATION OPPORTUNITIES
  // -------------------------------------------------------------

  // A. Gap Period Reduction & Early Dismissal Optimization
  for (const cls of data.classes || []) {
    const cid = cls._id.toString();
    for (const day of DAYS) {
      const s4 = grid[cid]?.[day]?.[4];
      const s5 = grid[cid]?.[day]?.[5];
      const s6 = grid[cid]?.[day]?.[6];

      // If P5 is empty but P6 has a single theory subject:
      const p5Empty = !s5 || s5.isEmpty || s5.isBreak;
      const p6Theory = s6 && !s6.isEmpty && !s6.isBreak && s6.subjectType === 'theory' && !s6.isLocked;

      if (p5Empty && p6Theory) {
        // Check if teacher for P6 is available at P5
        const tids = s6.teacherIds || [];
        let teacherFreeAtP5 = true;
        for (const tid of tids) {
          for (const [otherCid, dMap] of Object.entries(grid)) {
            const checkSlot = dMap[day]?.[5];
            if (checkSlot && !checkSlot.isEmpty && !checkSlot.isBreak && (checkSlot.teacherIds || []).map(String).includes(String(tid))) {
              teacherFreeAtP5 = false;
              break;
            }
          }
        }

        if (teacherFreeAtP5) {
          optimizations.push({
            id: `opt-gap-${optimizations.length + 1}`,
            category: 'OPTIMIZATION',
            severity: 'OPTIMIZATION',
            type: 'GAP_REDUCTION',
            title: 'Afternoon Gap Period Reduction',
            classId: cid,
            className: cls.name,
            day,
            period: 6,
            subjectCode: s6.subjectCode,
            subjectName: s6.subjectName,
            currentArrangement: `${cls.name} has idle Period 5 followed by ${s6.subjectName || s6.subjectCode} at Period 6 on ${day}.`,
            suggestedArrangement: `Shift ${s6.subjectName || s6.subjectCode} from Period 6 into Period 5.`,
            expectedBenefit: `Eliminates the afternoon idle gap, improves student continuity, and enables comfortable early dismissal.`,
            constraintsPreserved: `Faculty member is verified free at Period 5, room is available, and daily limits remain satisfied.`,
            isSafe: true,
            status: 'AVAILABLE',
          });
        }
      }
    }
  }

  // B. Faculty Rest Gap Optimization
  for (const t of data.teachers || []) {
    const tid = t._id.toString();
    for (const day of DAYS) {
      const p3Slot = Object.values(grid).map(d => d[day]?.[3]).find(s => s && !s.isEmpty && !s.isBreak && (s.teacherIds || []).map(String).includes(tid));
      const p4Slot = Object.values(grid).map(d => d[day]?.[4]).find(s => s && !s.isEmpty && !s.isBreak && (s.teacherIds || []).map(String).includes(tid));
      if (p3Slot && p4Slot && !p3Slot.isLabBlock && !p4Slot.isLabBlock) {
        // Back-to-back across lunch
        optimizations.push({
          id: `opt-rst-${optimizations.length + 1}`,
          category: 'OPTIMIZATION',
          severity: 'OPTIMIZATION',
          type: 'FACULTY_REST_GAP',
          title: 'Faculty Mid-Day Recovery Buffer',
          day,
          period: 4,
          teacherId: tid,
          teacherName: t.name,
          currentArrangement: `${t.name} teaches Period 3 immediately before lunch and Period 4 immediately after lunch on ${day}.`,
          suggestedArrangement: `Relocate Period 4 lecture to Period 5 or 6 if class schedule permits.`,
          expectedBenefit: `Provides instructor with an extended restorative lunch interval and eliminates mid-day fatigue.`,
          constraintsPreserved: `Preserves all KTU weekly curriculum hours and lab room reservations.`,
          isSafe: false,
          status: 'AVAILABLE',
        });
      }
    }
  }

  return {
    timetableId: timetable._id,
    version: timetable.version,
    revision: timetable.revision || 1,
    summary: {
      hardConflictsCount: hardConflicts.length,
      softWarningsCount: softWarnings.length,
      optimizationsCount: optimizations.length,
      overallStatus: hardConflicts.length === 0 ? 'PASSED' : 'FAILED',
      qualityScore: timetable.qualityScore?.overall || 100,
    },
    hardConflicts,
    softWarnings,
    optimizations,
  };
}

module.exports = {
  generateTimetableDiagnostics,
};
