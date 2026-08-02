const { jsPDF } = require('jspdf');
require('jspdf-autotable');

/**
 * PDF Service
 * Generates landscape A4 PDFs for class and teacher timetables
 * Streams buffer directly (not saved to disk)
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ── Get slot display text ──────────────────────────────────────────────────────
const getSlotText = (slot) => {
  if (!slot || slot.isEmpty) return '';
  if (slot.isBreak) return 'BREAK';
  if (!slot.subjectName) return '';

  let text = `${slot.subjectName}`;
  if (slot.subjectCode) text += `\n(${slot.subjectCode})`;
  if (slot.teacherNames && slot.teacherNames.length > 0) {
    text += `\n${slot.teacherNames.join(', ')}`;
  }
  if (slot.subjectType === 'lab') text += '\n[LAB]';
  if (slot.isElective) text += '\n[ELEC]';
  return text;
};

// ── Get cell fill color ────────────────────────────────────────────────────────
const getCellColor = (slot) => {
  if (!slot || slot.isEmpty) return [255, 255, 255];
  if (slot.isBreak) return [243, 244, 246];
  if (slot.subjectType === 'lab') return [219, 234, 254];
  if (slot.isElective) return [220, 252, 231];
  if (slot.isLocked) return [254, 243, 199];
  return [255, 255, 255];
};

// ── Build timetable table data ─────────────────────────────────────────────────
const buildTableData = (classTimetable, periodNumbers) => {
  const slotMap = {};
  for (const slot of classTimetable.slots || []) {
    const key = `${slot.day}_${slot.period}`;
    slotMap[key] = slot;
  }

  const body = [];
  for (const day of DAYS) {
    const row = [day];
    for (const period of periodNumbers) {
      const slot = slotMap[`${day}_${period}`];
      row.push(getSlotText(slot));
    }
    body.push(row);
  }

  return body;
};

// ── Get unique period numbers from timetable ───────────────────────────────────
const getPeriodNumbers = (timetable) => {
  const periods = new Set();
  for (const ct of timetable.classTimetables || []) {
    for (const slot of ct.slots || []) {
      periods.add(slot.period);
    }
  }
  return [...periods].sort((a, b) => a - b);
};

// ── Generate PDF for single class ──────────────────────────────────────────────
const generateClassPdf = async (cls, classTimetable, timetable) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const periodNumbers = getPeriodNumbers(timetable);

  // Cover info
  const deptName = cls.departmentId?.name || 'Unknown Department';
  const title = `Timetable — ${deptName} Semester ${cls.semester} Section ${cls.section}`;

  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text(title, 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated: ${new Date(timetable.generatedAt).toLocaleDateString()}  |  Quality Score: ${timetable.qualityScore?.overall || 0}/100`,
    14,
    26
  );

  // Build table
  const head = [['Day', ...periodNumbers.map((p) => `P${p}`)]];
  const body = buildTableData(classTimetable, periodNumbers);

  doc.autoTable({
    head,
    body,
    startY: 32,
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      minCellHeight: 12,
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold', fillColor: [241, 245, 249] },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) {
        const day = DAYS[data.row.index];
        const period = periodNumbers[data.column.index - 1];
        const slotMap = {};
        for (const slot of classTimetable.slots || []) {
          slotMap[`${slot.day}_${slot.period}`] = slot;
        }
        const slot = slotMap[`${day}_${period}`];
        data.cell.styles.fillColor = getCellColor(slot);
      }
    },
    theme: 'grid',
  });

  return Buffer.from(doc.output('arraybuffer'));
};

// ── Generate PDF for all classes ───────────────────────────────────────────────
const generateAllClassesPdf = async (classes, timetable) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const periodNumbers = getPeriodNumbers(timetable);

  // Cover page
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235);
  doc.text('Complete Timetable', 148, 100, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated: ${new Date(timetable.generatedAt).toLocaleDateString()}`,
    148,
    115,
    { align: 'center' }
  );
  doc.text(
    `Overall Quality Score: ${timetable.qualityScore?.overall || 0}/100`,
    148,
    125,
    { align: 'center' }
  );

  for (const cls of classes) {
    const classTT = (timetable.classTimetables || []).find(
      (ct) => ct.classId.toString() === cls._id.toString()
    );

    if (!classTT) continue;

    doc.addPage();

    const deptName = cls.departmentId?.name || 'Unknown';
    const title = `${deptName} — Semester ${cls.semester} Section ${cls.section}`;

    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(title, 14, 18);

    const head = [['Day', ...periodNumbers.map((p) => `P${p}`)]];
    const body = buildTableData(classTT, periodNumbers);

    doc.autoTable({
      head,
      body,
      startY: 26,
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', minCellHeight: 12 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold', fillColor: [241, 245, 249] } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          const day = DAYS[data.row.index];
          const period = periodNumbers[data.column.index - 1];
          const slotMap = {};
          for (const slot of classTT.slots || []) {
            slotMap[`${slot.day}_${slot.period}`] = slot;
          }
          const slot = slotMap[`${day}_${period}`];
          data.cell.styles.fillColor = getCellColor(slot);
        }
      },
      theme: 'grid',
    });
  }

  return Buffer.from(doc.output('arraybuffer'));
};

// ── Generate PDF for single teacher ───────────────────────────────────────────
const generateTeacherPdf = async (teacher, timetable) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const periodNumbers = getPeriodNumbers(timetable);

  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text(`Timetable — ${teacher.name}`, 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Department: ${teacher.departmentId?.name || 'N/A'}  |  Generated: ${new Date(timetable.generatedAt).toLocaleDateString()}`,
    14,
    26
  );

  // Build teacher-specific grid
  const teacherId = teacher._id.toString();
  const teacherGrid = {};

  for (const classTT of timetable.classTimetables || []) {
    for (const slot of classTT.slots || []) {
      if (slot.isBreak || slot.isEmpty) continue;

      const tIds = (slot.teacherIds || []).map((id) => id.toString());
      const isInSlot =
        tIds.includes(teacherId) ||
        (slot.isBatchSplit &&
          (slot.batch1?.teacherId?.toString() === teacherId ||
            slot.batch2?.teacherId?.toString() === teacherId));

      if (isInSlot) {
        const key = `${slot.day}_${slot.period}`;
        if (!teacherGrid[key]) {
          teacherGrid[key] = {
            ...slot,
            className: classTT.className,
          };
        }
      }
    }
  }

  const head = [['Day', ...periodNumbers.map((p) => `P${p}`)]];
  const body = DAYS.map((day) => {
    const row = [day];
    for (const period of periodNumbers) {
      const slot = teacherGrid[`${day}_${period}`];
      if (!slot) {
        row.push('');
      } else {
        row.push(`${slot.subjectName}\n${slot.className}`);
      }
    }
    return row;
  });

  doc.autoTable({
    head,
    body,
    startY: 32,
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', minCellHeight: 12 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold', fillColor: [241, 245, 249] } },
    theme: 'grid',
  });

  return Buffer.from(doc.output('arraybuffer'));
};

// ── Generate PDF for all teachers ─────────────────────────────────────────────
const generateAllTeachersPdf = async (teachers, timetable) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const periodNumbers = getPeriodNumbers(timetable);

  // Cover page
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235);
  doc.text('All Teacher Timetables', 148, 100, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated: ${new Date(timetable.generatedAt).toLocaleDateString()}`,
    148,
    115,
    { align: 'center' }
  );

  for (const teacher of teachers) {
    doc.addPage();

    const teacherId = teacher._id.toString();
    const teacherGrid = {};

    for (const classTT of timetable.classTimetables || []) {
      for (const slot of classTT.slots || []) {
        if (slot.isBreak || slot.isEmpty) continue;
        const tIds = (slot.teacherIds || []).map((id) => id.toString());
        const isInSlot =
          tIds.includes(teacherId) ||
          (slot.isBatchSplit &&
            (slot.batch1?.teacherId?.toString() === teacherId ||
              slot.batch2?.teacherId?.toString() === teacherId));

        if (isInSlot) {
          const key = `${slot.day}_${slot.period}`;
          if (!teacherGrid[key]) {
            teacherGrid[key] = { ...slot, className: classTT.className };
          }
        }
      }
    }

    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(`${teacher.name}`, 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Dept: ${teacher.departmentId?.name || 'N/A'}`, 14, 25);

    const head = [['Day', ...periodNumbers.map((p) => `P${p}`)]];
    const body = DAYS.map((day) => {
      const row = [day];
      for (const period of periodNumbers) {
        const slot = teacherGrid[`${day}_${period}`];
        row.push(slot ? `${slot.subjectName}\n${slot.className}` : '');
      }
      return row;
    });

    doc.autoTable({
      head,
      body,
      startY: 30,
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', minCellHeight: 12 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold', fillColor: [241, 245, 249] } },
      theme: 'grid',
    });
  }

  return Buffer.from(doc.output('arraybuffer'));
};

module.exports = {
  generateClassPdf,
  generateAllClassesPdf,
  generateTeacherPdf,
  generateAllTeachersPdf,
};