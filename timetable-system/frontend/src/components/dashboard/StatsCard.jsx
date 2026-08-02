import { cn } from '../../utils/cn';
import { TrendingUp } from 'lucide-react';

const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
  onClick,
}) => {
  const colors = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/50',
      icon: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50',
      border: 'hover:border-blue-500/40',
    },
    green: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      icon: 'text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50',
      border: 'hover:border-emerald-500/40',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/50',
      icon: 'text-purple-600 dark:text-purple-400',
      badge: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/50',
      border: 'hover:border-purple-500/40',
    },
    orange: {
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      icon: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/50',
      border: 'hover:border-amber-500/40',
    },
    red: {
      bg: 'bg-rose-50 dark:bg-rose-950/50',
      icon: 'text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700/50',
      border: 'hover:border-rose-500/40',
    },
  };

  const c = colors[color] || colors.blue;

  return (
    <div
      className={cn(
        'relative group overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-xl',
        c.border,
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Top Foil Shine Strip on Hover */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:scale-110 duration-300', c.bg)}>
            {Icon && <Icon className={cn('w-6 h-6', c.icon)} />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-3xl font-display font-extrabold text-slate-900 dark:text-white mt-0.5 tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {trend !== undefined && (
          <div className={cn('shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 shadow-sm', c.badge)}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;