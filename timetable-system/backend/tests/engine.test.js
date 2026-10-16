const test = require('node:test');
const assert = require('node:assert/strict');

const { placeAllSubjects, placeTheorySubject, initializeGrid } = require('../src/services/engine/slotPlacer');
const {
  validateOutput,
  validateGrid,
  validateSubjectHours,
  validateLabBlocks,
  countEmptyNonBreakSlots,
  isSlotValid,
  isLabBlockValid,
} = require('../src/services/engine/constraintValidator');
const { checkFeasibility } = require('../src/services/engine/feasibilityChecker');
const { gridToClassTimetables } = require('../src/services/engine/orchestrator');
const { scoreTeacherComfort } = require('../src/services/engine/qualityScorer');
const { crossesBreak } = require('../src/utils/timeHelpers');
const {
  makeClass,
  makeTeacher,
  makeTheory,
  makeLab,
  makeOpenElective,
  makeLinkedElective,
  buildData,
  defaultTimeline,
} = require('./helpers/fixtures');

test('crossesBreak uses timeline order (break numbered 0 between P3 and P4)', () => {
  const tl = defaultTimeline();
  assert.equal(crossesBreak(1, 3, tl), false, 'P1-P3 is valid');
  assert.equal(crossesBreak(4, 3, tl), false, 'P4-P6 is valid');
  assert.equal(crossesBreak(3, 2, tl), true, 'P3-P4 straddles lunch');
  assert.equal(crossesBreak(2, 3, tl), true, 'P2-P4 straddles lunch');
  assert.equal(crossesBreak(1, 6, tl), true, 'P1-P6 straddles lunch');
});

test('basic theory placement has zero hard violations and full weekly hours', () => {
  const t1 = makeTeacher('T1');
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 5);

  const data = buildData({ classes: [c1], subjects: [s1], teachers: [t1] });
  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  assert.equal(res.unplacedSubjects.length, 0, 'no unplaced subjects');
  assert.equal(v.hardViolationsCount, 0, JSON.stringify(v.hardViolations));
  assert.equal(v.checks.all_subject_hours_met, true);
  assert.equal(v.emptySlotsCount, 0);

  // Exactly 5 cells belong to s1 (autofill must not inflate this)
  let count = 0;
  for (const dayMap of Object.values(res.grid[c1._id.toString()])) {
    for (const slot of Object.values(dayMap)) {
      if (slot.subjectId && slot.subjectId.toString() === s1._id.toString()) count++;
    }
  }
  assert.equal(count, 5);
});

test('escalation retry never over-allocates a subject (no duplicate placement)', () => {
  const t1 = makeTeacher('T1', { maxPeriodsPerDay: 2 });
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 4);
  const data = buildData({ classes: [c1], subjects: [s1], teachers: [t1], settings: { teacherDailyLimit: 2 } });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  // Call twice; the second call must be a no-op because hours are already met.
  placeTheorySubject(s1, c1._id.toString(), grid, data, false, {});
  const second = placeTheorySubject(s1, c1._id.toString(), grid, data, false, {});
  assert.equal(second.placed.length, 0, 'second placement must not add periods');

  let count = 0;
  for (const dayMap of Object.values(grid[c1._id.toString()])) {
    for (const slot of Object.values(dayMap)) {
      if (slot.subjectId && slot.subjectId.toString() === s1._id.toString()) count++;
    }
  }
  assert.equal(count, 4, 'exactly weeklyHours placed');
});

test('under-schedulable subject is reported (not silently completed)', () => {
  const t1 = makeTeacher('T1', { maxPeriodsPerDay: 6 });
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 8); // only 6 teaching periods exist (Monday only)
  const data = buildData({
    classes: [c1],
    subjects: [s1],
    teachers: [t1],
    workingDays: ['Monday'],
    settings: { teacherDailyLimit: 6, workingDays: ['Monday'] },
  });

  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  assert.equal(res.unplacedSubjects.length, 1);
  assert.equal(res.unplacedSubjects[0].missing, 2);
  assert.equal(v.valid, false);
  assert.equal(v.checks.all_subject_hours_met, false);
  const under = v.hardViolations.filter((x) => x.type === 'SUBJECT_UNDER_SCHEDULED');
  assert.equal(under.length, 1);
});

