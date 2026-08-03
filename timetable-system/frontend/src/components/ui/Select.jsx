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
          <label className="block text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {label}
            {required && <span className="text-[var(--error)] ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              'block w-full rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 pr-9',
              'text-sm font-sans text-[var(--text-primary)] appearance-none cursor-pointer',
              'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-150',
              error && 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                {placeholder}
              </option>
            )}
            {children
              ? children
              : options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                  >
                    {opt.label}
                  </option>
                ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
          </div>
        </div>
        {hint && !error && <p className="text-xs font-sans text-[var(--text-secondary)]">{hint}</p>}
        {error && <p className="text-xs font-sans font-medium text-[var(--error)]">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;