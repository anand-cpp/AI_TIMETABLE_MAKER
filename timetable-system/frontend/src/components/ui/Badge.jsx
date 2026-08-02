import { cn } from '../../utils/cn';

const variants = {
  default: 'bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700',
  primary: 'bg-blue-500/15 text-blue-700 dark:text-cyan-300 border border-blue-500/30',
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30',
  info: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30',
};

const sizes = {
  sm: 'px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
  md: 'px-3 py-1 text-xs font-extrabold tracking-wide',
  lg: 'px-4 py-1.5 text-xs font-black tracking-widest uppercase',
};

const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-display backdrop-blur-md shadow-sm',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            variant === 'success' && 'bg-emerald-500 animate-pulse',
            variant === 'danger' && 'bg-rose-500 animate-pulse',
            variant === 'warning' && 'bg-amber-500 animate-pulse',
            variant === 'primary' && 'bg-[#6C63FF] dark:bg-[#00D4FF] animate-pulse',
            variant === 'info' && 'bg-indigo-500',
            variant === 'default' && 'bg-[#64748B]'
          )}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;