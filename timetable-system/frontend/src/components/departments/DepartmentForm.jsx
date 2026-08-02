import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';

const DepartmentForm = ({ onSubmit, onCancel, loading, initialData }) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      code: '',
      building: '',
      floor: '',
      travelOptimization: false,
    },
  });

  const travelOptimization = watch('travelOptimization');

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name || '',
        code: initialData.code || '',
        building: initialData.building || '',
        floor: initialData.floor || '',
        travelOptimization: initialData.travelOptimization || false,
      });
    }
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Department Name"
          required
          placeholder="e.g. Computer Science"
          error={errors.name?.message}
          {...register('name', {
            required: 'Department name is required',
            minLength: { value: 2, message: 'Min 2 characters' },
          })}
        />
        <Input
          label="Department Code"
          required
          placeholder="e.g. CSE"
          error={errors.code?.message}
          hint="Short uppercase code"
          {...register('code', {
            required: 'Code is required',
            minLength: { value: 2, message: 'Min 2 characters' },
            maxLength: { value: 10, message: 'Max 10 characters' },
          })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Building"
          placeholder="e.g. Main Block"
          error={errors.building?.message}
          {...register('building')}
        />
        <Input
          label="Floor"
          placeholder="e.g. 2nd Floor"
          error={errors.floor?.message}
          {...register('floor')}
        />
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <Toggle
          checked={travelOptimization}
          onChange={(val) => setValue('travelOptimization', val)}
          label="Travel Optimization"
          description="Try to schedule teachers from this department in nearby rooms"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Update Department' : 'Create Department'}
        </Button>
      </div>
    </form>
  );
};

export default DepartmentForm;