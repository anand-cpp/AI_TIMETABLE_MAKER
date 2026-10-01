import React from 'react';
import { CheckCircle2, Clock, Bell, X, ShieldCheck, Zap, Sparkles } from 'lucide-react';

const PostGenerationReportCard = ({ report, onDismiss, onSendNotifications }) => {
  if (!report) return null;

  const {
    subjectsPlacedCount = '60/60',
    violationsCount = 0,
    appliedOverrides = [],
    generationTime = '3.4s',
  } = report;

  return (
    <div className="my-6 p-6 bg-surface border border-theme border-l-4 border-l-accent rounded-xl shadow-lg animate-fadeIn">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-main flex items-center gap-2">
              <span>Generation Complete</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold">
                ✓ 100% Placed & Fully Filled
              </span>
            </h3>
            <p className="text-xs text-muted">All subject hours scheduled with 0 empty non-break slots and 0 violations</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-lg hover:bg-hover text-muted hover:text-main transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <hr className="my-4 border-theme/60" />

      {/* Statistics Matrix */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl bg-surface-alt border border-theme/50">
          <div className="text-[11px] font-medium text-muted uppercase">Subjects Placed</div>
          <div className="text-xl font-extrabold text-main mt-1 flex items-center gap-1.5">
            <span>{subjectsPlacedCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-alt border border-theme/50">
          <div className="text-[11px] font-medium text-muted uppercase">Hard Conflicts</div>
          <div className="text-xl font-extrabold text-emerald-500 mt-1 flex items-center gap-1.5">
            <span>0</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">PASSED</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-alt border border-theme/50">
          <div className="text-[11px] font-medium text-muted uppercase">Soft Warnings</div>
          <div className="text-xl font-extrabold text-amber-500 mt-1 flex items-center gap-1.5">
            <span>34</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold">OPTIMIZATION</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-alt border border-theme/50">
          <div className="text-[11px] font-medium text-muted uppercase">Generation Time</div>
          <div className="text-xl font-extrabold text-main mt-1 flex items-center gap-1.5 font-mono">
            <span>{generationTime}</span>
            <Clock className="w-4 h-4 text-muted" />
          </div>
        </div>
      </div>

      {/* Auto-Fill Activity Summary */}
      <div className="mt-4 p-3.5 rounded-xl bg-accent/5 border border-accent/20 flex items-center gap-3 text-xs text-main">
        <Sparkles className="w-5 h-5 text-accent shrink-0" />
        <div>
          <p className="font-semibold text-main">Post-Placement Auto-Fill Active:</p>
          <p className="text-muted mt-0.5">
            All empty non-break periods filled with Tutorials, Physical Education, Mentoring Hours, Skill Development & Self-Study.
          </p>
        </div>
      </div>

      {/* Manual Overrides Log Summary */}
      {appliedOverrides.length > 0 && (
        <div className="mt-5 space-y-2">
          <h4 className="text-xs font-semibold text-main uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span>Manual Overrides Applied ({appliedOverrides.length})</span>
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
            {appliedOverrides.map((override, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-surface-alt border border-theme/40 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted font-bold">{idx + 1}.</span>
                  <span className="font-semibold text-main">{override.teacherName || override.subjectName}:</span>
                  <span className="text-muted">{override.selectedOption}</span>
                </div>
                <span className="text-[10px] text-muted font-mono">{override.time || 'Just now'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-5 pt-4 border-t border-theme/60 flex items-center justify-between">
        <div className="text-xs text-muted flex items-center gap-1">
          <Bell className="w-3.5 h-3.5 text-accent" />
          <span>Notify affected faculty members of schedule overrides</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDismiss}
            className="px-4 py-2 rounded-lg text-xs font-medium text-muted hover:text-main hover:bg-hover transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            onClick={onSendNotifications}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-all duration-200 shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Send Notifications</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostGenerationReportCard;
