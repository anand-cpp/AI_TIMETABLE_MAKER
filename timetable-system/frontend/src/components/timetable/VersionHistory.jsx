import { useState } from 'react';
import { cn } from '../../utils/cn';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import PublishConfirmationModal from './PublishConfirmationModal';
import { formatDateTime } from '../../utils/formatters';
import {
  Clock,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

const computeRealisticScore = (version) => {
  if (!version) return 100;
  const unplacedCount = version.unplacedSubjects?.length || 0;
  const hardViolationsCount = Math.max(
    version.generationStats?.hardViolations || 0,
    version.validationChecks?.hardViolationsCount || 0
  );
  const softViolationsCount = Math.max(
    version.generationStats?.softViolations || 0,
    version.warnings?.length || 0
  );

  // Critical failure: hard conflicts strictly cap score at <= 48
  if (hardViolationsCount > 0) {
    return Math.max(15, 48 - (hardViolationsCount - 1) * 4);
  }

  // Deduct for soft warnings and unplaced subjects
  const softPenalty = Math.max(softViolationsCount > 0 ? 6 : 0, Math.round(softViolationsCount * 0.6));
  const unplacedPenalty = unplacedCount * 10;
  let score = Math.max(20, Math.min(100, 100 - softPenalty - unplacedPenalty));

  // Cap at 94 if any soft warnings exist - never award 100/100 when issues exist!
  if (softViolationsCount > 0 && score > 94) {
    score = 94;
  }

  // If a lower score was computed by backend breakdown, respect that lower score
  if (typeof version.qualityScore?.overall === 'number' && version.qualityScore.overall < score) {
    score = version.qualityScore.overall;
  }
  return score;
};

const VersionHistory = ({
  versions,
  loading,
  activeVersionId,
  onSelect,
  onAccept,
  onDelete,
}) => {
  const [publishTargetVersion, setPublishTargetVersion] = useState(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-sm font-sans font-semibold text-[var(--text-primary)]">No versions generated yet</p>
        <p className="text-xs font-sans text-[var(--text-secondary)] mt-1">
          Use the Generate panel to create your first timetable
        </p>
      </div>
    );
  }

  const handlePublishClick = (version) => {
    const softCount = version.generationStats?.softViolations || 34;
    if (softCount > 0) {
      setPublishTargetVersion(version);
    } else {
      onAccept(version._id);
    }
  };

  const handleModalConfirm = async (details) => {
    if (publishTargetVersion) {
      await onAccept(publishTargetVersion._id, details);
      setPublishTargetVersion(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--text-label)] mb-3">
        {versions.length} Version{versions.length !== 1 ? 's' : ''}
      </p>
      {versions.map((version) => {
        const isActive = version._id === activeVersionId;
        const isAccepted = version.isAccepted;
        const hasUnplaced = (version.unplacedSubjects?.length || 0) > 0;
        const hardViolationsCount = Math.max(
          version.generationStats?.hardViolations || 0,
          version.validationChecks?.hardViolationsCount || 0
        );
        const softViolationsCount = Math.max(
          version.generationStats?.softViolations || 0,
          version.warnings?.length || 0
        );

        // Realistic Quality Score: Never give 100/100 if there are warnings or hard conflicts
        const score = computeRealisticScore(version);

        // Smart Publish Logic: Publishable if 0 unplaced subjects and 0 hard conflicts
        const isCriticalError = hasUnplaced || hardViolationsCount > 0 || score < 60;
        const isPublishable = !isCriticalError;

        return (
          <div
            key={version._id}
            className={cn(
              'p-3.5 rounded-sm border transition-colors cursor-pointer bg-[var(--bg-surface)]',
              isActive
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] border-l-[3px] border-l-[var(--accent)]'
                : 'border-[var(--border)] hover:bg-[var(--bg-hover)]',
              isAccepted && 'ring-1 ring-[var(--success)]'
            )}
            onClick={() => onSelect(version._id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-sans font-semibold text-[var(--text-primary)]">
                    {version.label || `Version ${version.version}`}
                  </span>

                  {isPublishable ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> ✓ PUBLISHABLE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> ✗ {hardViolationsCount > 0 ? `${hardViolationsCount} CONFLICTS` : 'CRITICAL ISSUES'}
                    </span>
                  )}

                  {isAccepted && (
                    <Badge variant="success" dot size="sm">Active</Badge>
                  )}
                </div>

                <p className="text-xs font-sans text-[var(--text-secondary)] mt-1">
                  {formatDateTime(version.generatedAt)}
                </p>

                <div className="mt-1.5 space-y-0.5 text-[11px] font-sans">
                  {hardViolationsCount > 0 ? (
                    <p className="text-rose-500 font-medium">✗ {hardViolationsCount} hard conflict(s)</p>
                  ) : (
                    <p className="text-emerald-500 font-medium">✓ 0 hard conflicts · 100% placed</p>
                  )}
                  {softViolationsCount > 0 ? (
                    <p className="text-amber-500 font-medium">⚠ {softViolationsCount} soft warnings (optimization)</p>
                  ) : (
                    <p className="text-[var(--text-muted)] font-medium">✓ 0 soft warnings</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className={cn(
                  "text-lg font-mono font-bold",
                  score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-rose-600"
                )}>
                  {score}
                  <span className="text-xs font-sans font-normal text-[var(--text-muted)]">/100</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {isActive && (
              <div
                className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]"
                onClick={(e) => e.stopPropagation()}
              >
                {!isAccepted ? (
                  <Button
                    size="xs"
                    variant={isPublishable ? 'success' : 'secondary'}
                    disabled={!isPublishable}
                    onClick={() => isPublishable && handlePublishClick(version)}
                    leftIcon={<ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    title={
                      !isPublishable
                        ? 'Fix critical issues before publishing'
                        : 'Review & Publish this version'
                    }
                  >
                    {softViolationsCount > 0 ? 'Publish with Warnings ⚠' : 'Accept & Publish'}
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => onAccept(version._id)}
                  >
                    Un-publish
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onDelete(version)}
                  className="text-[var(--error)] hover:bg-[var(--bg-hover)] ml-auto"
                  leftIcon={<Trash2 className="w-3 h-3" strokeWidth={1.5} />}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Confirmation Modal */}
      {publishTargetVersion && (
        <PublishConfirmationModal
          isOpen={!!publishTargetVersion}
          onClose={() => setPublishTargetVersion(null)}
          onConfirm={handleModalConfirm}
          versionNumber={publishTargetVersion.version}
          qualityScore={computeRealisticScore(publishTargetVersion)}
          softViolationsCount={publishTargetVersion.generationStats?.softViolations ?? (publishTargetVersion.warnings?.length || 0)}
        />
      )}
    </div>
  );
};

export default VersionHistory;