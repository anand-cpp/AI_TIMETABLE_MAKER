import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import Spinner from './Spinner';

const variants = {
  primary: 'bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] active:scale-[0.98]',
  secondary: 'bg-[var(--bg-surface-alt)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:scale-[0.98]',
  outline: 'border border-[var(--border-strong)] text-[var(--text-primary)] bg-transparent hover:bg-[var(--text-primary)] hover:text-[var(--bg-surface)] active:scale-[0.98]',
  danger: 'bg-[var(--error)] text-white hover:opacity-90 active:scale-[0.98]',
  success: 'bg-[var(--success)] text-white hover:opacity-90 active:scale-[0.98]',
  ghost: 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] active:scale-[0.98]',
  link: 'text-[var(--accent)] hover:underline p-0 h-auto font-medium',
};

const sizes = {
  xs: 'px-3 py-1 text-xs rounded-sm font-medium',
  sm: 'px-4 py-1.5 text-xs rounded-sm font-medium tracking-wide',
  md: 'px-6 py-2.5 text-sm rounded-sm font-medium tracking-wide',
  lg: 'px-8 py-3 text-base rounded-sm font-medium tracking-wide',
  xl: 'px-9 py-4 text-base rounded-sm font-bold tracking-wider uppercase',
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
          'inline-flex items-center justify-center gap-2 font-sans tracking-tight select-none',
          'transition-all duration-150 ease-out cursor-pointer',
          'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
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