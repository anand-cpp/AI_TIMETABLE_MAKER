const { validateOutput } = require('./constraintValidator');

/**
 * Enhanced Quality Scorer - 100 Point Explainable Model
 * 
 * Dimensions:
 * 1. Workload Completeness: 20 pts
 * 2. Faculty Conflict Prevention: 15 pts
 * 3. Class Conflict Prevention: 15 pts
 * 4. Elective Synchronization: 10 pts
 * 5. Locked-Slot Compliance: 10 pts
 * 6. Laboratory Block Integrity: 10 pts
 * 7. Daily Balance & Subject Distribution: 10 pts
 * 8. Faculty Continuity & Comfortable Gaps: 10 pts
 * Total: 100 points
 */
const scoreGrid = (grid, data, validationResult = null) => {
  const val = validationResult || validateOutput(grid, data, []);
  const hardViolations = val.hardViolations || [];
  const checks = val.checks || {};

  const dimensions = [];
  const issues = [];

  // 1. Workload Completeness (20 pts)
  const underScheduled = hardViolations.filter(v => v.type === 'SUBJECT_UNDER_SCHEDULED');
  const overScheduled = hardViolations.filter(v => v.type === 'SUBJECT_OVER_SCHEDULED');
  let workloadScore = 20;
  let workloadExplanation = 'All legitimate academic hours fully scheduled.';
  if (underScheduled.length > 0 || overScheduled.length > 0) {
    const missing = underScheduled.reduce((sum, v) => sum + (v.missing || 1), 0);
    workloadScore = Math.max(0, 20 - missing * 4);
    workloadExplanation = `${underScheduled.length} subject(s) under-scheduled (${missing} period(s) missing).`;
    for (const u of underScheduled) {
      issues.push({
        dimension: 'Workload Completeness',
        class: u.classId,
        subject: u.subjectName,
        reason: u.message,
        fix: 'Place missing instructional periods in available non-break slots.',
      });
    }
  }
  dimensions.push({
    id: 'workloadCompleteness',
    name: 'Workload Completeness',
    score: workloadScore,
    maxScore: 20,
    weight: 20,
    explanation: workloadExplanation,
  });

  // 2. Faculty Conflict Prevention (15 pts)
  const teacherDoubles = hardViolations.filter(v => v.type === 'TEACHER_DOUBLE_BOOKED');
  let facultyScore = 15;
  let facultyExplanation = 'Zero faculty double-bookings.';
  if (teacherDoubles.length > 0) {
    facultyScore = Math.max(0, 15 - teacherDoubles.length * 5);
    facultyExplanation = `${teacherDoubles.length} simultaneous teacher collision(s) detected.`;
    for (const td of teacherDoubles) {
      issues.push({
        dimension: 'Faculty Conflicts',
        faculty: td.teacherId,
        day: td.day,
        period: td.period,
        reason: td.message,
        fix: 'Move one of the conflicting sessions to a free teaching period.',
      });
    }
  }
  dimensions.push({
    id: 'facultyConflicts',
    name: 'Faculty Conflict Prevention',
    score: facultyScore,
    maxScore: 15,
    weight: 15,
    explanation: facultyExplanation,
  });

  // 3. Class Conflict Prevention (15 pts)
  const classDoubles = hardViolations.filter(v => v.type === 'CLASS_DOUBLE_BOOKED');
  let classScore = 15;
  let classExplanation = 'Zero class double-bookings.';
  if (classDoubles.length > 0) {
    classScore = Math.max(0, 15 - classDoubles.length * 5);
    classExplanation = `${classDoubles.length} class collision(s) detected.`;
    for (const cd of classDoubles) {
      issues.push({
        dimension: 'Class Conflicts',
        class: cd.classId,
        day: cd.day,
        period: cd.period,
        reason: cd.message,
        fix: 'Resolve overlapping period assignments within the class.',
      });
    }
  }
  dimensions.push({
    id: 'classConflicts',
    name: 'Class Conflict Prevention',
    score: classScore,
    maxScore: 15,
    weight: 15,
    explanation: classExplanation,
  });

  // 4. Elective Synchronization (10 pts)
  // Check S4, S6, S8 groups
  let electiveScore = 10;
  let electiveExplanation = 'All elective groups synchronized across sections.';
  const electiveSyncIssues = [];

  // Check S4 CSE A & S4 CSE B sync
  const s4aId = '6aeccf3cbb1e84200c3db01b';
  const s4bId = '6aeccf3cbb1e84200c3db01c';
  if (grid[s4aId] && grid[s4bId]) {
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const slotA = grid[s4aId][day]?.[p];
        const slotB = grid[s4bId][day]?.[p];
        const isElcA = !!slotA?.isElective;
        const isElcB = !!slotB?.isElective;
        if (isElcA !== isElcB) {
          electiveSyncIssues.push(`S4 Elective mismatch on ${day} P${p}`);
        }
      }
    }
  }

  // Check S6 CSE A & S6 CSE B sync
  const s6aId = '6aeccf3cbb1e84200c3db01d';
  const s6bId = '6aeccf3cbb1e84200c3db01e';
  if (grid[s6aId] && grid[s6bId]) {
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const slotA = grid[s6aId][day]?.[p];
        const slotB = grid[s6bId][day]?.[p];
        const isElcA = !!slotA?.isElective;
        const isElcB = !!slotB?.isElective;
        if (isElcA !== isElcB) {
          electiveSyncIssues.push(`S6 Elective mismatch on ${day} P${p}`);
        }
      }
    }
  }

  // Check S8 CSE A & S8 CSE B sync
  const s8aId = '6aeccf3cbb1e84200c3db01f';
  const s8bId = '6aeccf3cbb1e84200c3db020';
  if (grid[s8aId] && grid[s8bId]) {
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      for (let p = 1; p <= 6; p++) {
        const sA = grid[s8aId][day]?.[p];
        const sB = grid[s8bId][day]?.[p];
        if (!!sA?.isElective !== !!sB?.isElective) {
          electiveSyncIssues.push(`S8 Elective mismatch on ${day} P${p}`);
        }
      }
    }
  }

  if (electiveSyncIssues.length > 0) {
    electiveScore = Math.max(0, 10 - electiveSyncIssues.length * 2);
    electiveExplanation = `${electiveSyncIssues.length} elective synchronization mismatch(es) detected.`;
    for (const ei of electiveSyncIssues) {
      issues.push({
        dimension: 'Elective Synchronization',
        reason: ei,
        fix: 'Align participating sections to the exact same day and period for shared elective groups.',
      });
    }
  }
  dimensions.push({
    id: 'electiveSync',
    name: 'Elective Synchronization',
    score: electiveScore,
    maxScore: 10,
    weight: 10,
    explanation: electiveExplanation,
  });

  // 5. Locked-Slot Compliance (10 pts)
  const fixedSlotViolations = hardViolations.filter(v => v.type === 'FIXED_SLOT_VIOLATION' || v.type === 'FIXED_SLOT_CONFLICT');
  let lockedScore = 10;
  let lockedExplanation = 'All locked and mandatory fixed slots preserved.';
  if (fixedSlotViolations.length > 0) {
    lockedScore = Math.max(0, 10 - fixedSlotViolations.length * 3);
    lockedExplanation = `${fixedSlotViolations.length} locked slot violation(s).`;
    for (const fv of fixedSlotViolations) {
      issues.push({
        dimension: 'Locked Slots',
        class: fv.classId,
        day: fv.day,
        period: fv.period,
        reason: fv.message,
        fix: 'Restore required subject to its designated locked position.',
      });
    }
  }
  dimensions.push({
    id: 'lockedSlots',
    name: 'Locked-Slot Compliance',
    score: lockedScore,
    maxScore: 10,
    weight: 10,
    explanation: lockedExplanation,
  });

  // 6. Laboratory Block Integrity (10 pts)
  const labViolations = hardViolations.filter(v => [
    'LAB_BLOCK_SPLIT', 'LAB_BLOCK_NON_CONSECUTIVE', 'LAB_BREAK_CROSSED',
    'FRIDAY_P3_LAB_PROHIBITED', 'LAB_ROOM_MISMATCH', 'LAB_ROOM_CONFLICT',
    'LAB_DOUBLE_BOOKING', 'INVALID_LAB_ASSIGNMENT'
  ].includes(v.type));
  let labScore = 10;
  let labExplanation = 'All lab sessions in valid contiguous blocks and designated rooms.';
  if (labViolations.length > 0) {
    labScore = Math.max(0, 10 - labViolations.length * 3);
    labExplanation = `${labViolations.length} laboratory block/room violation(s).`;
    for (const lv of labViolations) {
      issues.push({
        dimension: 'Lab Integrity',
        class: lv.classId,
        day: lv.day,
        reason: lv.message,
        fix: 'Ensure contiguous block scheduling in authorized room (Lab 1-3 for S1/S2, Lab 4 for S3-S8 practicals).',
      });
    }
  }
  dimensions.push({
    id: 'labIntegrity',
    name: 'Laboratory Block Integrity',
    score: labScore,
    maxScore: 10,
    weight: 10,
    explanation: labExplanation,
  });

  // 7. Daily Balance & Subject Distribution (10 pts)
  let balanceScore = 10;
  let balanceExplanation = 'Evenly distributed subject hours across days without consecutive repeats.';
  const repeatIssues = hardViolations.filter(v => v.type === 'THEORY_CONSECUTIVE_PERIODS_VIOLATION');
  if (repeatIssues.length > 0) {
    balanceScore = Math.max(0, 10 - repeatIssues.length * 2);
    balanceExplanation = `${repeatIssues.length} consecutive ordinary theory run(s) detected.`;
    for (const rv of repeatIssues) {
      issues.push({
        dimension: 'Daily Balance',
        class: rv.classId,
        day: rv.day,
        reason: rv.message,
        fix: 'Separate theory sessions with a break or different course.',
      });
    }
  }
  const softViolations = val.softViolations || val.warnings || [];
  const softBalance = softViolations.filter(s => (s.type || '').includes('BALANCE') || (s.type || '').includes('DISTRIBUTION') || (s.type || '').includes('STRESS'));
  if (softBalance.length > 0 && balanceScore > 4) {
    balanceScore = Math.max(4, balanceScore - Math.min(3, Math.round(softBalance.length * 0.5)));
    balanceExplanation += ` (${softBalance.length} distribution warning(s))`;
  }
  dimensions.push({
    id: 'dailyBalance',
    name: 'Daily Balance & Distribution',
    score: balanceScore,
    maxScore: 10,
    weight: 10,
    explanation: balanceExplanation,
  });

  // 8. Faculty Continuity & Comfortable Gaps (10 pts)
  const teacherOverloads = hardViolations.filter(v => v.type === 'TEACHER_DAILY_LIMIT_EXCEEDED' || v.type === 'FACULTY_REST_GAP');
  let continuityScore = 10;
  let continuityExplanation = 'Faculty loads distributed comfortably with adequate rest breaks.';
  if (teacherOverloads.length > 0) {
    continuityScore = Math.max(0, 10 - teacherOverloads.length * 2);
    continuityExplanation = `${teacherOverloads.length} teacher daily load ceiling or rest-gap violation(s).`;
    for (const to of teacherOverloads) {
      issues.push({
        dimension: 'Faculty Continuity',
        faculty: to.teacherId,
        day: to.day,
        reason: to.message,
        fix: 'Redistribute faculty periods across alternative weekdays to avoid daily overload or rest gap violations.',
      });
    }
  }
  const softFaculty = softViolations.filter(s => (s.type || '').includes('TEACHER') || (s.type || '').includes('FACULTY') || (s.type || '').includes('GAP'));
  if (softFaculty.length > 0 && continuityScore > 4) {
    continuityScore = Math.max(4, continuityScore - Math.min(3, Math.round(softFaculty.length * 0.5)));
    continuityExplanation += ` (${softFaculty.length} faculty workload gap warning(s))`;
  }
  dimensions.push({
    id: 'facultyContinuity',
    name: 'Faculty Continuity & Gaps',
    score: continuityScore,
    maxScore: 10,
    weight: 10,
    explanation: continuityExplanation,
  });

  const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);
  const isGated = hardViolations.length > 0;

  // Realistic score factoring in hard conflicts, soft warnings, and unplaced subjects
  let overall = totalScore;
  if (softViolations.length > 0) {
    // Deduct points proportionally for soft warnings (e.g. 34 soft warnings -> ~17-20 pts penalty)
    const softPenalty = Math.min(30, Math.round(softViolations.length * 0.6));
    overall = Math.max(20, overall - softPenalty);
  }
  if (isGated) {
    overall = Math.min(overall, Math.max(15, 48 - (hardViolations.length - 1) * 5));
  }

  return {
    overall,
    isGated,
    gateReason: isGated ? `${hardViolations.length} critical hard constraint violation(s) present.` : null,
    breakdown: dimensions,
    issues,
    // Legacy metrics for backwards compatibility:
    teacherLoad: Math.round((facultyScore / 15) * 100),
    distribution: Math.round((balanceScore / 10) * 100),
    labPlacement: Math.round((labScore / 10) * 100),
    electiveSync: Math.round((electiveScore / 10) * 100),
    travelOptimization: 100,
    teacherGaps: Math.round((continuityScore / 10) * 100),
    studentStress: Math.round((classScore / 15) * 100),
    teacherComfort: Math.round((continuityScore / 10) * 100),
  };
};

const scoreTeacherComfort = () => 100;

module.exports = { scoreGrid, scoreTeacherComfort };
