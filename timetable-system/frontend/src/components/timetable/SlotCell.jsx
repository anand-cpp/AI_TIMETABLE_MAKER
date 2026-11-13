import { cn } from '../../utils/cn';
import { Lock, FlaskConical, Layers, BookOpen, Zap, Sparkles } from 'lucide-react';

const SlotCell = ({
  slot,
  onClick,
  isSelected,
  isSwapSource,
  isSwapCompatible,
  isSwapConflict,
  isSwapIncompatible,
  swapReason,
  isDiagnosticFocus,
  showActions,
  dragRef,
  dropRef,
  attributes,
  listeners,
  isDragging,
  isOver,
  readonly,
  isLabGroupActive,
  onMouseEnter,
  onMouseLeave,
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
          'timetable-cell empty border border-[var(--border)] p-1.5 min-h-[60px] cursor-pointer relative select-none transition-colors duration-150',
          isDiagnosticFocus && 'ring-4 ring-rose-500 bg-rose-500/20 shadow-xl animate-pulse z-30',
          isOver && 'ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent-soft)] border-2 border-dashed border-[var(--accent)] z-20',
          isSelected && !isSwapSource && !isDiagnosticFocus && 'ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent-soft)]',
          isSwapSource && 'ring-2 ring-inset ring-amber-500 bg-amber-500/20 shadow-md z-20 animate-pulse',
          isSwapCompatible && 'ring-2 ring-inset ring-emerald-500 bg-emerald-500/15 border-emerald-500 shadow-sm z-20',
          isSwapConflict && 'ring-1 ring-inset ring-amber-500/60 bg-amber-500/10 z-10',
          isSwapIncompatible && 'opacity-40 cursor-not-allowed'
        )}
        onClick={() => onClick?.(slot)}
        title={swapReason || ''}
      >
        <div className="w-full h-full min-h-[56px] flex items-center justify-center pointer-events-none">
          {isOver ? (
            <span className="text-[10px] font-sans font-bold text-[var(--accent)] uppercase tracking-wider bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--accent)] shadow-sm">
              Move Here
            </span>
          ) : isSwapSource ? (
            <span className="text-[10px] font-sans font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-amber-500 shadow-sm">
              Selected
            </span>
          ) : isSwapCompatible ? (
            <span className="text-[10px] font-sans font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-emerald-500 shadow-sm animate-pulse">
              Swap Here
            </span>
          ) : isSwapConflict ? (
            <span className="text-[10px] font-sans font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-amber-500 shadow-sm">
              Auto-Adjust
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
  const isMinor = Boolean(slot.isMinor || slot.subjectType === 'minor');
  const isLab = Boolean(slot.subjectType === 'lab' || slot.subjectType === 'practical' || slot.isLabBlock || (slot.subjectName && slot.subjectName.toLowerCase().includes('lab')));
  const isElective = Boolean(slot.isElective || slot.subjectType === 'elective');

  // CRITICAL FIX: Removed scale-[1.02] and scale-[0.98] to prevent table layout reflow loops
  // and jitter/shaking during drag-and-drop hovering. Used ring-inset so bounding box never expands.
  const cellClass = cn(
    'timetable-cell border p-2 min-h-[60px] relative group transition-colors duration-150 select-none cursor-grab active:cursor-grabbing',
    isAutoFill ? 'bg-[var(--bg-surface-alt)] border-dashed border-[var(--border)]' : 'border-[var(--border)]',
    isLab && 'lab bg-emerald-500/10 border-emerald-500/30',
    isElective && 'elective bg-blue-500/10 border-blue-500/30',
    isMinor && 'minor bg-purple-500/10 border-purple-500/30 ring-1 ring-inset ring-purple-500/20',
    !isLab && !isElective && !isMinor && slot.subjectType === 'theory' && 'theory bg-[var(--bg-surface)]',
    slot.isLocked && 'locked bg-[var(--warning)]/10 ring-1 ring-inset ring-[var(--warning)]',
    slot.isOverride && 'ring-1 ring-inset ring-amber-500/50 bg-amber-500/5',
    isDiagnosticFocus && 'ring-4 ring-rose-500 shadow-xl animate-pulse z-30 bg-rose-500/10',
    isLabGroupActive && !isDiagnosticFocus && 'ring-2 ring-inset ring-indigo-500 bg-indigo-500/15 shadow-sm z-10',
    isSwapSource && !isDiagnosticFocus && 'ring-2 ring-inset ring-amber-500 bg-amber-500/20 shadow-md z-20 animate-pulse',
    isSwapCompatible && !isDiagnosticFocus && 'ring-2 ring-inset ring-emerald-500 bg-emerald-500/20 border-emerald-500 shadow-sm z-20 cursor-pointer',
    isSwapConflict && !isDiagnosticFocus && 'ring-1 ring-inset ring-amber-500/60 bg-amber-500/10 z-10 cursor-pointer',
    isSwapIncompatible && !isDiagnosticFocus && 'opacity-40 cursor-not-allowed',
    isSelected && !isSwapSource && !isDiagnosticFocus && 'ring-2 ring-inset ring-[var(--accent)]',
    isDragging && 'opacity-40 border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)]/20',
    isOver && 'ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent-soft)] border-2 border-dashed border-[var(--accent)] z-20'
  );

  const TypeIcon =
    isLab ? FlaskConical :
    isElective ? Layers :
    isAutoFill ? Sparkles : BookOpen;

  // Clean redundant "/minor" prefixes or suffixes when the MINOR badge is displayed
  const cleanMinorSubjectName = (name) => {
    if (!name || typeof name !== 'string') return '';
    return name
      .replace(/^\s*minor\s*[\/\-—:]\s*/i, '')
      .replace(/\s*[\/\-—:]\s*minor\s*$/i, '')
      .replace(/\s*\/\s*minor\b/i, '')
      .replace(/\bminor\s*\/\s*/i, '')
      .replace(/\s*\(\s*minor\s*\)/i, '')
      .trim();
  };

  const rawSubjectName = slot.minorSubjectName || slot.subjectName || '';
  const displaySubjectName = isMinor
    ? (cleanMinorSubjectName(rawSubjectName) || slot.subjectCode || 'Minor')
    : slot.subjectName;

  return (
    <td
      ref={setRef}
      {...attributes}
      {...(readonly || slot.isLocked ? {} : listeners)}
      className={cellClass}
      onClick={() => onClick?.(slot)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={swapReason || ''}
    >
      {/* 🔄 Click-to-Swap / Conflict Status Badges */}
      {isSwapCompatible && (
        <span className="absolute top-1 right-1 z-20 text-[9px] font-sans font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-400 shadow-sm animate-pulse">
          Swap
        </span>
      )}
      {isSwapConflict && (
        <span className="absolute top-1 right-1 z-20 text-[9px] font-sans font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.5 rounded border border-amber-400 shadow-sm" title={swapReason}>
          Adjust
        </span>
      )}
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

      {/* Drag Hover Indication (Zero geometric expansion) */}
      {isOver && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-[var(--accent)]/10 backdrop-blur-[1px] rounded-xs border-2 border-dashed border-[var(--accent)]">
          <span className="px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--accent)] font-sans font-bold text-[10px] uppercase shadow-md tracking-wider">
            Swap
          </span>
        </div>
      )}

      {/* Click-to-Swap Source Selection Indication */}
      {isSwapSource && (
        <div className="absolute top-1 left-1 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-sans font-bold uppercase shadow-sm">
          <span>Source</span>
        </div>
      )}

      <div className="flex flex-col h-full min-h-[56px] justify-between pointer-events-none">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-1 mb-1">
            <span className="font-mono text-[10px] text-[var(--accent)] font-semibold tracking-tight truncate">
              {slot.subjectCode}
            </span>
            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
              {isMinor && (
                <span className="text-[8px] font-sans font-bold px-1 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                  MINOR
                </span>
              )}
              {isLab && (
                <span className="text-[8px] font-sans font-bold px-1 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                  LAB
                </span>
              )}
              {isElective && (
                <span className="text-[8px] font-sans font-bold px-1 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                  ELECTIVE
                </span>
              )}
              {slot.isLocked && (
                <Lock className="w-3 h-3 text-[var(--warning)]" strokeWidth={1.5} />
              )}
              {slot.subjectType && slot.subjectType !== 'empty' && (
                <TypeIcon className="w-3 h-3 text-[var(--text-muted)]" strokeWidth={1.5} />
              )}
            </div>
          </div>
          <p className="font-serif font-normal text-xs text-[var(--text-primary)] leading-tight line-clamp-2">
            {displaySubjectName}
          </p>
        </div>

        <div className="mt-1 pt-1 border-t border-[var(--border)]/50 flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-sans">
          <span className="truncate max-w-[90px]">
            {slot.teacherNames && slot.teacherNames.length > 0
              ? slot.teacherNames.join(', ')
              : '—'}
          </span>
          {slot.roomName && (
            <span className="text-[var(--text-muted)] font-mono text-[9px] shrink-0">
              {slot.roomName}
            </span>
          )}
        </div>
      </div>
    </td>
  );
};

export default SlotCell;
