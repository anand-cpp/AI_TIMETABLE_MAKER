import { useEffect, useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle';
import teacherService from '../../services/teacherService';
import subjectService from '../../services/subjectService';
import { FlaskConical, CheckSquare, Square, Check, Sparkles } from 'lucide-react';

const DURATION_OPTIONS = [
  { value: '2', label: '2 Consecutive Periods' },
  { value: '3', label: '3 Consecutive Periods' },
];

const STANDARD_LABS = ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4'];

const LabFields = ({ register, errors, setValue, initialData }) => {
  const [teachers, setTeachers] = useState([]);
  const [labRooms, setLabRooms] = useState([]);
  const [isBatchSplit, setIsBatchSplit] = useState(false);
  const [morningPreference, setMorningPreference] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [selectedLabs, setSelectedLabs] = useState(['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4']);

  useEffect(() => {
    Promise.all([
      teacherService.getAll(),
      subjectService.getLabRooms(),
    ]).then(([teacherRes, roomRes]) => {
      setTeachers(teacherRes.data.teachers || []);
      setLabRooms(roomRes.data.rooms || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialData?.labDetails || initialData?.allowedLabs) {
      const ld = initialData.labDetails || {};
      setIsBatchSplit(ld.isBatchSplit || false);
      setMorningPreference(ld.morningPreference || false);

      const existingAllowed = ld.allowedLabs || initialData.allowedLabs;
      const initialRooms = Array.isArray(existingAllowed) && existingAllowed.length > 0
        ? existingAllowed
        : (ld.roomName ? [ld.roomName] : ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4']);

      setSelectedLabs(initialRooms);
      setValue('labDetails.allowedLabs', initialRooms);
      setValue('allowedLabs', initialRooms);
      setValue('labDetails.roomName', ld.roomName || initialRooms[0] || 'Lab 4');
      setValue('labDetails.duration', String(ld.duration || 2));
      setValue('labDetails.batch1Room', ld.batch1Room || '');
      setValue('labDetails.batch2Room', ld.batch2Room || '');
      setValue('labDetails.batch1Teacher',
        ld.batch1Teacher?._id || ld.batch1Teacher || '');
      setValue('labDetails.batch2Teacher',
        ld.batch2Teacher?._id || ld.batch2Teacher || '');
    } else {
      setValue('labDetails.allowedLabs', ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4']);
      setValue('allowedLabs', ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4']);
      setValue('labDetails.roomName', 'Lab 4');
    }

    if (initialData?.teachers) {
      const ids = initialData.teachers.map((t) =>
        t._id ? t._id.toString() : t.toString()
      );
      setSelectedTeachers(ids);
      setValue('teachers', ids);
    }
  }, [initialData, setValue]);

  const handleBatchSplitChange = (val) => {
    setIsBatchSplit(val);
    setValue('labDetails.isBatchSplit', val);
  };

  const handleMorningPrefChange = (val) => {
    setMorningPreference(val);
    setValue('labDetails.morningPreference', val);
  };

  const handleTeacherToggle = (teacherId) => {
    const updated = selectedTeachers.includes(teacherId)
      ? selectedTeachers.filter((id) => id !== teacherId)
      : [...selectedTeachers, teacherId];
    setSelectedTeachers(updated);
    setValue('teachers', updated);
  };

  const handleLabToggle = (labName) => {
    let updated;
    if (selectedLabs.includes(labName)) {
      if (selectedLabs.length === 1) {
        // Keep at least one selected
        return;
      }
      updated = selectedLabs.filter((l) => l !== labName);
    } else {
      updated = [...selectedLabs, labName];
    }
    setSelectedLabs(updated);
    setValue('labDetails.allowedLabs', updated);
    setValue('allowedLabs', updated);
    setValue('labDetails.roomName', updated[0] || '');
  };

  const handleSelectAllLabs = () => {
    if (selectedLabs.length === STANDARD_LABS.length) {
      // Toggle to just Lab 1
      const updated = ['Lab 1'];
      setSelectedLabs(updated);
      setValue('labDetails.allowedLabs', updated);
      setValue('allowedLabs', updated);
      setValue('labDetails.roomName', 'Lab 1');
    } else {
      const updated = [...STANDARD_LABS];
      setSelectedLabs(updated);
      setValue('labDetails.allowedLabs', updated);
      setValue('allowedLabs', updated);
      setValue('labDetails.roomName', updated[0]);
    }
  };

  const teacherOptions = teachers.map((t) => ({
    value: t._id,
    label: `${t.name} ${t.departmentId?.code ? `(${t.departmentId.code})` : ''}`,
  }));

  return (
    <div className="space-y-4">
      {/* Duration */}
      <Select
        label="Lab Duration"
        required
        options={DURATION_OPTIONS}
        error={errors.labDetails?.duration?.message}
        {...register('labDetails.duration', {
          required: 'Duration is required',
        })}
      />

      {/* Batch Split Toggle */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
        <Toggle
          checked={isBatchSplit}
          onChange={handleBatchSplitChange}
          label="Batch Split Lab"
          description="Class splits into two batches, each in different rooms simultaneously"
        />
        <Toggle
          checked={morningPreference}
          onChange={handleMorningPrefChange}
          label="Morning Preference"
          description="Prefer scheduling this lab in the morning slots (soft constraint)"
        />
      </div>

      {isBatchSplit ? (
        /* Batch Split Fields */
        <div className="space-y-4">
          <div className="p-4 border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/40 rounded-2xl">
            <p className="text-xs font-black text-blue-700 dark:text-blue-300 mb-3 tracking-wider">
              BATCH 1
            </p>
            <div className="space-y-3">
              <Select
                label="Batch 1 Teacher"
                required
                options={teacherOptions}
                placeholder="Select teacher"
                error={errors.labDetails?.batch1Teacher?.message}
                {...register('labDetails.batch1Teacher', {
                  required: 'Batch 1 teacher is required',
                })}
              />
              <Input
                label="Batch 1 Room"
                required
                placeholder="e.g. Lab 1"
                list="lab-rooms-list"
                error={errors.labDetails?.batch1Room?.message}
                {...register('labDetails.batch1Room', {
                  required: 'Batch 1 room is required',
                })}
              />
            </div>
          </div>

          <div className="p-4 border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/40 rounded-2xl">
            <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 mb-3 tracking-wider">
              BATCH 2
            </p>
            <div className="space-y-3">
              <Select
                label="Batch 2 Teacher"
                required
                options={teacherOptions}
                placeholder="Select teacher"
                error={errors.labDetails?.batch2Teacher?.message}
                {...register('labDetails.batch2Teacher', {
                  required: 'Batch 2 teacher is required',
                })}
              />
              <Input
                label="Batch 2 Room"
                required
                placeholder="e.g. Lab 2"
                list="lab-rooms-list"
                error={errors.labDetails?.batch2Room?.message}
                {...register('labDetails.batch2Room', {
                  required: 'Batch 2 room is required',
                })}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Normal Lab Fields */
        <div className="space-y-4">
          {/* 4 Lab Room Selection (Lab 1, Lab 2, Lab 3, Lab 4) with Select All 4 Labs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
                Eligible Lab Rooms <span className="text-rose-600 dark:text-rose-400 ml-1">*</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAllLabs}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {selectedLabs.length === STANDARD_LABS.length ? 'Deselect Extra' : 'Select All 4 Labs'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {STANDARD_LABS.map((labName) => {
                const isSelected = selectedLabs.includes(labName);
                return (
                  <div
                    key={labName}
                    onClick={() => handleLabToggle(labName)}
                    className={`cursor-pointer p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center select-none ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 dark:border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <FlaskConical className={`w-4 h-4 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 pointer-events-none"
                      />
                    </div>
                    <span className={`text-sm font-bold ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
                      {labName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isSelected ? 'Eligible' : 'Excluded'}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Selecting multiple labs (or all 4) allows the timetable engine to place this session into any free room, preventing room collisions or double-booking.
            </p>
            {selectedLabs.length === 0 && (
              <p className="form-error">At least one lab room must be selected</p>
            )}
          </div>

          {/* Hidden inputs to bind roomName and allowedLabs */}
          <input type="hidden" {...register('labDetails.roomName')} />

          {labRooms.length > 0 && (
            <datalist id="lab-rooms-list">
              {STANDARD_LABS.map((r) => (
                <option key={r} value={r} />
              ))}
              {labRooms.filter((r) => !STANDARD_LABS.includes(r)).map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
              Lab Teacher(s) <span className="text-rose-600 dark:text-rose-400 ml-1">*</span>
            </label>
            <div className="border border-slate-300 dark:border-slate-800 rounded-2xl max-h-40 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
              {teachers.map((teacher) => {
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
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{teacher.name}</span>
                  </label>
                );
              })}
            </div>
            {selectedTeachers.length === 0 && (
              <p className="form-error">At least one teacher required</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LabFields;
