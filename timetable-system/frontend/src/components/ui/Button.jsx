import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import Spinner from './Spinner';

const variants = {
  primary: 'bg-gradient-to-r from-[#6C63FF] to-[#00D4FF] text-white shadow-lg shadow-[#6C63FF]/30 hover:shadow-[#6C63FF]/50 active:scale-[0.98]',
  secondary: 'bg-[#F1F5F9] dark:bg-white/10 border border-[#CBD5E1] dark:border-white/10 text-[#0F172A] dark:text-white hover:bg-[#E2E8F0] dark:hover:bg-white/15 active:scale-[0.98]',
  outline: 'border border-[#CBD5E1] dark:border-white/20 text-[#0F172A] dark:text-white bg-white dark:bg-transparent hover:bg-[#F1F5F9] dark:hover:bg-white/5 active:scale-[0.98]',
  danger: 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-600/30 active:scale-[0.98]',
  success: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30 active:scale-[0.98]',
  ghost: 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.98]',
  link: 'text-blue-600 dark:text-cyan-400 hover:underline p-0 h-auto font-bold',
};

const sizes = {
  xs: 'px-3 py-1 text-xs rounded-xl font-bold',
  sm: 'px-4 py-1.5 text-xs rounded-xl font-extrabold tracking-wide',
  md: 'px-5 py-2.5 text-sm rounded-2xl font-extrabold tracking-wide',
  lg: 'px-7 py-3.5 text-base rounded-2xl font-extrabold tracking-wide',
  xl: 'px-9 py-4 text-base rounded-full font-black tracking-widest uppercase',
};

const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      className,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-display tracking-tight',
          'transition-all duration-200 ease-out cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/50 focus:ring-offset-2 dark:focus:ring-offset-[#0A0A0F]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" className="text-current" />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;