test('no teacher double-booking across classes', () => {
  const shared = makeTeacher('Shared');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const s1 = makeTheory(c1._id, [shared], 6, { name: 'Subj1' });
  const s2 = makeTheory(c2._id, [shared], 6, { name: 'Subj2' });

  const data = buildData({ classes: [c1, c2], subjects: [s1, s2], teachers: [shared] });
  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  assert.equal(v.checks.zero_teacher_conflicts, true, JSON.stringify(v.hardViolations));
  assert.equal(res.unplacedSubjects.length, 0);
});

test('teacher unavailability is respected', () => {
  const t1 = makeTeacher('T1', { unavailability: [{ day: 'Monday', period: 1 }] });
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 5);
  const data = buildData({ classes: [c1], subjects: [s1], teachers: [t1] });

  const res = placeAllSubjects(data, false);
  const slot = res.grid[c1._id.toString()].Monday[1];
  const usesTeacher = (slot.teacherIds || []).some((id) => id.toString() === t1._id.toString());
  assert.equal(usesTeacher, false, 'must not place unavailable teacher at Monday P1');

  const v = validateOutput(res.grid, data, res.unplacedSubjects);
  assert.equal(v.checks.zero_availability_violations, true);
});

test('lab is placed as one consecutive block that does not cross lunch', () => {
  const t1 = makeTeacher('T1');
  const c1 = makeClass('C1');
  const lab = makeLab(c1._id, [t1], 3);
  const data = buildData({ classes: [c1], subjects: [lab], teachers: [t1] });

  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  const periods = [];
  for (const dayMap of Object.values(res.grid[c1._id.toString()])) {
    for (const [p, slot] of Object.entries(dayMap)) {
      if (slot.subjectId && slot.subjectId.toString() === lab._id.toString()) periods.push(Number(p));
    }
  }
  assert.equal(periods.length, 3);
  assert.equal(validateLabBlocks(res.grid, data).length, 0);
  assert.equal(v.hardViolationsCount, 0, JSON.stringify(v.hardViolations));

  // Must never contain both P3 and P4 (the lunch-straddling pair)
  const has3 = periods.includes(3);
  const has4 = periods.includes(4);
  assert.equal(has3 && has4, false, 'lab must not straddle lunch');
});

test('two 3-period labs for one teacher never share a day (daily limit holds)', () => {
  const t1 = makeTeacher('T1'); // maxPeriodsPerDay defaults to 4
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const lab1 = makeLab(c1._id, [t1], 3, { roomName: 'CS-LAB-1', name: 'Lab1' });
  const lab2 = makeLab(c2._id, [t1], 3, { roomName: 'CS-LAB-2', name: 'Lab2' });

  const data = buildData({ classes: [c1, c2], subjects: [lab1, lab2], teachers: [t1] });
  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  assert.equal(res.unplacedSubjects.length, 0, 'both labs must be placed');
  assert.equal(v.hardViolationsCount, 0, JSON.stringify(v.hardViolations));

  // Regression: two 3-period blocks previously both landed on one day (6 periods,
  // over the limit of 5) because the block's own periods were not counted.
  const perDay = {};
  for (const classId of [c1._id.toString(), c2._id.toString()]) {
    for (const [day, periodMap] of Object.entries(res.grid[classId])) {
      for (const slot of Object.values(periodMap)) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;
        const usesT1 = (slot.teacherIds || []).some((id) => id.toString() === t1._id.toString());
        if (!usesT1) continue;
        perDay[day] = (perDay[day] || 0) + 1;
      }
    }
  }
  for (const [day, count] of Object.entries(perDay)) {
    assert.ok(count <= t1.maxPeriodsPerDay, `teacher has ${count} periods on ${day}, limit ${t1.maxPeriodsPerDay}`);
  }
  const daily = v.softViolations.filter((x) => x.type === 'TEACHER_DAILY_LIMIT_EXCEEDED');
  assert.equal(daily.length, 0, JSON.stringify(daily));
});

test('labs sharing a room are not scheduled at the same time', () => {
  const tA = makeTeacher('TA');
  const tB = makeTeacher('TB');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const lab1 = makeLab(c1._id, [tA], 2, { roomName: 'CS-LAB-1' });
  const lab2 = makeLab(c2._id, [tB], 2, { roomName: 'CS-LAB-1' });

  const data = buildData({ classes: [c1, c2], subjects: [lab1, lab2], teachers: [tA, tB] });
  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  assert.equal(v.checks.zero_room_conflicts, true, JSON.stringify(v.hardViolations));
});

