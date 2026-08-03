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
      <div className="text-center py-8 text-[var(--text-muted)] text-sm font-sans">
        No timetable data available
      </div>
    );
  }

  const getCellStyle = (slot) => {
    if (!slot || slot.isEmpty) return 'bg-[var(--bg-surface)]';
    if (slot.isBreak) return 'bg-[var(--bg-surface-alt)]';
    if (slot.subjectType === 'lab') return 'bg-[var(--accent-soft)]/60 border-l-[3px] border-l-[var(--accent)]';
    if (slot.subjectType === 'elective') return 'bg-[var(--accent-soft)] border-l-[3px] border-l-[var(--accent)]';
    return 'bg-[var(--bg-surface)]';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm font-sans">
        <thead>
          <tr className="bg-[var(--bg-surface-alt)] text-[var(--text-muted)] border-b border-[var(--border)]">
            <th className="px-4 py-3 text-left font-sans font-semibold text-[11px] uppercase tracking-widest w-24">
              Day
            </th>
            {periods.map((period) => {
              const isBreak = DAYS.some((day) => slotMap[day]?.[period]?.isBreak);
              return (
                <th
                  key={period}
                  className={cn(
                    'px-3 py-3 text-center font-sans font-semibold text-[11px] uppercase tracking-widest min-w-[100px]',
                    isBreak && 'bg-[var(--bg-surface-alt)] text-[var(--text-muted)]'
                  )}
                >
                  {isBreak ? '—' : `P${period}`}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {DAYS.map((day, dayIdx) => (
            <tr
              key={day}
              className={dayIdx % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-surface-alt)]/30'}
            >
              <td className="px-4 py-3 font-sans font-semibold text-xs text-[var(--text-primary)] border border-[var(--border)]">
                <span className="hidden sm:block">{day}</span>
                <span className="block sm:hidden">{dayShort(day)}</span>
              </td>
              {periods.map((period) => {
                const slot = slotMap[day]?.[period];

                if (!slot || slot.isEmpty) {
                  return (
                    <td
                      key={period}
                      className="border border-[var(--border)] p-2 min-h-[70px]"
                    />
                  );
                }

                if (slot.isBreak) {
                  return (
                    <td
                      key={period}
                      className="border border-[var(--border)] p-2 bg-[var(--bg-surface-alt)] text-center"
                    >
                      <span className="text-xs text-[var(--text-muted)] font-serif italic">
                        {slot.subjectName || 'Break'}
                      </span>
                    </td>
                  );
                }

                return (
                  <td
                    key={period}
                    className={cn(
                      'border border-[var(--border)] p-2.5 min-h-[70px] align-top transition-colors',
                      getCellStyle(slot)
                    )}
                  >
                    <div>
                      <p className="font-sans font-semibold text-xs text-[var(--text-primary)] leading-tight">
                        {slot.subjectName}
                      </p>
                      {slot.subjectCode && (
                        <p className="text-xs font-mono text-[var(--text-secondary)] mt-0.5">
                          {slot.subjectCode}
                        </p>
                      )}
                      {slot.teacherNames?.length > 0 && (
                        <p className="text-xs font-sans text-[var(--text-secondary)] mt-1 truncate">
                          {slot.teacherNames.join(', ')}
                        </p>
                      )}
                      {slot.isBatchSplit && (
                        <p className="text-[11px] font-sans font-semibold text-[var(--accent)] mt-0.5">
                          Batch Split
                        </p>
                      )}
                      {slot.roomName && (
                        <p className="text-xs font-sans text-[var(--text-muted)] mt-0.5">
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