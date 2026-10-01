import React from 'react';
import { Zap, FlaskConical, Layers, BookOpen, Sparkles } from 'lucide-react';

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
          <span className="w-2.5 h-2.5 rounded-xs bg-[var(--bg-surface-alt)] border border-dashed border-[var(--border)] inline-block" />
          <span className="italic text-[var(--text-muted)]">Auto-Fill Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[var(--bg-surface-alt)] border border-[var(--border)] inline-block" />
          <span>Break Period</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FlaskConical className="w-3 h-3 text-[var(--accent)]" />
          <span>Lab / Practical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-[var(--accent)]" />
          <span>Elective Subject</span>
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
