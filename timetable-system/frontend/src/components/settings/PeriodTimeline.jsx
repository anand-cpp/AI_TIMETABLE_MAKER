import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { cn } from '../../utils/cn';
import { Plus, Trash2, GripVertical, Utensils, Coffee, Clock, Wand2, Sliders } from 'lucide-react';

const addMinutesToTime = (timeStr, minutes) => {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

const getDurationMinutes = (startTime, endTime) => {
  if (!startTime || !endTime || !startTime.includes(':') || !endTime.includes(':')) return null;
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return diff > 0 ? diff : null;
};

const formatDuration = (mins) => {
  if (!mins) return '';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
};

const defaultPeriod = (num, isBreak = false, label = '', duration = 60, startTime = '09:00') => ({
  periodNumber: num,
  startTime,
  endTime: addMinutesToTime(startTime, duration),
  isBreak,
  label: label || (isBreak ? 'Break' : `Period ${num}`),
});

const PeriodRow = ({ period, index, onChange, onDelete, canDelete, onSetDuration, onAdjustDuration }) => {
  const duration = getDurationMinutes(period.startTime, period.endTime) || 60;
  const isLunch = period.isBreak && period.label.toLowerCase().includes('lunch');
  const isTea = period.isBreak && (period.label.toLowerCase().includes('tea') || period.label.toLowerCase().includes('short'));

  return (
    <div className={cn(
      'p-3.5 rounded-2xl border transition-all space-y-2.5',
      period.isBreak
        ? isLunch
          ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80'
          : isTea
          ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800/80'
          : 'bg-slate-100/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
    )}>
      {/* Primary Row Controls */}
      <div className="flex items-center gap-3">
        <div className="text-slate-400 dark:text-slate-500 cursor-grab shrink-0">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Period / Break Badge */}
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black',
          period.isBreak
            ? isLunch
              ? 'bg-amber-500 text-white'
              : isTea
              ? 'bg-purple-500 text-white'
              : 'bg-slate-600 text-white'
            : 'bg-blue-500/15 text-blue-600 dark:text-cyan-400'
        )}>
          {period.isBreak ? (isLunch ? <Utensils className="w-4 h-4" /> : <Coffee className="w-4 h-4" />) : period.periodNumber}
        </div>

        {/* Inputs Grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
          {/* Label Input */}
          <div className="col-span-1">
            <input
              type="text"
              value={period.label}
              onChange={(e) => onChange(index, 'label', e.target.value)}
              placeholder="Period / Break Label"
              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Start Time Input (1-min step enabled) */}
          <div className="col-span-1">
            <input
              type="time"
              step="60"
              value={period.startTime}
              onChange={(e) => onChange(index, 'startTime', e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Time Input (1-min step enabled) */}
          <div className="col-span-1">
            <input
              type="time"
              step="60"
              value={period.endTime}
              onChange={(e) => onChange(index, 'endTime', e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Break Checkbox & Duration Badge */}
          <div className="col-span-1 flex items-center justify-between gap-2 px-1">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={period.isBreak}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange(index, 'isBreak', checked);
                  if (checked && !period.label.toLowerCase().includes('break')) {
                    onChange(index, 'label', 'Short Break');
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              Is Break?
            </label>

            {duration && (
              <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-cyan-300 border border-blue-200 dark:border-blue-800/60 shrink-0">
                {formatDuration(duration)}
              </span>
            )}
          </div>
        </div>

        {/* Delete Row Button */}
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="text-rose-400 hover:text-rose-600 shrink-0 cursor-pointer p-1"
            title="Delete Row"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Custom Duration & Time Modification Setup Bar */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-xs flex-wrap pl-11">
        <span className="font-extrabold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider flex items-center gap-1">
          <Sliders className="w-3 h-3 text-blue-500" /> Custom Duration Setup:
        </span>

        {/* Direct Custom Minutes Input */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-lg shadow-sm">
          <input
            type="number"
            min="1"
            max="300"
            value={duration || ''}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val > 0) onSetDuration(index, val);
            }}
            className="w-12 text-xs font-black text-center bg-transparent text-slate-900 dark:text-white focus:outline-none"
          />
          <span className="text-[10px] font-bold text-slate-400">mins</span>
        </div>

        {/* Stepper Buttons for Precise 1-min & 5-min Adjustments */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAdjustDuration(index, -5)}
            className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer"
            title="Decrease duration by 5 mins"
          >
            -5m
          </button>
          <button
            type="button"
            onClick={() => onAdjustDuration(index, -1)}
            className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer"
            title="Decrease duration by 1 min"
          >
            -1m
          </button>
          <button
            type="button"
            onClick={() => onAdjustDuration(index, 1)}
            className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer"
            title="Increase duration by 1 min"
          >
            +1m
          </button>
          <button
            type="button"
            onClick={() => onAdjustDuration(index, 5)}
            className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer"
            title="Increase duration by 5 mins"
          >
            +5m
          </button>
        </div>

        {/* Preset Duration Quick Chips for Breaks */}
        {period.isBreak && (
          <div className="flex gap-1 items-center ml-auto">
            {[5, 10, 15, 20, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => onSetDuration(index, mins)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer',
                  duration === mins
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-500'
                )}
              >
                {mins}m
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PeriodTimeline = ({ settings, onSubmit, onPrevious, loading, isFriday = false }) => {
  const [timeline, setTimeline] = useState([]);
  const [nextRequested, setNextRequested] = useState(false);

  useEffect(() => {
    const tl = isFriday
      ? settings?.fridayTimeline || []
      : settings?.periodTimeline || [];
    
    if (tl.length > 0) {
      setTimeline(tl);
    } else {
      // Standard default schedule with Lunch Break
      setTimeline([
        defaultPeriod(1, false, 'Period 1', 60, '09:00'),
        defaultPeriod(2, false, 'Period 2', 60, '10:00'),
        defaultPeriod(3, true, 'Tea Break', 15, '11:00'),
        defaultPeriod(4, false, 'Period 3', 60, '11:15'),
        defaultPeriod(5, false, 'Period 4', 60, '12:15'),
        defaultPeriod(6, true, 'Lunch Break', 45, '13:15'),
        defaultPeriod(7, false, 'Period 5', 60, '14:00'),
        defaultPeriod(8, false, 'Period 6', 60, '15:00'),
      ]);
    }
  }, [settings, isFriday]);

  const handleChange = (index, field, value) => {
    setTimeline((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleSetDuration = (index, minutes) => {
    setTimeline((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        return {
          ...p,
          endTime: addMinutesToTime(p.startTime, minutes),
        };
      })
    );
  };

  const handleAdjustDuration = (index, deltaMinutes) => {
    setTimeline((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const currentDur = getDurationMinutes(p.startTime, p.endTime) || 60;
        const newDur = Math.max(1, currentDur + deltaMinutes);
        return {
          ...p,
          endTime: addMinutesToTime(p.startTime, newDur),
        };
      })
    );
  };

  const handleAddTeachingPeriod = () => {
    const teachingCount = timeline.filter((p) => !p.isBreak).length;
    const nextNum = teachingCount + 1;
    const lastPeriod = timeline[timeline.length - 1];
    const startTime = lastPeriod ? lastPeriod.endTime : '09:00';
    setTimeline((prev) => [...prev, defaultPeriod(nextNum, false, `Period ${nextNum}`, 60, startTime)]);
  };

  const handleAddLunchBreak = () => {
    const lastPeriod = timeline[timeline.length - 1];
    const startTime = lastPeriod ? lastPeriod.endTime : '13:00';
    setTimeline((prev) => [...prev, defaultPeriod(0, true, 'Lunch Break', 45, startTime)]);
  };

  const handleAddTeaBreak = () => {
    const lastPeriod = timeline[timeline.length - 1];
    const startTime = lastPeriod ? lastPeriod.endTime : '11:00';
    setTimeline((prev) => [...prev, defaultPeriod(0, true, 'Tea Break', 15, startTime)]);
  };

  const handleAutoAlignTimes = () => {
    setTimeline((prev) => {
      let currentStart = prev[0]?.startTime || '09:00';
      let currentPeriodNum = 1;

      return prev.map((p) => {
        const duration = getDurationMinutes(p.startTime, p.endTime) || 60;
        const newStart = currentStart;
        const newEnd = addMinutesToTime(newStart, duration);
        currentStart = newEnd;

        const periodNumber = p.isBreak ? 0 : currentPeriodNum++;
        return {
          ...p,
          periodNumber,
          startTime: newStart,
          endTime: newEnd,
        };
      });
    });
  };

  const handleDelete = (index) => {
    if (timeline.length <= 1) return;
    setTimeline((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Re-index non-break periods sequentially before saving
    let pNum = 1;
    const cleanTimeline = timeline.map((p) => ({
      ...p,
      periodNumber: p.isBreak ? 0 : pNum++,
    }));

    const key = isFriday ? 'fridayTimeline' : 'periodTimeline';
    onSubmit({ [key]: cleanTimeline }, nextRequested);
  };

  const teachingCount = timeline.filter((p) => !p.isBreak).length;
  const breakCount = timeline.filter((p) => p.isBreak).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm">
        <div className="flex items-center gap-2 text-xs font-sans">
          <span className="px-2.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] rounded-xs font-semibold">
            {teachingCount} teaching period{teachingCount !== 1 ? 's' : ''}
          </span>
          <span className="px-2.5 py-0.5 bg-[var(--bg-surface)] text-[var(--text-secondary)] rounded-xs border border-[var(--border)] font-medium flex items-center gap-1">
            🍱 {breakCount} break{breakCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleAutoAlignTimes}
            leftIcon={<Wand2 className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.5} />}
            title="Sequentially align all period start & end times"
          >
            Auto-Align Times
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleAddLunchBreak}
            leftIcon={<Utensils className="w-3.5 h-3.5 text-[var(--warning)]" strokeWidth={1.5} />}
          >
            + Lunch Break
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleAddTeaBreak}
            leftIcon={<Coffee className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.5} />}
          >
            + Tea Break
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={handleAddTeachingPeriod}
            leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            + Period
          </Button>
        </div>
      </div>

      {/* Table Columns Header */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 px-14 text-[10px] font-sans font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden sm:grid">
        <span>Label</span>
        <span>Start Time</span>
        <span>End Time</span>
        <span>Break & Duration</span>
      </div>

      {/* Period Rows List */}
      <div className="space-y-2.5">
        {timeline.map((period, index) => (
          <PeriodRow
            key={index}
            period={period}
            index={index}
            onChange={handleChange}
            onDelete={handleDelete}
            canDelete={timeline.length > 1}
            onSetDuration={handleSetDuration}
            onAdjustDuration={handleAdjustDuration}
          />
        ))}
      </div>

      {/* Submit Button Row */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] font-sans">
        {!isFriday ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onPrevious}
            leftIcon={<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />}
          >
            ← Previous
          </Button>
        ) : <div />}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            loading={loading}
            onClick={() => setNextRequested(false)}
          >
            Save {isFriday ? 'Friday' : 'Main'} Timeline
          </Button>
          {!isFriday && (
            <Button
              type="submit"
              variant="outline"
              loading={loading}
              onClick={() => setNextRequested(true)}
              rightIcon={<ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
            >
              Save & Next →
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};

export default PeriodTimeline;