test('open elective shared session is not a teacher conflict', () => {
  const ta = makeTeacher('TA');
  const tb = makeTeacher('TB');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const elective = makeOpenElective(
    [c1._id, c2._id],
    [
      { teacherId: ta._id, optionName: 'AI' },
      { teacherId: tb._id, optionName: 'Robotics' },
    ]
  );

  const data = buildData({ classes: [c1, c2], subjects: [elective], teachers: [ta, tb] });
  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  assert.equal(v.checks.zero_teacher_conflicts, true, JSON.stringify(v.hardViolations));

  // Both classes share the same elective slot
  const findElective = (classId) => {
    for (const [day, periodMap] of Object.entries(res.grid[classId])) {
      for (const [p, slot] of Object.entries(periodMap)) {
        if (slot.subjectId && slot.subjectId.toString() === elective._id.toString()) {
          return `${day}_${p}`;
        }
      }
    }
    return null;
  };
  const e1 = findElective(c1._id.toString());
  const e2 = findElective(c2._id.toString());
  assert.ok(e1 && e2);
  assert.equal(e1, e2);
});

// ── Elective audit ───────────────────────────────────────────────────────────
// Case A: the same teacher and the same subject name taught to two sections as
// ordinary lessons are SEPARATE lessons, not one shared session.
test('elective audit A: same teacher+subject in two sections are separate lessons', () => {
  const t = makeTeacher('TS');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const s1 = makeTheory(c1._id, [t], 3, { name: 'Data Structures', code: 'CS301' });
  const s2 = makeTheory(c2._id, [t], 3, { name: 'Data Structures', code: 'CS301' });

  const data = buildData({ classes: [c1, c2], subjects: [s1, s2], teachers: [t] });
  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  assert.equal(v.checks.zero_teacher_conflicts, true, JSON.stringify(v.hardViolations));

  const slotsOf = (classId, subjId) => {
    const out = [];
    for (const [day, pm] of Object.entries(res.grid[classId])) {
      for (const [p, slot] of Object.entries(pm)) {
        if (slot.subjectId?.toString() === subjId.toString()) out.push(`${day}_${p}`);
      }
    }
    return out;
  };
  const a = slotsOf(c1._id.toString(), s1._id);
  const b = slotsOf(c2._id.toString(), s2._id);
  assert.equal(a.length, 3);
  assert.equal(b.length, 3);
  assert.equal(a.filter((s) => b.includes(s)).length, 0, 'sections must not share the same slots');
});

// Case B: a genuinely linked elective is one physical session; each class's OWN
// subject doc is credited with the shared session (regression for the placer
// writing only the primary subject id into every class).
test('elective audit B: linked elective shared session credits each class own subject', () => {
  const t = makeTeacher('TE');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const gid = 'ELEC-G1';
  const e1 = makeLinkedElective(c1._id, [t], gid, { name: 'Elective AI' });
  const e2 = makeLinkedElective(c2._id, [t], gid, { name: 'Elective AI' });

  const data = buildData({ classes: [c1, c2], subjects: [e1, e2], teachers: [t] });
  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  assert.equal(v.checks.zero_teacher_conflicts, true, JSON.stringify(v.hardViolations));

  const findShared = (classId) => {
    for (const [day, pm] of Object.entries(res.grid[classId])) {
      for (const [p, slot] of Object.entries(pm)) {
        if (slot.isElective && slot.electiveGroupId === gid) return { day, period: p, slot };
      }
    }
    return null;
  };
  const a = findShared(c1._id.toString());
  const b = findShared(c2._id.toString());
  assert.ok(a && b, 'both classes received the shared elective session');
  assert.equal(`${a.day}_${a.period}`, `${b.day}_${b.period}`, 'one physical session');

  // Regression: each class carries its OWN doc, not the primary class's doc.
  assert.equal(a.slot.subjectId.toString(), e1._id.toString());
  assert.equal(b.slot.subjectId.toString(), e2._id.toString());

  const under = (v.hardViolations || []).filter((hv) => hv.type === 'SUBJECT_UNDER_SCHEDULED');
  assert.equal(under.length, 0, JSON.stringify(under));
});

// Case C: two linked groups with DIFFERENT group ids are independent electives —
// they are scheduled separately and never merge into one shared session.
test('elective audit C: different linked groups stay independent', () => {
  const t = makeTeacher('TI');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const e1 = makeLinkedElective(c1._id, [t], 'ELEC-IA', { name: 'Elective A' });
  const e2 = makeLinkedElective(c2._id, [t], 'ELEC-IB', { name: 'Elective B' });

  const data = buildData({ classes: [c1, c2], subjects: [e1, e2], teachers: [t] });
  const res = placeAllSubjects(data, false);
  const v = validateOutput(res.grid, data, res.unplacedSubjects);

  assert.equal(v.checks.zero_teacher_conflicts, true, JSON.stringify(v.hardViolations));

  const find = (classId, gid) => {
    for (const [day, pm] of Object.entries(res.grid[classId])) {
      for (const [p, slot] of Object.entries(pm)) {
        if (slot.isElective && slot.electiveGroupId === gid) return { day, period: p };
      }
    }
    return null;
  };
  const a = find(c1._id.toString(), 'ELEC-IA');
  const b = find(c2._id.toString(), 'ELEC-IB');
  assert.ok(a && b);
  assert.notEqual(`${a.day}_${a.period}`, `${b.day}_${b.period}`, 'independent electives do not share a slot');
});

// Case D: invalid shared metadata is rejected up-front by the feasibility check.
test('elective audit D: invalid linked metadata is rejected', () => {
  const t = makeTeacher('TD');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');

  // D1: a single-class "linked" group cannot be shared.
  const lone = makeLinkedElective(c1._id, [t], 'ELEC-LONE');
  const soloData = buildData({ classes: [c1], subjects: [lone], teachers: [t] });
  const solo = checkFeasibility(soloData);
  assert.ok(
    solo.warnings.some((w) => w.includes('ELEC-LONE') && w.includes('at least 2')),
    JSON.stringify(solo.warnings)
  );

  // D2: a linked elective with no teacher can never be placed.
  const noTeacher = makeLinkedElective(c1._id, [], 'ELEC-G2');
  const other = makeLinkedElective(c2._id, [], 'ELEC-G2');
  const ntData = buildData({ classes: [c1, c2], subjects: [noTeacher, other], teachers: [t] });
  const nt = checkFeasibility(ntData);
  assert.equal(nt.feasible, false);
  assert.ok(nt.errors.some((e) => e.includes('linked elective has no teacher assigned')));

  // D3: an elective missing electiveDetails entirely is rejected.
  const noDetails = { _id: 'e-d3', classId: c1._id, name: 'Broken', code: 'BR', type: 'elective', weeklyHours: 1, teachers: [t] };
  const ndData = buildData({ classes: [c1], subjects: [noDetails], teachers: [t] });
  const nd = checkFeasibility(ndData);
  assert.equal(nd.feasible, false);
  assert.ok(nd.errors.some((e) => e.includes('missing elective details')));

  // And the placer must never emit a no-teacher elective slot for D2.
  const placed = placeAllSubjects(ntData, false);
  const pv = validateOutput(placed.grid, ntData, placed.unplacedSubjects);
  assert.equal(
    pv.hardViolations.filter((hv) => hv.type === 'INVALID_SLOT_NO_TEACHER' && hv.message?.includes('Elective')).length,
    0,
    JSON.stringify(pv.hardViolations)
  );
});

test('validator detects an injected teacher double-booking', () => {
  const shared = makeTeacher('Shared');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const s1 = makeTheory(c1._id, [shared], 3, { name: 'S1' });
  const s2 = makeTheory(c2._id, [shared], 3, { name: 'S2' });
  const data = buildData({ classes: [c1, c2], subjects: [s1, s2], teachers: [shared] });

  const res = placeAllSubjects(data, false);
  // Force both classes to use the shared teacher at the same Mon P1
  const fake = {
    subjectId: s1._id.toString(), subjectName: 'X', subjectType: 'theory',
    teacherIds: [shared._id.toString()], teacherNames: [shared.name],
    isEmpty: false, isBreak: false, isLabBlock: false, isElective: false,
  };
  res.grid[c1._id.toString()].Monday[1] = { ...fake, day: 'Monday', period: 1 };
  res.grid[c2._id.toString()].Monday[1] = { ...fake, day: 'Monday', period: 1 };

  const g = validateGrid(res.grid, data);
  assert.ok(g.violations.some((x) => x.type === 'TEACHER_DOUBLE_BOOKED'));
});

