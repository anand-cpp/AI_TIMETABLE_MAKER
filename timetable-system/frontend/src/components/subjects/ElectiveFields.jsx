import { useEffect, useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';
import teacherService from '../../services/teacherService';
import classService from '../../services/classService';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const ELECTIVE_TYPE_OPTIONS = [
  { value: 'linked', label: 'Linked Elective (shared slot across classes)' },
  { value: 'open', label: 'Open Elective (students choose an option)' },
];

const ElectiveFields = ({ register, errors, watch, setValue, initialData, currentClassId }) => {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [electiveType, setElectiveType] = useState('linked');
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [linkedClasses, setLinkedClasses] = useState([]);
  const [openOptions, setOpenOptions] = useState([
    { id: uuidv4(), optionName: '', teacherId: '', roomName: '' },
  ]);
  const [participatingClasses, setParticipatingClasses] = useState([]);

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

  const teacherOptions = teachers.map((t) => ({
    value: t._id,
    label: t.name,
  }));

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
            <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">Participating Classes</label>
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