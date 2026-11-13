import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle';
import Button from '../ui/Button';
import UnavailabilityGrid from './UnavailabilityGrid';
import departmentService from '../../services/departmentService';
import settingsService from '../../services/settingsService';

const TeacherForm = ({ onSubmit, onCancel, loading, initialData }) => {
  const [departments, setDepartments] = useState([]);
  const [unavailability, setUnavailability] = useState([]);
  const [morningLabPreference, setMorningLabPreference] = useState(false);
  const [periods, setPeriods] = useState([1, 2, 3, 4, 5, 6]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      departmentId: '',
      email: '',
      phone: '',
      designation: '',
      maxPeriodsPerDay: '',
      maxPeriodsPerWeek: '',
    },
  });

  useEffect(() => {
    Promise.all([
      departmentService.getAll(),
      settingsService.get(),
    ]).then(([deptRes, settingsRes]) => {
      setDepartments(deptRes.data.departments || []);
      const timeline = settingsRes.data.settings?.periodTimeline || [];
      const teachingPeriods = timeline
        .filter((p) => !p.isBreak)
        .map((p) => p.periodNumber);
      if (teachingPeriods.length > 0) setPeriods(teachingPeriods);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name || '',
        departmentId: initialData.departmentId?._id || initialData.departmentId || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        designation: initialData.designation || '',
        maxPeriodsPerDay: initialData.maxPeriodsPerDay || '',
        maxPeriodsPerWeek: initialData.maxPeriodsPerWeek || '',
      });
      setUnavailability(initialData.unavailability || []);
      setMorningLabPreference(initialData.morningLabPreference || false);
    }
  }, [initialData, reset]);

  const handleFormSubmit = (data) => {
    onSubmit({
      ...data,
      unavailability,
      morningLabPreference,
      maxPeriodsPerDay: data.maxPeriodsPerDay ? Number(data.maxPeriodsPerDay) : null,
      maxPeriodsPerWeek: data.maxPeriodsPerWeek ? Number(data.maxPeriodsPerWeek) : null,
    });
  };

  const deptOptions = departments.map((d) => ({
    value: d._id,
    label: `${d.name} (${d.code})`,
  }));

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* Basic Info */}
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
          Basic Information
        </p>
        <div className="space-y-3">
          <Input
            label="Full Name"
            required
            placeholder="e.g. Dr. John Smith"
            error={errors.name?.message}
            hint="Username & password will be auto-generated from this name"
            {...register('name', {
              required: 'Teacher name is required',
              minLength: { value: 2, message: 'Min 2 characters' },
            })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Department"
              options={deptOptions}
              placeholder="Select department (optional)"
              error={errors.departmentId?.message}
              {...register('departmentId')}
            />
            <Input
              label="Designation"
              placeholder="e.g. Assistant Professor, HOD"
              error={errors.designation?.message}
              {...register('designation')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              placeholder="teacher@college.edu"
              error={errors.email?.message}
              {...register('email', {
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email',
                },
              })}
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+91 98765 43210"
              {...register('phone')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Periods Per Day"
              type="number"
              placeholder="e.g. 4 (default)"
              hint="Max daily limit"
              error={errors.maxPeriodsPerDay?.message}
              {...register('maxPeriodsPerDay', {
                min: { value: 1, message: 'Must be at least 1' },
                max: { value: 12, message: 'Max 12 periods' },
              })}
            />
            <Input
              label="Max Periods Per Week"
              type="number"
              placeholder="e.g. 20 (default)"
              hint="Max weekly limit"
              error={errors.maxPeriodsPerWeek?.message}
              {...register('maxPeriodsPerWeek', {
                min: { value: 1, message: 'Must be at least 1' },
                max: { value: 40, message: 'Max 40 periods' },
              })}
            />
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
          Preferences
        </p>
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Toggle
            checked={morningLabPreference}
            onChange={setMorningLabPreference}
            label="Morning Lab Preference"
            description="Prefer to schedule lab sessions in the morning slots"
          />
        </div>
      </div>

      {/* Unavailability Grid */}
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
          Unavailability
        </p>
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <UnavailabilityGrid
            periods={periods}
            unavailability={unavailability}
            onChange={setUnavailability}
          />
        </div>
      </div>

      {/* Password note for new teacher */}
      {!initialData && (
        <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl">
          <p className="text-xs font-medium text-blue-800 dark:text-cyan-200 leading-relaxed">
            <strong className="font-black">Auto-credentials:</strong> Username and password will be
            generated from the teacher's name (e.g. name → "johnsmith" /
            "johnsmith123"). You can change the password later.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Update Teacher' : 'Create Teacher'}
        </Button>
      </div>
    </form>
  );
};

export default TeacherForm;