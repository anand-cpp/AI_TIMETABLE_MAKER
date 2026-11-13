const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default || require('jspdf-autotable');

const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Department = require('../models/Department');

/**
 * Official Ahalia Timetable PDF Generation Service
 * Layout: Professional A3 Landscape (420mm x 297mm)
 * - Human-readable Full Subject Names as Primary Display
 * - Secondary Subject Codes and Faculty
 * - Explicit Friday Special Timings & 12:50 PM - 02:30 PM Prayer Break
 * - Official Ahalia Header (Form No. ASET-CS/DS03/FM06 / FM07)
 * - Subject Legend and Workload Breakdown
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAYS_MON_THU = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];

// ── Cache / Resolution Helper ──────────────────────────────────────────────────
async function getResolutionMaps() {
  const [subjects, teachers, classes] = await Promise.all([
    Subject.find().lean(),
    Teacher.find().lean(),
    Class.find().populate('departmentId', 'name code').lean(),
  ]);

  const subjectMap = new Map();
  const subjectCodeMap = new Map();
  for (const s of subjects) {
    subjectMap.set(s._id.toString(), s);
    if (s.code) subjectCodeMap.set(s.code.trim().toUpperCase(), s);
  }

  const teacherMap = new Map();
  for (const t of teachers) {
    teacherMap.set(t._id.toString(), t);
  }

  const classMap = new Map();
  for (const c of classes) {
    classMap.set(c._id.toString(), c);
  }

  return { subjectMap, subjectCodeMap, teacherMap, classMap };
}

// ── Resolve Slot Subject & Teacher Names ────────────────────────────────────────
function resolveSlot(slot, maps) {
  if (!slot || slot.isEmpty || slot.isBreak) return null;

  let name = slot.subjectName || '';
  let code = slot.subjectCode || '';
  let teachers = Array.isArray(slot.teacherNames)
    ? [...slot.teacherNames]
    : slot.teacherNames
    ? [slot.teacherNames]
    : [];

  // If name or code is missing, resolve from database maps
  if ((!name || !code) && slot.subjectId && maps?.subjectMap?.has(slot.subjectId.toString())) {
    const sub = maps.subjectMap.get(slot.subjectId.toString());
    if (!name) name = sub.name;
    if (!code) code = sub.code;
  }
  if (!name && code && maps?.subjectCodeMap?.has(code.trim().toUpperCase())) {
    name = maps.subjectCodeMap.get(code.trim().toUpperCase()).name;
  }
  if (!teachers.length && slot.teacherIds?.length && maps?.teacherMap) {
    teachers = slot.teacherIds
      .map((tid) => maps.teacherMap.get(tid.toString())?.name)
      .filter(Boolean);
  }

  const isLab = slot.subjectType === 'lab' || slot.subjectType === 'practical' || slot.isLabBlock;
  const isElective = slot.isElective;
  const isMinor = slot.isMinor || slot.subjectType === 'minor';
  const isTutorial = slot.subjectType === 'tutorial' || slot.overrideType === 'tutorial';

  return {
    name: name || code || 'Unspecified Subject',
    code: code || '',
    teachers: teachers.filter(Boolean).join(', '),
    isLab,
    isElective,
    isMinor,
    isTutorial,
    room: slot.roomName || '',
    raw: slot,
  };
}

// ── Format Cell Text for autotable ─────────────────────────────────────────────
function formatCell(slotDetails) {
  if (!slotDetails) return '';

  const lines = [];
  // 1. Primary: FULL HUMAN-READABLE SUBJECT NAME (Uppercase & Prominent)
  // Strips redundant 'Minor /' or 'MINOR —' prefix when [MINOR] activity badge is displayed
  let displayName = slotDetails.name || "";
  if (slotDetails.isMinor) {
    displayName = displayName
      .replace(/^\s*minor\s*[\/\-—:]\s*/i, '')
      .replace(/\s*[\/\-—:]\s*minor\s*$/i, '')
      .replace(/\s*\/\s*minor\b/i, '')
      .replace(/\bminor\s*\/\s*/i, '')
      .replace(/\s*\(\s*minor\s*\)/i, '')
      .trim() || displayName;
  }
  lines.push(displayName.toUpperCase());

  // 2. Secondary: Subject Code + Activity Marker
  if (slotDetails.code) {
    let codeStr = slotDetails.code;
    if (slotDetails.isTutorial) codeStr += ' ®';
    if (slotDetails.isLab) codeStr += ' [LAB]';
    if (slotDetails.isElective) codeStr += ' [ELEC]';
    if (slotDetails.isMinor) codeStr += ' [MINOR]';
    lines.push(codeStr);
  }

  // 3. Secondary: Assigned Faculty
  if (slotDetails.teachers) {
    lines.push(`Faculty: ${slotDetails.teachers}`);
  }

  // 4. Room
  if (slotDetails.room) {
    lines.push(`Room: ${slotDetails.room}`);
  }

  return lines.join('\n');
}

