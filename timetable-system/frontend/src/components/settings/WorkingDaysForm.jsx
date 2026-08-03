import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '../../utils/cn';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WorkingDaysForm = ({ settings, onSubmit, onPrevious, loading }) => {
  const [selectedDays, setSelectedDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [fridaySeparate, setFridaySeparate] = useState(false);
  const [nextRequested, setNextRequested] = useState(false);

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
    onSubmit({ workingDays: selectedDays, fridaySeparate }, nextRequested);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 font-sans">
      <div>
        <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-[var(--text-label)] mb-3">
          Working Days
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ALL_DAYS.map((day) => {
            const isSelected = selectedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={cn(
                  'px-3 py-2.5 rounded-sm border text-xs font-sans font-medium transition-all cursor-pointer',
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)] font-semibold'
                    : 'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--border-strong)]'
                )}
              >
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
        {selectedDays.length === 0 && (
          <p className="text-xs font-sans text-[var(--error)] mt-2">Select at least one working day</p>
        )}
        <p className="text-xs font-sans text-[var(--text-secondary)] mt-2">
          {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''} selected:{' '}
          {selectedDays.join(', ')}
        </p>
      </div>

      {selectedDays.includes('Friday') && (
        <div className="p-4 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm">
          <Toggle
            checked={fridaySeparate}
            onChange={setFridaySeparate}
            label="Friday Separate Timeline"
            description="Use a different period schedule for Fridays (e.g. shorter day)"
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
        <Button
          type="button"
          variant="ghost"
          onClick={onPrevious}
          leftIcon={<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />}
        >
          ← Previous
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            loading={loading}
            disabled={selectedDays.length === 0}
            onClick={() => setNextRequested(false)}
          >
            Save Working Days
          </Button>
          <Button
            type="submit"
            variant="outline"
            loading={loading}
            disabled={selectedDays.length === 0}
            onClick={() => setNextRequested(true)}
            rightIcon={<ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
          >
            Save & Next →
          </Button>
        </div>
      </div>
    </form>
  );
};

export default WorkingDaysForm;