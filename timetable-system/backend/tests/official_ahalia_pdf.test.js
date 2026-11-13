const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Timetable = require('../src/models/Timetable');
const Class = require('../src/models/Class');
const Teacher = require('../src/models/Teacher');
const Department = require('../src/models/Department');
const Subject = require('../src/models/Subject');
const pdfService = require('../src/services/pdfService');

test('Official Ahalia Timetable PDF Test Suite (All 9 Classes & Teachers)', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI);

  const timetable = await Timetable.findOne({ version: 1 });
  assert.ok(timetable, 'Version 1 timetable must exist');

  const classes = await Class.find().populate('departmentId', 'name code').lean();
  assert.equal(classes.length, 9, 'Must have exactly 9 classes');

  const teachers = await Teacher.find().populate('departmentId', 'name code').lean();
  assert.ok(teachers.length > 0, 'Teachers must exist');

  const TARGET_CLASSES = [
    'S2 CSE A',
    'S2 CSE B',
    'S4 CSE A',
    'S4 CSE B',
    'S4 AIML',
    'S6 CSE A',
    'S6 CSE B',
    'S8 CSE A',
    'S8 CSE B',
  ];

  // Helper to extract text from generated PDF arraybuffer
  function extractPdfText(buffer) {
    return buffer.toString('utf8');
  }

  await t.test('Test 1: All 9 classes generate official Ahalia PDF with full subject names', async () => {
    for (const className of TARGET_CLASSES) {
      const cls = classes.find((c) => c.name === className) || {
        className,
        semester: className.match(/S\d/)?.[0] || '4',
        section: className.endsWith('B') ? 'B' : 'A',
        departmentId: { name: 'Computer Science and Engineering' },
      };

      const classTT = timetable.classTimetables.find((ct) => ct.className === className);
      assert.ok(classTT, `Timetable for ${className} must exist`);

      const pdfBuf = await pdfService.generateClassPdf(cls, classTT, timetable);
      assert.ok(pdfBuf.length > 20000, `PDF for ${className} must be valid size (>20KB)`);

      const rawText = extractPdfText(pdfBuf);

      // Verify Official Ahalia Branding & Metadata
      assert.match(rawText, /AHALIA SCHOOL OF ENGINEERING/i, `${className} must contain Ahalia header`);
      assert.match(rawText, /ISO 9001:2015/i, `${className} must contain ISO certification`);
      assert.match(rawText, /ASET-CS\/DS03\/FM06/i, `${className} must contain Form No FM06`);
      assert.match(rawText, /CLASS TIME TABLE/i, `${className} must contain Class Time Table title`);

      // Verify Friday Special Timings & Prayer Break
      assert.match(rawText, /FRIDAY SPECIAL LUNCH[\s\S]*?PRAYER BREAK/i, `${className} must contain Friday Prayer Break`);
      assert.match(rawText, /12:50/i, `${className} must show 12:50 PM Friday break timing`);
      assert.match(rawText, /02:30/i, `${className} must show 02:30 PM Friday resume timing`);

      // Verify Monday-Thursday Timings
      assert.match(rawText, /09:00 - 10:00/i, `${className} must show P1 09:00 - 10:00`);
      assert.match(rawText, /11:00[\s\S]*?11:20/i, `${className} must show Mon-Thu short break`);
      assert.match(rawText, /12:20[\s\S]*?01:10/i, `${className} must show Mon-Thu lunch break`);
    }
  });

  await t.test('Test 2: Full human-readable subject names are prominently rendered (no pure-code replacement)', async () => {
    const s4bClass = classes.find((c) => c.name === 'S4 CSE B');
    const s4bTT = timetable.classTimetables.find((ct) => ct.className === 'S4 CSE B');
    const pdfBuf = await pdfService.generateClassPdf(s4bClass, s4bTT, timetable);
    const rawText = extractPdfText(pdfBuf);

    // Verify key subjects appear as full uppercase names
    assert.match(rawText, /DATABASE MANAGEMENT SYSTEMS/i, 'Full name DATABASE MANAGEMENT SYSTEMS must appear');
    assert.match(rawText, /OPERATING SYSTEMS/i, 'Full name OPERATING SYSTEMS must appear');
    assert.match(rawText, /COMPUTER ORGANIZATION AND ARCHITECTURE/i, 'Full name COA must appear');
    assert.match(rawText, /MATHEMATICS FOR INFORMATION SCIENCE 4/i, 'Full name Math 4 must appear');
    assert.match(rawText, /ENGINEERING ETHICS AND SUSTAINABLE DEVELOPMENT/i, 'Full name Ethics must appear');

    // Verify secondary codes are also present
    assert.match(rawText, /PCCST402/i, 'Code PCCST402 must appear as secondary');
    assert.match(rawText, /PCCST403/i, 'Code PCCST403 must appear as secondary');
    assert.match(rawText, /PBCST404/i, 'Code PBCST404 must appear as secondary');
  });

  await t.test('Test 3: S8 Project Phase-2 and Comprehensive Viva resolve correctly', async () => {
    const s8aClass = classes.find((c) => c.name === 'S8 CSE A');
    const s8aTT = timetable.classTimetables.find((ct) => ct.className === 'S8 CSE A');
    const pdfBuf = await pdfService.generateClassPdf(s8aClass, s8aTT, timetable);
    const rawText = extractPdfText(pdfBuf);

    assert.match(rawText, /PROJECT PHASE-2/i, 'S8A must prominently display PROJECT PHASE-2');
    assert.match(rawText, /CST416/i, 'S8A must show code CST416');
    assert.match(rawText, /DR S GUNASEKARAN/i, 'S8A Project must show Dr S Gunasekaran');
    assert.match(rawText, /COMPREHENSIVE COURSE VIVA/i, 'S8A must show COMPREHENSIVE COURSE VIVA');
  });

  await t.test('Test 4: Multi-period lab blocks are properly identified and formatted', async () => {
    const s4aClass = classes.find((c) => c.name === 'S4 CSE A');
    const s4aTT = timetable.classTimetables.find((ct) => ct.className === 'S4 CSE A');
    const pdfBuf = await pdfService.generateClassPdf(s4aClass, s4aTT, timetable);
    const rawText = extractPdfText(pdfBuf);

    assert.match(rawText, /DBMS LAB/i, 'S4A must show DBMS LAB');
    assert.match(rawText, /OPERATING SYSTEMS LAB/i, 'S4A must show OPERATING SYSTEMS LAB');
    assert.match(rawText, /\[LAB\]/i, 'Lab designation tag must be visible');
  });

  await t.test('Test 5: All-Classes PDF generates multi-page document with 1 page per class', async () => {
    const allBuf = await pdfService.generateAllClassesPdf(classes, timetable);
    assert.ok(allBuf.length > 250000, 'All classes PDF must be > 250KB');

    const rawText = extractPdfText(allBuf);

    // Count occurrences of Form No (1 per class page)
    const formMatches = rawText.match(/ASET-CS\/DS03\/FM06/g) || [];
    assert.equal(formMatches.length, 9, 'All Classes PDF must have exactly 9 class pages');

    // Count occurrences of Friday Special Lunch Break
    const breakMatches = rawText.match(/FRIDAY SPECIAL LUNCH/g) || [];
    assert.equal(breakMatches.length, 18, 'All Classes PDF must have Friday break on all 9 pages (header + row)');
  });

  await t.test('Test 6: Teacher Personal Timetable PDF generates with official Form FM07 and Friday timing', async () => {
    const reshmi = teachers.find((t) => t.name.includes('Reshmi')) || teachers[0];
    const teacherBuf = await pdfService.generateTeacherPdf(reshmi, timetable);
    assert.ok(teacherBuf.length > 20000, 'Teacher PDF must be valid size');

    const rawText = extractPdfText(teacherBuf);

    assert.match(rawText, /TEACHER TIME TABLE/i, 'Must have TEACHER TIME TABLE title');
    assert.match(rawText, /ASET-CS\/DS03\/FM07/i, 'Must have Form No FM07');
    assert.match(rawText, /FRIDAY SPECIAL LUNCH[\s\S]*?PRAYER BREAK/i, 'Must have Friday Prayer break');
    assert.match(rawText, /DR RESHMI B/i, 'Must have Faculty Name Dr Reshmi B');
  });

  await mongoose.disconnect();
});
