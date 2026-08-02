import { useMemo } from 'react';
import { cn } from '../../utils/cn';
import { dayShort } from '../../utils/formatters';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TeacherTimetableGrid = ({ slots, periods }) => {
  // Build slot map: day -> period -> slot
  const slotMap = useMemo(() => {
    const map = {};
    for (const slot of slots || []) {
      if (!map[slot.day]) map[slot.day] = {};
      map[slot.day][slot.period] = slot;
    }
    return map;
  }, [slots]);

  const allPeriods = useMemo(() => {
    if (periods?.length) return periods;
    const pSet = new Set();
    for (const slot of slots || []) pSet.add(slot.period);
    return [...pSet].sort((a, b) => a - b);
  }, [slots, periods]);

  if (!slots || slots.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No classes assigned yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800/90">
            <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left text-xs font-black text-slate-800 dark:text-white w-20 uppercase tracking-wider">
              Day
            </th>
            {allPeriods.map((period) => (
              <th
                key={period}
                className="border border-slate-200 dark:border-slate-700 px-2 py-2.5 text-center font-black text-slate-800 dark:text-white min-w-[90px] uppercase tracking-wider"
              >
                P{period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) => (
            <tr key={day}>
              <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-black text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900 text-xs">
                <span className="hidden sm:block">{day}</span>
                <span className="block sm:hidden">{dayShort(day)}</span>
              </td>
              {allPeriods.map((period) => {
                const slot = slotMap[day]?.[period];
                if (!slot) {
                  return (
                    <td
                      key={period}
                      className="border border-slate-200 dark:border-slate-800 p-1.5 min-h-[56px] bg-white dark:bg-slate-900/60"
                    />
                  );
                }
                return (
                  <td
                    key={period}
                    className={cn(
                      'border border-slate-200 dark:border-slate-800 p-1.5 min-h-[56px]',
                      slot.subjectType === 'lab' && 'bg-blue-50/90 dark:bg-blue-950/60',
                      slot.subjectType === 'elective' && 'bg-emerald-50/90 dark:bg-emerald-950/60',
                      slot.subjectType === 'theory' && 'bg-white dark:bg-slate-900/90',
                    )}
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {slot.subjectName}
                      </p>
                      {slot.subjectCode && (
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-300 font-bold">
                          {slot.subjectCode}
                        </p>
                      )}
                      <p className="text-xs text-blue-600 dark:text-cyan-400 font-black mt-0.5">
                        {slot.className}
                      </p>
                      {slot.roomName && (
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 mt-0.5">📍 {slot.roomName}</p>
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

export default TeacherTimetableGrid;