test('subject-hour validator flags over-scheduling', () => {
  const t1 = makeTeacher('T1');
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 3);
  const data = buildData({ classes: [c1], subjects: [s1], teachers: [t1] });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  const mk = (day, period) => ({
    subjectId: s1._id.toString(), subjectType: 'theory', teacherIds: [t1._id.toString()],
    isEmpty: false, isBreak: false, isElective: false, isLabBlock: false, day, period,
  });
  grid[c1._id.toString()].Monday[1] = mk('Monday', 1);
  grid[c1._id.toString()].Monday[2] = mk('Monday', 2);
  grid[c1._id.toString()].Monday[4] = mk('Monday', 4);
  grid[c1._id.toString()].Monday[5] = mk('Monday', 5);

  const over = validateSubjectHours(grid, data).filter((v) => v.type === 'SUBJECT_OVER_SCHEDULED');
  assert.equal(over.length, 1);
  assert.equal(over[0].excess, 1);
});

test('empty-slot counter detects missing (never initialised) cells', () => {
  const t1 = makeTeacher('T1');
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 1);
  const data = buildData({ classes: [c1], subjects: [s1], teachers: [t1] });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  // 6 teaching periods × 5 days = 30; the break (period 0) is NOT counted.
  assert.equal(countEmptyNonBreakSlots(grid, data), 30);

  // Filling a teaching slot reduces the count...
  grid[c1._id.toString()].Monday[1] = {
    day: 'Monday', period: 1, isEmpty: false, isBreak: false, subjectId: s1._id.toString(),
  };
  assert.equal(countEmptyNonBreakSlots(grid, data), 29);

  // ...and removing it (never-initialised cell) counts as empty again.
  delete grid[c1._id.toString()].Monday[1];
  assert.equal(countEmptyNonBreakSlots(grid, data), 30);
});

test('placement is deterministic when randomize is false', () => {
  const shared = makeTeacher('Shared');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const s1 = makeTheory(c1._id, [shared], 4, { name: 'A' });
  const s2 = makeTheory(c2._id, [shared], 4, { name: 'B' });
  const data = buildData({ classes: [c1, c2], subjects: [s1, s2], teachers: [shared] });

  const r1 = placeAllSubjects(data, false);
  const r2 = placeAllSubjects(data, false);
  assert.equal(JSON.stringify(r1.grid), JSON.stringify(r2.grid));
});

test('feasibility checker reports missing teacher as infeasible', () => {
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [], 3); // no teacher
  const data = buildData({ classes: [c1], subjects: [s1], teachers: [] });
  const f = checkFeasibility(data);
  assert.equal(f.feasible, false);
  assert.ok(f.errors.some((e) => /no teacher/i.test(e)));
});

test('feasibility checker reports over-capacity class as infeasible', () => {
  const t1 = makeTeacher('T1');
  const c1 = makeClass('C1');
  // 30 teaching periods/week but demand 40
  const mk = (i) => makeTheory(c1._id, [t1], 10, { name: `S${i}`, code: `S${i}` });
  const subjects = [mk(1), mk(2), mk(3), mk(4)];
  const data = buildData({ classes: [c1], subjects, teachers: [t1] });
  const f = checkFeasibility(data);
  assert.equal(f.feasible, false);
});

test('gridToClassTimetables includes every class', () => {
  const t1 = makeTeacher('T1');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const s1 = makeTheory(c1._id, [t1], 2, { name: 'A' });
  const s2 = makeTheory(c2._id, [t1], 2, { name: 'B' });
  const data = buildData({ classes: [c1, c2], subjects: [s1, s2], teachers: [t1] });

  const res = placeAllSubjects(data, false);
  const cts = gridToClassTimetables(res.grid, data.classes);
  assert.equal(cts.length, 2);
});

// ---------------------------------------------------------------------------
// Teacher daily limit (default 4)
// ---------------------------------------------------------------------------

test('teacher daily limit defaults to 4 when neither teacher nor settings specify one', () => {
  // Force the fallback chain (teacher.maxPeriodsPerDay || settings.teacherDailyLimit || 4).
  const t1 = makeTeacher('T1', { maxPeriodsPerDay: undefined });
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 1);
  const data = buildData({
    classes: [c1],
    subjects: [s1],
    teachers: [t1],
    settings: { teacherDailyLimit: undefined },
  });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  const mk = (day, period) => ({
    subjectId: s1._id.toString(), subjectType: 'theory', teacherIds: [t1._id.toString()],
    isEmpty: false, isBreak: false, isElective: false, isLabBlock: false, day, period,
  });
  grid[c1._id.toString()].Monday[1] = mk('Monday', 1);
  grid[c1._id.toString()].Monday[2] = mk('Monday', 2);
  grid[c1._id.toString()].Monday[3] = mk('Monday', 3);
  grid[c1._id.toString()].Monday[4] = mk('Monday', 4);

  let daily = validateGrid(grid, data).violations.filter((v) => v.type === 'TEACHER_DAILY_LIMIT_EXCEEDED');
  assert.equal(daily.length, 0, 'exactly 4 periods/day is within the default limit');

  grid[c1._id.toString()].Monday[5] = mk('Monday', 5);
  daily = validateGrid(grid, data).violations.filter((v) => v.type === 'TEACHER_DAILY_LIMIT_EXCEEDED');
  assert.equal(daily.length, 1, '5th period breaches the default limit');
  assert.equal(daily[0].limit, 4, 'the default limit is 4');
});

