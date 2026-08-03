import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

const LoginForm = ({
  onSubmit,
  loading = false,
  title = 'Sign In',
  subtitle,
  error,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  return (
    <div className="w-full max-w-md">
      <div className="bg-[var(--bg-surface)] rounded-md p-8 border border-[var(--border)]">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-serif font-normal text-[var(--text-primary)] tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-[var(--text-secondary)] font-sans text-xs mt-1.5">{subtitle}</p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-[var(--bg-surface-alt)] border border-[var(--error)]/40 rounded-sm">
            <p className="text-[var(--error)] text-xs font-sans font-semibold">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Username"
            required
            placeholder="Enter your username"
            error={errors.username?.message}
            {...register('username', {
              required: 'Username is required',
              minLength: { value: 3, message: 'Min 3 characters' },
            })}
          />

          <div className="relative">
            <Input
              label="Password"
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              error={errors.password?.message}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              }
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
            />
          </div>

          <Button
            type="submit"
            fullWidth
            loading={loading}
            size="md"
            className="mt-4"
            leftIcon={!loading && <LogIn className="w-4 h-4" strokeWidth={1.5} />}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;