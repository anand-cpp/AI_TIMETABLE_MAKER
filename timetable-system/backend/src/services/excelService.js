const XLSX = require('xlsx');

/**
 * Excel Service
 * Generates .xlsx timetable files
 * Auto-column-width calculation
 * Streams buffer directly
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ── Get slot display text for Excel cell ──────────────────────────────────────
const getSlotText = (slot) => {
  if (!slot || slot.isEmpty) return '';
  if (slot.isBreak) return 'BREAK';
  if (!slot.subjectName) return '';

  let text = slot.subjectName;
  if (slot.subjectCode) text += ` (${slot.subjectCode})`;
  if (slot.teacherNames && slot.teacherNames.length > 0) {
    text += ` | ${slot.teacherNames.join(', ')}`;
  }
  if (slot.subjectType === 'lab') text += ' [LAB]';
  if (slot.isElective) text += ' [ELEC]';
  return text;
};

// ── Auto-calculate column widths ───────────────────────────────────────────────
const autoColumnWidths = (data) => {
  const colWidths = [];

  for (const row of data) {
    row.forEach((cell, colIndex) => {
      const cellStr = String(cell || '');
      const lines = cellStr.split('\n');
      const maxLineLen = Math.max(...lines.map((l) => l.length));
      const currentWidth = colWidths[colIndex] || 0;
      colWidths[colIndex] = Math.max(currentWidth, maxLineLen + 2);
    });
  }

  return colWidths.map((w) => ({ wch: Math.min(Math.max(w, 8), 40) }));
};

// ── Build worksheet for a class ───────────────────────────────────────────────
const buildClassWorksheet = (cls, classTimetable, periodNumbers) => {
  const slotMap = {};
  for (const slot of classTimetable.slots || []) {
    slotMap[`${slot.day}_${slot.period}`] = slot;
  }

  const headerRow = ['Day / Period', ...periodNumbers.map((p) => `Period ${p}`)];
  const dataRows = DAYS.map((day) => {
    const row = [day];
    for (const period of periodNumbers) {
      const slot = slotMap[`${day}_${period}`];
      row.push(getSlotText(slot));
    }
    return row;
  });

  const allData = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allData);

  // Column widths
  ws['!cols'] = autoColumnWidths(allData);

  // Row heights
  ws['!rows'] = allData.map(() => ({ hpt: 40 }));

  return ws;
};

// ── Get period numbers from timetable ─────────────────────────────────────────
const getPeriodNumbers = (timetable) => {
  const periods = new Set();
  for (const ct of timetable.classTimetables || []) {
    for (const slot of ct.slots || []) {
      periods.add(slot.period);
    }
  }
  return [...periods].sort((a, b) => a - b);
};

// ── Generate Excel for single class ───────────────────────────────────────────
const generateClassExcel = async (cls, classTimetable, timetable) => {
  const wb = XLSX.utils.book_new();
  const periodNumbers = getPeriodNumbers(timetable);

  const sheetName = `S${cls.semester}${cls.section}`.substring(0, 31);
  const ws = buildClassWorksheet(cls, classTimetable, periodNumbers);

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Add metadata sheet
  const metaData = [
    ['Field', 'Value'],
    ['Department', cls.departmentId?.name || ''],
    ['Semester', cls.semester],
    ['Section', cls.section],
    ['Generated', new Date(timetable.generatedAt).toLocaleDateString()],
    ['Quality Score', `${timetable.qualityScore?.overall || 0}/100`],
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(metaData);
  metaWs['!cols'] = [{ wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, metaWs, 'Info');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
};

// ── Generate Excel for all classes ────────────────────────────────────────────
const generateAllClassesExcel = async (classes, timetable) => {
  const wb = XLSX.utils.book_new();
  const periodNumbers = getPeriodNumbers(timetable);

  // Cover sheet
  const coverData = [
    ['Complete Timetable'],
    ['Generated', new Date(timetable.generatedAt).toLocaleDateString()],
    ['Overall Quality Score', `${timetable.qualityScore?.overall || 0}/100`],
    ['Total Classes', classes.length],
    [],
    ['Sheet Name', 'Department', 'Semester', 'Section'],
  ];

  for (const cls of classes) {
    const sheetName = `${cls.departmentId?.code || 'UNK'}_S${cls.semester}${cls.section}`.substring(0, 31);
    coverData.push([
      sheetName,
      cls.departmentId?.name || '',
      cls.semester,
      cls.section,
    ]);
  }

  const coverWs = XLSX.utils.aoa_to_sheet(coverData);
  coverWs['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, coverWs, 'Index');

  // Per-class sheets
  for (const cls of classes) {
    const classTT = (timetable.classTimetables || []).find(
      (ct) => ct.classId.toString() === cls._id.toString()
    );

    if (!classTT) continue;

    const sheetName = `${cls.departmentId?.code || 'UNK'}_S${cls.semester}${cls.section}`.substring(0, 31);
    const ws = buildClassWorksheet(cls, classTT, periodNumbers);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
};

module.exports = {
  generateClassExcel,
  generateAllClassesExcel,
};