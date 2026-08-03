import { useDraggable, useDroppable } from '@dnd-kit/core';
import SlotCell from './SlotCell';

const DraggableSlotCell = ({
  slot,
  onClick,
  isSelected,
  showActions,
  readonly,
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

  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({
    id: cellId,
    data: { slot },
    disabled: isTargetDisabled,
  });

  const isOverTarget = isOver && !isDragging;

  return (
    <SlotCell
      slot={slot}
      onClick={onClick}
      isSelected={isSelected}
      showActions={showActions}
      readonly={readonly}
      dragRef={setDragRef}
      dropRef={setDropRef}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
      isOver={isOverTarget}
    />
  );
};

export default DraggableSlotCell;
