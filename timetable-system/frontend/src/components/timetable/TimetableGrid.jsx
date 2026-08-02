import { useState, useMemo } from 'react';
import SlotCell from './SlotCell';
import { cn } from '../../utils/cn';
import { dayShort } from '../../utils/formatters';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TimetableGrid = ({
  classTimetable,
  onSlotClick,
  selectedSlot,
  showActions = false,
  readonly = false,
}) => {
  if (!classTimetable || !classTimetable.slots) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        No timetable data available
      </div>
    );
  }

  // Build slot map: day -> period -> slot
  const slotMap = useMemo(() => {
    const map = {};
    for (const slot of classTimetable.slots) {
      if (!map[slot.day]) map[slot.day] = {};
      map[slot.day][slot.period] = slot;
    }
    return map;
  }, [classTimetable.slots]);

  // Get all unique period numbers sorted
  const periods = useMemo(() => {
    const pSet = new Set();
    for (const slot of classTimetable.slots) {
      pSet.add(slot.period);
    }
    return [...pSet].sort((a, b) => a - b);
  }, [classTimetable.slots]);

  const handleSlotClick = (slot) => {
    if (readonly) return;
    onSlotClick?.(slot);
  };

  const isSelected = (slot) => {
    if (!selectedSlot) return false;
    return selectedSlot.day === slot?.day && selectedSlot.period === slot?.period;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800/90">
            <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left text-xs font-black text-slate-800 dark:text-white w-20 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 uppercase tracking-wider">
              Day
            </th>
            {periods.map((period) => {
              // Check if this is a break period
              const isBreakPeriod = DAYS.some((day) => {
                const slot = slotMap[day]?.[period];
                return slot?.isBreak;
              });
              return (
                <th
                  key={period}
                  className={cn(
                    'border border-slate-200 dark:border-slate-700 px-2 py-2.5 text-center font-black text-slate-800 dark:text-white min-w-[80px] uppercase tracking-wider',
                    isBreakPeriod && 'bg-slate-200/60 dark:bg-slate-900 text-slate-400 dark:text-slate-400'
                  )}
                >
                  {isBreakPeriod ? '—' : `P${period}`}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) => (
            <tr key={day}>
              <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-black text-slate-800 dark:text-white sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 text-xs">
                <span className="hidden sm:block">{day}</span>
                <span className="block sm:hidden">{dayShort(day)}</span>
              </td>
              {periods.map((period) => {
                const slot = slotMap[day]?.[period];
                return (
                  <SlotCell
                    key={`${day}-${period}`}
                    slot={slot || { day, period, isEmpty: true }}
                    onClick={handleSlotClick}
                    isSelected={isSelected(slot)}
                    showActions={showActions && !readonly}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableGrid;