import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../utils/cn';

const SaveStatusIndicator = ({ status = 'saved', onRetry }) => {
  return (
    <div className="flex items-center gap-2 text-xs font-sans select-none">
      {status === 'saved' && (
        <span className="inline-flex items-center gap-1.5 text-[var(--success)] font-medium">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          <span>Saved</span>
        </span>
      )}

      {status === 'saving' && (
        <span className="inline-flex items-center gap-1.5 text-[var(--warning)] font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--warning)]" />
          <span>Saving...</span>
        </span>
      )}

      {status === 'error' && (
        <span className="inline-flex items-center gap-1.5 text-[var(--error)] font-medium">
          <span className="w-2 h-2 rounded-full bg-[var(--error)]" />
          <span>Sync failed</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-1 underline hover:opacity-80 text-[11px] font-semibold cursor-pointer"
            >
              Retry
            </button>
          )}
        </span>
      )}

      {status === 'offline' && (
        <span className="inline-flex items-center gap-1.5 text-[var(--warning)] font-medium">
          <span>⚠ Offline — saved locally</span>
        </span>
      )}
    </div>
  );
};

export default SaveStatusIndicator;
