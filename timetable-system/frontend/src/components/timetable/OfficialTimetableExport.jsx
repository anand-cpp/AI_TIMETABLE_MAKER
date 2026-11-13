import React from 'react';

/**
 * Official Ahalia Class Timetable Export Component
 * Layout: Professional A3 Landscape (420mm x 297mm)
 * - Prominent, full human-readable Subject Names
 * - Secondary Subject Codes & Faculty Names
 * - Explicit Friday Special Timings & 12:50 PM - 02:30 PM Prayer Break
 * - Official Ahalia Header Box & Form No. ASET-CS/DS03/FM06
 * - Subject Legend Table with L-T-P breakdown
 */

export const renderTimetableCell = (slot) => {
  if (!slot || slot.isEmpty || slot.isBreak) {
    return <span className="text-gray-300 font-sans text-[11px]">—</span>;
  }

  const rawName = slot.minorSubjectName || slot.subjectName || slot.name || '';
  const code = slot.subjectCode || slot.code || '';
  const teachers = Array.isArray(slot.teacherNames)
    ? slot.teacherNames.filter(Boolean).join(', ')
    : slot.teacherNames || slot.teachers || '';
  const room = slot.roomName || slot.room || '';
  const isLab = Boolean(slot.subjectType === 'lab' || slot.subjectType === 'practical' || slot.isLabBlock || (rawName && rawName.toLowerCase().includes('lab')));
  const isTutorial = slot.subjectType === 'tutorial' || slot.overrideType === 'tutorial';
  const isElective = Boolean(slot.isElective || slot.subjectType === 'elective');
  const isMinor = Boolean(slot.isMinor || slot.subjectType === 'minor');

  const cleanMinorSubjectName = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/^\s*minor\s*[\/\-—:]\s*/i, '')
      .replace(/\s*[\/\-—:]\s*minor\s*$/i, '')
      .replace(/\s*\/\s*minor\b/i, '')
      .replace(/\bminor\s*\/\s*/i, '')
      .replace(/\s*\(\s*minor\s*\)/i, '')
      .trim();
  };

  const displayName = isMinor
    ? (cleanMinorSubjectName(rawName) || code || 'Minor')
    : (rawName || code);

  return (
    <div className="flex flex-col items-center justify-center p-2 text-center leading-snug w-full h-full min-h-[58px]">
      {/* 1. Primary Display: FULL HUMAN-READABLE SUBJECT NAME */}
      <div className="font-bold text-[11px] text-gray-950 uppercase tracking-tight line-clamp-3 mb-0.5">
        {displayName}
      </div>

      {/* 2. Secondary Display: Subject Code */}
      {code && (
        <div className="text-[9.5px] font-mono font-bold text-blue-900 tracking-wide mb-0.5">
          {code} {isTutorial ? '®' : ''}
        </div>
      )}

      {/* 3. Secondary Display: Assigned Faculty */}
      {teachers && (
        <div className="text-[9px] text-gray-700 font-medium italic">
          Faculty: <span className="not-italic font-semibold text-gray-900">{teachers}</span>
        </div>
      )}

      {/* 4. Designation Badges & Room */}
      <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
        {isMinor && (
          <span className="text-[7.5px] bg-purple-100 text-purple-900 font-bold px-1.5 py-0.5 rounded-xs border border-purple-300 uppercase">
            MINOR
          </span>
        )}
        {isLab && (
          <span className="text-[7.5px] bg-emerald-100 text-emerald-900 font-bold px-1.5 py-0.5 rounded-xs border border-emerald-300 uppercase">
            LAB
          </span>
        )}
        {isElective && (
          <span className="text-[7.5px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded-xs border border-blue-300 uppercase">
            ELECTIVE
          </span>
        )}
        {room && (
          <span className="text-[8px] text-gray-600 font-mono font-medium">
            [{room}]
          </span>
        )}
      </div>
    </div>
  );
};

