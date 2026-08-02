import { cn } from '../../utils/cn';
import { Lock, FlaskConical, Layers, BookOpen } from 'lucide-react';

const SlotCell = ({ slot, onClick, isSelected, showActions }) => {
  if (!slot) {
    return (
      <td className="timetable-cell empty border border-gray-200 p-1 min-h-[60px]">
        <div className="w-full h-full min-h-[56px]" />
      </td>
    );
  }

  if (slot.isBreak) {
    return (
      <td className="timetable-cell break border border-gray-200 p-1 text-center">
        <span className="text-xs text-gray-400 italic">{slot.subjectName || 'Break'}</span>
      </td>
    );
  }

  if (slot.isEmpty) {
    return (
      <td
        className={cn(
          'timetable-cell empty border border-gray-200 p-1 min-h-[60px] cursor-pointer',
          isSelected && 'ring-2 ring-primary-400 bg-primary-50'
        )}
        onClick={() => onClick?.(slot)}
      >
        <div className="w-full h-full min-h-[56px] flex items-center justify-center">
          {showActions && (
            <span className="text-xs text-gray-300 group-hover:text-gray-400">
              + Add
            </span>
          )}
        </div>
      </td>
    );
  }

  const cellClass = cn(
    'timetable-cell border border-slate-200 dark:border-slate-800 p-1.5 min-h-[60px] cursor-pointer relative group transition-colors',
    slot.subjectType === 'lab' && 'lab bg-blue-50/90 dark:bg-blue-950/60',
    slot.subjectType === 'theory' && 'theory bg-white dark:bg-slate-900/90',
    slot.subjectType === 'elective' && 'elective bg-emerald-50/90 dark:bg-emerald-950/60',
    slot.isLocked && 'locked bg-amber-50 dark:bg-amber-950/60 ring-1 ring-amber-400',
    isSelected && 'ring-2 ring-blue-500',
    slot.isLabBlock && slot.labBlockIndex > 0 && 'border-t-0'
  );

  const TypeIcon =
    slot.subjectType === 'lab' ? FlaskConical :
    slot.subjectType === 'elective' ? Layers : BookOpen;

  return (
    <td className={cellClass} onClick={() => onClick?.(slot)}>
      <div className="flex flex-col h-full min-h-[56px] justify-between">
        <div className="flex-1">
          {/* Subject name */}
          <p className={cn(
            'text-xs font-bold leading-tight break-words',
            slot.subjectType === 'lab' && 'text-blue-950 dark:text-blue-200',
            slot.subjectType === 'elective' && 'text-emerald-950 dark:text-emerald-200',
            slot.subjectType === 'theory' && 'text-slate-900 dark:text-white',
          )}>
            {slot.subjectName}
          </p>

          {/* Subject code */}
          {slot.subjectCode && (
            <p className={cn(
              'text-xs font-mono mt-0.5 font-bold',
              slot.subjectType === 'lab' && 'text-blue-600 dark:text-cyan-400',
              slot.subjectType === 'elective' && 'text-emerald-600 dark:text-emerald-400',
              slot.subjectType === 'theory' && 'text-slate-500 dark:text-slate-300',
            )}>
              {slot.subjectCode}
            </p>
          )}

          {/* Teacher names */}
          {slot.teacherNames?.length > 0 && (
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-200 mt-0.5 truncate">
              {slot.teacherNames.join(', ')}
            </p>
          )}

          {/* Batch split */}
          {slot.isBatchSplit && (
            <div className="mt-0.5 space-y-0.5">
              {slot.batch1?.teacherName && (
                <p className="text-xs font-bold text-blue-600 dark:text-cyan-400 truncate">
                  B1: {slot.batch1.teacherName}
                </p>
              )}
              {slot.batch2?.teacherName && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  B2: {slot.batch2.teacherName}
                </p>
              )}
            </div>
          )}

          {/* Room */}
          {slot.roomName && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-300 truncate mt-0.5">
              📍 {slot.roomName}
            </p>
          )}
        </div>

        {/* Bottom icons */}
        <div className="flex items-center justify-between mt-1">
          <TypeIcon className={cn(
            'w-3 h-3',
            slot.subjectType === 'lab' && 'text-blue-500 dark:text-cyan-400',
            slot.subjectType === 'elective' && 'text-emerald-500 dark:text-emerald-400',
            slot.subjectType === 'theory' && 'text-slate-400 dark:text-slate-400',
          )} />
          {slot.isLocked && (
            <Lock className="w-3 h-3 text-amber-500 dark:text-amber-400" />
          )}
        </div>
      </div>
    </td>
  );
};

export default SlotCell;