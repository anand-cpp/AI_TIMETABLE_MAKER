import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Tabs from '../ui/Tabs';
import TheoryFields from './TheoryFields';
import LabFields from './LabFields';
import ElectiveFields from './ElectiveFields';
import classService from '../../services/classService';
import { BookOpen, FlaskConical, Layers } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'theory', label: 'Theory' },
  { value: 'lab', label: 'Lab' },
  { value: 'elective', label: 'Elective' },
];

const SubjectForm = ({ onSubmit, onCancel, loading, initialData, preselectedClassId }) => {
  const [classes, setClasses] = useState([]);
  const [subjectType, setSubjectType] = useState(initialData?.type || 'theory');

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
  }, [initialData, reset]);

  const handleTypeChange = (val) => {
    setSubjectType(val);
    setValue('type', val);
  };

  const handleFormSubmit = (data) => {
    const payload = {
      ...data,
      type: subjectType,
    };

    // Clean up unused type data
    if (subjectType !== 'lab') delete payload.labDetails;
    if (subjectType !== 'elective') delete payload.electiveDetails;
    if (subjectType === 'lab') delete payload.weeklyHours;

    onSubmit(payload);
  };

  const classOptions = classes.map((c) => ({
    value: c._id,
    label: `${c.departmentId?.code || ''} Sem ${c.semester} Sec ${c.section}`,
  }));

  const typeIcons = {
    theory: BookOpen,
    lab: FlaskConical,
    elective: Layers,
  };

  const TypeIcon = typeIcons[subjectType];

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* Basic Info */}
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

      <Select
        label="Class"
        required
        options={classOptions}
        placeholder="Select class"
        disabled={!!preselectedClassId || !!initialData}
        error={errors.classId?.message}
        {...register('classId', { required: 'Class is required' })}
      />

      {/* Type selector */}
      <div className="form-group">
        <label className="form-label">
          Subject Type <span className="text-red-500">*</span>
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
                disabled={!!initialData}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Type-specific fields */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <TypeIcon className="w-4 h-4 text-primary-600" />
          <p className="text-sm font-semibold text-gray-700">
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