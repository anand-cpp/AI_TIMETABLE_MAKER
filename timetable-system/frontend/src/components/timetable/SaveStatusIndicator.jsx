import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const SaveStatusIndicator = ({ status = 'saved', onRetry, onRefresh }) => {
  return (
    <div className="flex items-center gap-2 text-xs font-sans select-none">
      {status === 'saved' && (
        <span className="inline-flex items-center gap-1.5 text-[var(--success)] font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" strokeWidth={2} />
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
        <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Save failed — retry required</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-1 underline hover:opacity-80 text-[11px] font-bold text-rose-700 dark:text-rose-300 cursor-pointer"
            >
              Retry
            </button>
          )}
        </span>
      )}

      {status === 'conflict' && (
        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Timetable changed elsewhere — refresh required</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="ml-1 underline hover:opacity-80 text-[11px] font-bold text-amber-700 dark:text-amber-300 cursor-pointer"
            >
              Refresh
            </button>
          )}
        </span>
      )}

      {status === 'idle' && (
        <span className="inline-flex items-center gap-1 text-[var(--text-muted)] opacity-75 font-normal text-[11px]">
          <span>Ready</span>
        </span>
      )}

      {status === 'offline' && (
        <span className="inline-flex items-center gap-1.5 text-[var(--warning)] font-medium">
          <span>⚠ Offline — pending sync</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-1 underline text-[11px] font-bold cursor-pointer"
            >
              Retry
            </button>
          )}
        </span>
      )}
    </div>
  );
};

export default SaveStatusIndicator;
