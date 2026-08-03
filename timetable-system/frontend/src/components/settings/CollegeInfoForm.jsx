import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { ArrowRight } from 'lucide-react';

const CollegeInfoForm = ({ settings, onSubmit, loading }) => {
  const [nextRequested, setNextRequested] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      collegeName: '',
      teacherDailyLimit: 5,
      periodDuration: 60,
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        collegeName: settings.collegeName || '',
        teacherDailyLimit: settings.teacherDailyLimit || 5,
        periodDuration: settings.periodDuration || 60,
      });
    }
  }, [settings, reset]);

  const handleFormSubmit = (data) => {
    onSubmit(data, nextRequested);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 font-sans">
      <Input
        label="College Name"
        required
        placeholder="e.g. Government Engineering College"
        error={errors.collegeName?.message}
        {...register('collegeName', {
          required: 'College name is required',
          minLength: { value: 3, message: 'Min 3 characters' },
        })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Teacher Daily Period Limit"
          type="number"
          required
          hint="Max periods a teacher can teach per day"
          error={errors.teacherDailyLimit?.message}
          {...register('teacherDailyLimit', {
            required: 'Required',
            min: { value: 1, message: 'Min 1' },
            max: { value: 12, message: 'Max 12' },
          })}
        />
        <Input
          label="Period Duration (minutes)"
          type="number"
          required
          hint="Duration of one period"
          error={errors.periodDuration?.message}
          {...register('periodDuration', {
            required: 'Required',
            min: { value: 30, message: 'Min 30 min' },
            max: { value: 120, message: 'Max 120 min' },
          })}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
        <Button type="submit" loading={loading} onClick={() => setNextRequested(false)}>
          Save College Info
        </Button>
        <Button
          type="submit"
          variant="outline"
          loading={loading}
          onClick={() => setNextRequested(true)}
          rightIcon={<ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
        >
          Save & Next →
        </Button>
      </div>
    </form>
  );
};

export default CollegeInfoForm;