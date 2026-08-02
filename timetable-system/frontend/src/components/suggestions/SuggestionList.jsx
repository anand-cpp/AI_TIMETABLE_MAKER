import { formatDateTime } from '../../utils/formatters';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { MessageSquare, Check, Trash2, User } from 'lucide-react';
import { cn } from '../../utils/cn';

const SuggestionList = ({
  suggestions,
  isAdmin = false,
  onMarkRead,
  onDelete,
}) => {
  if (!suggestions || suggestions.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No suggestions yet"
        message={
          isAdmin
            ? 'Teachers have not submitted any suggestions yet'
            : 'You have not submitted any suggestions yet'
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion._id}
          className={cn(
            'p-5 rounded-2xl border transition-all glass-panel',
            suggestion.isRead
              ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
              : 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/40'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-blue-600/15 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <User className="w-4.5 h-4.5" />
              </div>

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && suggestion.teacherName && (
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {suggestion.teacherName}
                    </span>
                  )}
                  {!suggestion.isRead && (
                    <Badge variant="primary" size="sm" dot>New</Badge>
                  )}
                  {suggestion.isRead && isAdmin && (
                    <Badge variant="default" size="sm">Read</Badge>
                  )}
                </div>

                {/* Time */}
                <p className="text-xs font-medium text-slate-400 dark:text-slate-400 mt-0.5">
                  {formatDateTime(suggestion.createdAt)}
                  {suggestion.isRead && suggestion.readAt && (
                    <span className="ml-2 text-slate-400">
                      · Read {formatDateTime(suggestion.readAt)}
                    </span>
                  )}
                </p>

                {/* Message */}
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-2 leading-relaxed">
                  {suggestion.message}
                </p>
              </div>
            </div>

            {/* Actions */}
            {isAdmin && (
              <div className="flex items-center gap-1 shrink-0">
                {!suggestion.isRead && onMarkRead && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onMarkRead(suggestion._id)}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    Mark Read
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onDelete(suggestion)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SuggestionList;