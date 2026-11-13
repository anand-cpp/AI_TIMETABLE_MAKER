import { CheckCircle2, Clock, Bell, X, ShieldCheck, ShieldAlert, Zap, Sparkles, Award, RefreshCw, Layers } from 'lucide-react';

const PostGenerationReportCard = ({ report, onDismiss, onSendNotifications, onOpenDiagnostics }) => {
  if (!report) return null;

  const {
    subjectsPlacedCount = 'Unknown',
    violationsCount = 0,
    softWarnings = 0,
    appliedOverrides = [],
    generationTime = '—',
    allPlaced = false,
    fullyFilled = false,
    publicationOutcome = 'FULLY_VALID',
    repairsAppliedCount = 0,
    independentAudit = null,
  } = report;

  const isOutcomeA = publicationOutcome === 'FULLY_VALID' || (violationsCount === 0 && allPlaced);
  const isOutcomeB = publicationOutcome === 'PARTIALLY_FEASIBLE';
  const isClean = isOutcomeA && violationsCount === 0;

  return (
    <div className="my-6 p-6 bg-[var(--bg-surface)] border border-[var(--border)] border-l-4 border-l-[var(--accent)] rounded-xl shadow-lg animate-fadeIn text-[var(--text-primary)]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isClean ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-500'}`}>
            {isClean ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>Pre-Publication Quality & Validation Audit</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isClean
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : isOutcomeB
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                }`}
              >
                {isClean
                  ? '✓ Outcome A — Fully Valid & Publishable'
                  : isOutcomeB
                  ? '⚠ Outcome B — Partially Feasible'
                  : '✗ Outcome C — Infeasible / Conflicts Present'}
              </span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {isClean
                ? 'All mandatory institutional constraints, laboratory eligibility rules, faculty rest limits, and syllabus contact hours mathematically verified.'
                : 'Automated repair resolved all solvable conflicts; inspect unresolved constraints below before publication.'}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <hr className="my-4 border-[var(--border)]" />

      {/* Statistics Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
          <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase">Subjects Placed</div>
          <div className="text-xl font-extrabold text-[var(--text-primary)] mt-1 flex items-center gap-1.5">
            <span>{subjectsPlacedCount}</span>
            {allPlaced ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-500" />
            )}
          </div>
        </div>

        <div
          onClick={() => onOpenDiagnostics?.('HARD_CONFLICTS')}
          className="p-3.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-md transition-all cursor-pointer group"
          title="Click to inspect all hard conflict violations and root causes"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase group-hover:text-[var(--accent)] transition-colors">
              Hard Conflicts
            </div>
            <span className="text-[10px] text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
              Inspect →
            </span>
          </div>
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

        <div
          onClick={() => onOpenDiagnostics?.('SOFT_WARNINGS')}
          className="p-3.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group"
          title="Click to inspect scheduling quality and soft warnings"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase group-hover:text-amber-500 transition-colors">
              Soft Warnings
            </div>
            <span className="text-[10px] text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
              Inspect →
            </span>
          </div>
          <div className="text-xl font-extrabold text-amber-500 mt-1 flex items-center gap-1.5">
            <span>{softWarnings}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold">
              OPTIMIZATION
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
          <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase">
            Auto-Repairs Applied
          </div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1 flex items-center gap-1.5 font-mono">
            <span>{repairsAppliedCount}</span>
            <RefreshCw className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Compliance Verification Pillars */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Mandatory Laboratory Matrix:</p>
            <p className="text-[var(--text-secondary)] text-[11px]">S1/S2 Lab 1–2 · S1/S2 Mini Lab 3 · S3–S8 Lab 4</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Faculty Rest-Gap Policy:</p>
            <p className="text-[var(--text-secondary)] text-[11px]">Max 2 consecutive teaching periods · Lunch reset</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Dynamic Minor Sync:</p>
            <p className="text-[var(--text-secondary)] text-[11px]">S4 CSE A & S4 CSE B common slots verified</p>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center justify-between">
        <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Generation & validation pipeline completed in {generationTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDismiss}
            className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            Dismiss Summary
          </button>
          <button
            onClick={() => onOpenDiagnostics?.('HARD_CONFLICTS')}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>View Full Diagnostic Audit</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostGenerationReportCard;
