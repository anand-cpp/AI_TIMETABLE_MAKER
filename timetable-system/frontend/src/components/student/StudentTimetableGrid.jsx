import { useMemo } from 'react';
import { cn } from '../../utils/cn';
import { dayShort } from '../../utils/formatters';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const StudentTimetableGrid = ({ slots }) => {
  const slotMap = useMemo(() => {
    const map = {};
    for (const slot of slots || []) {
      if (!map[slot.day]) map[slot.day] = {};
      map[slot.day][slot.period] = slot;
    }
    return map;
  }, [slots]);

  const periods = useMemo(() => {
    const pSet = new Set();
    for (const slot of slots || []) pSet.add(slot.period);
    return [...pSet].sort((a, b) => a - b);
  }, [slots]);

  if (!slots || slots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No timetable data available
      </div>
    );
  }

  const getCellStyle = (slot) => {
    if (!slot || slot.isEmpty) return 'bg-white dark:bg-slate-900/60';
    if (slot.isBreak) return 'bg-slate-100 dark:bg-slate-800';
    if (slot.subjectType === 'lab') return 'bg-blue-50/90 dark:bg-blue-950/60 border-l-2 border-l-blue-500';
    if (slot.subjectType === 'elective') return 'bg-emerald-50/90 dark:bg-emerald-950/60 border-l-2 border-l-emerald-500';
    return 'bg-white dark:bg-slate-900/90';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <th className="px-4 py-3 text-left font-black w-24 rounded-tl-xl uppercase tracking-wider text-xs">
              Day
            </th>
            {periods.map((period, idx) => {
              const isBreak = DAYS.some((day) => slotMap[day]?.[period]?.isBreak);
              return (
                <th
                  key={period}
                  className={cn(
                    'px-3 py-3 text-center font-black min-w-[100px] uppercase tracking-wider text-xs',
                    isBreak && 'bg-indigo-900/80 text-cyan-200',
                    idx === periods.length - 1 && 'rounded-tr-xl'
                  )}
                >
                  {isBreak ? '—' : `P${period}`}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day, dayIdx) => (
            <tr
              key={day}
              className={dayIdx % 2 === 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-slate-50/50 dark:bg-slate-900/80'}
            >
              <td className="px-4 py-3 font-black text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 text-xs">
                <span className="hidden sm:block">{day}</span>
                <span className="block sm:hidden">{dayShort(day)}</span>
              </td>
              {periods.map((period) => {
                const slot = slotMap[day]?.[period];

                if (!slot || slot.isEmpty) {
                  return (
                    <td
                      key={period}
                      className="border border-slate-200 dark:border-slate-800 p-2 min-h-[70px]"
                    />
                  );
                }

                if (slot.isBreak) {
                  return (
                    <td
                      key={period}
                      className="border border-slate-200 dark:border-slate-800 p-2 bg-slate-100 dark:bg-slate-800 text-center"
                    >
                      <span className="text-xs text-slate-400 dark:text-slate-400 italic">
                        {slot.subjectName || 'Break'}
                      </span>
                    </td>
                  );
                }

                return (
                  <td
                    key={period}
                    className={cn(
                      'border border-slate-200 dark:border-slate-800 p-2.5 min-h-[70px] align-top',
                      getCellStyle(slot)
                    )}
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {slot.subjectName}
                      </p>
                      {slot.subjectCode && (
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-300 font-bold mt-0.5">
                          {slot.subjectCode}
                        </p>
                      )}
                      {slot.teacherNames?.length > 0 && (
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-200 mt-1 truncate">
                          {slot.teacherNames.join(', ')}
                        </p>
                      )}
                      {slot.isBatchSplit && (
                        <p className="text-xs font-bold text-blue-600 dark:text-cyan-400 mt-0.5">
                          Batch Split
                        </p>
                      )}
                      {slot.roomName && (
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 mt-0.5">
                          📍 {slot.roomName}
                        </p>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentTimetableGrid;