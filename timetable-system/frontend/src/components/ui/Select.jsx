import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(
  (
    {
      label,
      error,
      hint,
      options = [],
      placeholder = 'Select an option',
      className,
      wrapperClassName,
      required,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn('space-y-1.5', wrapperClassName)}>
        {label && (
          <label className="block text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">
            {label}
            {required && <span className="text-rose-600 dark:text-rose-400 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              'block w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 pr-10',
              'text-sm font-bold text-slate-900 dark:text-white appearance-none cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-cyan-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200 shadow-sm',
              error && 'border-rose-500 focus:ring-rose-500/40 focus:border-rose-500',
              className
            )}
            {...props}
          >
            {placeholder && <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{placeholder}</option>}
            {children
              ? children
              : options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white"
                  >
                    {opt.label}
                  </option>
                ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-blue-600 dark:text-cyan-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {hint && !error && <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">{hint}</p>}
        {error && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;