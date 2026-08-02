import { useEffect, useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle';
import teacherService from '../../services/teacherService';
import subjectService from '../../services/subjectService';

const DURATION_OPTIONS = [
  { value: '2', label: '2 Consecutive Periods' },
  { value: '3', label: '3 Consecutive Periods' },
];

const LabFields = ({ register, errors, watch, setValue, initialData }) => {
  const [teachers, setTeachers] = useState([]);
  const [labRooms, setLabRooms] = useState([]);
  const [isBatchSplit, setIsBatchSplit] = useState(false);
  const [morningPreference, setMorningPreference] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState([]);

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
    if (initialData?.labDetails) {
      const ld = initialData.labDetails;
      setIsBatchSplit(ld.isBatchSplit || false);
      setMorningPreference(ld.morningPreference || false);
      setValue('labDetails.roomName', ld.roomName || '');
      setValue('labDetails.duration', String(ld.duration || 2));
      setValue('labDetails.batch1Room', ld.batch1Room || '');
      setValue('labDetails.batch2Room', ld.batch2Room || '');
      setValue('labDetails.batch1Teacher',
        ld.batch1Teacher?._id || ld.batch1Teacher || '');
      setValue('labDetails.batch2Teacher',
        ld.batch2Teacher?._id || ld.batch2Teacher || '');
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

  const teacherOptions = teachers.map((t) => ({
    value: t._id,
    label: `${t.name} ${t.departmentId?.code ? `(${t.departmentId.code})` : ''}`,
  }));

  const roomSuggestions = labRooms.map((r) => ({
    value: r,
    label: r,
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
                placeholder="e.g. Lab A"
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
                placeholder="e.g. Lab B"
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
          <Input
            label="Lab Room Name"
            required
            placeholder="e.g. Computer Lab 1"
            hint="Used to detect room conflicts across classes"
            error={errors.labDetails?.roomName?.message}
            list="lab-rooms-list"
            {...register('labDetails.roomName', {
              required: 'Lab room name is required',
            })}
          />
          {labRooms.length > 0 && (
            <datalist id="lab-rooms-list">
              {labRooms.map((r) => (
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