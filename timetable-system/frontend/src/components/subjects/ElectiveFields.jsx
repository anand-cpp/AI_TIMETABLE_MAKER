import { useEffect, useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import teacherService from '../../services/teacherService';
import classService from '../../services/classService';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const ELECTIVE_TYPE_OPTIONS = [
  { value: 'linked', label: 'Linked Elective (shared slot across classes)' },
  { value: 'open', label: 'Open Elective (students choose an option)' },
];

const ElectiveFields = ({ register, errors, setValue, initialData, currentClassId }) => {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [electiveType, setElectiveType] = useState('linked');
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [linkedClasses, setLinkedClasses] = useState([]);
  const [openOptions, setOpenOptions] = useState([
    { id: uuidv4(), optionName: '', teacherId: '', roomName: '' },
  ]);
  const [participatingClasses, setParticipatingClasses] = useState([]);
  const [requiresConsecutive, setRequiresConsecutive] = useState(false);
  const [consecutiveCount, setConsecutiveCount] = useState(1);
  const [fixedSlotsEnabled, setFixedSlotsEnabled] = useState(false);
  const [fixedSlots, setFixedSlots] = useState([]);

  useEffect(() => {
    Promise.all([
      teacherService.getAll(),
      classService.getAll(),
    ]).then(([teacherRes, classRes]) => {
      setTeachers(teacherRes.data.teachers || []);
      setClasses(
        (classRes.data.classes || []).filter(
          (c) => c._id !== currentClassId
        )
      );
    }).catch(() => {});
  }, [currentClassId]);

  useEffect(() => {
    if (initialData?.electiveDetails) {
      const ed = initialData.electiveDetails;
      setElectiveType(ed.electiveType || 'linked');
      setValue('electiveDetails.electiveType', ed.electiveType || 'linked');
      setValue('electiveDetails.linkedGroupId', ed.linkedGroupId || '');

      if (ed.linkedClasses?.length) {
        const ids = ed.linkedClasses.map((c) => c._id || c);
        setLinkedClasses(ids);
      }
      if (ed.participatingClasses?.length) {
        const ids = ed.participatingClasses.map((c) => c._id || c);
        setParticipatingClasses(ids);
      }
      if (ed.openElectiveOptions?.length) {
        setOpenOptions(
          ed.openElectiveOptions.map((o) => ({
            id: uuidv4(),
            optionName: o.optionName || '',
            teacherId: o.teacherId?._id || o.teacherId || '',
            roomName: o.roomName || '',
          }))
        );
      }
    }
    if (initialData?.teachers) {
      const ids = initialData.teachers.map((t) => t._id || t);
      setSelectedTeachers(ids);
    }
    // Initialize consecutive periods from existing subject data
    if (initialData?.requiresConsecutivePeriods !== undefined) {
      setRequiresConsecutive(initialData.requiresConsecutivePeriods);
      setValue('requiresConsecutivePeriods', initialData.requiresConsecutivePeriods);
    }
    if (initialData?.consecutivePeriodsCount !== undefined) {
      setConsecutiveCount(initialData.consecutivePeriodsCount);
      setValue('consecutivePeriodsCount', initialData.consecutivePeriodsCount);
    }
    // Initialize fixed slots from existing subject data
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

  const handleElectiveTypeChange = (val) => {
    setElectiveType(val);
    setValue('electiveDetails.electiveType', val);
  };

  const handleTeacherToggle = (teacherId) => {
    const updated = selectedTeachers.includes(teacherId)
      ? selectedTeachers.filter((id) => id !== teacherId)
      : [...selectedTeachers, teacherId];
    setSelectedTeachers(updated);
    setValue('teachers', updated);
  };

  const handleLinkedClassToggle = (classId) => {
    const updated = linkedClasses.includes(classId)
      ? linkedClasses.filter((id) => id !== classId)
      : [...linkedClasses, classId];
    setLinkedClasses(updated);
    setValue('electiveDetails.linkedClasses', updated);
  };

  const handleParticipatingClassToggle = (classId) => {
    const updated = participatingClasses.includes(classId)
      ? participatingClasses.filter((id) => id !== classId)
      : [...participatingClasses, classId];
    setParticipatingClasses(updated);
    setValue('electiveDetails.participatingClasses', updated);
  };

  const addOption = () => {
    const updated = [
      ...openOptions,
      { id: uuidv4(), optionName: '', teacherId: '', roomName: '' },
    ];
    setOpenOptions(updated);
    syncOptions(updated);
  };

  const removeOption = (id) => {
    if (openOptions.length === 1) return;
    const updated = openOptions.filter((o) => o.id !== id);
    setOpenOptions(updated);
    syncOptions(updated);
  };

  const updateOption = (id, field, value) => {
    const updated = openOptions.map((o) =>
      o.id === id ? { ...o, [field]: value } : o
    );
    setOpenOptions(updated);
    syncOptions(updated);
  };

  const syncOptions = (opts) => {
    setValue(
      'electiveDetails.openElectiveOptions',
      opts.map(({ optionName, teacherId, roomName }) => ({
        optionName,
        teacherId,
        roomName,
      }))
    );
  };

  const toggleFixedSlots = (enabled) => {
    if (enabled) {
      if (fixedSlots.length === 0) {
        // Add first slot defaulting to Monday Period 1
        const newSlot = { day: 'Monday', period: 1, isMandatory: true };
        setFixedSlots([newSlot]);
        setValue('fixedSlots', [newSlot]);
        setValue('fixedSlotsEnabled', true);
      } else {
        setValue('fixedSlotsEnabled', true);
      }
    } else {
      setValue('fixedSlotsEnabled', false);
    }
  };

  const addFixedSlot = () => {
    const newSlot = { day: 'Monday', period: 1, isMandatory: true };
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

  return (
    <div className="space-y-4">
      <Input
        label="Weekly Hours"
        type="number"
        required
        placeholder="e.g. 2"
        error={errors.weeklyHours?.message}
        {...register('weeklyHours', {
          required: 'Weekly hours is required',
          min: { value: 1, message: 'Min 1' },
        })}
      />

      <div className="space-y-1.5">
        <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
          Elective Type <span className="text-rose-600 dark:text-rose-400 ml-1">*</span>
        </label>
        <div className="space-y-2">
          {ELECTIVE_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                electiveType === opt.value
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/50'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                checked={electiveType === opt.value}
                onChange={() => handleElectiveTypeChange(opt.value)}
                className="mt-0.5 text-blue-600"
              />
              <span className="text-sm font-bold text-slate-900 dark:text-white">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
          Teachers <span className="text-rose-600 dark:text-rose-400 ml-1">*</span>
        </label>
        <div className="border border-slate-300 dark:border-slate-800 rounded-2xl max-h-40 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
          {teachers.map((teacher) => {
            const isSelected = selectedTeachers.includes(teacher._id);
            return (
              <label
                key={teacher._id}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/60 ${
                  isSelected ? 'bg-blue-50/80 dark:bg-blue-950/50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleTeacherToggle(teacher._id)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <span className="text-sm font-bold text-slate-900 dark:text-white">{teacher.name}</span>
              </label>
            );
          })}
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
                This subject requires consecutive periods
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
                onClick={() => toggleFixedSlots(opt.value)}
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
                        options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => ({ value: day, label: day }))}
                        placeholder="Select day"
                        error={errors[`fixedSlots.${index}.day`]?.message}
                        value={slot.day}
                        onChange={(e) => updateFixedSlot(index, 'day', e.target.value)}
                      />
                      <Select
                        label="Period"
                        required
                        options={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((p) => ({ value: p, label: `Period ${p}` }))}
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

      {electiveType === 'linked' && (
        <div className="space-y-4">
          <Input
            label="Linked Group ID"
            placeholder="e.g. ELEC-GROUP-1 (same for all linked classes)"
            hint="Use the same ID for all subjects that belong to this elective group"
            {...register('electiveDetails.linkedGroupId')}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">Teacher(s)</label>
            <div className="border border-slate-300 dark:border-slate-800 rounded-2xl max-h-40 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
              {teachers.map((teacher) => {
                const isSelected = selectedTeachers.includes(teacher._id);
                return (
                  <label
                    key={teacher._id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/60 ${
                      isSelected ? 'bg-blue-50/80 dark:bg-blue-950/50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTeacherToggle(teacher._id)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{teacher.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">Linked Classes</label>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Select other classes that share this elective slot
            </p>
            <div className="border border-slate-300 dark:border-slate-800 rounded-2xl max-h-40 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
              {classes.map((cls) => {
                const isSelected = linkedClasses.includes(cls._id);
                return (
                  <label
                    key={cls._id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/60 ${
                      isSelected ? 'bg-blue-50/80 dark:bg-blue-950/50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleLinkedClassToggle(cls._id)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {cls.departmentId?.code} S{cls.semester}{cls.section}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {electiveType === 'open' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-400 mb-2">
              Participating Classes
            </label>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              All classes that attend this open elective slot
            </p>
            <div className="border border-slate-300 dark:border-slate-800 rounded-2xl max-h-40 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
              {classes.map((cls) => {
                const isSelected = participatingClasses.includes(cls._id);
                return (
                  <label
                    key={cls._id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/60 ${
                      isSelected ? 'bg-blue-50/80 dark:bg-blue-950/50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleParticipatingClassToggle(cls._id)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {cls.departmentId?.code} S{cls.semester}{cls.section}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
                Elective Options <span className="text-rose-600 dark:text-rose-400 ml-1">*</span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={addOption}
                leftIcon={<Plus className="w-3 h-3" />}
              >
                Add Option
              </Button>
            </div>
            <div className="space-y-3">
              {openOptions.map((opt, idx) => (
                <div
                  key={opt.id}
                  className="p-3 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
                      Option {idx + 1}
                    </span>
                    {openOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOption(opt.id)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Option name"
                      value={opt.optionName}
                      onChange={(e) => updateOption(opt.id, 'optionName', e.target.value)}
                      className="col-span-1 px-3 py-2 text-sm font-bold border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={opt.teacherId}
                      onChange={(e) => updateOption(opt.id, 'teacherId', e.target.value)}
                      className="col-span-1 px-3 py-2 text-sm font-bold border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Select teacher</option>
                      {teachers.map((t) => (
                        <option key={t._id} value={t._id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Room (optional)"
                      value={opt.roomName}
                      onChange={(e) => updateOption(opt.id, 'roomName', e.target.value)}
                      className="col-span-1 px-3 py-2 text-sm font-bold border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElectiveFields;