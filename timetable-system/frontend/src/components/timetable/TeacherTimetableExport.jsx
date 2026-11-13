import React from 'react';

/**
 * Official Ahalia Teacher Timetable Export Component
 * Layout: Professional A3 Landscape (420mm x 297mm)
 * - Prominent, full human-readable Subject Names
 * - Secondary Class & Subject Codes
 * - Explicit Friday Special Timings & 12:50 PM - 02:30 PM Prayer Break
 * - Official Ahalia Header Box & Form No. ASET-CS/DS03/FM07
 * - Assigned Subjects Summary Table
 */

const TeacherTimetableExport = ({
  teacherName = 'Dr. Anoop Kumar',
  designation = 'HOD, CSE',
  departmentName = 'Computer Science and Engineering',
  academicYear = '2026-27',
  semester = 'ODD',
  timetableVersion,
  effectiveDate = '27-08-2024',
}) => {
  // Aggregate teacher's slots across all class timetables in this version
  const teacherSlotsMap = {};
  const teacherSubjectsMap = {};

  if (timetableVersion?.classTimetables) {
    for (const ct of timetableVersion.classTimetables) {
      for (const slot of ct.slots || []) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;
        const matchesTeacher = Array.isArray(slot.teacherNames)
          ? slot.teacherNames.some((t) => t && t.toLowerCase().includes(teacherName.toLowerCase()))
          : slot.teacherNames?.toLowerCase().includes(teacherName.toLowerCase());

        if (matchesTeacher) {
          if (!teacherSlotsMap[slot.day]) teacherSlotsMap[slot.day] = {};
          teacherSlotsMap[slot.day][slot.period] = {
            ...slot,
            className: ct.className,
          };

          const key = `${ct.className}-${slot.subjectCode || slot.subjectName}`;
          if (!teacherSubjectsMap[key]) {
            teacherSubjectsMap[key] = {
              subjectCode: slot.subjectCode || 'N/A',
              subjectName: slot.subjectName || slot.subjectCode,
              className: ct.className,
              roomName: slot.roomName || 'LH 102',
              sessions: 0,
            };
          }
          teacherSubjectsMap[key].sessions += 1;
        }
      }
    }
  }

  const assignedSubjects = Object.values(teacherSubjectsMap);

  const renderTeacherCell = (item) => {
    if (!item) {
      return <span className="text-gray-400 font-sans text-[11px] italic">— (Free) —</span>;
    }

    const isMinor = Boolean(item.isMinor || item.subjectType === 'minor');
    const isLab = Boolean(item.subjectType === 'lab' || item.subjectType === 'practical' || item.isLabBlock || (item.subjectName && item.subjectName.toLowerCase().includes('lab')));
    const isElective = Boolean(item.isElective || item.subjectType === 'elective');

    const cleanMinorSubjectName = (name) => {
      if (!name || typeof name !== 'string') return '';
      return name
        .replace(/^\s*minor\s*[\/\-—:]\s*/i, '')
        .replace(/\s*[\/\-—:]\s*minor\s*$/i, '')
        .replace(/\s*\/\s*minor\b/i, '')
        .replace(/\bminor\s*\/\s*/i, '')
        .replace(/\s*\(\s*minor\s*\)/i, '')
        .trim();
    };

    const rawSubjectName = item.minorSubjectName || item.subjectName || '';
    const displayName = isMinor
      ? (cleanMinorSubjectName(rawSubjectName) || item.subjectCode || 'Minor')
      : (item.subjectName || item.subjectCode);

    return (
      <div className="flex flex-col items-center justify-center p-2 text-center leading-snug w-full h-full min-h-[58px]">
        {/* 1. Primary: FULL HUMAN-READABLE SUBJECT NAME */}
        <div className="font-bold text-[11px] text-gray-950 uppercase tracking-tight line-clamp-3 mb-0.5">
          {displayName}
        </div>

        {/* 2. Secondary: Class & Subject Code */}
        <div className="text-[9.5px] font-semibold text-blue-900 tracking-wide mb-0.5">
          <span className="font-bold">{item.className}</span> {item.subjectCode ? `(${item.subjectCode})` : ''}
        </div>

        {/* 3. Designation Badges */}
        <div className="flex items-center justify-center gap-1 mt-0.5 mb-0.5 flex-wrap">
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
        </div>

        {/* 4. Room */}
        {item.roomName && (
          <div className="text-[8.5px] text-gray-600 font-mono font-medium">
            Room: {item.roomName}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      id="teacher-timetable-export"
      className="official-teacher-export p-8 bg-white text-black font-serif text-xs leading-normal border border-gray-300 rounded-xs shadow-lg mx-auto"
      style={{
        width: '420mm',
        minHeight: '297mm',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: "'Times New Roman', Times, serif",
      }}
    >
      {/* 1. 3-COLUMN OFFICIAL HEADER */}
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
        Form No.: <u className="font-bold">ASET-CS/DS03/FM07</u>
      </div>

      {/* TITLE & DEPARTMENT */}
      <div className="text-center mb-3">
        <h2 className="font-bold text-base underline tracking-wider uppercase m-0 text-black">
          Teacher Time Table
        </h2>
        <h3 className="font-bold text-xs underline mt-1 text-gray-900 uppercase">
          Department of {departmentName}
        </h3>
      </div>

      {/* TEACHER METADATA ROW */}
      <table className="w-full text-xs font-serif mb-3 font-semibold">
        <tbody>
          <tr>
            <td className="w-1/4">Academic Year: <b className="text-sm">{academicYear}</b></td>
            <td className="w-1/4 text-center">Faculty Name: <b className="text-sm text-blue-900">{teacherName}</b></td>
            <td className="w-1/4 text-center">Designation: <b className="text-sm">{designation}</b></td>
            <td className="w-1/4 text-right">Semester: <b className="text-sm">{semester}</b></td>
          </tr>
        </tbody>
      </table>

      {/* 2. MONDAY TO THURSDAY TEACHER GRID */}
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900 mb-1">
          Monday – Thursday Teaching Schedule
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
              return (
                <tr key={day} className="h-14">
                  <td className="border border-black font-bold bg-gray-100 text-xs">{shortDay}</td>
                  <td className="border border-black">{renderTeacherCell(teacherSlotsMap[day]?.[1])}</td>
                  <td className="border border-black">{renderTeacherCell(teacherSlotsMap[day]?.[2])}</td>
                  <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700 uppercase">BREAK</td>
                  <td className="border border-black">{renderTeacherCell(teacherSlotsMap[day]?.[3])}</td>
                  <td className="border border-black bg-gray-100 font-bold text-[8.5px] tracking-wider text-gray-800 uppercase leading-tight">LUNCH<br/>BREAK</td>
                  <td className="border border-black">{renderTeacherCell(teacherSlotsMap[day]?.[4])}</td>
                  <td className="border border-black">{renderTeacherCell(teacherSlotsMap[day]?.[5])}</td>
                  <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700 uppercase">BREAK</td>
                  <td className="border border-black">{renderTeacherCell(teacherSlotsMap[day]?.[6])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. FRIDAY SPECIAL TEACHER GRID */}
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
            <tr className="h-14">
              <td className="border border-black font-bold bg-gray-100 text-xs">FRI</td>
              <td className="border border-black">{renderTeacherCell(teacherSlotsMap['Friday']?.[1])}</td>
              <td className="border border-black">{renderTeacherCell(teacherSlotsMap['Friday']?.[2])}</td>
              <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">BREAK</td>
              <td className="border border-black">{renderTeacherCell(teacherSlotsMap['Friday']?.[3])}</td>
              <td className="border border-black">{renderTeacherCell(teacherSlotsMap['Friday']?.[4])}</td>
              {/* FRIDAY SPECIAL PRAYER / LUNCH BREAK */}
              <td className="border-2 border-amber-600 bg-amber-100 font-bold text-amber-950 p-2 align-middle">
                <div className="text-[9.5px] uppercase tracking-wide">Friday Special Lunch / Prayer Break</div>
                <div className="text-[8.5px] font-semibold text-amber-900 mt-0.5">12:50 PM to 02:30 PM</div>
              </td>
              <td className="border border-black">{renderTeacherCell(teacherSlotsMap['Friday']?.[5])}</td>
              <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">BREAK</td>
              <td className="border border-black">{renderTeacherCell(teacherSlotsMap['Friday']?.[6])}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 4. TEACHER SUMMARY TABLE */}
      <div className="mt-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-800 mb-1">
          Assigned Subjects & Teaching Workload
        </div>
        <table className="w-full border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-gray-100 font-bold text-center">
              <th className="border border-black p-1.5 w-12">Sl</th>
              <th className="border border-black p-1.5 w-32">Subject Code</th>
              <th className="border border-black p-1.5 text-left w-[180mm]">Full Subject Name</th>
              <th className="border border-black p-1.5 text-center w-36">Class</th>
              <th className="border border-black p-1.5 text-center w-28">Room</th>
              <th className="border border-black p-1.5 text-center w-36">Sessions / Week</th>
            </tr>
          </thead>
          <tbody>
            {assignedSubjects.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-black p-3 text-center text-gray-500 italic">
                  No teaching periods assigned to this faculty member in the current timetable
                </td>
              </tr>
            ) : (
              assignedSubjects.map((sub, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border border-black p-1.5 text-center font-bold">{i + 1}</td>
                  <td className="border border-black p-1.5 text-center font-mono font-bold text-blue-900">{sub.subjectCode}</td>
                  <td className="border border-black p-1.5 uppercase font-bold text-gray-950">{sub.subjectName}</td>
                  <td className="border border-black p-1.5 text-center font-semibold">{sub.className}</td>
                  <td className="border border-black p-1.5 text-center font-mono">{sub.roomName}</td>
                  <td className="border border-black p-1.5 text-center font-bold text-gray-950">{sub.sessions}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 5. SIGNATURES ROW */}
      <div className="mt-8 flex items-center justify-between px-6 text-xs font-bold font-serif">
        <div>Faculty Signature</div>
        <div>Timetable Coordinator</div>
        <div>HOD, CSE</div>
        <div>Principal</div>
      </div>
    </div>
  );
};

export default TeacherTimetableExport;
