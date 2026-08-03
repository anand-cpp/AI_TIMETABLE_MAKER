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
          <label className="block text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {label}
            {required && <span className="text-[var(--error)] ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            disabled={disabled}
            className={cn(
              'block w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2',
              'text-sm font-sans text-[var(--text-primary)] placeholder-[var(--text-muted)]',
              'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]',
              'disabled:bg-[var(--bg-surface-alt)] disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-150',
              error && 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-muted)]">
              {rightIcon}
            </div>
          )}
        </div>
        {hint && !error && <p className="text-xs font-sans text-[var(--text-secondary)]">{hint}</p>}
        {error && <p className="text-xs font-sans font-medium text-[var(--error)]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;