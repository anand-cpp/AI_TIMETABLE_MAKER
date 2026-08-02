import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';
import { cn } from '../../utils/cn';

const AdminSetup = ({ onSubmit, loading = false, error }) => {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const password = watch('password');

  return (
    <div className="w-full max-w-md">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">First Time Setup</h1>
          <p className="text-white/60 text-sm mt-2">
            Create your admin account to get started
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">
              Admin Username
            </label>
            <input
              {...register('username', {
                required: 'Username is required',
                minLength: { value: 3, message: 'Min 3 characters' },
                pattern: {
                  value: /^[a-zA-Z0-9_]+$/,
                  message: 'Only letters, numbers, and underscores',
                },
              })}
              type="text"
              placeholder="e.g. admin"
              className={cn(
                'w-full px-4 py-2.5 rounded-lg bg-white/10 border text-white',
                'placeholder-white/40 focus:outline-none focus:ring-2',
                errors.username
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-white/20 focus:ring-primary-400'
              )}
            />
            {errors.username && (
              <p className="mt-1 text-xs text-red-300">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Min 6 characters' },
                })}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 6 characters"
                className={cn(
                  'w-full px-4 py-2.5 pr-12 rounded-lg bg-white/10 border text-white',
                  'placeholder-white/40 focus:outline-none focus:ring-2',
                  errors.password
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-white/20 focus:ring-primary-400'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-300">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">
              Confirm Password
            </label>
            <input
              {...register('confirmPassword', {
                required: 'Please confirm password',
                validate: (v) => v === password || 'Passwords do not match',
              })}
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter password"
              className={cn(
                'w-full px-4 py-2.5 rounded-lg bg-white/10 border text-white',
                'placeholder-white/40 focus:outline-none focus:ring-2',
                errors.confirmPassword
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-white/20 focus:ring-primary-400'
              )}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-300">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            fullWidth
            loading={loading}
            size="lg"
            className="mt-2 bg-white text-primary-700 hover:bg-white/90 focus:ring-white"
          >
            {loading ? 'Creating Account...' : 'Create Admin Account'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminSetup;