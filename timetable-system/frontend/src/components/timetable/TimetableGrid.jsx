import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import DraggableSlotCell from './DraggableSlotCell';
import SaveStatusIndicator from './SaveStatusIndicator';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { dayShort } from '../../utils/formatters';
import { checkSlotConflict } from '../../utils/conflictChecker';
import { RotateCcw, RotateCw, AlertTriangle, FlaskConical, ArrowLeftRight, ArrowRight, X } from 'lucide-react';
import LabUtilizationReport from './LabUtilizationReport';
import TimetableLegend from './TimetableLegend';
import RebalanceModal from './RebalanceModal';
import timetableService from '../../services/timetableService';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const isLabSlot = (s) => {
  if (!s || s.isEmpty) return false;
  return !!(
    s.isLabBlock ||
    s.subjectType === 'lab' ||
    ['CSD416', 'CST416'].includes(s.subjectCode) ||
    (s.subjectName && /\b(lab|laboratory|workshop|mini project|project phase)\b/i.test(s.subjectName))
  );
};

const resolveLabStartPeriod = (K, targetDay, period) => {
  const p = Number(period);
  const dur = Number(K);

  if (targetDay !== 'Friday') {
    if (dur >= 3) {
      if (p <= 3) return 1;
      return 4;
    }
    if (dur === 2) {
      if (p === 1) return 1;
      if (p === 2 || p === 3) return 2;
      if (p === 4) return 4;
      if (p >= 5) return 5;
    }
  } else {
    if (dur >= 6) {
      return 1;
    }
    if (dur === 2) {
      if (p <= 1) return 1;
      if (p === 2) return 2;
      if (p === 3 || p === 4) return 3;
      if (p >= 5) return 5;
    }
    if (dur === 3) {
      if (p <= 4) return 1;
      return 1;
    }
  }

  if (p + dur - 1 > 6) {
    const adjusted = 7 - dur;
    return adjusted >= 1 ? adjusted : 1;
  }
  return p;
};

