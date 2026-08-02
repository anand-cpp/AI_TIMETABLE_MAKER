import { cn } from '../../utils/cn';
import { Inbox } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No Items Available',
  message = 'No data or records found for this section yet.',
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center mb-4 shadow-inner">
        <Icon className="w-7 h-7 text-slate-400 dark:text-slate-500" />
      </div>
      {title && (
        <h3 className="text-base font-display font-extrabold text-slate-900 dark:text-white mb-1 tracking-tight">
          {title}
        </h3>
      )}
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-6 max-w-sm leading-relaxed">
        {message}
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

export default EmptyState;