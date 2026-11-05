import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import TheoryFields from './TheoryFields';
import LabFields from './LabFields';
import ElectiveFields from './ElectiveFields';
import classService from '../../services/classService';
import { BookOpen, FlaskConical, Layers, X } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'theory', label: 'Theory' },
  { value: 'lab', label: 'Lab' },
  { value: 'elective', label: 'Elective' },
];

const SubjectForm = ({ 
  onSubmit, 
  onCancel, 
  loading, 
  initialData, 
  preselectedClassId,
  electiveGroupContext,
  isModal = false
}) => {
  const [classes, setClasses] = useState([]);
  const [subjectType, setSubjectType] = useState(initialData?.type || 'theory');
  const [assignMode, setAssignMode] = useState('single');
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [classError, setClassError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      code: '',
      classId: preselectedClassId || '',
      type: 'theory',
      weeklyHours: '',
      teachers: [],
      labDetails: {
        roomName: '',
        duration: '2',
        isBatchSplit: false,
        batch1Teacher: '',
        batch2Teacher: '',
        batch1Room: '',
        batch2Room: '',
        morningPreference: false,
      },
      electiveDetails: {
        electiveType: 'linked',
        linkedGroupId: '',
        linkedClasses: [],
        openElectiveOptions: [],
        participatingClasses: [],
        electiveGroupId: '',
        optionIndex: 0,
      },
    },
  });

  const watchClassId = watch('classId');

  useEffect(() => {
    classService.getAll()
      .then((res) => setClasses(res.data.classes || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (electiveGroupContext) {
      const { group, sections, departmentId } = electiveGroupContext;
      const sectionClasses = classes.filter(c => 
        c.departmentId?._id === departmentId && 
        c.semester === group.semester && 
        sections.includes(c.section)
      );
      const classIds = sectionClasses.map(c => c._id);
      
      reset({
        name: '',
        code: '',
        classId: classIds[0] || '',
        type: 'elective',
        weeklyHours: '',
        teachers: [],
        electiveDetails: {
          electiveType: 'linked',
          linkedGroupId: '',
          linkedClasses: [],
          openElectiveOptions: [],
          participatingClasses: [],
          electiveGroupId: group._id,
          optionIndex: 0,
        },
      });
      setSubjectType('elective');
      return;
    }
    
    if (initialData) {
      reset({
        name: initialData.name || '',
        code: initialData.code || '',
        classId: initialData.classId?._id || initialData.classId || '',
        type: initialData.type || 'theory',
        weeklyHours: initialData.weeklyHours || '',
        teachers: (initialData.teachers || []).map((t) => t._id || t),
      });
      setSubjectType(initialData.type || 'theory');
    }
  }, [electiveGroupContext, initialData, reset, classes]);

  useEffect(() => {
    if (initialData && initialData.electiveGroupId && !electiveGroupContext) {
      const egId = initialData.electiveGroupId._id || initialData.electiveGroupId;
      const existingOptions = initialData.electiveDetails?.openElectiveOptions || [];
      reset({
        name: initialData.name || '',
        code: initialData.code || '',
        classId: initialData.classId?._id || initialData.classId || '',
        type: 'elective',
        weeklyHours: initialData.weeklyHours || '',
        teachers: (initialData.teachers || []).map((t) => t._id || t),
        electiveDetails: {
          electiveType: initialData.electiveDetails?.electiveType || 'linked',
          linkedGroupId: initialData.electiveDetails?.linkedGroupId || '',
          linkedClasses: initialData.electiveDetails?.linkedClasses || [],
          openElectiveOptions: existingOptions.map((o) => ({
            id: 'opt-' + Date.now(),
            optionName: o.optionName || '',
            teacherId: o.teacherId?._id || o.teacherId || '',
            roomName: o.roomName || '',
          })),
          participatingClasses: initialData.electiveDetails?.participatingClasses || [],
          electiveGroupId: egId,
          optionIndex: 0,
        },
      });
      setSubjectType('elective');
    }
  }, [initialData, reset]);

  const handleTypeChange = (val) => {
    if (electiveGroupContext) return;
    setSubjectType(val);
    setValue('type', val);
  };

  useEffect(() => {
    if (electiveGroupContext && classes.length > 0) {
      const { group, sections, departmentId } = electiveGroupContext;
      const sectionClasses = classes.filter(c => 
        c.departmentId?._id === departmentId && 
        c.semester === group.semester && 
        sections.includes(c.section)
      );
      const classIds = sectionClasses.map(c => c._id);
      if (classIds.length > 0) {
        setValue('classId', classIds[0]);
      }
    }
  }, [electiveGroupContext, classes, setValue]);

  const handleClassToggle = (classId) => {
    setClassError('');
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleFormSubmit = (data) => {
    const payload = {
      ...data,
      type: subjectType,
    };

    if (subjectType !== 'lab') delete payload.labDetails;
    if (subjectType !== 'elective') delete payload.electiveDetails;
    if (subjectType === 'lab') delete payload.weeklyHours;

    const isBulk = !initialData && assignMode === 'multiple';
    if (isBulk) {
      if (selectedClassIds.length === 0) {
        setClassError('Select at least one class');
        return;
      }
      delete payload.classId;
      payload.classIds = selectedClassIds;
    }

    if (electiveGroupContext) {
      payload.electiveGroupContext = {
        groupId: electiveGroupContext.group._id,
        sections: electiveGroupContext.sections,
        departmentId: electiveGroupContext.departmentId,
        semester: electiveGroupContext.group.semester,
      };
    }

    onSubmit(payload);
  };

  const typeIcons = {
    theory: BookOpen,
    lab: FlaskConical,
    elective: Layers,
  };
  const TypeIcon = typeIcons[subjectType];

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Subject Name"
          required
          placeholder="e.g. Data Structures"
          error={errors.name?.message}
          {...register('name', {
            required: 'Subject name is required',
            minLength: { value: 2, message: 'Min 2 characters' },
          })}
        />
        <Input
          label="Subject Code"
          required
          placeholder="e.g. CS301"
          error={errors.code?.message}
          {...register('code', {
            required: 'Subject code is required',
          })}
        />
      </div>

      {!initialData && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
            Assign to
          </span>
          <div className="inline-flex rounded-2xl border border-slate-200 dark:border-slate-800 p-0.5 bg-white dark:bg-slate-950">
            {[

              { value: 'single', label: 'One class' },
              { value: 'multiple', label: 'Multiple classes' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setAssignMode(opt.value); setClassError(''); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  assignMode === opt.value
                    ? 'bg-blue-500/15 text-blue-700 dark:text-cyan-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {((initialData || assignMode === 'single') && !electiveGroupContext) ? (
        <Select
          label="Class"
          required
          options={classOptions}
          placeholder="Select class"
          disabled={!!preselectedClassId || !!initialData || !!electiveGroupContext}
          error={errors.classId?.message}
          {...register('classId', { required: 'Class is required' })}
        />
      ) : electiveGroupContext ? (
        <div className="space-y-1.5">
          <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
            Class (Auto-assigned from group sections)
          </label>
          <Select
            disabled
            options={classOptions.filter(c => 
              electiveGroupContext.sections.includes(c.label.split('Sec ')[1]?.charAt(0))
            )}
            placeholder="Auto-assigned from group sections"
            {...register('classId')}
          />
        </div>
      ) : (
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
            Classes <span className="text-rose-600 dark:text-rose-400 ml-1">*</span>
          </label>
          <div className="border border-slate-300 dark:border-slate-800 rounded-2xl max-h-48 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
            {classes.length === 0 ? (
              <p className="p-4 text-xs font-semibold text-slate-400 text-center">
                No classes found. Add classes first.
              </p>
            ) : (
              classes.map((c) => {
                const isSelected = selectedClassIds.includes(c._id);
                return (
                  <label
                    key={c._id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/60 ${
                      isSelected ? 'bg-blue-50/80 dark:bg-blue-950/50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleClassToggle(c._id)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {c.departmentId?.code} Sem {c.semester} Sec {c.section}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {classError && <p className="form-error">{classError}</p>}
          {!classError && selectedClassIds.length > 0 && (
            <p className="form-hint">
              {selectedClassIds.length} class(es) selected. A copy is created for every class that
              does not already have this subject code.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200 mb-2">
          Subject Type <span className="text-rose-600 dark:text-rose-400">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = typeIcons[opt.value];
            const isSelected = subjectType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleTypeChange(opt.value)}
                disabled={!!initialData || !!electiveGroupContext}
                className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/15 text-blue-700 dark:text-cyan-300 font-extrabold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-bold">{opt.label}</span>
                {electiveGroupContext && opt.value !== 'elective' && (
                  <span className="text-[10px] text-rose-500">Group only</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <TypeIcon className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {subjectType.charAt(0).toUpperCase() + subjectType.slice(1)} Configuration
          </p>
        </div>

        {subjectType === 'theory' && (
          <TheoryFields
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            initialData={initialData}
          />
        )}
        {subjectType === 'lab' && (
          <LabFields
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            initialData={initialData}
          />
        )}
        {subjectType === 'elective' && (
          <ElectiveFields
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            initialData={initialData}
            currentClassId={watchClassId}
          />
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Update Subject' : 'Create Subject'}
        </Button>
      </div>
    </form>
  );
};

export default SubjectForm;