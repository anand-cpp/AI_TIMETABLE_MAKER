import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import departmentService from '../../services/departmentService';

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
  value: String(s),
  label: `Semester ${s}`,
}));

const ClassForm = ({ onSubmit, onCancel, loading, initialData }) => {
  const [departments, setDepartments] = useState([]);
  const [deptLoading, setDeptLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      departmentId: '',
      semester: '',
      section: '',
      strength: 60,
      classRepName: '',
      classRepEmail: '',
      hodEmail: '',
    },
  });

  useEffect(() => {
    departmentService.getAll()
      .then((res) => setDepartments(res.data.departments || []))
      .catch(() => {})
      .finally(() => setDeptLoading(false));
  }, []);

  useEffect(() => {
    if (initialData) {
      reset({
        departmentId: initialData.departmentId?._id || initialData.departmentId || '',
        semester: String(initialData.semester || ''),
        section: initialData.section || '',
        strength: initialData.strength || 60,
        classRepName: initialData.classRepName || '',
        classRepEmail: initialData.classRepEmail || '',
        hodEmail: initialData.hodEmail || '',
      });
    }
  }, [initialData, reset]);

  const deptOptions = departments.map((d) => ({
    value: d._id,
    label: `${d.name} (${d.code})`,
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Department"
        required
        options={deptOptions}
        placeholder={deptLoading ? 'Loading...' : 'Select department'}
        disabled={deptLoading || !!initialData}
        error={errors.departmentId?.message}
        {...register('departmentId', { required: 'Department is required' })}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Semester"
          required
          options={SEMESTER_OPTIONS}
          placeholder="Select semester"
          disabled={!!initialData}
          error={errors.semester?.message}
          {...register('semester', { required: 'Semester is required' })}
        />
        <Input
          label="Section"
          required
          placeholder="e.g. A"
          error={errors.section?.message}
          hint="Single letter like A, B, C"
          {...register('section', {
            required: 'Section is required',
            maxLength: { value: 5, message: 'Max 5 characters' },
          })}
        />
      </div>

      <Input
        label="Class Strength"
        type="number"
        placeholder="60"
        error={errors.strength?.message}
        {...register('strength', {
          min: { value: 1, message: 'Must be at least 1' },
          max: { value: 200, message: 'Max 200 students' },
        })}
      />

      <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
        <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          Contact Information <span className="text-slate-400 font-medium">(optional)</span>
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Class Rep Name"
              placeholder="Student name"
              {...register('classRepName')}
            />
            <Input
              label="Class Rep Email"
              type="email"
              placeholder="student@email.com"
              error={errors.classRepEmail?.message}
              {...register('classRepEmail', {
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email',
                },
              })}
            />
          </div>
          <Input
            label="HOD Email"
            type="email"
            placeholder="hod@college.edu"
            error={errors.hodEmail?.message}
            {...register('hodEmail', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email',
              },
            })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Update Class' : 'Create Class'}
        </Button>
      </div>
    </form>
  );
};

export default ClassForm;