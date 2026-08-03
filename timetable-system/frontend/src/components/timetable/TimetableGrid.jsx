import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import DraggableSlotCell from './DraggableSlotCell';
import SaveStatusIndicator from './SaveStatusIndicator';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { dayShort } from '../../utils/formatters';
import { checkSlotConflict } from '../../utils/conflictChecker';
import { RotateCcw, RotateCw, AlertTriangle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TimetableGrid = ({
  classTimetable,
  timetableVersion,
  onSlotClick,
  onSlotSwap,
  selectedSlot,
  showActions = false,
  readonly = false,
  saveStatus = 'saved',
  onRetrySave,
}) => {
  const [activeSlot, setActiveSlot] = useState(null);
  const [pendingConflictSwap, setPendingConflictSwap] = useState(null);

  // Undo / Redo history state
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Configure sensors (pointer require 5px move to prevent accidental clicks)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Reset history when classTimetable changes
  useEffect(() => {
    if (classTimetable?.slots) {
      setHistory([classTimetable.slots]);
      setHistoryIndex(0);
    }
  }, [classTimetable?.classId]);

  // Current active slots
  const currentSlots = useMemo(() => {
    if (historyIndex >= 0 && history[historyIndex]) {
      return history[historyIndex];
    }
    return classTimetable?.slots || [];
  }, [classTimetable?.slots, history, historyIndex]);

  // Build slot map: day -> period -> slot
  const slotMap = useMemo(() => {
    const map = {};
    for (const slot of currentSlots) {
      if (!map[slot.day]) map[slot.day] = {};
      map[slot.day][slot.period] = slot;
    }
    return map;
  }, [currentSlots]);

  // Get all unique period numbers sorted
  const periods = useMemo(() => {
    const pSet = new Set();
    for (const slot of currentSlots) {
      pSet.add(slot.period);
    }
    return [...pSet].sort((a, b) => a - b);
  }, [currentSlots]);

  // Handle Drag Start
  const handleDragStart = (event) => {
    const slot = event.active.data.current?.slot;
    if (slot) {
      setActiveSlot(slot);
    }
  };

  // Execute actual slot swap in state and notify parent
  const executeSwap = useCallback((sourceSlot, targetSlot) => {
    // Deep clone array to guarantee immutability & React re-render
    const updatedSlots = JSON.parse(JSON.stringify(currentSlots)).map((s) => {
      if (s.day === sourceSlot.day && s.period === sourceSlot.period) {
        return {
          ...s,
          subjectId: targetSlot.subjectId || null,
          subjectName: targetSlot.subjectName || '',
          subjectCode: targetSlot.subjectCode || '',
          subjectType: targetSlot.subjectType || 'empty',
          teacherIds: targetSlot.teacherIds || [],
          teacherNames: targetSlot.teacherNames || [],
          roomName: targetSlot.roomName || '',
          isEmpty: targetSlot.isEmpty ?? true,
          isBatchSplit: targetSlot.isBatchSplit ?? false,
          batch1: targetSlot.batch1 || null,
          batch2: targetSlot.batch2 || null,
        };
      }
      if (s.day === targetSlot.day && s.period === targetSlot.period) {
        return {
          ...s,
          subjectId: sourceSlot.subjectId || null,
          subjectName: sourceSlot.subjectName || '',
          subjectCode: sourceSlot.subjectCode || '',
          subjectType: sourceSlot.subjectType || 'empty',
          teacherIds: sourceSlot.teacherIds || [],
          teacherNames: sourceSlot.teacherNames || [],
          roomName: sourceSlot.roomName || '',
          isEmpty: sourceSlot.isEmpty ?? true,
          isBatchSplit: sourceSlot.isBatchSplit ?? false,
          batch1: sourceSlot.batch1 || null,
          batch2: sourceSlot.batch2 || null,
        };
      }
      return s;
    });

    // Update local history stack
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(updatedSlots);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Trigger parent callback
    onSlotSwap?.(sourceSlot, targetSlot, updatedSlots);

    // Toast feedback
    toast.success('Period moved ↺ Undo available', {
      duration: 3000,
      icon: '🔄',
    });
  }, [currentSlots, history, historyIndex, onSlotSwap]);

  // Handle Drag End
  const handleDragEnd = (event) => {
    setActiveSlot(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceSlot = active.data.current?.slot;
    const targetSlot = over.data.current?.slot;

    if (!sourceSlot || !targetSlot) return;

    // Conflict check
    const conflict = checkSlotConflict(timetableVersion || { classTimetables: [classTimetable] }, sourceSlot, targetSlot);

    if (conflict) {
      setPendingConflictSwap({ sourceSlot, targetSlot, conflictInfo: conflict });
    } else {
      executeSwap(sourceSlot, targetSlot);
    }
  };

  // Confirm Conflict Swap
  const handleConfirmConflictSwap = () => {
    if (pendingConflictSwap) {
      executeSwap(pendingConflictSwap.sourceSlot, pendingConflictSwap.targetSlot);
      setPendingConflictSwap(null);
    }
  };

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      onSlotSwap?.(null, null, history[prevIndex]);
      toast('Undo applied', { icon: '↺' });
    }
  }, [history, historyIndex, onSlotSwap]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      onSlotSwap?.(null, null, history[nextIndex]);
      toast('Redo applied', { icon: '↻' });
    }
  }, [history, historyIndex, onSlotSwap]);

  // Keyboard Shortcuts (Ctrl+Z / Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  if (!classTimetable || !classTimetable.slots) {
    return (
      <div className="p-8 text-center text-xs font-sans text-[var(--text-muted)]">
        No timetable data available
      </div>
    );
  }

  const isSelected = (slot) => {
    if (!selectedSlot) return false;
    return selectedSlot.day === slot?.day && selectedSlot.period === slot?.period;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3 font-sans">
        {/* Toolbar Header Above Grid */}
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className={cn(
                'px-2.5 py-1 text-xs font-sans rounded-xs border flex items-center gap-1 transition-colors cursor-pointer',
                historyIndex > 0
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]'
                  : 'bg-[var(--bg-surface-alt)] text-[var(--text-muted)] border-[var(--border)] opacity-50 cursor-not-allowed'
              )}
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Undo</span>
            </button>

            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className={cn(
                'px-2.5 py-1 text-xs font-sans rounded-xs border flex items-center gap-1 transition-colors cursor-pointer',
                historyIndex < history.length - 1
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]'
                  : 'bg-[var(--bg-surface-alt)] text-[var(--text-muted)] border-[var(--border)] opacity-50 cursor-not-allowed'
              )}
              title="Redo (Ctrl+Shift+Z)"
            >
              <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Redo</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            {!readonly && (
              <span className="text-[11px] font-sans text-[var(--text-muted)] hidden md:inline">
                💡 Drag any period cell to swap slots
              </span>
            )}
            <SaveStatusIndicator status={saveStatus} onRetry={onRetrySave} />
          </div>
        </div>

        {/* Timetable Table Grid */}
        <div className="overflow-x-auto border border-[var(--border)] rounded-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)]">
                <th className="border border-[var(--border)] px-3 py-2.5 text-left text-xs font-sans font-semibold text-[var(--text-primary)] w-20 sticky left-0 bg-[var(--bg-surface-alt)] z-10 uppercase tracking-wider">
                  Day
                </th>
                {periods.map((period) => {
                  const isBreakPeriod = DAYS.some((day) => {
                    const slot = slotMap[day]?.[period];
                    return slot?.isBreak;
                  });
                  return (
                    <th
                      key={period}
                      className={cn(
                        'border border-[var(--border)] px-2 py-2.5 text-center font-sans font-semibold text-[var(--text-primary)] min-w-[100px] uppercase tracking-wider',
                        isBreakPeriod && 'bg-[var(--bg-surface-alt)] text-[var(--text-muted)]'
                      )}
                    >
                      {isBreakPeriod ? '—' : `P${period}`}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day} className="border-b border-[var(--border)]">
                  <td className="border border-[var(--border)] px-3 py-2 font-sans font-semibold text-[var(--text-primary)] sticky left-0 bg-[var(--bg-surface)] z-10 text-xs">
                    <span className="hidden sm:block">{day}</span>
                    <span className="block sm:hidden">{dayShort(day)}</span>
                  </td>
                  {periods.map((period) => {
                    const slot = slotMap[day]?.[period] || { day, period, isEmpty: true };
                    return (
                      <DraggableSlotCell
                        key={`${day}-${period}`}
                        slot={slot}
                        onClick={() => onSlotClick?.(slot)}
                        isSelected={isSelected(slot)}
                        showActions={showActions && !readonly}
                        readonly={readonly}
                        timetable={timetableVersion || { classTimetables: [classTimetable] }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Drag Overlay Floating Card Preview */}
        <DragOverlay>
          {activeSlot ? (
            <div className="p-2 bg-[var(--bg-surface)] border-2 border-[var(--accent)] rounded-xs shadow-2xl scale-105 rotate-1 opacity-90 text-xs pointer-events-none w-36">
              <p className="font-serif font-normal text-[var(--text-primary)] truncate">{activeSlot.subjectName}</p>
              <p className="font-mono text-[10px] text-[var(--accent)] font-semibold">{activeSlot.subjectCode}</p>
              <p className="font-sans text-[10px] text-[var(--text-secondary)] truncate">{activeSlot.teacherNames?.join(', ')}</p>
            </div>
          ) : null}
        </DragOverlay>

        {/* Conflict Warning Modal */}
        <Modal
          isOpen={!!pendingConflictSwap}
          onClose={() => setPendingConflictSwap(null)}
          title="⚠ Scheduling Conflict Detected"
          size="sm"
        >
          <div className="space-y-4 font-sans">
            <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xs flex items-start gap-2.5 text-xs text-[var(--error)]">
              <AlertTriangle className="w-5 h-5 shrink-0 text-[var(--error)] mt-0.5" strokeWidth={1.5} />
              <div>
                <p className="font-semibold">Conflict Details:</p>
                <p className="mt-1 leading-relaxed">{pendingConflictSwap?.conflictInfo?.message}</p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Moving this period will create a teacher double-booking. Do you want to swap these periods anyway?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setPendingConflictSwap(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmConflictSwap}>
                Swap Anyway (Override)
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DndContext>
  );
};

export default TimetableGrid;