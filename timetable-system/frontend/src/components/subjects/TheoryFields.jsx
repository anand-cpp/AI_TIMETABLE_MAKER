import { useEffect, useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { Plus, Trash2 } from 'lucide-react';
import teacherService from '../../services/teacherService';
import settingsService from '../../services/settingsService';

const TheoryFields = ({ register, errors, setValue, watch, initialData }) => {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [periodTimeline, setPeriodTimeline] = useState([]);
  const [fridayTimeline, setFridayTimeline] = useState([]);
  const [workingDays, setWorkingDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [fixedSlots, setFixedSlots] = useState([]);

  // Watch for consecutive periods toggle to show/hide duration field
  const requiresConsecutive = watch('requiresConsecutivePeriods');
  const fixedSlotsEnabled = watch('fixedSlotsEnabled');

  useEffect(() => {
    teacherService.getAll()
      .then((res) => setTeachers(res.data.teachers || []))
      .catch(() => {});
  }, []);

  // Fetch settings to get period timeline and working days
  useEffect(() => {
    settingsService.get()
      .then((res) => {
        const settings = res.data?.settings || {};
        if (settings.periodTimeline) setPeriodTimeline(settings.periodTimeline);
        if (settings.fridayTimeline) setFridayTimeline(settings.fridayTimeline);
        if (settings.workingDays) setWorkingDays(settings.workingDays);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialData?.teachers) {
      const ids = initialData.teachers.map((t) =>
        t._id ? t._id.toString() : t.toString()
      );
      setSelectedTeachers(ids);
      setValue('teachers', ids);
    }
    if (initialData?.requiresConsecutivePeriods !== undefined) {
      setValue('requiresConsecutivePeriods', initialData.requiresConsecutivePeriods);
    }
    if (initialData?.consecutivePeriodsCount !== undefined) {
      setValue('consecutivePeriodsCount', initialData.consecutivePeriodsCount);
    }
    // Handle both legacy fixedSlot and new fixedSlots
    if (initialData?.fixedSlots && initialData.fixedSlots.length > 0) {
      setFixedSlots(initialData.fixedSlots);
      setValue('fixedSlots', initialData.fixedSlots);
      setValue('fixedSlotsEnabled', true);
    } else if (initialData?.fixedSlot && initialData.fixedSlot.day && initialData.fixedSlot.period) {
      // Migrate legacy single fixedSlot
      const migrated = [{ day: initialData.fixedSlot.day, period: initialData.fixedSlot.period, isMandatory: initialData.fixedSlot.isMandatory !== false }];
      setFixedSlots(migrated);
      setValue('fixedSlots', migrated);
      setValue('fixedSlotsEnabled', true);
    }
  }, [initialData, setValue]);

  const handleTeacherToggle = (teacherId) => {
    const updated = selectedTeachers.includes(teacherId)
      ? selectedTeachers.filter((id) => id !== teacherId)
      : [...selectedTeachers, teacherId];
    setSelectedTeachers(updated);
    setValue('teachers', updated);
  };

  // Get teaching periods for a specific day
  const getTeachingPeriods = (day) => {
    const timeline = day === 'Friday' && fridayTimeline.length > 0 ? fridayTimeline : periodTimeline;
    return timeline
      .filter((p) => !p.isBreak)
      .map((p) => p.periodNumber)
      .sort((a, b) => a - b);
  };

  // Get period options for Select component
  const getPeriodOptions = (day) => {
    const periods = getTeachingPeriods(day);
    return periods.map((p) => ({ value: p, label: `Period ${p}` }));
  };

  const dayOptions = workingDays.map((day) => ({ value: day, label: day }));

  const addFixedSlot = () => {
    const firstDay = dayOptions[0]?.value || 'Monday';
    const firstPeriods = getPeriodOptions(firstDay);
    const firstPeriod = firstPeriods[0]?.value || 1;
    const newSlot = { day: firstDay, period: firstPeriod, isMandatory: true };
    const updated = [...fixedSlots, newSlot];
    setFixedSlots(updated);
    setValue('fixedSlots', updated);
    setValue('fixedSlotsEnabled', true);
  };

  const updateFixedSlot = (index, field, value) => {
    const updated = [...fixedSlots];
    updated[index] = { ...updated[index], [field]: value };
    setFixedSlots(updated);
    setValue('fixedSlots', updated);
  };

  const removeFixedSlot = (index) => {
    const updated = fixedSlots.filter((_, i) => i !== index);
    setFixedSlots(updated);
    setValue('fixedSlots', updated);
    if (updated.length === 0) {
      setValue('fixedSlotsEnabled', false);
    }
  };

  const handleToggleFixedSlots = (enabled) => {
    if (enabled) {
      if (fixedSlots.length === 0) {
        addFixedSlot();
      } else {
        setValue('fixedSlotsEnabled', true);
      }
    } else {
      setValue('fixedSlotsEnabled', false);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        label="Weekly Hours"
        type="number"
        required
        placeholder="e.g. 3"
        hint="Number of periods per week for this subject"
        error={errors.weeklyHours?.message}
        {...register('weeklyHours', {
          required: 'Weekly hours is required',
          min: { value: 1, message: 'Min 1 period per week' },
          max: { value: 20, message: 'Max 20 periods per week' },
        })}
      />

      <div className="space-y-1.5">
        <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
          Assigned Teacher(s) <span className="text-rose-600 dark:text-rose-400 ml-1">*</span>
        </label>
        <div className="border border-slate-300 dark:border-slate-800 rounded-2xl max-h-48 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
          {teachers.length === 0 ? (
            <p className="p-4 text-xs font-semibold text-slate-400 text-center">
              No teachers found. Add teachers first.
            </p>
          ) : (
            teachers.map((teacher) => {
              const isSelected = selectedTeachers.includes(teacher._id);
              return (
                <label
                  key={teacher._id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${
                    isSelected ? 'bg-blue-50/80 dark:bg-blue-950/50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleTeacherToggle(teacher._id)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{teacher.name}</p>
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-400">
                      @{teacher.username}
                      {teacher.departmentId?.name && ` · ${teacher.departmentId.name}`}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>
        {selectedTeachers.length === 0 && (
          <p className="form-error">At least one teacher must be selected</p>
        )}
        {selectedTeachers.length > 0 && (
          <p className="form-hint">{selectedTeachers.length} teacher(s) selected</p>
        )}
      </div>

      {/* Feature A: Consecutive Periods Configuration */}
      <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-700 dark:text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </span>
          Consecutive Periods Configuration
        </h4>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('requiresConsecutivePeriods')}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                This theory subject requires consecutive periods
              </span>
            </label>
          </div>

          {requiresConsecutive && (
            <Input
              label="Required Consecutive Periods"
              type="number"
              required
              placeholder="e.g. 2"
              hint="Number of consecutive periods required (2-6). Must form one uninterrupted block."
              error={errors.consecutivePeriodsCount?.message}
              {...register('consecutivePeriodsCount', {
                required: 'Consecutive periods count is required',
                min: { value: 2, message: 'Min 2 consecutive periods' },
                max: { value: 6, message: 'Max 6 consecutive periods' },
              })}
            />
          )}
        </div>
      </div>

      {/* Feature B: Fixed Slot Configuration */}
      <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-700 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" /></svg>
          </span>
          Fixed Slot Constraints
        </h4>

        <div className="space-y-3">
          <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 mb-2">
            Does this subject need to be scheduled at specific day(s) and period(s)?
          </label>

          <div className="inline-flex rounded-2xl border border-slate-200 dark:border-slate-800 p-0.5 bg-white dark:bg-slate-950">
            {[
              { value: true, label: 'Yes' },
              { value: false, label: 'No' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleToggleFixedSlots(opt.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  fixedSlotsEnabled === opt.value
                    ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {fixedSlotsEnabled && (
            <div className="space-y-3">
              {fixedSlots.length === 0 ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
                  No fixed slots added yet. Click "Add Another Slot" to add one.
                </div>
              ) : (
                fixedSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <span className="text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      Slot {index + 1}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                      <Select
                        label="Day"
                        required
                        options={dayOptions}
                        placeholder="Select day"
                        error={errors[`fixedSlots.${index}.day`]?.message}
                        value={slot.day}
                        onChange={(e) => updateFixedSlot(index, 'day', e.target.value)}
                      />
                      <Select
                        label="Period"
                        required
                        options={getPeriodOptions(slot.day)}
                        placeholder="Select period"
                        error={errors[`fixedSlots.${index}.period`]?.message}
                        value={slot.period}
                        onChange={(e) => updateFixedSlot(index, 'period', Number(e.target.value))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFixedSlot(index)}
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors self-start"
                      title="Remove this slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={addFixedSlot}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Slot
                </button>
              </div>

              {fixedSlots.length > 0 && (
                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
                  <p className="text-xs font-bold uppercase tracking-widest text-purple-700 dark:text-purple-300 mb-2">
                    Configured Fixed Slots
                  </p>
                  <ul className="space-y-1 text-sm text-slate-900 dark:text-white">
                    {fixedSlots.map((slot, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300 text-xs font-bold">
                          {index + 1}
                        </span>
                        <span>{slot.day} — Period {slot.period}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TheoryFields;