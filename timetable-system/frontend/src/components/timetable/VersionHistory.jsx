import { cn } from '../../utils/cn';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import { formatDate, formatDateTime } from '../../utils/formatters';
import {
  CheckCircle,
  Clock,
  Trash2,
  Eye,
  Check,
  Star,
  ChevronRight,
} from 'lucide-react';

const VersionHistory = ({
  versions,
  loading,
  activeVersionId,
  onSelect,
  onAccept,
  onDelete,
  onUpdateLabel,
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
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No versions generated yet</p>
        <p className="text-xs text-gray-300 mt-1">
          Use the Generate panel to create your first timetable
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
        {versions.length} Version{versions.length !== 1 ? 's' : ''}
      </p>
      {versions.map((version) => {
        const isActive = version._id === activeVersionId;
        const isAccepted = version.isAccepted;
        const score = version.qualityScore?.overall || 0;

        const scoreColor =
          score >= 80 ? 'text-emerald-500 dark:text-emerald-400' :
          score >= 60 ? 'text-amber-500 dark:text-amber-400' :
          score >= 40 ? 'text-orange-500 dark:text-orange-400' : 'text-rose-500 dark:text-rose-400';

        return (
          <div
            key={version._id}
            className={cn(
              'p-3.5 rounded-2xl border transition-all cursor-pointer glass-panel',
              isActive
                ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/60'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700',
              isAccepted && 'ring-2 ring-emerald-400 dark:ring-emerald-500'
            )}
            onClick={() => onSelect(version._id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {version.label || `Version ${version.version}`}
                  </span>
                  {isAccepted && (
                    <Badge variant="success" dot size="sm">Active</Badge>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-400 mt-0.5">
                  {formatDateTime(version.generatedAt)}
                </p>
                {version.generationStats && (
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-400">
                    {version.generationStats.generations} gen ·{' '}
                    {(version.generationStats.timeMs / 1000).toFixed(1)}s ·{' '}
                    {version.generationStats.hardViolations} violations
                  </p>
                )}
                {version.warnings?.length > 0 && (
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    ⚠ {version.warnings.length} warning(s)
                  </p>
                )}
                {version.unplacedSubjects?.length > 0 && (
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    ✗ {version.unplacedSubjects.length} unplaced subject(s)
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className={cn('text-xl font-black', scoreColor)}>
                  {score}
                  <span className="text-xs font-normal text-slate-400">/100</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {isActive && (
              <div
                className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                {!isAccepted ? (
                  <Button
                    size="xs"
                    variant="success"
                    onClick={() => onAccept(version._id)}
                    leftIcon={<Check className="w-3 h-3" />}
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
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 ml-auto"
                  leftIcon={<Trash2 className="w-3 h-3" />}
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