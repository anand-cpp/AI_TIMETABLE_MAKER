import React from 'react';

// Helper to format subject display name with tutorial / lab suffixes
const formatSlotDisplay = (slot) => {
  if (!slot || slot.isEmpty || slot.isBreak) return '';

  const code = slot.subjectCode || '';
  const name = slot.subjectName || '';

  // Calculate abbreviation: prefer subjectCode, fallback to initials of subjectName
  let abbr = code || name;
  if (!code && name) {
    abbr = name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  if (slot.subjectType === 'tutorial' || slot.overrideType === 'tutorial') {
    return `${abbr} ®`;
  }
  if (slot.subjectType === 'lab' || slot.subjectType === 'practical' || slot.isLabBlock) {
    return `${abbr} (P)`;
  }
  return abbr;
};

// Auto-derive subject abbreviation for legend table
export const getSubjectAbbr = (subject) => {
  if (subject.code) return subject.code.replace(/[^A-Za-z0-9]/g, '');
  const name = subject.name || '';
  return name
    .split(' ')
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'SUB';
};

const OfficialTimetableExport = ({
  classTimetable,
  academicYear = '2026-27',
  semester = 'ODD',
  className = '',
  departmentName = 'Computer Science and Engineering',
  roomNo = '121',
  effectiveDate = '27-08-2024',
}) => {
  const slots = classTimetable?.slots || [];

  // Build slot lookup: slotMap[day][period]
  const slotMap = {};
  for (const slot of slots) {
    if (!slotMap[slot.day]) slotMap[slot.day] = {};
    slotMap[slot.day][slot.period] = slot;
  }

  // Derive unique placed subjects for legend table
  const subjectsMap = {};
  for (const slot of slots) {
    if (!slot || slot.isEmpty || slot.isBreak || !slot.subjectName) continue;
    const key = slot.subjectCode || slot.subjectName;
    if (!subjectsMap[key]) {
      subjectsMap[key] = {
        code: slot.subjectCode || key,
        name: slot.subjectName,
        faculty: Array.isArray(slot.teacherNames) ? slot.teacherNames.join(', ') : slot.teacherNames || 'Faculty',
        L: 0,
        T: 0,
        P: 0,
        total: 0,
      };
    }
    if (slot.subjectType === 'tutorial') {
      subjectsMap[key].T += 1;
    } else if (slot.subjectType === 'lab' || slot.isLabBlock) {
      subjectsMap[key].P += 1;
    } else {
      subjectsMap[key].L += 1;
    }
    subjectsMap[key].total += 1;
  }

  const legendSubjects = Object.values(subjectsMap);

  return (
    <div
      id="official-timetable-export"
      className="official-timetable-export p-6 bg-white text-black font-serif text-xs leading-tight border border-gray-300 rounded-xs shadow-md mx-auto"
      style={{
        width: '210mm',
        minHeight: '297mm',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: "'Times New Roman', Times, serif",
      }}
    >
      {/* 3-COLUMN HEADER */}
      <table className="w-full border-collapse border border-black mb-2 text-[10px]">
        <tbody>
          <tr>
            <td className="w-[28%] border border-black p-1.5 align-top">
              <div><b>Written By:</b> ISO Coordinator</div>
              <div><b>Approved By:</b> Principal</div>
              <div><b>Effective Date:</b> {effectiveDate}</div>
            </td>
            <td className="w-[44%] border border-black p-2 text-center align-middle">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full border border-blue-900 flex items-center justify-center font-bold text-blue-900 text-[10px]">
                  ASET
                </div>
                <div className="font-bold text-sm text-[#003399] tracking-wide uppercase">
                  AHALIA SCHOOL OF ENGINEERING & TECHNOLOGY
                </div>
              </div>
              <div className="text-[8px] text-gray-700 leading-tight">
                ISO 9001:2015 Certified Institution. Approved by AICTE & Affiliated to A.P.J. Abdul Kalam Technological University
              </div>
              <div className="text-[8px] text-gray-700 leading-tight">
                Ahalia Health, Heritage & Knowledge Village, Palakkad -678557 Ph:04923-226666, www.ahalia.ac.in
              </div>
            </td>
            <td className="w-[28%] border border-black p-1.5 align-top">
              <div><b>Issue No:</b> 02</div>
              <div><b>Revision No.:</b> 00</div>
              <div><b>Revision Date:</b> 21-08-2024</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* FORM NO */}
      <div className="text-[10px] mb-2">
        Form No.: <u className="font-semibold">ASET-CS/DS03/FM06</u>
      </div>

      {/* TITLE */}
      <div className="text-center mb-3">
        <h2 className="font-bold text-sm underline tracking-wide uppercase m-0">
          Class Time Table
        </h2>
        <h3 className="font-bold text-xs underline m-1 text-gray-900">
          Department of {departmentName}
        </h3>
      </div>

      {/* METADATA ROW */}
      <table className="w-full text-xs font-serif mb-3">
        <tbody>
          <tr>
            <td>Academic Year: <b>{academicYear}</b></td>
            <td>Semester: <b>{semester}</b></td>
            <td>Class: <b>{className || classTimetable?.className || 'S3 CSE A'}</b></td>
            <td className="text-right">Room No: <b>{roomNo}</b></td>
          </tr>
        </tbody>
      </table>

      {/* TIMETABLE GRID */}
      <table className="w-full border-collapse border border-black text-center text-[10px] mb-4">
        <thead>
          <tr className="bg-gray-100 font-bold">
            <th className="border border-black p-1 w-14">DATE/HR</th>
            <th className="border border-black p-1">9:00 to 10:00 AM</th>
            <th className="border border-black p-1">10:00 to 11:00 AM</th>
            <th className="border border-black p-1 w-10 text-[9px]">11:00 to 11:20 AM</th>
            <th className="border border-black p-1">11:20 AM to 12:20 PM</th>
            <th className="border border-black p-1 w-12 text-[9px]">12:20 to 1:10 PM</th>
            <th className="border border-black p-1">1:10 to 2:10 PM</th>
            <th className="border border-black p-1">2:10 to 3:10 PM</th>
            <th className="border border-black p-1 w-10 text-[9px]">3:10 to 3:20 PM</th>
            <th className="border border-black p-1">3:20 to 4:20 PM</th>
          </tr>
        </thead>
        <tbody>
          {/* MONDAY TO THURSDAY */}
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday'].map((day) => {
            const shortDay = day.substring(0, 3).toUpperCase();
            const p1 = slotMap[day]?.[1];
            const p2 = slotMap[day]?.[2];
            const p3 = slotMap[day]?.[3];
            const p4 = slotMap[day]?.[4];
            const p5 = slotMap[day]?.[5];
            const p6 = slotMap[day]?.[6];

            // Check if P1 and P2 are part of a merged lab block
            const isMerged12 = p1?.subjectName && p1?.subjectName === p2?.subjectName && (p1.isLabBlock || p1.subjectType === 'lab');

            return (
              <tr key={day} className="h-10">
                <td className="border border-black font-bold bg-gray-50">{shortDay}</td>
                {isMerged12 ? (
                  <td colSpan={2} className="border border-black font-bold">
                    {formatSlotDisplay(p1)}
                  </td>
                ) : (
                  <>
                    <td className="border border-black">{formatSlotDisplay(p1)}</td>
                    <td className="border border-black">{formatSlotDisplay(p2)}</td>
                  </>
                )}
                <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700 uppercase">
                  BREAK
                </td>
                <td className="border border-black">{formatSlotDisplay(p3)}</td>
                <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700 uppercase">
                  LUNCH BREAK
                </td>
                <td className="border border-black">{formatSlotDisplay(p4)}</td>
                <td className="border border-black">{formatSlotDisplay(p5)}</td>
                <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700 uppercase">
                  BREAK
                </td>
                <td className="border border-black">{formatSlotDisplay(p6)}</td>
              </tr>
            );
          })}

          {/* FRIDAY ALTERNATE TIMING HEADER */}
          <tr className="bg-gray-100 font-bold text-[9px]">
            <td rowSpan={2} className="border border-black font-bold align-middle bg-gray-50">
              Hour
            </td>
            <td className="border border-black p-0.5">1</td>
            <td className="border border-black p-0.5">2</td>
            <td className="border border-black p-0.5">BREAK</td>
            <td className="border border-black p-0.5">3</td>
            <td className="border border-black p-0.5">4</td>
            <td className="border border-black p-0.5">LUNCH</td>
            <td className="border border-black p-0.5">5</td>
            <td className="border border-black p-0.5">BREAK</td>
            <td className="border border-black p-0.5">6</td>
          </tr>
          <tr className="bg-gray-100 text-[8px] font-semibold">
            <td className="border border-black p-0.5">9:00 to 10:00 AM</td>
            <td className="border border-black p-0.5">10:00 to 11:00 AM</td>
            <td className="border border-black p-0.5">11:00 to 11:10 AM</td>
            <td className="border border-black p-0.5">11:10 to 12:00 PM</td>
            <td className="border border-black p-0.5">12:00 to 12:50 PM</td>
            <td className="border border-black p-0.5">12:50 to 2:30 PM</td>
            <td className="border border-black p-0.5">2:30 to 3:20 PM</td>
            <td className="border border-black p-0.5">3:20 to 3:30 PM</td>
            <td className="border border-black p-0.5">3:30 to 4:20 PM</td>
          </tr>

          {/* FRIDAY ROW */}
          <tr className="h-10">
            <td className="border border-black font-bold bg-gray-50">FRI</td>
            <td className="border border-black">{formatSlotDisplay(slotMap['Friday']?.[1])}</td>
            <td className="border border-black">{formatSlotDisplay(slotMap['Friday']?.[2])}</td>
            <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">
              BREAK
            </td>
            <td className="border border-black">{formatSlotDisplay(slotMap['Friday']?.[3])}</td>
            <td className="border border-black">{formatSlotDisplay(slotMap['Friday']?.[4])}</td>
            <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">
              LUNCH BREAK
            </td>
            <td className="border border-black">{formatSlotDisplay(slotMap['Friday']?.[5])}</td>
            <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">
              BREAK
            </td>
            <td className="border border-black font-semibold text-[9px]">
              {formatSlotDisplay(slotMap['Friday']?.[6]) || 'ZERO HR / remedial'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* SUBJECT LEGEND TABLE */}
      <div className="mt-4">
        <table className="w-full border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-gray-100 font-bold text-center">
              <th className="border border-black p-1 w-16">Abbreviation</th>
              <th className="border border-black p-1 w-20">Subject Code</th>
              <th className="border border-black p-1 text-left">Subject</th>
              <th className="border border-black p-1 text-left">Faculty</th>
              <th className="border border-black p-0.5 w-16" colSpan={3}>
                No of Session per week
                <div className="grid grid-cols-3 border-t border-black mt-0.5 text-[8px]">
                  <span>L</span>
                  <span>T</span>
                  <span>P</span>
                </div>
              </th>
              <th className="border border-black p-1 w-14">No. of Sessions</th>
            </tr>
          </thead>
          <tbody>
            {legendSubjects.length === 0 ? (
              <tr>
                <td colSpan={8} className="border border-black p-2 text-center text-gray-500 italic">
                  No subjects placed in this timetable
                </td>
              </tr>
            ) : (
              legendSubjects.map((sub, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border border-black p-1 font-bold text-center">{getSubjectAbbr(sub)}</td>
                  <td className="border border-black p-1 text-center font-mono">{sub.code}</td>
                  <td className="border border-black p-1 uppercase">{sub.name}</td>
                  <td className="border border-black p-1">{sub.faculty}</td>
                  <td className="border border-black p-1 text-center border-r-0">{sub.L}</td>
                  <td className="border border-black p-1 text-center border-r-0">{sub.T}</td>
                  <td className="border border-black p-1 text-center">{sub.P}</td>
                  <td className="border border-black p-1 text-center font-bold">{sub.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OfficialTimetableExport;
