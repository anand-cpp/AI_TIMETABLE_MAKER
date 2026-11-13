import { FlaskConical, Layers } from 'lucide-react';

const TimetableLegend = () => {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-md text-xs font-sans text-[var(--text-secondary)] select-none flex-wrap mt-3">
      <span className="font-semibold text-[var(--text-primary)] uppercase tracking-wider text-[10px]">
        Legend:
      </span>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[var(--bg-surface)] border border-[var(--border)] inline-block" />
          <span>Regular Subject</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-sans font-bold px-1 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
            LAB
          </span>
          <span>Laboratory</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-sans font-bold px-1 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 uppercase tracking-wider">
            ELECTIVE
          </span>
          <span>Elective Subject</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-sans font-bold px-1 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 uppercase tracking-wider">
            MINOR
          </span>
          <span>Minor Subject</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[var(--bg-surface-alt)] border border-dashed border-[var(--border)] inline-block" />
          <span className="italic text-[var(--text-muted)]">Auto-Fill Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[9px]">⚡</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">Admin Override</span>
        </div>
      </div>
    </div>
  );
};

export default TimetableLegend;
