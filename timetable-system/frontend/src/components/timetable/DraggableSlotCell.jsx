import { useDraggable, useDroppable } from '@dnd-kit/core';
import SlotCell from './SlotCell';

const DraggableSlotCell = ({
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
  readonly,
  isLabGroupActive,
  isSameLabAsActive,
  onMouseEnter,
  onMouseLeave,
}) => {
  const cellId = `cell-${slot.day}-${slot.period}`;
  const isTargetDisabled = readonly || slot.isBreak || slot.isLocked;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: cellId,
    data: { slot },
    disabled: isTargetDisabled || slot.isEmpty,
  });

  // CRITICAL FIX: Disable droppable on the cell currently being dragged
  // AND all sibling periods of the same active laboratory group
  // to completely eliminate self-drop collision oscillation (vibration/shaking)
  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({
    id: cellId,
    data: { slot },
    disabled: isTargetDisabled || isDragging || isSameLabAsActive,
  });

  const isOverTarget = isOver && !isDragging && !isSameLabAsActive;

  return (
    <SlotCell
      slot={slot}
      onClick={onClick}
      isSelected={isSelected}
      isSwapSource={isSwapSource}
      isSwapCompatible={isSwapCompatible}
      isSwapConflict={isSwapConflict}
      isSwapIncompatible={isSwapIncompatible}
      swapReason={swapReason}
      isDiagnosticFocus={isDiagnosticFocus}
      showActions={showActions}
      readonly={readonly}
      dragRef={setDragRef}
      dropRef={setDropRef}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
      isOver={isOverTarget}
      isLabGroupActive={isLabGroupActive}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
};

export default DraggableSlotCell;