const getLabBlock = (slots, day, period) => {
  if (!slots || !Array.isArray(slots)) return null;
  const pNum = Number(period);
  const target = slots.find((s) => s.day === day && s.period === pNum);
  if (!target || !isLabSlot(target)) return null;

  const targetSubId = target.subjectId ? target.subjectId.toString() : null;
  const targetCode = target.subjectCode;

  const matches = (s) => {
    if (!s || !isLabSlot(s)) return false;
    if (targetSubId && s.subjectId && s.subjectId.toString() === targetSubId) return true;
    if (targetCode && s.subjectCode === targetCode) return true;
    return false;
  };

  const daySlots = slots.filter((s) => s.day === day);

  let startP = pNum;
  while (startP > 1) {
    const prev = daySlots.find((s) => s.period === startP - 1);
    if (prev && matches(prev)) startP--;
    else break;
  }

  let endP = pNum;
  while (endP < 6) {
    const next = daySlots.find((s) => s.period === endP + 1);
    if (next && matches(next)) endP++;
    else break;
  }

  const groupSlots = [];
  const periods = [];
  for (let p = startP; p <= endP; p++) {
    const s = daySlots.find((sl) => sl.period === p);
    if (s) {
      groupSlots.push(s);
      periods.push(p);
    }
  }

  return {
    isLab: true,
    duration: groupSlots.length,
    startPeriod: startP,
    endPeriod: endP,
    periods,
    slots: groupSlots,
    day,
    subjectName: target.subjectName,
    subjectCode: target.subjectCode,
    roomName: target.roomName,
    teacherNames: target.teacherNames || [],
  };
};

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
  onRefresh,
  onVersionUpdate,
  onUndo,
  onRedo,
  canUndo: canUndoProp,
  canRedo: canRedoProp,
  diagnosticHighlight = null,
  onClearDiagnosticHighlight,
  onNavigateToClass,
  swapSourceSlot: externalSwapSourceSlot,
  onSwapSourceChange,
}) => {
  const [activeSlot, setActiveSlot] = useState(null);
  const [hoveredLab, setHoveredLab] = useState(null);

  // Conflict & Auto-Adjust Modal state
  const [conflictModalState, setConflictModalState] = useState({
    isOpen: false,
    sourceSlot: null,
    targetSlot: null,
    conflict: null,
    rebalanceData: null,
    isSimulating: false,
    isApplying: false,
  });

  // Click-to-Select & Click-to-Swap Mode state
  const [internalSwapSourceSlot, setInternalSwapSourceSlot] = useState(null);
  const swapSourceSlot = externalSwapSourceSlot !== undefined ? externalSwapSourceSlot : internalSwapSourceSlot;
  const setSwapSourceSlot = useCallback((slot) => {
    if (onSwapSourceChange) onSwapSourceChange(slot);
    setInternalSwapSourceSlot(slot);
  }, [onSwapSourceChange]);

  const [isSwapMode, setIsSwapMode] = useState(false);

  // Undo / Redo history state & action tracker
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const actionHistoryRef = useRef([]);
  const lastClassIdRef = useRef(null);
  const lastVersionIdRef = useRef(null);
  const lastRevisionRef = useRef(null);

  // Configure sensors (pointer requires 4px distance to avoid accidental drags on clicks)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // CRITICAL FIX: Custom collision detection using pointer coordinates strictly inside a cell.
  // Avoids closestCenter center-point oscillation that caused table shaking / vibrating!
  const customCollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return rectIntersection(args);
  }, []);

  // Synchronize history when class, version, revision, or error rollback occurs
  useEffect(() => {
    const classChanged = lastClassIdRef.current !== classTimetable?.classId;
    const versionChanged = lastVersionIdRef.current !== timetableVersion?._id;
    const revisionChanged = lastRevisionRef.current !== timetableVersion?.revision;

    if (classChanged || versionChanged || revisionChanged || historyIndex === -1) {
      lastClassIdRef.current = classTimetable?.classId;
      lastVersionIdRef.current = timetableVersion?._id;
      lastRevisionRef.current = timetableVersion?.revision;
      if (classTimetable?.slots) {
        setHistory([classTimetable.slots]);
        setHistoryIndex(0);
        actionHistoryRef.current = [];
        setSwapSourceSlot(null);
      }
    }
  }, [classTimetable?.classId, classTimetable?.slots, timetableVersion?._id, timetableVersion?.revision, historyIndex]);

  // Roll back internal state to authoritative class slots on save conflict or error
  useEffect(() => {
    if (saveStatus === 'error' || saveStatus === 'conflict') {
      if (classTimetable?.slots) {
        setHistory([classTimetable.slots]);
        setHistoryIndex(0);
        actionHistoryRef.current = [];
        setSwapSourceSlot(null);
      }
    }
  }, [saveStatus, classTimetable?.slots]);

  // Current active slots (authoritative classTimetable.slots takes priority when backend undo/redo is connected)
  const currentSlots = useMemo(() => {
    if (onUndo) {
      return classTimetable?.slots || [];
    }
    if (historyIndex >= 0 && history[historyIndex]) {
      return history[historyIndex];
    }
    return classTimetable?.slots || [];
  }, [classTimetable?.slots, history, historyIndex, onUndo]);

  // Build slot map: day -> period -> slot (inject classId for conflict checking)
  const slotMap = useMemo(() => {
    const map = {};
    for (const slot of currentSlots) {
      if (!map[slot.day]) map[slot.day] = {};
      map[slot.day][slot.period] = {
        ...slot,
        classId: classTimetable?.classId || slot.classId,
      };
    }
    return map;
  }, [currentSlots, classTimetable?.classId]);

  // Column definitions supporting Friday's different schedule
  const getDayColumns = useCallback((day) => {
    if (day === 'Friday') {
      return [1, 2, 3, 4, 'LUNCH_FRI', 5, 6];
    }
    return [1, 2, 3, 'LUNCH_MAIN', 4, 5, 6];
  }, []);

  // Identify the full lab group of the actively dragged slot (if activeSlot is a lab)
  const activeLabGroup = useMemo(() => {
    if (!activeSlot || !isLabSlot(activeSlot)) return null;
    return getLabBlock(currentSlots, activeSlot.day, activeSlot.period);
  }, [activeSlot, currentSlots]);

  // Handle Drag Start
  const handleDragStart = (event) => {
    const slot = event.active.data.current?.slot;
    if (slot) {
      setActiveSlot(slot);
      setHoveredLab(null); // Clear hover state on drag start to prevent layout mutations
      setSwapSourceSlot(null); // Clear click-to-swap selection on drag
    }
  };

  // Execute actual slot swap in state and notify parent
  const executeSwap = useCallback(async (sourceSlot, targetSlot) => {
    if (!sourceSlot || !targetSlot) return;

    if (sourceSlot.isBreak || targetSlot.isBreak) {
      toast.error('Cannot swap break slots');
      return;
    }

    if (sourceSlot.isLocked || targetSlot.isLocked) {
      toast.error('Cannot swap locked slots. Unlock them first.');
      return;
    }

    const srcDay = sourceSlot.day;
    const srcPeriod = sourceSlot.period;
    const dstDay = targetSlot.day;
    const dstPeriod = targetSlot.period;

    if (srcDay === dstDay && srcPeriod === dstPeriod) {
      return; // Same slot, no-op
    }

    // Deep clone array to guarantee immutability & React re-render
    const clonedSlots = JSON.parse(JSON.stringify(currentSlots));

    const group1 = getLabBlock(clonedSlots, srcDay, srcPeriod);
    const group2 = getLabBlock(clonedSlots, dstDay, dstPeriod);

    // 1. Both are labs (Lab-to-Lab swap)
    if (group1 && group2) {
      if (group1.duration !== group2.duration) {
        toast.error(`Cannot swap laboratory of ${group1.duration} periods with laboratory of ${group2.duration} periods. Durations must match.`);
        return;
      }

      if (group1.slots.some((s) => s.isLocked) || group2.slots.some((s) => s.isLocked)) {
        toast.error('Cannot swap: laboratory session contains locked slots');
        return;
      }

      for (let i = 0; i < group1.duration; i++) {
        const s1 = group1.slots[i];
        const s2 = group2.slots[i];
        const p1 = { ...s1 };
        const p2 = { ...s2 };
        delete p1.day; delete p1.period; delete p1._id;
        delete p2.day; delete p2.period; delete p2._id;

        const idxA = clonedSlots.findIndex((s) => s.day === s1.day && s.period === s1.period);
        const idxB = clonedSlots.findIndex((s) => s.day === s2.day && s.period === s2.period);

        if (idxA !== -1 && idxB !== -1) {
          clonedSlots[idxA] = { ...clonedSlots[idxA], ...p2, isLabBlock: true, labBlockIndex: i };
          clonedSlots[idxB] = { ...clonedSlots[idxB], ...p1, isLabBlock: true, labBlockIndex: i };
        }
      }

      setHistory((prev) => [...prev.slice(0, historyIndex + 1), clonedSlots]);
      setHistoryIndex((prev) => prev + 1);
      actionHistoryRef.current = [
        ...actionHistoryRef.current.slice(0, historyIndex),
        { sourceSlot, targetSlot },
      ];

      onSlotSwap?.(sourceSlot, targetSlot, clonedSlots);
      toast.success(`Laboratory sessions swapped atomically as complete ${group1.duration}-period blocks!`, { icon: '🧪' });
      return;
    }

    // 2. Exactly one is a lab (Lab-to-Block swap)
    if (group1 || group2) {
      const labGroup = group1 || group2;
      const isSrcLab = Boolean(group1);
      const destDay = isSrcLab ? dstDay : srcDay;
      const rawDestP = Number(isSrcLab ? dstPeriod : srcPeriod);
      const K = labGroup.duration;
      const destStartP = resolveLabStartPeriod(K, destDay, rawDestP);
      const destEndP = destStartP + K - 1;

      if (destEndP > 6) {
        toast.error(`Destination periods [P${destStartP}–P${destEndP}] exceed period 6`);
        return;
      }

      if (destDay !== 'Friday' && destStartP <= 3 && destEndP >= 4) {
        toast.error(`Laboratory session cannot cross lunch break between P3 and P4`);
        return;
      }

      if (destDay === 'Friday' && destStartP <= 4 && destEndP >= 5) {
        toast.error(`Laboratory session cannot cross Friday prayer/lunch interval`);
        return;
      }

      const isProj = ['CST416', 'CSD416'].includes(labGroup.subjectCode);
      if (destDay === 'Friday' && K >= 3 && !isProj) {
        toast.error(`3-period lab sessions cannot be scheduled on Friday (50-minute periods)`);
        return;
      }

      const destSlots = [];
      for (let p = destStartP; p <= destEndP; p++) {
        const ds = clonedSlots.find((s) => s.day === destDay && s.period === p);
        if (!ds) {
          toast.error(`Destination slot at ${destDay} P${p} not found`);
          return;
        }
        if (ds.isBreak || ds.isLocked) {
          toast.error(`Destination slot at ${destDay} P${p} is locked or a break`);
          return;
        }
        if (isLabSlot(ds)) {
          toast.error(`Destination block overlaps another laboratory session`);
          return;
        }
        destSlots.push(ds);
      }

      for (let i = 0; i < K; i++) {
        const srcS = labGroup.slots[i];
        const dstS = destSlots[i];

        const pSrc = { ...srcS };
        const pDst = { ...dstS };
        delete pSrc.day; delete pSrc.period; delete pSrc._id;
        delete pDst.day; delete pDst.period; delete pDst._id;

        const idxSrc = clonedSlots.findIndex((s) => s.day === srcS.day && s.period === srcS.period);
        const idxDst = clonedSlots.findIndex((s) => s.day === dstS.day && s.period === dstS.period);

        if (idxSrc !== -1 && idxDst !== -1) {
          clonedSlots[idxSrc] = { ...clonedSlots[idxSrc], ...pDst, isLabBlock: false, labBlockIndex: 0 };
          clonedSlots[idxDst] = { ...clonedSlots[idxDst], ...pSrc, isLabBlock: true, labBlockIndex: i };
        }
      }

      // Always send the lab slot as labRefSlot, and target destination starting slot as destRefSlot
      const labRefSlot = isSrcLab ? sourceSlot : { ...targetSlot, day: labGroup.day, period: labGroup.startPeriod };
      const destRefSlot = { day: destDay, period: destStartP };

      setHistory((prev) => [...prev.slice(0, historyIndex + 1), clonedSlots]);
      setHistoryIndex((prev) => prev + 1);
      actionHistoryRef.current = [
        ...actionHistoryRef.current.slice(0, historyIndex),
        { sourceSlot: labRefSlot, targetSlot: destRefSlot },
      ];

      onSlotSwap?.(labRefSlot, destRefSlot, clonedSlots);
      toast.success(`Laboratory session (${labGroup.subjectName}) moved atomically as complete ${K}-period group!`, { icon: '🧪' });
      return;
    }

    // 3. Normal single slot swap
    const originalSrc = clonedSlots.find((s) => s.day === srcDay && s.period === srcPeriod) || sourceSlot;
    const originalDst = clonedSlots.find((s) => s.day === dstDay && s.period === dstPeriod) || targetSlot;

    const capturedSrcContent = { ...originalSrc };
    delete capturedSrcContent.day;
    delete capturedSrcContent.period;

    const capturedDstContent = { ...originalDst };
    delete capturedDstContent.day;
    delete capturedDstContent.period;

    const updatedSlots = clonedSlots.map((s) => {
      if (s.day === srcDay && s.period === srcPeriod) {
        return { ...s, ...capturedDstContent, day: srcDay, period: srcPeriod };
      }
      if (s.day === dstDay && s.period === dstPeriod) {
        return { ...s, ...capturedSrcContent, day: dstDay, period: dstPeriod };
      }
      return s;
    });

    setHistory((prev) => [...prev.slice(0, historyIndex + 1), updatedSlots]);
    setHistoryIndex((prev) => prev + 1);
    actionHistoryRef.current = [
      ...actionHistoryRef.current.slice(0, historyIndex),
      { sourceSlot, targetSlot },
    ];

    onSlotSwap?.(sourceSlot, targetSlot, updatedSlots);
    toast.success('Period moved ↺ Undo available', { duration: 3000, icon: '🔄' });
  }, [currentSlots, history, historyIndex, onSlotSwap]);

  // Comprehensive conflict detection for single periods and multi-period lab blocks
  const checkComprehensiveConflict = useCallback(
    (sourceSlot, targetSlot) => {
      if (!sourceSlot || !targetSlot) return null;
      const tt = timetableVersion || { classTimetables: [classTimetable] };
      const cid = classTimetable?.classId;

      const g1 = getLabBlock(currentSlots, sourceSlot.day, sourceSlot.period);
      const g2 = getLabBlock(currentSlots, targetSlot.day, targetSlot.period);

      if (g1 && g2 && g1.duration === g2.duration) {
        for (let i = 0; i < g1.duration; i++) {
          const c = checkSlotConflict(tt, g1.slots[i], g2.slots[i], cid);
          if (c) return c;
        }
        return null;
      }

      if (g1 || g2) {
        const labGroup = g1 || g2;
        const isSrcLab = Boolean(g1);
        const destDay = isSrcLab ? targetSlot.day : sourceSlot.day;
        const rawDestP = Number(isSrcLab ? targetSlot.period : sourceSlot.period);
        const K = labGroup.duration;
        const destStartP = resolveLabStartPeriod(K, destDay, rawDestP);

        for (let i = 0; i < K; i++) {
          const labS = labGroup.slots[i];
          const destP = destStartP + i;
          const destS = currentSlots.find((s) => s.day === destDay && s.period === destP) || {
            day: destDay,
            period: destP,
            isEmpty: true,
          };
          const c = checkSlotConflict(tt, isSrcLab ? labS : destS, isSrcLab ? destS : labS, cid);
          if (c) return c;
        }
        return null;
      }

      return checkSlotConflict(tt, sourceSlot, targetSlot, cid);
    },
    [timetableVersion, classTimetable, currentSlots]
  );

  // Trigger modal when teacher conflict is detected
  const handleConflictDetected = useCallback(
    async (sourceSlot, targetSlot, conflict) => {
      setConflictModalState({
        isOpen: true,
        sourceSlot,
        targetSlot,
        conflict,
        rebalanceData: null,
        isSimulating: true,
        isApplying: false,
      });

      if (!timetableVersion?._id || !classTimetable?.classId) {
        setConflictModalState((prev) => ({
          ...prev,
          isSimulating: false,
          rebalanceData: { canRebalance: false, reason: 'Timetable version or class id unavailable' },
        }));
        return;
      }

      try {
        const res = await timetableService.previewRebalance(timetableVersion._id, {
          classId: classTimetable.classId,
          source: { day: sourceSlot.day, period: sourceSlot.period },
          target: { day: targetSlot.day, period: targetSlot.period },
        });
        const data = res.data || res;
        setConflictModalState((prev) => ({
          ...prev,
          isSimulating: false,
          rebalanceData: data,
        }));
      } catch (err) {
        setConflictModalState((prev) => ({
          ...prev,
          isSimulating: false,
          rebalanceData: {
            canRebalance: false,
            reason: err.response?.data?.message || err.message || 'No conflict-free arrangement exists.',
          },
        }));
      }
    },
    [timetableVersion?._id, classTimetable?.classId]
  );

  // Auto-Adjust action: apply conflict-free rebalance to database
  const handleApplyAutoAdjust = useCallback(async () => {
    const { sourceSlot, targetSlot, rebalanceData } = conflictModalState;
    if (!timetableVersion?._id || !classTimetable?.classId || !rebalanceData?.rebalancedGrid) return;

    setConflictModalState((prev) => ({ ...prev, isApplying: true }));

    try {
      const res = await timetableService.applyRebalance(timetableVersion._id, {
        classId: classTimetable.classId,
        source: { day: sourceSlot.day, period: sourceSlot.period },
        target: { day: targetSlot.day, period: targetSlot.period },
        rebalancedGrid: rebalanceData.rebalancedGrid,
      });

      const updatedTimetable = res.data?.timetable || res.timetable;
      if (updatedTimetable) {
        onVersionUpdate?.(updatedTimetable);
      }
      onRefresh?.();

      toast.success('Schedule auto-adjusted conflict-free and saved to database!', { icon: '✨' });
      setConflictModalState({
        isOpen: false,
        sourceSlot: null,
        targetSlot: null,
        conflict: null,
        rebalanceData: null,
        isSimulating: false,
        isApplying: false,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to apply auto-adjust');
      setConflictModalState((prev) => ({ ...prev, isApplying: false }));
    }
  }, [conflictModalState, timetableVersion?._id, classTimetable?.classId, onVersionUpdate, onRefresh]);

  // Force Swap action: swap with adminOverride
  const handleForceSwapWithConflict = useCallback(() => {
    const { sourceSlot, targetSlot } = conflictModalState;
    setConflictModalState({
      isOpen: false,
      sourceSlot: null,
      targetSlot: null,
      conflict: null,
      rebalanceData: null,
      isSimulating: false,
      isApplying: false,
    });
    if (sourceSlot && targetSlot) {
      executeSwap(sourceSlot, targetSlot);
      toast('Swapped with conflict (Admin override saved to database)', { icon: '⚠️' });
    }
  }, [conflictModalState, executeSwap]);

  // Cancel action: close modal cleanly
  const handleCancelConflict = useCallback(() => {
    setConflictModalState({
      isOpen: false,
      sourceSlot: null,
      targetSlot: null,
      conflict: null,
      rebalanceData: null,
      isSimulating: false,
      isApplying: false,
    });
    setSwapSourceSlot(null);
  }, []);

  // Handle Drag End
  const handleDragEnd = (event) => {
    setActiveSlot(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceSlot = active.data.current?.slot;
    const targetSlot = over.data.current?.slot;

    if (!sourceSlot || !targetSlot) return;

    // Check if source and target are periods of the same lab session
    const g1 = getLabBlock(currentSlots, sourceSlot.day, sourceSlot.period);
    const g2 = getLabBlock(currentSlots, targetSlot.day, targetSlot.period);
    if (g1 && g2 && g1.day === g2.day && g1.startPeriod === g2.startPeriod) {
      // User dropped onto another period of the same lab session -> no-op
      return;
    }

    // Pre-swap conflict check for other classes
    const conflict = checkComprehensiveConflict(sourceSlot, targetSlot);
    if (conflict) {
      handleConflictDetected(sourceSlot, targetSlot, conflict);
      return;
    }

    executeSwap(sourceSlot, targetSlot);
  };

  // Handle Click-to-Select and Click-to-Swap
  const handleCellClick = (slot) => {
    if (readonly || slot.isBreak || slot.isLocked) {
      onSlotClick?.(slot);
      return;
    }

    // If Click-to-Swap Mode is active or a source slot is already selected:
    if (isSwapMode || swapSourceSlot) {
      if (!swapSourceSlot) {
        // First click: select source slot
        if (slot.isEmpty) {
          toast('Select an occupied slot as source to swap', { icon: 'ℹ️' });
          return;
        }
        setSwapSourceSlot(slot);
        toast(`Selected ${slot.day} P${slot.period} (${slot.subjectName || slot.subjectCode}). Click destination slot to swap.`, { icon: '🎯' });
      } else {
        // Second click: if clicked same slot, deselect
        if (swapSourceSlot.day === slot.day && swapSourceSlot.period === slot.period) {
          setSwapSourceSlot(null);
          toast('Selection cancelled', { icon: '✕' });
          return;
        }

        // Check if both slots belong to the same laboratory session
        const gSrc = getLabBlock(currentSlots, swapSourceSlot.day, swapSourceSlot.period);
        const gDst = getLabBlock(currentSlots, slot.day, slot.period);
        if (gSrc && gDst && gSrc.day === gDst.day && gSrc.startPeriod === gDst.startPeriod) {
          setSwapSourceSlot(null);
          toast('Selection cancelled: both periods belong to the same laboratory session', { icon: 'ℹ️' });
          return;
        }

        // Execute swap between swapSourceSlot and clicked target slot
        const src = swapSourceSlot;
        setSwapSourceSlot(null);

        const conflict = checkComprehensiveConflict(src, slot);
        if (conflict) {
          handleConflictDetected(src, slot, conflict);
          return;
        }

        executeSwap(src, slot);
      }
      return;
    }

    // Default mode: trigger parent onSlotClick (e.g. view/edit slot details)
    onSlotClick?.(slot);
  };

  // Undo / Redo handlers
  const canUndo = canUndoProp !== undefined ? canUndoProp : historyIndex > 0;
  const canRedo = canRedoProp !== undefined ? canRedoProp : (historyIndex < history.length - 1 && historyIndex >= 0);

  const handleUndo = useCallback(() => {
    if (onUndo) {
      onUndo();
      return;
    }
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const lastAction = actionHistoryRef.current[prevIndex];
      setHistoryIndex(prevIndex);
      if (lastAction?.sourceSlot && lastAction?.targetSlot) {
        onSlotSwap?.(lastAction.targetSlot, lastAction.sourceSlot, history[prevIndex]);
      } else {
        onSlotSwap?.(null, null, history[prevIndex]);
      }
      toast('Undo applied and persisted', { icon: '↺' });
    }
  }, [onUndo, history, historyIndex, onSlotSwap]);

  const handleRedo = useCallback(() => {
    if (onRedo) {
      onRedo();
      return;
    }
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const redoAction = actionHistoryRef.current[historyIndex];
      setHistoryIndex(nextIndex);
      if (redoAction?.sourceSlot && redoAction?.targetSlot) {
        onSlotSwap?.(redoAction.sourceSlot, redoAction.targetSlot, history[nextIndex]);
      } else {
        onSlotSwap?.(null, null, history[nextIndex]);
      }
      toast('Redo applied and persisted', { icon: '↻' });
    }
  }, [onRedo, history, historyIndex, onSlotSwap]);

  // Keyboard Shortcuts (Ctrl+Z / Cmd+Z, Ctrl+Y, Ctrl+Shift+Z, Escape to cancel swap selection)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Do not intercept shortcuts when typing in inputs, textareas, or contentEditable elements
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) ||
        e.target?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (swapSourceSlot) {
          setSwapSourceSlot(null);
          toast('Swap selection cleared', { icon: '✕' });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          e.preventDefault();
          if (canRedo) handleRedo();
        } else {
          e.preventDefault();
          if (canUndo) handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        if (canRedo) handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, swapSourceSlot, canUndo, canRedo]);

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
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3 font-sans">
        {/* Diagnostic Highlight Banner */}
        {diagnosticHighlight && (
          <div className="flex items-center justify-between p-3.5 rounded-sm bg-rose-500/10 border border-rose-500/30 text-xs animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-600">
                    Diagnostic Focus: {diagnosticHighlight.title}
                  </span>
                  <span className="font-mono text-[10px] bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    {diagnosticHighlight.day} Period {diagnosticHighlight.period}
                  </span>
                </div>
                <p className="text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {diagnosticHighlight.explanation}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-4">
              {diagnosticHighlight.conflictingAssignment && onNavigateToClass && (
                <button
                  onClick={() =>
                    onNavigateToClass(
                      diagnosticHighlight.conflictingAssignment.classId,
                      diagnosticHighlight.conflictingAssignment.day,
                      diagnosticHighlight.conflictingAssignment.period
                    )
                  }
                  className="px-2.5 py-1 text-xs rounded-xs bg-[var(--bg-surface)] text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  <span>Switch to {diagnosticHighlight.conflictingAssignment.className}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
              {onClearDiagnosticHighlight && (
                <button
                  onClick={onClearDiagnosticHighlight}
                  className="p-1 hover:bg-rose-500/20 text-rose-600 rounded transition-colors cursor-pointer"
                  title="Dismiss highlight"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Toolbar Header Above Grid */}
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={cn(
                'px-2.5 py-1 text-xs font-sans rounded-xs border flex items-center gap-1 transition-colors cursor-pointer',
                canUndo
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
              disabled={!canRedo}
              className={cn(
                'px-2.5 py-1 text-xs font-sans rounded-xs border flex items-center gap-1 transition-colors cursor-pointer',
                canRedo
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]'
                  : 'bg-[var(--bg-surface-alt)] text-[var(--text-muted)] border-[var(--border)] opacity-50 cursor-not-allowed'
              )}
              title="Redo (Ctrl+Shift+Z)"
            >
              <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Redo</span>
            </button>

            {/* Click-to-Swap Mode Toggle */}
            {!readonly && (
              <button
                onClick={() => {
                  setIsSwapMode(!isSwapMode);
                  setSwapSourceSlot(null);
                }}
                className={cn(
                  'px-2.5 py-1 text-xs font-sans rounded-xs border flex items-center gap-1.5 transition-colors cursor-pointer ml-1',
                  isSwapMode
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]'
                )}
                title="Toggle Click-to-Swap Mode: Click 1st slot, then click 2nd slot to swap"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{isSwapMode ? 'Swap Mode ON' : 'Click-to-Swap'}</span>
              </button>
            )}
          </div>

          {/* Active Click-to-Swap Banner */}
          {swapSourceSlot && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xs text-xs text-amber-800 dark:text-amber-200 animate-fadeIn flex-wrap">
              <span className="font-semibold uppercase tracking-wider text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded">
                Source
              </span>
              <span className="font-medium">
                {swapSourceSlot.day} P{swapSourceSlot.period} ({swapSourceSlot.subjectName || swapSourceSlot.subjectCode})
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                ➔ Click any green cell to swap, or orange cell for auto-adjust
              </span>
              <button
                onClick={() => setSwapSourceSlot(null)}
                className="ml-2 px-1.5 py-0.5 text-[11px] bg-[var(--bg-surface)] hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 rounded border border-amber-300 dark:border-amber-700 cursor-pointer flex items-center gap-1 font-medium"
                title="Cancel selection (Esc)"
              >
                <X className="w-3 h-3" />
                <span>Cancel (Esc)</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-4">
            {!readonly && !swapSourceSlot && (
              <span className="text-[11px] font-sans text-[var(--text-muted)] hidden md:inline">
                💡 Drag any period cell, or enable Click-to-Swap
              </span>
            )}
            <SaveStatusIndicator status={saveStatus} onRetry={onRetrySave} onRefresh={onRefresh} />
          </div>
        </div>

        {/* Persistent, zero-layout-shift Context & Lab Info Bar - ALWAYS exactly 32px height */}
        <div className="h-8 px-3 rounded-xs flex items-center text-xs overflow-hidden border border-[var(--border)] transition-colors duration-150 bg-[var(--bg-surface-alt)]/60">
          {hoveredLab ? (
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 truncate">
              <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-semibold font-sans">
                Laboratory Block ({hoveredLab.duration} Periods):
              </span>
              <span className="font-serif">{hoveredLab.subjectName}</span>
              <span className="font-mono text-[10px] bg-indigo-500/20 px-1 py-0.5 rounded">
                ({hoveredLab.day} P{hoveredLab.startPeriod}–P{hoveredLab.endPeriod})
              </span>
              {hoveredLab.roomName && (
                <span className="text-[var(--text-muted)] font-sans">📍 {hoveredLab.roomName}</span>
              )}
              {hoveredLab.teacherNames?.length > 0 && (
                <span className="text-[var(--text-muted)] font-sans">👤 {hoveredLab.teacherNames.join(', ')}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between w-full text-[11px] text-[var(--text-muted)] font-sans">
              <span>💡 Hover any laboratory cell to inspect block details. Drag or click two slots to swap.</span>
              <span className="font-mono text-[10px] opacity-75">Atomic Multi-Period Swapping Active</span>
            </div>
          )}
        </div>

        {/* Timetable Table Grid */}
        <div className="overflow-x-auto border border-[var(--border)] rounded-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)]">
                <th className="border border-[var(--border)] px-3 py-2.5 text-left text-xs font-sans font-semibold text-[var(--text-primary)] min-w-[100px] w-28 sticky left-0 bg-[var(--bg-surface-alt)] z-20 uppercase tracking-wider shadow-sm">
                  Day
                </th>
                <th className="border border-[var(--border)] px-2 py-2 text-center font-sans font-semibold text-[var(--text-primary)] min-w-[105px] uppercase tracking-wider">
                  <div>P1</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono font-normal">09:00 - 10:00</div>
                </th>
                <th className="border border-[var(--border)] px-2 py-2 text-center font-sans font-semibold text-[var(--text-primary)] min-w-[105px] uppercase tracking-wider">
                  <div>P2</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono font-normal">10:00 - 11:00</div>
                </th>
                <th className="border border-[var(--border)] px-2 py-2 text-center font-sans font-semibold text-[var(--text-primary)] min-w-[110px] uppercase tracking-wider">
                  <div>P3</div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono font-normal leading-tight">11:20-12:20 <span className="text-[var(--accent)]">(Fri: 11:10)</span></div>
                </th>
                <th className="border border-[var(--border)] px-2 py-2 text-center font-sans font-semibold text-[var(--text-primary)] min-w-[115px] uppercase tracking-wider bg-[var(--bg-surface-alt)]/50">
                  <div className="text-[11px]">Lunch <span className="text-[var(--accent)] font-normal text-[10px]">/ Fri: P4</span></div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono font-normal leading-tight">12:20-13:10 <span className="text-[var(--accent)]">(Fri: 12:00-12:50)</span></div>
                </th>
                <th className="border border-[var(--border)] px-2 py-2 text-center font-sans font-semibold text-[var(--text-primary)] min-w-[120px] uppercase tracking-wider bg-[var(--bg-surface-alt)]/50">
                  <div className="text-[11px]">P4 <span className="text-[var(--accent)] font-semibold text-[10px]">/ Jum'ah Break</span></div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono font-normal leading-tight">13:10-14:10 <span className="text-[var(--accent)]">(Fri: 12:50-14:30)</span></div>
                </th>
                <th className="border border-[var(--border)] px-2 py-2 text-center font-sans font-semibold text-[var(--text-primary)] min-w-[105px] uppercase tracking-wider">
                  <div>P5</div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono font-normal leading-tight">14:10-15:10 <span className="text-[var(--accent)]">(Fri: 14:30)</span></div>
                </th>
                <th className="border border-[var(--border)] px-2 py-2 text-center font-sans font-semibold text-[var(--text-primary)] min-w-[105px] uppercase tracking-wider">
                  <div>P6</div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono font-normal leading-tight">15:20-16:20 <span className="text-[var(--accent)]">(Fri: 15:20)</span></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => {
                const cols = getDayColumns(day);
                return (
                  <tr key={day} className="border-b border-[var(--border)]">
                    <td className="border border-[var(--border)] px-3 py-2 font-sans font-semibold text-[var(--text-primary)] sticky left-0 bg-[var(--bg-surface)] z-20 text-xs min-w-[100px] w-28 shadow-sm">
                      <div className="flex flex-col">
                        <span className="hidden sm:inline">{day}</span>
                        <span className="sm:hidden">{dayShort(day)}</span>
                        {day === 'Friday' && (
                          <span className="text-[9px] text-[var(--accent)] font-mono font-normal mt-0.5">Pre-Lunch P4</span>
                        )}
                      </div>
                    </td>
                    {cols.map((colKey) => {
                      if (colKey === 'LUNCH_MAIN') {
                        return (
                          <td
                            key={`${day}-lunch`}
                            className="border border-[var(--border)] p-1 text-center bg-[var(--bg-surface-alt)] select-none min-w-[110px]"
                          >
                            <div className="flex flex-col items-center justify-center py-2">
                              <span className="text-[11px] font-sans font-medium text-[var(--text-muted)] italic">Lunch Break</span>
                              <span className="text-[10px] font-mono text-[var(--text-muted)] opacity-75">12:20 – 13:10</span>
                            </div>
                          </td>
                        );
                      }
                      if (colKey === 'LUNCH_FRI') {
                        return (
                          <td
                            key={`${day}-lunch`}
                            className="border border-[var(--border)] p-1 text-center bg-[var(--accent)]/5 border-dashed select-none min-w-[110px]"
                          >
                            <div className="flex flex-col items-center justify-center py-2">
                              <span className="text-[11px] font-sans font-semibold text-[var(--accent)] italic">Jum'ah & Lunch</span>
                              <span className="text-[10px] font-mono text-[var(--accent)] opacity-85">12:50 – 14:30</span>
                            </div>
                          </td>
                        );
                      }
                      const period = colKey;
                      const slot = slotMap[day]?.[period] || { day, period, isEmpty: true, classId: classTimetable?.classId };
                      const isHoveredLabSlot = Boolean(
                        hoveredLab &&
                        isLabSlot(slot) &&
                        hoveredLab.day === day &&
                        hoveredLab.periods.includes(period)
                      );
                      const isSelectedAsSwapSource = Boolean(
                        swapSourceSlot &&
                        swapSourceSlot.day === day &&
                        Number(swapSourceSlot.period) === Number(period)
                      );
                      const isSameLabAsActive = Boolean(
                        activeLabGroup &&
                        isLabSlot(slot) &&
                        activeLabGroup.day === day &&
                        activeLabGroup.periods.includes(period)
                      );

                      // Click-to-Swap Compatibility & Conflict Status Calculation
                      let isSwapCompatible = false;
                      let isSwapConflict = false;
                      let isSwapIncompatible = false;
                      let swapReason = '';

                      if (swapSourceSlot) {
                        if (isSelectedAsSwapSource) {
                          swapReason = 'Selected source period (click another period to swap, or Esc to cancel)';
                        } else if (slot.isBreak) {
                          isSwapIncompatible = true;
                          swapReason = 'Cannot swap break periods';
                        } else if (slot.isLocked) {
                          isSwapIncompatible = true;
                          swapReason = 'Slot is locked — unlock first to swap';
                        } else {
                          const gSrc = getLabBlock(currentSlots, swapSourceSlot.day, swapSourceSlot.period);
                          const gDst = getLabBlock(currentSlots, day, period);
                          if (gSrc && gDst && gSrc.day === gDst.day && gSrc.startPeriod === gDst.startPeriod) {
                            isSwapIncompatible = true;
                            swapReason = 'Belongs to the same laboratory session';
                          } else {
                            const conflict = checkComprehensiveConflict(swapSourceSlot, slot);
                            if (conflict) {
                              isSwapConflict = true;
                              swapReason = conflict.message || 'Scheduling conflict (Click for auto-adjust)';
                            } else {
                              isSwapCompatible = true;
                              swapReason = 'Compatible swap target — click to swap';
                            }
                          }
                        }
                      }

                      return (
                        <DraggableSlotCell
                          key={`${day}-${period}`}
                          slot={slot}
                          onClick={() => handleCellClick(slot)}
                          isSelected={isSelected(slot)}
                          isSwapSource={isSelectedAsSwapSource}
                          isSwapCompatible={isSwapCompatible}
                          isSwapConflict={isSwapConflict}
                          isSwapIncompatible={isSwapIncompatible}
                          swapReason={swapReason}
                          isDiagnosticFocus={Boolean(diagnosticHighlight && diagnosticHighlight.day === day && Number(diagnosticHighlight.period) === Number(period))}
                          showActions={showActions && !readonly}
                          readonly={readonly}
                          isLabGroupActive={isHoveredLabSlot}
                          isSameLabAsActive={isSameLabAsActive}
                          onMouseEnter={() => {
                            if (activeSlot) return; // Do not update hoveredLab while dragging!
                            if (isLabSlot(slot)) {
                              const block = getLabBlock(currentSlots, day, period);
                              if (block) setHoveredLab(block);
                            }
                          }}
                          onMouseLeave={() => {
                            if (activeSlot) return; // Do not update hoveredLab while dragging!
                            setHoveredLab(null);
                          }}
                          timetable={timetableVersion || { classTimetables: [classTimetable] }}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Drag Overlay Floating Card Preview (Static bounding box, zero jitter) */}
        <DragOverlay>
          {activeSlot ? (
            <div className="p-2.5 bg-[var(--bg-surface)] border-2 border-indigo-500 rounded-xs shadow-2xl opacity-95 text-xs pointer-events-none w-44">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold mb-0.5">
                {isLabSlot(activeSlot) ? <FlaskConical className="w-3.5 h-3.5" /> : null}
                <span className="text-[10px] uppercase font-bold tracking-wider">
                  {isLabSlot(activeSlot) ? 'Lab Group (Atomic)' : 'Period'}
                </span>
              </div>
              <p className="font-serif font-normal text-[var(--text-primary)] truncate">{activeSlot.subjectName}</p>
              <p className="font-mono text-[10px] text-[var(--accent)] font-semibold">{activeSlot.subjectCode}</p>
              <p className="font-sans text-[10px] text-[var(--text-secondary)] truncate">{activeSlot.teacherNames?.join(', ')}</p>
            </div>
          ) : null}
        </DragOverlay>

        {/* Grid Legend */}
        <TimetableLegend />

        {/* Lab Utilization Report */}
        <LabUtilizationReport
          timetableVersion={timetableVersion}
          classTimetables={[classTimetable]}
        />

        {/* Interactive Faculty Conflict & Auto-Adjust Modal */}
        <RebalanceModal
          isOpen={conflictModalState.isOpen}
          onClose={handleCancelConflict}
          conflict={conflictModalState.conflict}
          rebalanceData={conflictModalState.rebalanceData}
          isSimulating={conflictModalState.isSimulating}
          loading={conflictModalState.isApplying}
          onAutoAdjust={handleApplyAutoAdjust}
          onForceSwap={handleForceSwapWithConflict}
        />
      </div>
    </DndContext>
  );
};

export default TimetableGrid;