test('isSlotValid enforces the limit and counts whole multi-period blocks', () => {
  const t1 = makeTeacher('T1', { maxPeriodsPerDay: 4 });
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 1);
  const data = buildData({ classes: [c1], subjects: [s1], teachers: [t1], settings: { teacherDailyLimit: 4 } });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  const mk = (day, period) => ({
    subjectId: s1._id.toString(), subjectType: 'theory', teacherIds: [t1._id.toString()],
    isEmpty: false, isBreak: false, isElective: false, isLabBlock: false, day, period,
  });
  const slot = { teacherIds: [t1._id.toString()], subjectType: 'theory' };

  // Teacher already teaches 3 periods on Monday.
  grid[c1._id.toString()].Monday[1] = mk('Monday', 1);
  grid[c1._id.toString()].Monday[2] = mk('Monday', 2);
  grid[c1._id.toString()].Monday[3] = mk('Monday', 3);

  // 4th single period fits...
  assert.equal(isSlotValid(c1._id.toString(), 'Monday', 4, slot, grid, data), true);
  // ...but a 3-period block (3 + 3 = 6) does not.
  assert.equal(
    isSlotValid(c1._id.toString(), 'Monday', 4, slot, grid, data, { additionalPeriods: 3 }),
    false
  );

  // With 4 already taught, the 5th single period is rejected.
  grid[c1._id.toString()].Monday[4] = mk('Monday', 4);
  assert.equal(isSlotValid(c1._id.toString(), 'Monday', 5, slot, grid, data), false);
});

test('daily limit counts periods across every section a teacher teaches', () => {
  const shared = makeTeacher('Shared', { maxPeriodsPerDay: 4 });
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const s1 = makeTheory(c1._id, [shared], 1, { name: 'A' });
  const s2 = makeTheory(c2._id, [shared], 1, { name: 'B' });
  const data = buildData({ classes: [c1, c2], subjects: [s1, s2], teachers: [shared], settings: { teacherDailyLimit: 4 } });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  const mk = (sid, day, period) => ({
    subjectId: sid, subjectType: 'theory', teacherIds: [shared._id.toString()],
    isEmpty: false, isBreak: false, isElective: false, isLabBlock: false, day, period,
  });
  // Distinct periods so the shared teacher is never double-booked.
  grid[c1._id.toString()].Monday[1] = mk(s1._id.toString(), 'Monday', 1);
  grid[c1._id.toString()].Monday[2] = mk(s1._id.toString(), 'Monday', 2);
  grid[c2._id.toString()].Monday[3] = mk(s2._id.toString(), 'Monday', 3);
  grid[c2._id.toString()].Monday[4] = mk(s2._id.toString(), 'Monday', 4);

  let daily = validateGrid(grid, data).violations.filter((v) => v.type === 'TEACHER_DAILY_LIMIT_EXCEEDED');
  assert.equal(daily.length, 0, '4 periods spread over two sections is still within the limit');

  grid[c2._id.toString()].Monday[5] = mk(s2._id.toString(), 'Monday', 5);
  daily = validateGrid(grid, data).violations.filter((v) => v.type === 'TEACHER_DAILY_LIMIT_EXCEEDED');
  assert.equal(daily.length, 1, 'the 5th period (any section) breaches the limit');
});

