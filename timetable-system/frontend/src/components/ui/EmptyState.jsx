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
        'flex flex-col items-center justify-center p-10 text-center bg-[var(--bg-surface-alt)] rounded-md border border-dashed border-[var(--border)]',
        className
      )}
    >
      <div className="w-10 h-10 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center mb-4 text-[var(--text-muted)]">
        <Icon className="w-5 h-5" strokeWidth={1.5} />
      </div>
      {title && (
        <h3 className="font-serif italic text-xl font-normal text-[var(--text-primary)] mb-1">
          {title}
        </h3>
      )}
      <p className="font-sans text-xs text-[var(--text-secondary)] mb-6 max-w-sm leading-relaxed">
        {message}
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

export default EmptyState;