import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

const Input = forwardRef(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      className,
      wrapperClassName,
      required,
      disabled,
      type = 'text',
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn('space-y-1.5', wrapperClassName)}>
        {label && (
          <label className="block text-xs font-black uppercase tracking-widest text-[#0F172A] dark:text-slate-200">
            {label}
            {required && <span className="text-rose-600 dark:text-rose-400 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 dark:text-slate-300">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            disabled={disabled}
            className={cn(
              'block w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3',
              'text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-cyan-400',
              'disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200 shadow-sm',
              error && 'border-rose-500 focus:ring-rose-500/40 focus:border-rose-500',
              leftIcon && 'pl-11',
              rightIcon && 'pr-11',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 dark:text-slate-300">
              {rightIcon}
            </div>
          )}
        </div>
        {hint && !error && <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">{hint}</p>}
        {error && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;