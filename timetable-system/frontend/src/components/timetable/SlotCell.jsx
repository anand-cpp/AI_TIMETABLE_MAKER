import { cn } from '../../utils/cn';
import { Lock, FlaskConical, Layers, BookOpen, Zap, Sparkles } from 'lucide-react';

const SlotCell = ({
  slot,
  onClick,
  isSelected,
  showActions,
  dragRef,
  dropRef,
  attributes,
  listeners,
  isDragging,
  isOver,
  readonly,
}) => {
  const setRef = (node) => {
    if (dragRef) dragRef(node);
    if (dropRef) dropRef(node);
  };

  if (!slot) {
    return (
      <td
        ref={setRef}
        {...attributes}
        {...listeners}
        className="timetable-cell empty border border-[var(--border)] p-1 min-h-[60px] select-none"
      >
        <div className="w-full h-full min-h-[56px]" />
      </td>
    );
  }

  if (slot.isBreak) {
    return (
      <td
        ref={setRef}
        {...attributes}
        {...listeners}
        className="timetable-cell break border border-[var(--border)] p-1 text-center bg-[var(--bg-surface-alt)] select-none"
      >
        <span className="text-xs text-[var(--text-muted)] italic pointer-events-none">
          {slot.subjectName || 'Break'}
        </span>
      </td>
    );
  }

  if (slot.isEmpty) {
    return (
      <td
        ref={setRef}
        {...attributes}
        {...listeners}
        className={cn(
          'timetable-cell empty border border-[var(--border)] p-1.5 min-h-[60px] cursor-pointer relative select-none transition-all duration-150',
          isOver && 'ring-2 ring-[var(--accent)] bg-[var(--accent-soft)] border-2 border-dashed border-[var(--accent)]',
          isSelected && 'ring-2 ring-[var(--accent)] bg-[var(--accent-soft)]'
        )}
        onClick={() => onClick?.(slot)}
      >
        <div className="w-full h-full min-h-[56px] flex items-center justify-center pointer-events-none">
          {isOver ? (
            <span className="text-[10px] font-sans font-bold text-[var(--accent)] uppercase tracking-wider bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--accent)] shadow-sm">
              Move Here
            </span>
          ) : showActions ? (
            <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--accent)]">
              + Add
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">—</span>
          )}
        </div>
      </td>
    );
  }

  const isAutoFill = slot.isAutoFill || slot.subjectType === 'autofill';

  const cellClass = cn(
    'timetable-cell border p-2 min-h-[60px] relative group transition-all duration-150 select-none cursor-grab active:cursor-grabbing',
    isAutoFill ? 'bg-[var(--bg-surface-alt)] border-dashed border-[var(--border)]' : 'border-[var(--border)]',
    slot.subjectType === 'lab' && 'lab bg-[var(--accent-soft)]/40',
    slot.subjectType === 'theory' && 'theory bg-[var(--bg-surface)]',
    slot.subjectType === 'elective' && 'elective bg-[var(--accent-soft)]/20',
    slot.isLocked && 'locked bg-[var(--warning)]/10 ring-1 ring-[var(--warning)]',
    slot.isOverride && 'ring-1 ring-amber-500/50 bg-amber-500/5',
    isSelected && 'ring-2 ring-[var(--accent)]',
    isDragging && 'opacity-40 scale-[0.98] border-2 border-dashed border-[var(--accent)]',
    isOver && 'ring-2 ring-[var(--accent)] bg-[var(--accent-soft)] border-2 border-dashed border-[var(--accent)] scale-[1.02] z-20'
  );

  const TypeIcon =
    slot.subjectType === 'lab' ? FlaskConical :
    slot.subjectType === 'elective' ? Layers :
    isAutoFill ? Sparkles : BookOpen;

  return (
    <td
      ref={setRef}
      {...attributes}
      {...(readonly || slot.isLocked ? {} : listeners)}
      className={cellClass}
      onClick={() => onClick?.(slot)}
    >
      {/* ⚡ Override Marker Badge */}
      {slot.isOverride && (
        <div
          className="absolute top-1 right-1 z-20 flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white shadow-sm"
          title={`⚡ Admin Override: ${slot.overrideDetails || slot.notes || 'Approved constraint waiver'}`}
        >
          <Zap className="w-2.5 h-2.5 fill-current" />
        </div>
      )}

      {/* AUTO Badge for Auto-Fill Cells */}
      {isAutoFill && (
        <span className="absolute bottom-1 right-1 z-10 text-[9px] font-mono font-bold text-[var(--text-muted)] bg-[var(--bg-surface)] px-1 rounded border border-[var(--border)] uppercase opacity-80">
          AUTO
        </span>
      )}

      {isOver && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-[var(--accent)]/10 backdrop-blur-[1px] rounded-xs border-2 border-dashed border-[var(--accent)]">
          <span className="px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--accent)] font-sans font-bold text-[10px] uppercase shadow-md tracking-wider">
            Swap
          </span>
        </div>
      )}

      <div className="flex flex-col h-full min-h-[56px] justify-between pointer-events-none">
        <div className="flex-1">
          {/* Subject name */}
          <p className={cn(
            "text-xs font-serif text-[var(--text-primary)] leading-tight break-words pr-3",
            isAutoFill ? "italic text-[var(--text-secondary)] font-normal" : "font-normal"
          )}>
            {slot.icon && <span className="mr-1.5 not-italic">{slot.icon}</span>}
            {slot.subjectName}
          </p>

          {/* Subject code */}
          {slot.subjectCode && (
            <p className="text-[10px] font-mono font-semibold text-[#B8A574] mt-0.5">
              {slot.subjectCode}
            </p>
          )}

          {/* Teacher names */}
          {slot.teacherNames?.length > 0 && (
            <p className="text-[11px] font-sans text-[var(--text-secondary)] mt-0.5 truncate">
              {slot.teacherNames.join(', ')}
            </p>
          )}

          {/* Batch split */}
          {slot.isBatchSplit && (
            <div className="mt-0.5 space-y-0.5 text-[10px] font-sans font-medium">
              {slot.batch1?.teacherName && (
                <p className="text-[var(--accent)] truncate">B1: {slot.batch1.teacherName}</p>
              )}
              {slot.batch2?.teacherName && (
                <p className="text-[var(--text-secondary)] truncate">B2: {slot.batch2.teacherName}</p>
              )}
            </div>
          )}

          {/* Room */}
          {slot.roomName && (
            <p className="text-[10px] font-sans text-[var(--text-muted)] truncate mt-0.5">
              📍 {slot.roomName}
            </p>
          )}
        </div>

        {/* Bottom icons */}
        <div className="flex items-center justify-between mt-1">
          <TypeIcon className="w-3 h-3 text-[var(--accent)]" strokeWidth={1.5} />
          {slot.isLocked && (
            <Lock className="w-3 h-3 text-[var(--warning)]" strokeWidth={1.5} />
          )}
        </div>
      </div>
    </td>
  );
};

export default SlotCell;