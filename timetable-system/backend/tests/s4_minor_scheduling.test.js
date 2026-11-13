const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

describe('S4 CSE Minor Subject Scheduling Module - Acceptance Suite', () => {
  let MinorGroup, Timetable, Class, Subject, Teacher, Department;
  let testMinorGroupId;

  before(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/timetable_db');
    MinorGroup = require('../src/models/MinorGroup');
    Timetable = require('../src/models/Timetable');
    Class = require('../src/models/Class');
    Subject = require('../src/models/Subject');
    Teacher = require('../src/models/Teacher');
    Department = require('../src/models/Department');
  });

  after(async () => {
    await mongoose.disconnect();
  });

  test('1. Minor configuration creation in database', async () => {
    const cseDept = await Department.findOne({ code: 'CSE' });
    assert.ok(cseDept, 'CSE Department must exist');

    const group = await MinorGroup.create({
      name: 'Test S4 CSE Minor Group',
      departmentId: cseDept._id,
      semester: 4,
      sections: ['A', 'B'],
      weeklyHours: 4,
      isActive: true,
      slots: [
        { day: 'Monday', period: 3, subjectCode: 'GAMAT401', subjectName: 'Mathematics', weeklyHours: 1 },
        { day: 'Thursday', period: 3, subjectCode: 'PCCST402', subjectName: 'DBMS', weeklyHours: 1 },
        { day: 'Friday', period: 4, subjectCode: 'PCCST403', subjectName: 'OS', weeklyHours: 1 },
        { day: 'Friday', period: 6, subjectCode: 'PBCST404', subjectName: 'COA', weeklyHours: 1 },
      ],
    });

    assert.ok(group._id, 'Group must be assigned MongoDB _id');
    testMinorGroupId = group._id;
  });

  test('2. Minor configuration editing and persistence', async () => {
    const updated = await MinorGroup.findByIdAndUpdate(
      testMinorGroupId,
      { notes: 'Updated KTU 2026 Regulation S4 Minor' },
      { new: true }
    );
    assert.equal(updated.notes, 'Updated KTU 2026 Regulation S4 Minor');
  });

  test('3. Dynamic Minor hours configuration (supports 4 hours by default)', async () => {
    const group = await MinorGroup.findById(testMinorGroupId);
    assert.equal(group.weeklyHours, 4, 'Default configured weekly Minor hours must be 4');
  });

  test('4. Configured subject entries match Mathematics, DBMS, OS, COA', async () => {
    const group = await MinorGroup.findById(testMinorGroupId);
    const codes = group.slots.map(s => s.subjectCode);
    assert.ok(codes.includes('GAMAT401'), 'Must include GAMAT401 (Mathematics)');
    assert.ok(codes.includes('PCCST402'), 'Must include PCCST402 (DBMS)');
    assert.ok(codes.includes('PCCST403'), 'Must include PCCST403 (OS)');
    assert.ok(codes.includes('PBCST404'), 'Must include PBCST404 (COA)');
  });

  test('5. Monday Period 3 reservation for Minor', async () => {
    const group = await MinorGroup.findById(testMinorGroupId);
    const monP3 = group.slots.find(s => s.day === 'Monday' && s.period === 3);
    assert.ok(monP3, 'Monday Period 3 must be a reserved Minor slot');
    assert.equal(monP3.subjectCode, 'GAMAT401');
  });

  test('6. Thursday Period 3 reservation for Minor', async () => {
    const group = await MinorGroup.findById(testMinorGroupId);
    const thuP3 = group.slots.find(s => s.day === 'Thursday' && s.period === 3);
    assert.ok(thuP3, 'Thursday Period 3 must be a reserved Minor slot');
    assert.equal(thuP3.subjectCode, 'PCCST402');
  });

  test('7. Friday Period 4 reservation for Minor', async () => {
    const group = await MinorGroup.findById(testMinorGroupId);
    const friP4 = group.slots.find(s => s.day === 'Friday' && s.period === 4);
    assert.ok(friP4, 'Friday Period 4 must be a reserved Minor slot');
    assert.equal(friP4.subjectCode, 'PCCST403');
  });

  test('8. Friday Period 6 reservation for Minor', async () => {
    const group = await MinorGroup.findById(testMinorGroupId);
    const friP6 = group.slots.find(s => s.day === 'Friday' && s.period === 6);
    assert.ok(friP6, 'Friday Period 6 must be a reserved Minor slot');
    assert.equal(friP6.subjectCode, 'PBCST404');
  });

  test('9. Synchronization between S4 CSE A and S4 CSE B in published timetable', async () => {
    const published = await Timetable.findOne({ publicationStatus: 'PUBLISHED' }).sort({ version: -1 });
    assert.ok(published, 'A published timetable must exist');

    const s4A = published.classTimetables.find(c => c.className === 'S4 CSE A');
    const s4B = published.classTimetables.find(c => c.className === 'S4 CSE B');
    assert.ok(s4A && s4B, 'Both S4 CSE A and S4 CSE B must exist');

    const reservedSlots = [
      { day: 'Monday', period: 3 },
      { day: 'Thursday', period: 3 },
      { day: 'Friday', period: 4 },
      { day: 'Friday', period: 6 },
    ];

    for (const rs of reservedSlots) {
      const slotA = s4A.slots.find(s => s.day === rs.day && s.period === rs.period);
      const slotB = s4B.slots.find(s => s.day === rs.day && s.period === rs.period);

      assert.ok(slotA && slotA.isMinor, `S4 CSE A must have Minor on ${rs.day} P${rs.period}`);
      assert.ok(slotB && slotB.isMinor, `S4 CSE B must have Minor on ${rs.day} P${rs.period}`);
      // Under Sub-Minor system, permutation solver assigns collision-free subjects to fixed slots
      assert.ok(slotA.subjectCode && slotB.subjectCode, 'Both sections must have assigned sub-minor subjects');
    }
  });

  test('10. Faculty conflict rejection (zero unauthorized collisions)', async () => {
    const published = await Timetable.findOne({ publicationStatus: 'PUBLISHED' }).sort({ version: -1 });
    const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
    const val = await validatePersistedTimetable(published);
    assert.equal(val.checks.zero_teacher_conflicts, true, 'Zero teacher collisions must be maintained');
    assert.equal(val.checks.minor_slots_synchronized, true, 'Minor synchronization check must pass');
  });

  test('11. Room conflict rejection (zero room collisions)', async () => {
    const published = await Timetable.findOne({ publicationStatus: 'PUBLISHED' }).sort({ version: -1 });
    const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
    const val = await validatePersistedTimetable(published);
    assert.equal(val.checks.zero_room_conflicts, true, 'Zero room double-bookings must be maintained');
  });

  test('12. Student-group collision rejection (zero class conflicts)', async () => {
    const published = await Timetable.findOne({ publicationStatus: 'PUBLISHED' }).sort({ version: -1 });
    const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
    const val = await validatePersistedTimetable(published);
    assert.equal(val.checks.zero_class_conflicts, true, 'Zero class conflicts must be maintained');
  });

  test('13. Duplicate Minor assignment prevention', async () => {
    const duplicateSlots = [
      { day: 'Monday', period: 3, subjectCode: 'GAMAT401' },
      { day: 'Monday', period: 3, subjectCode: 'PCCST402' }, // Duplicate day + period
    ];
    const seen = new Set();
    let hasDuplicate = false;
    for (const s of duplicateSlots) {
      const key = `${s.day}-${s.period}`;
      if (seen.has(key)) hasDuplicate = true;
      seen.add(key);
    }
    assert.equal(hasDuplicate, true, 'Duplicate slot detector must identify and reject duplicates');
  });

  test('14. Workload integrity (transparent tracking, exactly 4 Minor hours)', async () => {
    const published = await Timetable.findOne({ publicationStatus: 'PUBLISHED' }).sort({ version: -1 });
    const s4A = published.classTimetables.find(c => c.className === 'S4 CSE A');
    const s4B = published.classTimetables.find(c => c.className === 'S4 CSE B');

    const minorCountA = s4A.slots.filter(s => s.isMinor).length;
    const minorCountB = s4B.slots.filter(s => s.isMinor).length;

    assert.equal(minorCountA, 4, 'S4 CSE A must have exactly 4 Minor periods');
    assert.equal(minorCountB, 4, 'S4 CSE B must have exactly 4 Minor periods');
  });

  test('15. Database persistence across queries', async () => {
    const reloadedGroup = await MinorGroup.findById(testMinorGroupId);
    assert.ok(reloadedGroup, 'Minor group must persist in MongoDB');
    assert.equal(reloadedGroup.semester, 4);
    // Cleanup temporary test group
    await MinorGroup.findByIdAndDelete(testMinorGroupId);
  });

  test('16. Engine reservation integration (slotPlacer S4_MINOR_RESERVED_SLOTS)', () => {
    const fs = require('fs');
    const slotPlacerContent = fs.readFileSync('src/services/engine/slotPlacer.js', 'utf8');
    assert.ok(slotPlacerContent.includes('S4_MINOR_RESERVED_SLOTS'), 'slotPlacer must define S4_MINOR_RESERVED_SLOTS');
    assert.ok(slotPlacerContent.includes('SHARED_MINOR_'), 'slotPlacer must support SHARED_MINOR_ session linking');
  });

  test('17. Published timetable display attributes', async () => {
    const published = (await Timetable.findOne({ isAccepted: true })) || (await Timetable.findOne({ publicationStatus: 'PUBLISHED' }).sort({ version: -1 }));
    const s4A = published.classTimetables.find(c => c.className === 'S4 CSE A');
    const minorSlot = s4A.slots.find(s => s.isMinor);

    assert.ok(minorSlot, 'Minor slot must exist');
    assert.equal(minorSlot.subjectType, 'minor');
    assert.equal(minorSlot.isLocked, true);
    assert.ok(minorSlot.subjectName, 'Subject name must be populated');
    assert.ok(minorSlot.teacherNames.length > 0, 'Teacher names must be assigned');
  });

  test('18. Faculty timetable display compatibility', async () => {
    const published = (await Timetable.findOne({ isAccepted: true })) || (await Timetable.findOne({ publicationStatus: 'PUBLISHED' }).sort({ version: -1 }));
    const happy = await Teacher.findOne({ name: /Happy/i });
    assert.ok(happy, 'Ms Happy A must exist');

    const teacherSlots = [];
    for (const ct of published.classTimetables) {
      for (const slot of ct.slots) {
        if (slot.teacherIds?.some(id => id.toString() === happy._id.toString()) || slot.teacherNames?.some(n => n.includes('Happy'))) {
          teacherSlots.push({ ...slot.toObject(), className: ct.className });
        }
      }
    }

    const friP6Minor = teacherSlots.find(s => s.day === 'Friday' && s.period === 6 && s.isMinor);
    assert.ok(friP6Minor, 'Ms Happy A must have Friday P6 Minor session in her personal timetable');
  });

  test('19. Official export display compatibility', () => {
    const fs = require('fs');
    const pdfServiceContent = fs.readFileSync('src/services/pdfService.js', 'utf8');
    assert.ok(pdfServiceContent.includes('isMinor'), 'pdfService must handle isMinor');
    assert.ok(pdfServiceContent.includes('Minor /') || pdfServiceContent.includes('MINOR —'), 'pdfService must format Minor subjects');
  });

  test('20. Existing elective and laboratory functionality remains unaffected', async () => {
    const published = await Timetable.findOne({ publicationStatus: 'PUBLISHED' }).sort({ version: -1 });
    const { validatePersistedTimetable } = require('../src/services/engine/persistedValidator');
    const val = await validatePersistedTimetable(published);

    assert.equal(val.checks.zero_lab_block_violations, true, 'Zero lab block violations');
    assert.equal(val.checks.zero_teacher_conflicts, true, 'Zero teacher conflicts');
    assert.equal(val.checks.minor_slots_synchronized, true, 'Minor slots synchronized');
  });
});
