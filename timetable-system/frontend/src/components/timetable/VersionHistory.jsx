import { cn } from '../../utils/cn';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import { formatDateTime } from '../../utils/formatters';
import {
  Clock,
  Trash2,
  Check,
} from 'lucide-react';

const VersionHistory = ({
  versions,
  loading,
  activeVersionId,
  onSelect,
  onAccept,
  onDelete,
}) => {
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

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--text-label)] mb-3">
        {versions.length} Version{versions.length !== 1 ? 's' : ''}
      </p>
      {versions.map((version) => {
        const isActive = version._id === activeVersionId;
        const isAccepted = version.isAccepted;
        const score = version.qualityScore?.overall || 0;

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
                  {isAccepted && (
                    <Badge variant="success" dot size="sm">Active</Badge>
                  )}
                </div>
                <p className="text-xs font-sans text-[var(--text-secondary)] mt-0.5">
                  {formatDateTime(version.generatedAt)}
                </p>
                {version.generationStats && (
                  <p className="text-[11px] font-sans text-[var(--text-muted)] mt-0.5">
                    {version.generationStats.generations} gen ·{' '}
                    {(version.generationStats.timeMs / 1000).toFixed(1)}s ·{' '}
                    {version.generationStats.hardViolations} violations
                  </p>
                )}
                {version.warnings?.length > 0 && (
                  <p className="text-xs font-sans font-medium text-[var(--warning)] mt-0.5">
                    ⚠ {version.warnings.length} warning(s)
                  </p>
                )}
                {version.unplacedSubjects?.length > 0 && (
                  <p className="text-xs font-sans font-medium text-[var(--error)] mt-0.5">
                    ✗ {version.unplacedSubjects.length} unplaced subject(s)
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="text-lg font-mono font-bold text-[var(--accent)]">
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
                    variant="success"
                    onClick={() => onAccept(version._id)}
                    leftIcon={<Check className="w-3 h-3" strokeWidth={1.5} />}
                  >
                    Accept & Publish
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
    </div>
  );
};

export default VersionHistory;