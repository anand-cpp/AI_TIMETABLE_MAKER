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
      <div className="text-center py-12 text-[var(--text-muted)] font-sans">
        <p className="text-sm">No classes assigned yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs font-sans">
        <thead>
          <tr className="bg-[var(--bg-surface-alt)] text-[var(--text-muted)]">
            <th className="border border-[var(--border)] px-3 py-2.5 text-left text-[11px] font-sans font-semibold uppercase tracking-widest w-20">
              Day
            </th>
            {allPeriods.map((period) => (
              <th
                key={period}
                className="border border-[var(--border)] px-2 py-2.5 text-center font-sans font-semibold text-[11px] uppercase tracking-widest min-w-[90px]"
              >
                P{period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) => (
            <tr key={day}>
              <td className="border border-[var(--border)] px-3 py-2 font-sans font-semibold text-xs text-[var(--text-primary)] bg-[var(--bg-surface-alt)]/50">
                <span className="hidden sm:block">{day}</span>
                <span className="block sm:hidden">{dayShort(day)}</span>
              </td>
              {allPeriods.map((period) => {
                const slot = slotMap[day]?.[period];
                if (!slot) {
                  return (
                    <td
                      key={period}
                      className="border border-[var(--border)] p-1.5 min-h-[56px] bg-[var(--bg-surface)]"
                    />
                  );
                }
                return (
                  <td
                    key={period}
                    className={cn(
                      'border border-[var(--border)] p-2 min-h-[56px] transition-colors',
                      slot.subjectType === 'lab' && 'bg-[var(--accent-soft)]/60 border-l-[3px] border-l-[var(--accent)]',
                      slot.subjectType === 'elective' && 'bg-[var(--accent-soft)] border-l-[3px] border-l-[var(--accent)]',
                      slot.subjectType === 'theory' && 'bg-[var(--bg-surface)]',
                    )}
                  >
                    <div>
                      <p className="font-sans font-semibold text-xs text-[var(--text-primary)] leading-tight">
                        {slot.subjectName}
                      </p>
                      {slot.subjectCode && (
                        <p className="text-xs font-mono text-[var(--text-secondary)]">
                          {slot.subjectCode}
                        </p>
                      )}
                      <p className="text-xs font-sans font-medium text-[var(--accent)] mt-0.5">
                        {slot.className}
                      </p>
                      {slot.roomName && (
                        <p className="text-xs font-sans text-[var(--text-muted)] mt-0.5">📍 {slot.roomName}</p>
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