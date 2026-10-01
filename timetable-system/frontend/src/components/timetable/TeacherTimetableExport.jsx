import React from 'react';

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
          ? slot.teacherNames.some((t) => t.toLowerCase().includes(teacherName.toLowerCase()))
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
              subjectCode: slot.subjectCode || slot.subjectName,
              subjectName: slot.subjectName,
              className: ct.className,
              roomName: slot.roomName || '121',
              sessions: 0,
            };
          }
          teacherSubjectsMap[key].sessions += 1;
        }
      }
    }
  }

  const assignedSubjects = Object.values(teacherSubjectsMap);

  return (
    <div
      id="teacher-timetable-export"
      className="official-teacher-export p-6 bg-white text-black font-serif text-xs leading-tight border border-gray-300 rounded-xs shadow-md mx-auto"
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
        Form No.: <u className="font-semibold">ASET-CS/DS03/FM07</u>
      </div>

      {/* TITLE */}
      <div className="text-center mb-3">
        <h2 className="font-bold text-sm underline tracking-wide uppercase m-0">
          Teacher Time Table
        </h2>
        <h3 className="font-bold text-xs underline m-1 text-gray-900">
          Department of {departmentName}
        </h3>
      </div>

      {/* TEACHER METADATA ROW */}
      <table className="w-full text-xs font-serif mb-3">
        <tbody>
          <tr>
            <td>Academic Year: <b>{academicYear}</b></td>
            <td>Semester: <b>{semester}</b></td>
            <td>Faculty: <b>{teacherName}</b></td>
            <td className="text-right">Designation: <b>{designation}</b></td>
          </tr>
        </tbody>
      </table>

      {/* TEACHER TIMETABLE GRID */}
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
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
            const shortDay = day.substring(0, 3).toUpperCase();
            return (
              <tr key={day} className="h-9">
                <td className="border border-black font-bold bg-gray-50">{shortDay}</td>
                {[1, 2].map((period) => {
                  const s = teacherSlotsMap[day]?.[period];
                  return (
                    <td key={period} className="border border-black">
                      {s ? <b>{s.className} - {s.subjectCode || s.subjectName}</b> : <span className="text-gray-400 font-sans text-[9px]">(free)</span>}
                    </td>
                  );
                })}
                <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">
                  BREAK
                </td>
                {[3].map((period) => {
                  const s = teacherSlotsMap[day]?.[period];
                  return (
                    <td key={period} className="border border-black">
                      {s ? <b>{s.className} - {s.subjectCode || s.subjectName}</b> : <span className="text-gray-400 font-sans text-[9px]">(free)</span>}
                    </td>
                  );
                })}
                <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">
                  LUNCH BREAK
                </td>
                {[4, 5].map((period) => {
                  const s = teacherSlotsMap[day]?.[period];
                  return (
                    <td key={period} className="border border-black">
                      {s ? <b>{s.className} - {s.subjectCode || s.subjectName}</b> : <span className="text-gray-400 font-sans text-[9px]">(free)</span>}
                    </td>
                  );
                })}
                <td className="border border-black bg-gray-100 font-bold text-[8px] tracking-widest text-gray-700">
                  BREAK
                </td>
                {[6].map((period) => {
                  const s = teacherSlotsMap[day]?.[period];
                  return (
                    <td key={period} className="border border-black">
                      {s ? <b>{s.className} - {s.subjectCode || s.subjectName}</b> : <span className="text-gray-400 font-sans text-[9px]">(free)</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TEACHER SUMMARY TABLE */}
      <div className="mt-4">
        <table className="w-full border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-gray-100 font-bold text-center">
              <th className="border border-black p-1 w-20">Subject Code</th>
              <th className="border border-black p-1 text-left">Subject Name</th>
              <th className="border border-black p-1 text-center w-24">Class</th>
              <th className="border border-black p-1 text-center w-20">Room</th>
              <th className="border border-black p-1 text-center w-24">Sessions/Week</th>
            </tr>
          </thead>
          <tbody>
            {assignedSubjects.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-black p-2 text-center text-gray-500 italic">
                  No classes assigned for this teacher in this version
                </td>
              </tr>
            ) : (
              assignedSubjects.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border border-black p-1 text-center font-mono font-semibold">{item.subjectCode}</td>
                  <td className="border border-black p-1 uppercase">{item.subjectName}</td>
                  <td className="border border-black p-1 text-center font-bold">{item.className}</td>
                  <td className="border border-black p-1 text-center">{item.roomName}</td>
                  <td className="border border-black p-1 text-center font-bold">{item.sessions}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeacherTimetableExport;