export const getSubjectAbbr = (subject) => {
  if (subject.code) return subject.code.replace(/[^A-Za-z0-9]/g, '');
  const name = subject.name || '';
  return (
    name
      .split(' ')
      .filter((w) => w.length > 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'SUB'
  );
};

const OfficialTimetableExport = ({
  classTimetable,
  academicYear = '2026-27',
  semester = 'ODD',
  className = '',
  departmentName = 'Computer Science and Engineering',
  roomNo = 'LH 102',
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
    if (!slot || slot.isEmpty || slot.isBreak || (!slot.subjectName && !slot.subjectCode)) continue;
    const key = slot.subjectCode || slot.subjectName;
    if (!subjectsMap[key]) {
      subjectsMap[key] = {
        code: slot.subjectCode || key,
        name: slot.subjectName || key,
        faculty: Array.isArray(slot.teacherNames)
          ? slot.teacherNames.filter(Boolean).join(', ')
          : slot.teacherNames || 'Faculty',
        L: 0,
        T: 0,
        P: 0,
        total: 0,
      };
    }
    if (slot.subjectType === 'tutorial' || slot.overrideType === 'tutorial') {
      subjectsMap[key].T += 1;
    } else if (slot.subjectType === 'lab' || slot.subjectType === 'practical' || slot.isLabBlock) {
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
      className="official-timetable-export p-8 bg-white text-black font-serif text-xs leading-normal border border-gray-300 rounded-xs shadow-lg mx-auto"
      style={{
        width: '420mm',
        minHeight: '297mm',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: "'Times New Roman', Times, serif",
      }}
    >
      {/* 1. 3-COLUMN OFFICIAL AHALIA HEADER */}
      <table className="w-full border-collapse border border-black mb-2 text-[11px]">
        <tbody>
          <tr>
            <td className="w-[24%] border border-black p-2 align-top">
              <div className="font-semibold">Written By: <span className="font-bold">ISO Coordinator</span></div>
              <div className="font-semibold">Approved By: <span className="font-bold">Principal</span></div>
              <div className="font-semibold">Effective Date: <span className="font-bold">{effectiveDate}</span></div>
            </td>
            <td className="w-[52%] border border-black p-2.5 text-center align-middle">
              <div className="flex items-center justify-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-full border-2 border-blue-900 flex items-center justify-center font-bold text-blue-900 text-xs">
                  ASET
                </div>
                <div className="font-bold text-base text-[#003399] tracking-wider uppercase">
                  AHALIA SCHOOL OF ENGINEERING & TECHNOLOGY
                </div>
              </div>
              <div className="text-[9.5px] text-gray-800 leading-tight font-medium">
                ISO 9001:2015 Certified Institution | Approved by AICTE & Affiliated to A.P.J. Abdul Kalam Technological University
              </div>
              <div className="text-[9.5px] text-gray-700 leading-tight">
                Ahalia Health, Heritage & Knowledge Village, Palakkad - 678557 Ph: 04923-226666, www.ahalia.ac.in
              </div>
            </td>
            <td className="w-[24%] border border-black p-2 align-top">
              <div className="font-semibold">Issue No: <span className="font-bold">02</span></div>
              <div className="font-semibold">Revision No.: <span className="font-bold">00</span></div>
              <div className="font-semibold">Revision Date: <span className="font-bold">21-08-2024</span></div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* FORM NO */}
      <div className="text-[11px] mb-2 font-serif">
        Form No.: <u className="font-bold">ASET-CS/DS03/FM06</u>
      </div>

      {/* TITLE & DEPARTMENT */}
      <div className="text-center mb-3">
        <h2 className="font-bold text-base underline tracking-wider uppercase m-0 text-black">
          Class Time Table
        </h2>
        <h3 className="font-bold text-xs underline mt-1 text-gray-900 uppercase">
          Department of {departmentName}
        </h3>
      </div>

      {/* METADATA ROW */}
      <table className="w-full text-xs font-serif mb-3 font-semibold">
        <tbody>
          <tr>
            <td className="w-1/4">Academic Year: <b className="text-sm">{academicYear}</b></td>
            <td className="w-1/4 text-center">Semester: <b className="text-sm">{semester}</b></td>
            <td className="w-1/4 text-center">Class: <b className="text-sm">{className || classTimetable?.className || 'Class'}</b></td>
            <td className="w-1/4 text-right">Room No: <b className="text-sm">{roomNo}</b></td>
          </tr>
        </tbody>
      </table>

      {/* 2. MONDAY TO THURSDAY TIMETABLE GRID */}
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900 mb-1">
          Monday – Thursday Academic Schedule
        </div>
        <table className="w-full border-collapse border border-black text-center text-[10px]">
          <thead>
            <tr className="bg-blue-800 text-white font-bold">
              <th className="border border-black p-1.5 w-16">DAY / HR</th>
              <th className="border border-black p-1.5 w-[53mm]">Period 1<br/><span className="text-[8.5px] font-normal">09:00 - 10:00 AM</span></th>
              <th className="border border-black p-1.5 w-[53mm]">Period 2<br/><span className="text-[8.5px] font-normal">10:00 - 11:00 AM</span></th>
              <th className="border border-black p-1 w-[14mm] text-[8px] bg-blue-900">SHORT BREAK<br/><span className="text-[7.5px] font-normal">11:00 - 11:20 AM</span></th>
              <th className="border border-black p-1.5 w-[53mm]">Period 3<br/><span className="text-[8.5px] font-normal">11:20 AM - 12:20 PM</span></th>
              <th className="border border-black p-1 w-[26mm] text-[8px] bg-blue-900">LUNCH BREAK<br/><span className="text-[7.5px] font-normal">12:20 - 01:10 PM</span></th>
              <th className="border border-black p-1.5 w-[53mm]">Period 4<br/><span className="text-[8.5px] font-normal">01:10 - 02:10 PM</span></th>
              <th className="border border-black p-1.5 w-[53mm]">Period 5<br/><span className="text-[8.5px] font-normal">02:10 - 03:10 PM</span></th>
              <th className="border border-black p-1 w-[14mm] text-[8px] bg-blue-900">SHORT BREAK<br/><span className="text-[7.5px] font-normal">03:10 - 03:20 PM</span></th>
              <th className="border border-black p-1.5 w-[53mm]">Period 6<br/><span className="text-[8.5px] font-normal">03:20 - 04:20 PM</span></th>
            </tr>
          </thead>
          <tbody>
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday'].map((day) => {
              const shortDay = day.substring(0, 3).toUpperCase();
              const p1 = slotMap[day]?.[1];
              const p2 = slotMap[day]?.[2];
              const p3 = slotMap[day]?.[3];
              const p4 = slotMap[day]?.[4];
              const p5 = slotMap[day]?.[5];
              const p6 = slotMap[day]?.[6];

              const isLab12 = p1?.isLabBlock && p2?.isLabBlock && p1?.subjectCode === p2?.subjectCode;
              const isLab45 = p4?.isLabBlock && p5?.isLabBlock && p4?.subjectCode === p5?.subjectCode;

              return (
                <tr key={day} className="h-14">
                  <td className="border border-black font-bold bg-gray-100 text-xs">{shortDay}</td>

                  {/* P1 & P2 */}
                  {isLab12 ? (
                    <td colSpan={2} className="border border-black bg-blue-50">
                      {renderTimetableCell(p1)}
                    </td>
                  ) : (
                    <>
                      <td className={`border border-black ${p1?.isLabBlock ? 'bg-blue-50' : ''}`}>
                        {renderTimetableCell(p1)}
                      </td>
                      <td className={`border border-black ${p2?.isLabBlock ? 'bg-blue-50' : ''}`}>
                        {renderTimetableCell(p2)}
                      </td>
                    </>
                  )}

                  {/* Short Break 1 */}
                  <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700 uppercase">
                    BREAK
                  </td>

                  {/* P3 */}
                  <td className={`border border-black ${p3?.isLabBlock ? 'bg-blue-50' : ''}`}>
                    {renderTimetableCell(p3)}
                  </td>

                  {/* Lunch Break */}
                  <td className="border border-black bg-gray-100 font-bold text-[8.5px] tracking-wider text-gray-800 uppercase leading-tight">
                    LUNCH<br/>BREAK
                  </td>

                  {/* P4 & P5 */}
                  {isLab45 ? (
                    <td colSpan={2} className="border border-black bg-blue-50">
                      {renderTimetableCell(p4)}
                    </td>
                  ) : (
                    <>
                      <td className={`border border-black ${p4?.isLabBlock ? 'bg-blue-50' : ''}`}>
                        {renderTimetableCell(p4)}
                      </td>
                      <td className={`border border-black ${p5?.isLabBlock ? 'bg-blue-50' : ''}`}>
                        {renderTimetableCell(p5)}
                      </td>
                    </>
                  )}

                  {/* Short Break 2 */}
                  <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700 uppercase">
                    BREAK
                  </td>

                  {/* P6 */}
                  <td className={`border border-black ${p6?.isLabBlock ? 'bg-blue-50' : ''}`}>
                    {renderTimetableCell(p6)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. FRIDAY SPECIAL TIMETABLE GRID */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 mb-1 flex items-center justify-between">
          <span>Friday Special Schedule (Day-Specific Timings & Prayer Break)</span>
          <span className="text-amber-800 font-bold">Special Prayer/Lunch Break: 12:50 PM – 02:30 PM</span>
        </div>
        <table className="w-full border-collapse border border-black text-center text-[10px]">
          <thead>
            <tr className="bg-indigo-900 text-white font-bold">
              <th className="border border-black p-1.5 w-16">DAY / HR</th>
              <th className="border border-black p-1.5 w-[51mm]">Period 1<br/><span className="text-[8.5px] font-normal">09:00 - 10:00 AM</span></th>
              <th className="border border-black p-1.5 w-[51mm]">Period 2<br/><span className="text-[8.5px] font-normal">10:00 - 11:00 AM</span></th>
              <th className="border border-black p-1 w-[13mm] text-[8px] bg-indigo-950">SHORT BREAK<br/><span className="text-[7.5px] font-normal">11:00 - 11:10 AM</span></th>
              <th className="border border-black p-1.5 w-[51mm]">Period 3<br/><span className="text-[8.5px] font-normal">11:10 AM - 12:00 PM</span></th>
              <th className="border border-black p-1.5 w-[51mm]">Period 4<br/><span className="text-[8.5px] font-normal">12:00 - 12:50 PM</span></th>
              <th className="border border-black p-1.5 w-[38mm] text-[8.5px] bg-amber-200 text-amber-950 font-bold">
                FRIDAY SPECIAL LUNCH / PRAYER BREAK<br/><span className="text-[8px] font-semibold text-amber-900">12:50 PM – 02:30 PM</span>
              </th>
              <th className="border border-black p-1.5 w-[51mm]">Period 5<br/><span className="text-[8.5px] font-normal">02:30 - 03:20 PM</span></th>
              <th className="border border-black p-1 w-[13mm] text-[8px] bg-indigo-950">SHORT BREAK<br/><span className="text-[7.5px] font-normal">03:20 - 03:30 PM</span></th>
              <th className="border border-black p-1.5 w-[51mm]">Period 6<br/><span className="text-[8.5px] font-normal">03:30 - 04:20 PM</span></th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const friP1 = slotMap['Friday']?.[1];
              const friP2 = slotMap['Friday']?.[2];
              const friP3 = slotMap['Friday']?.[3];
              const friP4 = slotMap['Friday']?.[4];
              const friP5 = slotMap['Friday']?.[5];
              const friP6 = slotMap['Friday']?.[6];

              const isFriLab12 = friP1?.isLabBlock && friP2?.isLabBlock && friP1?.subjectCode === friP2?.subjectCode;

              return (
                <tr className="h-14">
                  <td className="border border-black font-bold bg-gray-100 text-xs">FRI</td>

                  {/* Friday P1 & P2 */}
                  {isFriLab12 ? (
                    <td colSpan={2} className="border border-black bg-blue-50">
                      {renderTimetableCell(friP1)}
                    </td>
                  ) : (
                    <>
                      <td className={`border border-black ${friP1?.isLabBlock ? 'bg-blue-50' : ''}`}>
                        {renderTimetableCell(friP1)}
                      </td>
                      <td className={`border border-black ${friP2?.isLabBlock ? 'bg-blue-50' : ''}`}>
                        {renderTimetableCell(friP2)}
                      </td>
                    </>
                  )}

                  {/* Friday Short Break 1 (11:00 - 11:10) */}
                  <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">
                    BREAK
                  </td>

                  {/* Friday P3 (11:10 - 12:00) */}
                  <td className={`border border-black ${friP3?.isLabBlock ? 'bg-blue-50' : ''}`}>
                    {renderTimetableCell(friP3)}
                  </td>

                  {/* Friday P4 (12:00 - 12:50) */}
                  <td className={`border border-black ${friP4?.isLabBlock ? 'bg-blue-50' : ''}`}>
                    {renderTimetableCell(friP4)}
                  </td>

                  {/* FRIDAY SPECIAL PRAYER / LUNCH BREAK (12:50 - 2:30 PM) */}
                  <td className="border-2 border-amber-600 bg-amber-100 font-bold text-amber-950 p-2 align-middle">
                    <div className="text-[9.5px] uppercase tracking-wide">Friday Special Lunch / Prayer Break</div>
                    <div className="text-[8.5px] font-semibold text-amber-900 mt-0.5">12:50 PM to 02:30 PM</div>
                  </td>

                  {/* Friday P5 (2:30 - 3:20) */}
                  <td className={`border border-black ${friP5?.isLabBlock ? 'bg-blue-50' : ''}`}>
                    {renderTimetableCell(friP5)}
                  </td>

                  {/* Friday Short Break 2 (3:20 - 3:30) */}
                  <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">
                    BREAK
                  </td>

                  {/* Friday P6 (3:30 - 4:20) */}
                  <td className={`border border-black ${friP6?.isLabBlock ? 'bg-blue-50' : ''}`}>
                    {renderTimetableCell(friP6)}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* 4. SUBJECT LEGEND TABLE */}
      <div className="mt-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-800 mb-1">
          Subject Details & Workload Breakdown
        </div>
        <table className="w-full border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-gray-100 font-bold text-center">
              <th className="border border-black p-1.5 w-10">Sl</th>
              <th className="border border-black p-1.5 w-28">Subject Code</th>
              <th className="border border-black p-1.5 text-left w-[160mm]">Full Subject Name</th>
              <th className="border border-black p-1.5 text-left w-[115mm]">Assigned Faculty</th>
              <th className="border border-black p-0.5 w-14" colSpan={3}>
                Sessions/Week
                <div className="grid grid-cols-3 border-t border-black mt-0.5 text-[8.5px]">
                  <span>L</span>
                  <span>T</span>
                  <span>P</span>
                </div>
              </th>
              <th className="border border-black p-1.5 w-20">Total Sessions</th>
            </tr>
          </thead>
          <tbody>
            {legendSubjects.length === 0 ? (
              <tr>
                <td colSpan={8} className="border border-black p-3 text-center text-gray-500 italic">
                  No subjects placed in this timetable
                </td>
              </tr>
            ) : (
              legendSubjects.map((sub, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border border-black p-1.5 text-center font-bold">{i + 1}</td>
                  <td className="border border-black p-1.5 text-center font-mono font-bold text-blue-900">{sub.code}</td>
                  <td className="border border-black p-1.5 uppercase font-bold text-gray-950">{sub.name}</td>
                  <td className="border border-black p-1.5 text-gray-900">{sub.faculty}</td>
                  <td className="border border-black p-1.5 text-center border-r-0 font-medium">{sub.L}</td>
                  <td className="border border-black p-1.5 text-center border-r-0 font-medium">{sub.T}</td>
                  <td className="border border-black p-1.5 text-center font-medium">{sub.P}</td>
                  <td className="border border-black p-1.5 text-center font-bold text-gray-950">{sub.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 5. SIGNATURES ROW */}
      <div className="mt-8 flex items-center justify-between px-6 text-xs font-bold font-serif">
        <div>Class Advisor</div>
        <div>Timetable Coordinator</div>
        <div>HOD, CSE</div>
        <div>Principal</div>
      </div>
    </div>
  );
};

export default OfficialTimetableExport;