test('a lab block cannot push a teacher past the daily limit', () => {
  const t1 = makeTeacher('T1', { maxPeriodsPerDay: 4 });
  const c1 = makeClass('C1');
  const lab = makeLab(c1._id, [t1], 3, { roomName: 'CS-LAB-1' });
  const data = buildData({ classes: [c1], subjects: [lab], teachers: [t1], settings: { teacherDailyLimit: 4 } });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  const mk = (sid, day, period, extra = {}) => ({
    subjectId: sid, subjectType: 'theory', teacherIds: [t1._id.toString()],
    isEmpty: false, isBreak: false, isElective: false, isLabBlock: false, day, period, ...extra,
  });
  // Two theory periods already taught on Monday.
  grid[c1._id.toString()].Monday[1] = mk(lab._id.toString(), 'Monday', 1);
  grid[c1._id.toString()].Monday[2] = mk(lab._id.toString(), 'Monday', 2);

  const labSlot = { teacherIds: [t1._id.toString()], subjectType: 'lab', roomName: 'CS-LAB-1' };
  // A 3-period lab starting at P4 would be 2 + 3 = 5 > 4.
  assert.equal(isLabBlockValid(c1._id.toString(), 'Monday', 4, 3, labSlot, grid, data), false);
});

test('post-hoc validation flags an injected over-limit day (persisted re-validation parity)', () => {
  const t1 = makeTeacher('T1', { maxPeriodsPerDay: 4 });
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 5, { name: 'S1' }); // exactly 5 periods expected
  const data = buildData({ classes: [c1], subjects: [s1], teachers: [t1], settings: { teacherDailyLimit: 4 } });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  const mk = (day, period) => ({
    subjectId: s1._id.toString(), subjectType: 'theory', teacherIds: [t1._id.toString()],
    isEmpty: false, isBreak: false, isElective: false, isLabBlock: false, day, period,
  });
  // Force all 5 weekly periods onto Monday (over the daily limit, hours still met).
  for (const p of [1, 2, 3, 4, 5]) grid[c1._id.toString()].Monday[p] = mk('Monday', p);

  const v = validateOutput(grid, data, []);
  assert.equal(v.hardViolationsCount, 0, JSON.stringify(v.hardViolations));
  const daily = v.softViolations.filter((x) => x.type === 'TEACHER_DAILY_LIMIT_EXCEEDED');
  assert.equal(daily.length, 1);
  assert.equal(daily[0].limit, 4);
  assert.equal(daily[0].periodsCount, 5);
});

// ---------------------------------------------------------------------------
// Negative fixtures
// ---------------------------------------------------------------------------

test('feasibility flags a lab with no room assigned', () => {
  const t1 = makeTeacher('T1');
  const c1 = makeClass('C1');
  const lab = makeLab(c1._id, [t1], 2, { labDetails: { roomName: '' } });
  const data = buildData({ classes: [c1], subjects: [lab], teachers: [t1] });

  const f = checkFeasibility(data);
  assert.equal(f.feasible, false);
  assert.ok(f.errors.some((e) => /no room/i.test(e)), JSON.stringify(f.errors));
});

test('overlapping labs sharing a teacher are flagged', () => {
  const t1 = makeTeacher('T1');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const lab1 = makeLab(c1._id, [t1], 2, { code: 'L1', name: 'Lab 1', labDetails: { roomName: 'CS-LAB-1' } });
  const lab2 = makeLab(c2._id, [t1], 2, { code: 'L2', name: 'Lab 2', labDetails: { roomName: 'CS-LAB-2' } });
  const data = buildData({ classes: [c1, c2], subjects: [lab1, lab2], teachers: [t1] });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  const mk = (lab, day, period) => ({
    subjectId: lab._id.toString(), subjectName: lab.name, subjectType: 'lab',
    teacherIds: [t1._id.toString()], teacherNames: [t1.name], roomName: lab.labDetails.roomName,
    isLabBlock: true, isEmpty: false, isBreak: false, isElective: false, day, period,
  });
  // Both labs occupy Monday P1-P2 → the shared teacher is double-booked.
  grid[c1._id.toString()].Monday[1] = mk(lab1, 'Monday', 1);
  grid[c1._id.toString()].Monday[2] = mk(lab1, 'Monday', 2);
  grid[c2._id.toString()].Monday[1] = mk(lab2, 'Monday', 1);
  grid[c2._id.toString()].Monday[2] = mk(lab2, 'Monday', 2);

  const g = validateGrid(grid, data);
  assert.ok(g.violations.some((x) => x.type === 'TEACHER_DOUBLE_BOOKED'), JSON.stringify(g.violations));
});

test('validator flags a teacher scheduled during unavailability', () => {
  const t1 = makeTeacher('T1', { unavailability: [{ day: 'Monday', period: 1 }] });
  const c1 = makeClass('C1');
  const s1 = makeTheory(c1._id, [t1], 1);
  const data = buildData({ classes: [c1], subjects: [s1], teachers: [t1] });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  grid[c1._id.toString()].Monday[1] = {
    subjectId: s1._id.toString(), subjectType: 'theory', teacherIds: [t1._id.toString()],
    isEmpty: false, isBreak: false, isElective: false, isLabBlock: false, day: 'Monday', period: 1,
  };

  const g = validateGrid(grid, data);
  assert.ok(g.violations.some((x) => x.type === 'TEACHER_UNAVAILABLE'), JSON.stringify(g.violations));
});

test('validator flags two labs booked into the same room at the same time', () => {
  const t1 = makeTeacher('T1');
  const t2 = makeTeacher('T2');
  const c1 = makeClass('C1');
  const c2 = makeClass('C2');
  const lab1 = makeLab(c1._id, [t1], 2, { code: 'L1', name: 'Lab 1', labDetails: { roomName: 'SHARED-LAB' } });
  const lab2 = makeLab(c2._id, [t2], 2, { code: 'L2', name: 'Lab 2', labDetails: { roomName: 'SHARED-LAB' } });
  const data = buildData({ classes: [c1, c2], subjects: [lab1, lab2], teachers: [t1, t2] });

  const grid = initializeGrid(data.classes, data.workingDays, data.allPeriodsPerDayMap, data.breakPeriodsPerDayMap);
  const mk = (lab, teacher, day, period) => ({
    subjectId: lab._id.toString(), subjectName: lab.name, subjectType: 'lab',
    teacherIds: [teacher._id.toString()], teacherNames: [teacher.name], roomName: 'SHARED-LAB',
    isLabBlock: true, isEmpty: false, isBreak: false, isElective: false, day, period,
  });
  grid[c1._id.toString()].Monday[1] = mk(lab1, t1, 'Monday', 1);
  grid[c2._id.toString()].Monday[1] = mk(lab2, t2, 'Monday', 1);

  const g = validateGrid(grid, data);
  assert.ok(g.violations.some((x) => x.type === 'LAB_ROOM_CONFLICT'), JSON.stringify(g.violations));
});

// ── Teacher comfort (teacher-friendly soft metric) ───────────────────────────
const setupComfort = () => {
  const t = makeTeacher('TC');
  const c = makeClass('C1');
  const s = makeTheory(c._id, [t], 6);
  const data = buildData({ classes: [c], subjects: [s], teachers: [t] });
  const cls = c._id.toString();
  const grid = { [cls]: {} };
  for (const day of data.workingDays) grid[cls][day] = {};
  const put = (day, period) => {
    grid[cls][day][period] = {
      subjectId: s._id.toString(), subjectType: 'theory', teacherIds: [t._id.toString()],
      teacherNames: [t.name], isEmpty: false, isBreak: false, isElective: false, isLabBlock: false,
      day, period,
    };
  };
  return { data, grid, put };
};

test('teacher comfort rewards spreading load across the week', () => {
  // Concentrated: four consecutive periods on a single day.
  const concentrated = setupComfort();
  for (const p of [1, 2, 3, 4]) concentrated.put('Monday', p);

  // Spread: one period on each of four days.
  const spread = setupComfort();
  spread.put('Monday', 1);
  spread.put('Tuesday', 1);
  spread.put('Wednesday', 1);
  spread.put('Thursday', 1);

  const cScore = scoreTeacherComfort(concentrated.grid, concentrated.data);
  const sScore = scoreTeacherComfort(spread.grid, spread.data);
  assert.ok(sScore > cScore, `spread ${sScore} should beat concentrated ${cScore}`);
});

test('teacher comfort penalizes long consecutive runs', () => {
  // One 4-period run.
  const oneRun = setupComfort();
  for (const p of [1, 2, 3, 4]) oneRun.put('Monday', p);

  // Two 2-period runs (same load, shorter max run).
  const twoRuns = setupComfort();
  for (const p of [1, 2]) twoRuns.put('Monday', p);
  for (const p of [4, 5]) twoRuns.put('Monday', p);

  const a = scoreTeacherComfort(oneRun.grid, oneRun.data);
  const b = scoreTeacherComfort(twoRuns.grid, twoRuns.data);
  assert.ok(b > a, `shorter runs ${b} should beat one long run ${a}`);
});

test('teacher comfort is 100 when no teacher is scheduled', () => {
  const empty = setupComfort();
  assert.equal(scoreTeacherComfort(empty.grid, empty.data), 100);
});
