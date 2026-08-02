import { useEffect, useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import teacherService from '../../services/teacherService';

const TheoryFields = ({ register, errors, watch, setValue, initialData }) => {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);

  useEffect(() => {
    teacherService.getAll()
      .then((res) => setTeachers(res.data.teachers || []))
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
  }, [initialData, setValue]);

  const teacherOptions = teachers.map((t) => ({
    value: t._id,
    label: `${t.name} ${t.departmentId?.code ? `(${t.departmentId.code})` : ''}`,
  }));

  const handleTeacherToggle = (teacherId) => {
    const updated = selectedTeachers.includes(teacherId)
      ? selectedTeachers.filter((id) => id !== teacherId)
      : [...selectedTeachers, teacherId];
    setSelectedTeachers(updated);
    setValue('teachers', updated);
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
    </div>
  );
};

export default TheoryFields;