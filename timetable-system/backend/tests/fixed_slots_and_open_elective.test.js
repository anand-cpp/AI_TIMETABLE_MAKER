const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { placeAllSubjects } = require('../src/services/engine/slotPlacer');
const { checkFeasibility } = require('../src/services/engine/feasibilityChecker');
const { validateOutput } = require('../src/services/engine/constraintValidator');

describe('Fixed Slots, S6 Open Elective & Workload Constraints', () => {
  const baseTimeline = [
    { periodNumber: 1, startTime: '09:00', endTime: '09:50', isBreak: false },
    { periodNumber: 2, startTime: '09:50', endTime: '10:40', isBreak: false },
    { periodNumber: 3, startTime: '10:50', endTime: '11:40', isBreak: false },
    { periodNumber: 4, startTime: '11:40', endTime: '12:30', isBreak: false },
    { periodNumber: 5, startTime: '13:20', endTime: '14:10', isBreak: false },
    { periodNumber: 6, startTime: '14:10', endTime: '15:00', isBreak: false },
  ];

  const workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periodsPerDayMap = {
    Monday: [1, 2, 3, 4, 5, 6],
    Tuesday: [1, 2, 3, 4, 5, 6],
    Wednesday: [1, 2, 3, 4, 5, 6],
    Thursday: [1, 2, 3, 4, 5, 6],
    Friday: [1, 2, 3, 4, 5, 6],
  };
  const breakPeriodsPerDayMap = {
    Monday: [0], Tuesday: [0], Wednesday: [0], Thursday: [0], Friday: [0],
  };

  it('Phase 0 places mandatory fixed slots first and reserves them', () => {
    const classId = 'class_s4a';
    const classes = [{ _id: classId, name: 'S4 CSE A', semester: 4, section: 'A' }];
    const teacherId = 'teacher_sunitha';
    const teachers = [{ _id: teacherId, name: 'Ms Sunitha S', maxPeriodsPerDay: 4, maxPeriodsPerWeek: 16 }];
    const teacherMap = { [teacherId]: teachers[0] };
    const classMap = { [classId]: classes[0] };

    const subjects = [
      {
        _id: 'sub_mat',
        name: 'Mathematics',
        code: 'GAMAT401',
        type: 'theory',
        classId,
        weeklyHours: 4,
        teachers: [teacherId],
        fixedSlots: [{ day: 'Monday', period: 3, isMandatory: true }],
      },
      {
        _id: 'sub_other',
        name: 'Other Subject',
        code: 'OTH101',
        type: 'theory',
        classId,
        weeklyHours: 2,
        teachers: ['teacher_other'],
      }
    ];
    teacherMap['teacher_other'] = { _id: 'teacher_other', name: 'Other Teacher', maxPeriodsPerDay: 4, maxPeriodsPerWeek: 16 };

    const data = {
      classes,
      subjects,
      teachers: Object.values(teacherMap),
      teacherMap,
      classMap,
      workingDays,
      periodsPerDayMap,
      allPeriodsPerDayMap: periodsPerDayMap,
      breakPeriodsPerDayMap,
      subjectsByClass: { [classId]: subjects },
      settings: { teacherDailyLimit: 4 },
      timeline: baseTimeline,
    };

    const res = placeAllSubjects(data, false);
    const mondayP3 = res.grid[classId]['Monday'][3];
    assert.equal(mondayP3.subjectCode, 'GAMAT401');
    assert.equal(mondayP3.isFixed, true);
    assert.equal(mondayP3.isLocked, true);
  });

  it('Feasibility checker detects fixed slot teacher collision across two classes', () => {
    const class1 = { _id: 'c1', name: 'S4 CSE A', semester: 4, section: 'A' };
    const class2 = { _id: 'c2', name: 'S4 CSE B', semester: 4, section: 'B' };
    const teacherId = 'teacher_sunitha';
    const teacherMap = { [teacherId]: { _id: teacherId, name: 'Ms Sunitha S', maxPeriodsPerWeek: 16 } };

    const subjects = [
      {
        _id: 's1',
        name: 'Maths A',
        code: 'GAMAT401',
        type: 'theory',
        classId: 'c1',
        weeklyHours: 4,
        teachers: [teacherId],
        fixedSlots: [{ day: 'Monday', period: 3, isMandatory: true }],
      },
      {
        _id: 's2',
        name: 'Maths B',
        code: 'GAMAT401',
        type: 'theory',
        classId: 'c2',
        weeklyHours: 4,
        teachers: [teacherId],
        fixedSlots: [{ day: 'Monday', period: 3, isMandatory: true }],
      },
    ];

    const data = {
      classes: [class1, class2],
      subjects,
      teachers: [teacherMap[teacherId]],
      teacherMap,
      classMap: { c1: class1, c2: class2 },
      workingDays,
      periodsPerDayMap,
      breakPeriodsPerDayMap,
      subjectsByClass: { c1: [subjects[0]], c2: [subjects[1]] },
      timeline: baseTimeline,
    };

    const feasibility = checkFeasibility(data);
    assert.equal(feasibility.feasible, false);
    const hasCollision = feasibility.errors.some(e => e.includes('Fixed slot conflict') && e.includes('Ms Sunitha S'));
    assert.equal(hasCollision, true);
  });

  it('Feasibility checker flags class workload exceeding 30 periods/week', () => {
    const class1 = { _id: 'c1', name: 'S4 CSE A', semester: 4, section: 'A' };
    const teacherId = 't1';
    const teacherMap = { [teacherId]: { _id: teacherId, name: 'Teacher 1', maxPeriodsPerWeek: 40 } };

    const subjects = [
      { _id: 's1', name: 'Big Subject', code: 'BIG1', type: 'theory', classId: 'c1', weeklyHours: 32, teachers: [teacherId] }
    ];

    const data = {
      classes: [class1],
      subjects,
      teachers: [teacherMap[teacherId]],
      teacherMap,
      classMap: { c1: class1 },
      workingDays,
      periodsPerDayMap,
      breakPeriodsPerDayMap,
      subjectsByClass: { c1: subjects },
      timeline: baseTimeline,
    };

    const feasibility = checkFeasibility(data);
    assert.equal(feasibility.feasible, false);
    const hasOverload = feasibility.errors.some(e => e.includes('needs 32 periods/week but only 30 teaching periods available'));
    assert.equal(hasOverload, true);
  });

  it('Validator flags S6 Open Elective in prohibited slot as hard violation', () => {
    const class1 = { _id: 'c_s6', name: 'S6 CSE A', semester: 6, section: 'A' };
    const grid = {
      c_s6: {
        Monday: {
          1: { isEmpty: false, subjectName: 'OE 1', isElective: true, electiveType: 'open', isOpenElective: true, period: 1 },
        }
      }
    };
    const data = {
      classes: [class1],
      classMap: { c_s6: class1 },
      workingDays,
      periodsPerDayMap,
      breakPeriodsPerDayMap,
      subjectsByClass: { c_s6: [] },
      timeline: baseTimeline,
    };

    const val = validateOutput(grid, data, []);
    const prohibitedViolation = val.hardViolations.find(v => v.type === 'S6_OPEN_ELECTIVE_PROHIBITED_SLOT');
    assert.ok(prohibitedViolation, 'Should report S6_OPEN_ELECTIVE_PROHIBITED_SLOT for Monday P1');
  });

  it('Validator accepts S6 Open Elective in approved slot (Monday P3)', () => {
    const class1 = { _id: 'c_s6', name: 'S6 CSE A', semester: 6, section: 'A' };
    const grid = {
      c_s6: {
        Monday: {
          3: { isEmpty: false, subjectName: 'OE 1', isElective: true, electiveType: 'open', isOpenElective: true, period: 3 },
        }
      }
    };
    const data = {
      classes: [class1],
      classMap: { c_s6: class1 },
      workingDays,
      periodsPerDayMap,
      breakPeriodsPerDayMap,
      subjectsByClass: { c_s6: [] },
      timeline: baseTimeline,
    };

    const val = validateOutput(grid, data, []);
    const prohibitedViolation = val.hardViolations.find(v => v.type === 'S6_OPEN_ELECTIVE_PROHIBITED_SLOT');
    assert.equal(prohibitedViolation, undefined, 'Monday P3 should be approved');
  });
});
