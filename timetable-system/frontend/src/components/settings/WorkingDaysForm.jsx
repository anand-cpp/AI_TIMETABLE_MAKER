import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';
import { cn } from '../../utils/cn';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WorkingDaysForm = ({ settings, onSubmit, loading }) => {
  const [selectedDays, setSelectedDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [fridaySeparate, setFridaySeparate] = useState(false);

  useEffect(() => {
    if (settings) {
      setSelectedDays(settings.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      setFridaySeparate(settings.fridaySeparate || false);
    }
  }, [settings]);

  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedDays.length === 0) return;
    onSubmit({ workingDays: selectedDays, fridaySeparate });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 mb-3">Working Days</label>
        <div className="grid grid-cols-3 gap-2">
          {ALL_DAYS.map((day) => {
            const isSelected = selectedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={cn(
                  'px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer',
                  isSelected
                    ? 'border-blue-500 bg-blue-500/15 text-blue-700 dark:text-cyan-300 font-extrabold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                )}
              >
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
        {selectedDays.length === 0 && (
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-2">Select at least one working day</p>
        )}
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">
          {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''} selected:{' '}
          {selectedDays.join(', ')}
        </p>
      </div>

      {selectedDays.includes('Friday') && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Toggle
            checked={fridaySeparate}
            onChange={setFridaySeparate}
            label="Friday Separate Timeline"
            description="Use a different period schedule for Fridays (e.g. shorter day)"
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={loading}
          disabled={selectedDays.length === 0}
        >
          Save Working Days
        </Button>
      </div>
    </form>
  );
};

export default WorkingDaysForm;