// ── Render Official Ahalia Class Timetable Page (A3 Landscape) ─────────────────
function renderClassPage(doc, cls, classTT, timetable, maps, isFirstPage = false) {
  if (!isFirstPage) {
    doc.addPage('a3', 'landscape');
  }

  const pageWidth = 420;
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2; // 390mm

  // 1. AHALIA 3-COLUMN OFFICIAL HEADER TABLE
  autoTable(doc, {
    startY: 10,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [],
    body: [
      [
        {
          content: 'Written By: ISO Coordinator\nApproved By: Principal\nEffective Date: 27-08-2024',
          styles: { fontStyle: 'bold', fontSize: 8, halign: 'left', valign: 'top' },
        },
        {
          content:
            'AHALIA SCHOOL OF ENGINEERING & TECHNOLOGY\nISO 9001:2015 Certified Institution | Approved by AICTE & Affiliated to APJ Abdul Kalam Technological University\nAhalia Health, Heritage & Knowledge Village, Palakkad - 678557 Ph: 04923-226666, www.ahalia.ac.in',
          styles: {
            fontStyle: 'bold',
            fontSize: 10,
            halign: 'center',
            valign: 'middle',
            textColor: [0, 51, 153],
          },
        },
        {
          content: 'Issue No: 02\nRevision No.: 00\nRevision Date: 21-08-2024',
          styles: { fontStyle: 'bold', fontSize: 8, halign: 'left', valign: 'top' },
        },
      ],
    ],
    theme: 'plain',
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.3,
    styles: { cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 210 },
      2: { cellWidth: 90 },
    },
  });

  let currentY = doc.lastAutoTable.finalY + 3;

  // Form No & Title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Form No.: ASET-CS/DS03/FM06', marginX, currentY);

  currentY += 4;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('CLASS TIME TABLE', pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  const deptName =
    cls.departmentId?.name ||
    (cls.className?.includes('AIML')
      ? 'Artificial Intelligence and Machine Learning'
      : 'Computer Science and Engineering');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Department of ${deptName}`, pageWidth / 2, currentY, { align: 'center' });

  currentY += 6;

  // Metadata Bar
  const academicYear = timetable.academicYear || '2026-27';
  const semester = cls.semester || 'ODD';
  const className = cls.className || `Semester ${cls.semester} ${cls.section || ''}`;
  const roomNo = cls.roomName || 'LH 102';

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [],
    body: [
      [
        `Academic Year: ${academicYear}`,
        `Semester: ${semester}`,
        `Class: ${className}`,
        `Room No: ${roomNo}`,
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 9, fontStyle: 'bold', cellPadding: 1 },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
    },
  });

  currentY = doc.lastAutoTable.finalY + 2;

  // Build Slot Map
  const slotMap = {};
  for (const s of classTT.slots || []) {
    if (!slotMap[s.day]) slotMap[s.day] = {};
    slotMap[s.day][s.period] = resolveSlot(s, maps);
  }

  // 2. MONDAY TO THURSDAY TABLE (Exact Column Widths: Sum = 390mm)
  const monThuHead = [
    [
      { content: 'DAY / HR', styles: { halign: 'center', valign: 'middle' } },
      { content: 'Period 1\n09:00 - 10:00 AM', styles: { halign: 'center' } },
      { content: 'Period 2\n10:00 - 11:00 AM', styles: { halign: 'center' } },
      { content: 'SHORT BREAK\n11:00 - 11:20 AM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 3\n11:20 AM - 12:20 PM', styles: { halign: 'center' } },
      { content: 'LUNCH BREAK\n12:20 - 01:10 PM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 4\n01:10 - 02:10 PM', styles: { halign: 'center' } },
      { content: 'Period 5\n02:10 - 03:10 PM', styles: { halign: 'center' } },
      { content: 'SHORT BREAK\n03:10 - 03:20 PM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 6\n03:20 - 04:20 PM', styles: { halign: 'center' } },
    ],
  ];

  const monThuBody = [];
  for (const day of DAYS_MON_THU) {
    const row = [
      { content: day.substring(0, 3).toUpperCase(), styles: { fontStyle: 'bold', halign: 'center', valign: 'middle' } },
    ];

    const p1 = slotMap[day]?.[1];
    const p2 = slotMap[day]?.[2];
    const p3 = slotMap[day]?.[3];
    const p4 = slotMap[day]?.[4];
    const p5 = slotMap[day]?.[5];
    const p6 = slotMap[day]?.[6];

    // Check lab merges for 1-2
    const isLab12 = p1?.isLab && p2?.isLab && p1?.code === p2?.code;
    if (isLab12) {
      row.push({ content: formatCell(p1), colSpan: 2, styles: { fillColor: [239, 246, 255], fontStyle: 'bold' } });
    } else {
      row.push({ content: formatCell(p1), styles: p1?.isLab ? { fillColor: [239, 246, 255] } : {} });
      row.push({ content: formatCell(p2), styles: p2?.isLab ? { fillColor: [239, 246, 255] } : {} });
    }

    // Short Break 1 (11:00 - 11:20)
    row.push({
      content: 'BREAK',
      styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 },
    });

    // P3
    row.push({ content: formatCell(p3), styles: p3?.isLab ? { fillColor: [239, 246, 255] } : {} });

    // Lunch Break (12:20 - 1:10)
    row.push({
      content: 'LUNCH\nBREAK',
      styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 },
    });

    // P4, P5
    const isLab45 = p4?.isLab && p5?.isLab && p4?.code === p5?.code;
    if (isLab45) {
      row.push({ content: formatCell(p4), colSpan: 2, styles: { fillColor: [239, 246, 255], fontStyle: 'bold' } });
    } else {
      row.push({ content: formatCell(p4), styles: p4?.isLab ? { fillColor: [239, 246, 255] } : {} });
      row.push({ content: formatCell(p5), styles: p5?.isLab ? { fillColor: [239, 246, 255] } : {} });
    }

    // Short Break 2 (15:10 - 15:20)
    row.push({
      content: 'BREAK',
      styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 },
    });

    // P6
    row.push({ content: formatCell(p6), styles: p6?.isLab ? { fillColor: [239, 246, 255] } : {} });

    monThuBody.push(row);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: monThuHead,
    body: monThuBody,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 14,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 53 },
      2: { cellWidth: 53 },
      3: { cellWidth: 13 },
      4: { cellWidth: 53 },
      5: { cellWidth: 26 },
      6: { cellWidth: 53 },
      7: { cellWidth: 53 },
      8: { cellWidth: 13 },
      9: { cellWidth: 53 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 3;

  // 3. FRIDAY SPECIAL TIMING TABLE (Exact Column Widths: Sum = 390mm)
  const friHead = [
    [
      { content: 'DAY / HR', styles: { halign: 'center', valign: 'middle' } },
      { content: 'Period 1\n09:00 - 10:00 AM', styles: { halign: 'center' } },
      { content: 'Period 2\n10:00 - 11:00 AM', styles: { halign: 'center' } },
      { content: 'SHORT BREAK\n11:00 - 11:10 AM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 3\n11:10 AM - 12:00 PM', styles: { halign: 'center' } },
      { content: 'Period 4\n12:00 - 12:50 PM', styles: { halign: 'center' } },
      {
        content: 'FRIDAY SPECIAL LUNCH / PRAYER BREAK\n12:50 PM - 02:30 PM',
        styles: {
          halign: 'center',
          valign: 'middle',
          fontStyle: 'bold',
          fillColor: [254, 243, 199],
          textColor: [146, 64, 14],
          fontSize: 7.5,
        },
      },
      { content: 'Period 5\n02:30 - 03:20 PM', styles: { halign: 'center' } },
      { content: 'SHORT BREAK\n03:20 - 03:30 PM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 6\n03:30 - 04:20 PM', styles: { halign: 'center' } },
    ],
  ];

  const friP1 = slotMap['Friday']?.[1];
  const friP2 = slotMap['Friday']?.[2];
  const friP3 = slotMap['Friday']?.[3];
  const friP4 = slotMap['Friday']?.[4];
  const friP5 = slotMap['Friday']?.[5];
  const friP6 = slotMap['Friday']?.[6];

  const friRow = [
    { content: 'FRI', styles: { fontStyle: 'bold', halign: 'center', valign: 'middle' } },
  ];

  // Friday P1, P2
  const isFriLab12 = friP1?.isLab && friP2?.isLab && friP1?.code === friP2?.code;
  if (isFriLab12) {
    friRow.push({ content: formatCell(friP1), colSpan: 2, styles: { fillColor: [239, 246, 255], fontStyle: 'bold' } });
  } else {
    friRow.push({ content: formatCell(friP1), styles: friP1?.isLab ? { fillColor: [239, 246, 255] } : {} });
    friRow.push({ content: formatCell(friP2), styles: friP2?.isLab ? { fillColor: [239, 246, 255] } : {} });
  }

  // Friday Break 1 (11:00 - 11:10)
  friRow.push({
    content: 'BREAK',
    styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 },
  });

  // Friday P3 (11:10 - 12:00)
  friRow.push({ content: formatCell(friP3), styles: friP3?.isLab ? { fillColor: [239, 246, 255] } : {} });

  // Friday P4 (12:00 - 12:50)
  friRow.push({ content: formatCell(friP4), styles: friP4?.isLab ? { fillColor: [239, 246, 255] } : {} });

  // Friday Special Lunch / Prayer Break (12:50 - 2:30 PM)
  friRow.push({
    content: 'FRIDAY SPECIAL LUNCH / PRAYER BREAK\n(12:50 PM to 02:30 PM)',
    styles: {
      halign: 'center',
      valign: 'middle',
      fontStyle: 'bold',
      fillColor: [254, 243, 199],
      textColor: [146, 64, 14],
      fontSize: 8,
    },
  });

  // Friday P5 (2:30 - 3:20)
  friRow.push({ content: formatCell(friP5), styles: friP5?.isLab ? { fillColor: [239, 246, 255] } : {} });

  // Friday Break 2 (3:20 - 3:30)
  friRow.push({
    content: 'BREAK',
    styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 },
  });

  // Friday P6 (3:30 - 4:20)
  friRow.push({ content: formatCell(friP6), styles: friP6?.isLab ? { fillColor: [239, 246, 255] } : {} });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: friHead,
    body: [friRow],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 14,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 51 },
      2: { cellWidth: 51 },
      3: { cellWidth: 13 },
      4: { cellWidth: 51 },
      5: { cellWidth: 51 },
      6: { cellWidth: 38 },
      7: { cellWidth: 51 },
      8: { cellWidth: 13 },
      9: { cellWidth: 51 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 4;

  // 4. SUBJECT LEGEND TABLE (Exact Column Widths: Sum = 390mm)
  const legendMap = {};
  for (const day of DAYS) {
    for (let p = 1; p <= 6; p++) {
      const s = slotMap[day]?.[p];
      if (!s) continue;
      const key = s.code || s.name;
      if (!legendMap[key]) {
        legendMap[key] = {
          code: s.code || 'N/A',
          name: s.name,
          teachers: s.teachers || 'Assigned Faculty',
          L: 0,
          T: 0,
          P: 0,
          total: 0,
        };
      }
      if (s.isTutorial) legendMap[key].T += 1;
      else if (s.isLab) legendMap[key].P += 1;
      else legendMap[key].L += 1;
      legendMap[key].total += 1;
    }
  }

  const legendList = Object.values(legendMap);

  const legendHead = [
    [
      { content: 'Sl', styles: { halign: 'center' } },
      { content: 'Subject Code', styles: { halign: 'center' } },
      { content: 'Full Subject Name', styles: { halign: 'left' } },
      { content: 'Assigned Faculty', styles: { halign: 'left' } },
      { content: 'L', styles: { halign: 'center' } },
      { content: 'T', styles: { halign: 'center' } },
      { content: 'P', styles: { halign: 'center' } },
      { content: 'Total', styles: { halign: 'center' } },
    ],
  ];

  const legendBody = legendList.map((item, idx) => [
    idx + 1,
    item.code,
    item.name.toUpperCase(),
    item.teachers,
    item.L,
    item.T,
    item.P,
    item.total,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: legendHead,
    body: legendBody,
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.2,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 35 },
      2: { cellWidth: 160 },
      3: { cellWidth: 115 },
      4: { cellWidth: 15 },
      5: { cellWidth: 15 },
      6: { cellWidth: 15 },
      7: { cellWidth: 25 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // 5. SIGNATURES ROW
  if (currentY > 280) currentY = 280;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  const sigSpacing = contentWidth / 4;
  doc.text('Class Advisor', marginX + 15, currentY);
  doc.text('Timetable Coordinator', marginX + sigSpacing + 15, currentY);
  doc.text('HOD, CSE', marginX + sigSpacing * 2 + 30, currentY);
  doc.text('Principal', marginX + sigSpacing * 3 + 45, currentY);
}

// ── Render Official Teacher Timetable Page (A3 Landscape) ──────────────────────
function renderTeacherPage(doc, teacher, timetable, maps, isFirstPage = false) {
  if (!isFirstPage) {
    doc.addPage('a3', 'landscape');
  }

  const pageWidth = 420;
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2; // 390mm

  // 1. AHALIA 3-COLUMN OFFICIAL HEADER TABLE
  autoTable(doc, {
    startY: 10,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [],
    body: [
      [
        {
          content: 'Written By: ISO Coordinator\nApproved By: Principal\nEffective Date: 27-08-2024',
          styles: { fontStyle: 'bold', fontSize: 8, halign: 'left', valign: 'top' },
        },
        {
          content:
            'AHALIA SCHOOL OF ENGINEERING & TECHNOLOGY\nISO 9001:2015 Certified Institution | Approved by AICTE & Affiliated to APJ Abdul Kalam Technological University\nAhalia Health, Heritage & Knowledge Village, Palakkad - 678557 Ph: 04923-226666, www.ahalia.ac.in',
          styles: {
            fontStyle: 'bold',
            fontSize: 10,
            halign: 'center',
            valign: 'middle',
            textColor: [0, 51, 153],
          },
        },
        {
          content: 'Issue No: 02\nRevision No.: 00\nRevision Date: 21-08-2024',
          styles: { fontStyle: 'bold', fontSize: 8, halign: 'left', valign: 'top' },
        },
      ],
    ],
    theme: 'plain',
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.3,
    styles: { cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 210 },
      2: { cellWidth: 90 },
    },
  });

  let currentY = doc.lastAutoTable.finalY + 3;

  // Form No & Title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Form No.: ASET-CS/DS03/FM07', marginX, currentY);

  currentY += 4;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('TEACHER TIME TABLE', pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  const deptName = teacher.departmentId?.name || 'Computer Science and Engineering';
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Department of ${deptName}`, pageWidth / 2, currentY, { align: 'center' });

  currentY += 6;

  // Metadata Bar
  const academicYear = timetable.academicYear || '2026-27';
  const designation = teacher.designation || 'Faculty';

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [],
    body: [
      [
        `Academic Year: ${academicYear}`,
        `Faculty Name: ${teacher.name}`,
        `Designation: ${designation}`,
        `Department: ${deptName}`,
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 9, fontStyle: 'bold', cellPadding: 1 },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
    },
  });

  currentY = doc.lastAutoTable.finalY + 2;

  // Build Teacher Grid
  const teacherId = teacher._id.toString();
  const teacherGrid = {};
  const assignedSubjectsMap = {};

  for (const ct of timetable.classTimetables || []) {
    for (const slot of ct.slots || []) {
      if (slot.isBreak || slot.isEmpty) continue;

      const tIds = (slot.teacherIds || []).map((id) => id.toString());
      const tNames = Array.isArray(slot.teacherNames) ? slot.teacherNames : (slot.teacherNames ? [slot.teacherNames] : []);
      const matches =
        tIds.includes(teacherId) ||
        tNames.some((n) => n && n.toLowerCase().includes(teacher.name.toLowerCase()));

      if (matches) {
        const key = `${slot.day}_${slot.period}`;
        const resolved = resolveSlot(slot, maps);
        if (!teacherGrid[key]) {
          teacherGrid[key] = {
            ...resolved,
            className: ct.className,
          };
        }

        const subKey = `${ct.className}-${resolved.code || resolved.name}`;
        if (!assignedSubjectsMap[subKey]) {
          assignedSubjectsMap[subKey] = {
            code: resolved.code || 'N/A',
            name: resolved.name,
            className: ct.className,
            room: slot.roomName || 'LH 102',
            sessions: 0,
          };
        }
        assignedSubjectsMap[subKey].sessions += 1;
      }
    }
  }

  function formatTeacherCell(item) {
    if (!item) return '— (Free) —';
    const lines = [];
    lines.push(item.name.toUpperCase());
    lines.push(`${item.className} (${item.code})`);
    if (item.room) lines.push(`Room: ${item.room}`);
    return lines.join('\n');
  }

  // Mon-Thu Teacher Grid
  const monThuHead = [
    [
      { content: 'DAY / HR', styles: { halign: 'center', valign: 'middle' } },
      { content: 'Period 1\n09:00 - 10:00 AM', styles: { halign: 'center' } },
      { content: 'Period 2\n10:00 - 11:00 AM', styles: { halign: 'center' } },
      { content: 'SHORT BREAK\n11:00 - 11:20 AM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 3\n11:20 AM - 12:20 PM', styles: { halign: 'center' } },
      { content: 'LUNCH BREAK\n12:20 - 01:10 PM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 4\n01:10 - 02:10 PM', styles: { halign: 'center' } },
      { content: 'Period 5\n02:10 - 03:10 PM', styles: { halign: 'center' } },
      { content: 'SHORT BREAK\n03:10 - 03:20 PM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 6\n03:20 - 04:20 PM', styles: { halign: 'center' } },
    ],
  ];

  const monThuBody = [];
  for (const day of DAYS_MON_THU) {
    const row = [
      { content: day.substring(0, 3).toUpperCase(), styles: { fontStyle: 'bold', halign: 'center', valign: 'middle' } },
    ];
    const p1 = teacherGrid[`${day}_1`];
    const p2 = teacherGrid[`${day}_2`];
    const p3 = teacherGrid[`${day}_3`];
    const p4 = teacherGrid[`${day}_4`];
    const p5 = teacherGrid[`${day}_5`];
    const p6 = teacherGrid[`${day}_6`];

    row.push({ content: formatTeacherCell(p1), styles: p1 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } });
    row.push({ content: formatTeacherCell(p2), styles: p2 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } });
    row.push({ content: 'BREAK', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 } });
    row.push({ content: formatTeacherCell(p3), styles: p3 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } });
    row.push({ content: 'LUNCH\nBREAK', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 } });
    row.push({ content: formatTeacherCell(p4), styles: p4 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } });
    row.push({ content: formatTeacherCell(p5), styles: p5 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } });
    row.push({ content: 'BREAK', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 } });
    row.push({ content: formatTeacherCell(p6), styles: p6 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } });
    monThuBody.push(row);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: monThuHead,
    body: monThuBody,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 14,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 53 },
      2: { cellWidth: 53 },
      3: { cellWidth: 13 },
      4: { cellWidth: 53 },
      5: { cellWidth: 26 },
      6: { cellWidth: 53 },
      7: { cellWidth: 53 },
      8: { cellWidth: 13 },
      9: { cellWidth: 53 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 3;

  // Friday Teacher Grid
  const friHead = [
    [
      { content: 'DAY / HR', styles: { halign: 'center', valign: 'middle' } },
      { content: 'Period 1\n09:00 - 10:00 AM', styles: { halign: 'center' } },
      { content: 'Period 2\n10:00 - 11:00 AM', styles: { halign: 'center' } },
      { content: 'SHORT BREAK\n11:00 - 11:10 AM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 3\n11:10 AM - 12:00 PM', styles: { halign: 'center' } },
      { content: 'Period 4\n12:00 - 12:50 PM', styles: { halign: 'center' } },
      {
        content: 'FRIDAY SPECIAL LUNCH / PRAYER BREAK\n12:50 PM - 02:30 PM',
        styles: {
          halign: 'center',
          valign: 'middle',
          fontStyle: 'bold',
          fillColor: [254, 243, 199],
          textColor: [146, 64, 14],
          fontSize: 7.5,
        },
      },
      { content: 'Period 5\n02:30 - 03:20 PM', styles: { halign: 'center' } },
      { content: 'SHORT BREAK\n03:20 - 03:30 PM', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: 'Period 6\n03:30 - 04:20 PM', styles: { halign: 'center' } },
    ],
  ];

  const friP1 = teacherGrid['Friday_1'];
  const friP2 = teacherGrid['Friday_2'];
  const friP3 = teacherGrid['Friday_3'];
  const friP4 = teacherGrid['Friday_4'];
  const friP5 = teacherGrid['Friday_5'];
  const friP6 = teacherGrid['Friday_6'];

  const friRow = [
    { content: 'FRI', styles: { fontStyle: 'bold', halign: 'center', valign: 'middle' } },
    { content: formatTeacherCell(friP1), styles: friP1 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } },
    { content: formatTeacherCell(friP2), styles: friP2 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } },
    { content: 'BREAK', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 } },
    { content: formatTeacherCell(friP3), styles: friP3 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } },
    { content: formatTeacherCell(friP4), styles: friP4 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } },
    {
      content: 'FRIDAY SPECIAL LUNCH / PRAYER BREAK\n(12:50 PM to 02:30 PM)',
      styles: {
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold',
        fillColor: [254, 243, 199],
        textColor: [146, 64, 14],
        fontSize: 8,
      },
    },
    { content: formatTeacherCell(friP5), styles: friP5 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } },
    { content: 'BREAK', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [243, 244, 246], fontSize: 7 } },
    { content: formatTeacherCell(friP6), styles: friP6 ? { fillColor: [239, 246, 255] } : { textColor: [156, 163, 175] } },
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: friHead,
    body: [friRow],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 14,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 51 },
      2: { cellWidth: 51 },
      3: { cellWidth: 13 },
      4: { cellWidth: 51 },
      5: { cellWidth: 51 },
      6: { cellWidth: 38 },
      7: { cellWidth: 51 },
      8: { cellWidth: 13 },
      9: { cellWidth: 51 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 4;

  // Teacher Summary Table
  const assignedList = Object.values(assignedSubjectsMap);
  const assignedHead = [
    [
      { content: 'Sl', styles: { halign: 'center' } },
      { content: 'Subject Code', styles: { halign: 'center' } },
      { content: 'Full Subject Name', styles: { halign: 'left' } },
      { content: 'Class', styles: { halign: 'center' } },
      { content: 'Room', styles: { halign: 'center' } },
      { content: 'Sessions / Week', styles: { halign: 'center' } },
    ],
  ];

  const assignedBody = assignedList.map((item, idx) => [
    idx + 1,
    item.code,
    item.name.toUpperCase(),
    item.className,
    item.room,
    item.sessions,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: assignedHead,
    body: assignedBody,
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.2,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 45 },
      2: { cellWidth: 180 },
      3: { cellWidth: 50 },
      4: { cellWidth: 50 },
      5: { cellWidth: 50 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;
  if (currentY > 280) currentY = 280;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  const sigSpacing = contentWidth / 4;
  doc.text('Faculty Signature', marginX + 15, currentY);
  doc.text('Timetable Coordinator', marginX + sigSpacing + 15, currentY);
  doc.text('HOD, CSE', marginX + sigSpacing * 2 + 30, currentY);
  doc.text('Principal', marginX + sigSpacing * 3 + 45, currentY);
}

// ── Service API Functions ──────────────────────────────────────────────────────
const generateClassPdf = async (cls, classTimetable, timetable) => {
  const maps = await getResolutionMaps();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  renderClassPage(doc, cls, classTimetable, timetable, maps, true);
  return Buffer.from(doc.output('arraybuffer'));
};

const generateAllClassesPdf = async (classes, timetable) => {
  const maps = await getResolutionMaps();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  let isFirst = true;
  for (const ct of timetable.classTimetables || []) {
    const cls =
      maps.classMap.get(ct.classId?.toString()) ||
      (classes || []).find((c) => c._id?.toString() === ct.classId?.toString()) || {
        className: ct.className,
        semester: ct.className?.match(/S\d/)?.[0] || '4',
        section: ct.className?.endsWith('B') ? 'B' : 'A',
        departmentId: { name: 'Computer Science and Engineering' },
      };

    renderClassPage(doc, cls, ct, timetable, maps, isFirst);
    isFirst = false;
  }

  return Buffer.from(doc.output('arraybuffer'));
};

const generateTeacherPdf = async (teacher, timetable) => {
  const maps = await getResolutionMaps();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  renderTeacherPage(doc, teacher, timetable, maps, true);
  return Buffer.from(doc.output('arraybuffer'));
};

const generateAllTeachersPdf = async (teachers, timetable) => {
  const maps = await getResolutionMaps();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  let isFirst = true;
  for (const teacher of teachers || []) {
    renderTeacherPage(doc, teacher, timetable, maps, isFirst);
    isFirst = false;
  }

  return Buffer.from(doc.output('arraybuffer'));
};

module.exports = {
  generateClassPdf,
  generateAllClassesPdf,
  generateTeacherPdf,
  generateAllTeachersPdf,
  getResolutionMaps,
  resolveSlot,
};
