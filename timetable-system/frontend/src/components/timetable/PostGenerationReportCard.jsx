import { CheckCircle2, Clock, Bell, X, ShieldCheck, ShieldAlert, Zap, Sparkles } from 'lucide-react';

const PostGenerationReportCard = ({ report, onDismiss, onSendNotifications }) => {
  if (!report) return null;

  const {
    subjectsPlacedCount = 'Unknown',
    violationsCount = 0,
    softWarnings = 0,
    appliedOverrides = [],
    generationTime = '—',
    allPlaced = false,
    fullyFilled = false,
  } = report;

  const isClean = allPlaced && fullyFilled && violationsCount === 0;

  return (
    <div className="my-6 p-6 bg-surface border border-theme border-l-4 border-l-accent rounded-xl shadow-lg animate-fadeIn">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isClean ? 'bg-accent/10 text-accent' : 'bg-amber-500/10 text-amber-500'}`}>
            {isClean ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-main flex items-center gap-2">
              <span>Generation Complete</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isClean
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-amber-500/10 text-amber-600'
                }`}
              >
                {isClean ? '✓ All Placed & Fully Filled' : '⚠ Review Required'}
              </span>
            </h3>
            <p className="text-xs text-muted">
              {isClean
                ? 'All subject hours scheduled with 0 empty non-break slots and 0 hard conflicts.'
                : 'Some subjects or slots could not be fully scheduled — review before publishing.'}
            </p>
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
            {allPlaced ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-500" />
            )}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-alt border border-theme/50">
          <div className="text-[11px] font-medium text-muted uppercase">Hard Conflicts</div>
          <div
            className={`text-xl font-extrabold mt-1 flex items-center gap-1.5 ${
              violationsCount === 0 ? 'text-emerald-500' : 'text-red-500'
            }`}
          >
            <span>{violationsCount}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                violationsCount === 0
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-red-500/10 text-red-600'
              }`}
            >
              {violationsCount === 0 ? 'PASSED' : 'FAILED'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-alt border border-theme/50">
          <div className="text-[11px] font-medium text-muted uppercase">Soft Warnings</div>
          <div className="text-xl font-extrabold text-amber-500 mt-1 flex items-center gap-1.5">
            <span>{softWarnings}</span>
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
          {fullyFilled ? (
            <>
              <p className="font-semibold text-main">Post-Placement Auto-Fill Active:</p>
              <p className="text-muted mt-0.5">
                All empty non-break periods filled with Tutorials, Physical Education, Mentoring Hours, Skill Development & Self-Study.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-main">Some periods remain empty:</p>
              <p className="text-muted mt-0.5">
                Auto-fill could not fill every non-break slot. Review the grid before publishing.
              </p>
            </>
          )}
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
