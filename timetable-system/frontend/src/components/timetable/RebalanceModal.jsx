import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Users,
  Sparkles,
  Loader2,
  AlertOctagon,
} from 'lucide-react';

const RebalanceModal = ({
  isOpen,
  onClose,
  conflict,
  rebalanceData,
  onAutoAdjust,
  onForceSwap,
  loading = false,
  isSimulating = false,
}) => {
  if (!isOpen) return null;

  const preview = rebalanceData?.preview;
  const canRebalance = Boolean(rebalanceData?.canRebalance);
  const actionLabel = rebalanceData?.actionLabel || 'Faculty Conflict Detected';
  const reason = rebalanceData?.reason || 'No conflict-free arrangement found without violating constraints.';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2 text-rose-500 font-bold">
          <AlertTriangle className="w-5 h-5" />
          Faculty Conflict Detected
        </span>
      }
      size="md"
    >
      <div className="space-y-4 font-sans text-[var(--text-primary)]">
        {/* Conflicting Teacher Alert Box */}
        {conflict && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs space-y-1.5">
            <div className="flex items-start gap-2 text-rose-600 dark:text-rose-400 font-medium">
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-600 dark:text-rose-400">
                  {conflict.teacherName ? `${conflict.teacherName} is already teaching` : 'Teacher Conflict'}:
                </p>
                <p className="text-[var(--text-primary)] mt-0.5">
                  Scheduled for <span className="font-semibold">{conflict.subjectName || 'another subject'}</span> in{' '}
                  <span className="font-semibold">{conflict.className || 'another class'}</span> on{' '}
                  <span className="font-semibold">{conflict.day} Period {conflict.period}</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading simulation status */}
        {isSimulating ? (
          <div className="p-4 bg-[var(--accent-soft)]/20 border border-[var(--border)] rounded-md flex items-center justify-center gap-3 text-xs text-[var(--text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
            <span>Analyzing schedule for a minimal conflict-free Auto-Adjust option...</span>
          </div>
        ) : canRebalance ? (
          /* Auto-Adjust Option Available */
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>Auto-Adjust Available (0 Conflicts)</span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              We can automatically readjust the displaced period to resolve this teacher collision{' '}
              <strong className="text-[var(--text-primary)] font-medium">without disrupting</strong> the rest of the schedule.
            </p>

            {/* Reposition preview */}
            {preview?.otherChanges && preview.otherChanges.length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-500/20 space-y-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] block">
                  Synchronized Minimal Readjustment:
                </span>
                {preview.otherChanges.map((chg, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded flex items-center justify-between font-mono text-[11px]"
                  >
                    <span className="font-sans font-medium text-[var(--text-primary)] truncate max-w-[150px]">
                      {chg.subject}
                    </span>
                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                      <span>{chg.fromDay} P{chg.fromPeriod}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-500" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{chg.day} P{chg.period}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Cannot Rebalance */
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs text-amber-600 dark:text-amber-400 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Auto-Adjust Unavailable
            </p>
            <p className="text-[var(--text-secondary)] text-[11px]">{reason}</p>
          </div>
        )}

        {/* Position Context */}
        {preview && (
          <div className="border border-[var(--border)] rounded-md p-3 text-xs bg-[var(--bg-surface-alt)] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] block">
                Moving
              </span>
              <p className="font-semibold text-[var(--text-primary)] mt-0.5">
                {preview?.originalPeriod?.day} P{preview?.originalPeriod?.period}
              </p>
              <p className="text-[11px] text-[var(--accent)] font-medium truncate max-w-[140px]">
                {preview?.originalPeriod?.subject}
              </p>
            </div>
            <div className="w-7 h-7 rounded-full bg-[var(--border)]/60 flex items-center justify-center text-[var(--text-muted)]">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] block">
                Onto
              </span>
              <p className="font-semibold text-[var(--text-primary)] mt-0.5">
                {preview?.requestedNewPeriod?.day} P{preview?.requestedNewPeriod?.period}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] truncate max-w-[140px]">
                {preview?.requestedNewPeriod?.subject || 'Empty'}
              </p>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-[var(--border)]">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto order-3 sm:order-1 text-[var(--text-muted)]"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
            {/* Force Swap Option */}
            <Button
              variant="outline"
              size="sm"
              onClick={onForceSwap}
              disabled={loading}
              className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              title="Force swap with conflict (Admin override)"
            >
              Force Swap (Keep Conflict)
            </Button>

            {/* Auto-Adjust Option (Primary if available) */}
            {canRebalance && (
              <Button
                variant="primary"
                size="sm"
                onClick={onAutoAdjust}
                loading={loading}
                disabled={isSimulating}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Auto-Adjust (Readjust)
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default RebalanceModal;
