import { cn } from '../../utils/cn';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const UnavailabilityGrid = ({ periods, unavailability = [], onChange }) => {
  const isBlocked = (day, period) =>
    unavailability.some((u) => u.day === day && u.period === period);

  const toggle = (day, period) => {
    const exists = isBlocked(day, period);
    if (exists) {
      onChange(unavailability.filter((u) => !(u.day === day && u.period === period)));
    } else {
      onChange([...unavailability, { day, period }]);
    }
  };

  const clearAll = () => onChange([]);

  const toggleDay = (day) => {
    const allBlocked = periods.every((p) => isBlocked(day, p));
    if (allBlocked) {
      onChange(unavailability.filter((u) => u.day !== day));
    } else {
      const existing = unavailability.filter((u) => u.day !== day);
      const newEntries = periods.map((p) => ({ day, period: p }));
      onChange([...existing, ...newEntries]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-900 dark:text-white">
          Unavailability Schedule
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
            <span className="w-3 h-3 rounded bg-rose-200 dark:bg-rose-900 border border-rose-400 dark:border-rose-700 inline-block" />
            Unavailable
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
            <span className="w-3 h-3 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 inline-block" />
            Available
          </div>
          {unavailability.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="w-20 text-left px-2 py-2 text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider">
                Day / Period
              </th>
              {periods.map((p) => (
                <th
                  key={p}
                  className="text-center px-1 py-2 text-slate-400 dark:text-slate-400 font-bold min-w-[40px] uppercase"
                >
                  P{p}
                </th>
              ))}
              <th className="text-center px-2 py-2 text-slate-400 dark:text-slate-400 font-bold uppercase">
                All
              </th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => {
              const allBlocked = periods.every((p) => isBlocked(day, p));
              const someBlocked = periods.some((p) => isBlocked(day, p));
              return (
                <tr key={day} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1.5 font-bold text-slate-800 dark:text-white text-xs">
                    {day.slice(0, 3)}
                  </td>
                  {periods.map((period) => {
                    const blocked = isBlocked(day, period);
                    return (
                      <td key={period} className="text-center px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggle(day, period)}
                          className={cn(
                            'w-7 h-7 rounded-lg border transition-all duration-100 cursor-pointer',
                            'hover:scale-110 focus:outline-none focus:ring-1 focus:ring-blue-400',
                            blocked
                              ? 'bg-rose-200 dark:bg-rose-900 border-rose-400 dark:border-rose-700 hover:bg-rose-300 dark:hover:bg-rose-800'
                              : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900'
                          )}
                          title={`${day} Period ${period}: ${blocked ? 'Click to mark available' : 'Click to mark unavailable'}`}
                        />
                      </td>
                    );
                  })}
                  <td className="text-center px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'w-7 h-7 rounded-lg border text-xs font-bold transition-all cursor-pointer',
                        'hover:scale-110 focus:outline-none',
                        allBlocked
                          ? 'bg-rose-500 border-rose-600 text-white'
                          : someBlocked
                          ? 'bg-rose-100 dark:bg-rose-950 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-300'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-300'
                      )}
                      title={allBlocked ? 'Click to clear entire day' : 'Click to block entire day'}
                    >
                      {allBlocked ? '✕' : someBlocked ? '~' : '✕'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {unavailability.length > 0 && (
        <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {unavailability.length} slot{unavailability.length !== 1 ? 's' : ''} marked as unavailable
        </p>
      )}
    </div>
  );
};

export default UnavailabilityGrid;