import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { cn } from '../../utils/cn';
import timetableService from '../../services/timetableService';
import toast from 'react-hot-toast';
import {
  Lock,
  Unlock,
  Trash2,
  ArrowLeftRight,
  Info,
} from 'lucide-react';

const EditSlotModal = ({
  isOpen,
  onClose,
  slot,
  timetableId,
  classId,
  onUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState(null);

  if (!slot) return null;

  const isEmpty = slot.isEmpty;
  const isLocked = slot.isLocked;
  const isBreak = slot.isBreak;

  const handleClear = async () => {
    try {
      setLoading(true);
      await timetableService.clearSlot(timetableId, {
        classId,
        day: slot.day,
        period: slot.period,
      });
      toast.success('Slot cleared');
      onUpdate?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clear slot');
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    try {
      setLoading(true);
      await timetableService.lockSlot(timetableId, {
        classId,
        day: slot.day,
        period: slot.period,
      });
      toast.success('Slot locked — will not be moved during regeneration');
      onUpdate?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to lock slot');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    try {
      setLoading(true);
      await timetableService.unlockSlot(timetableId, {
        classId,
        day: slot.day,
        period: slot.period,
      });
      toast.success('Slot unlocked');
      onUpdate?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unlock slot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Slot"
      size="sm"
    >
      <div className="space-y-4">
        {/* Slot info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {slot.day} · Period {slot.period}
            </p>
            <div className="flex gap-1">
              {isLocked && <Badge variant="warning" size="sm">Locked</Badge>}
              {slot.subjectType && slot.subjectType !== 'empty' && (
                <Badge
                  variant={
                    slot.subjectType === 'lab' ? 'info' :
                    slot.subjectType === 'elective' ? 'success' : 'default'
                  }
                  size="sm"
                >
                  {slot.subjectType}
                </Badge>
              )}
            </div>
          </div>

          {isEmpty || !slot.subjectName ? (
            <p className="text-sm font-semibold text-slate-400 italic">Empty slot</p>
          ) : (
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {slot.subjectName}
              </p>
              {slot.subjectCode && (
                <p className="text-xs font-mono text-slate-500 dark:text-slate-300 font-bold">{slot.subjectCode}</p>
              )}
              {slot.teacherNames?.length > 0 && (
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
                  👤 {slot.teacherNames.join(', ')}
                </p>
              )}
              {slot.roomName && (
                <p className="text-sm font-medium text-slate-500 dark:text-slate-300 mt-0.5">📍 {slot.roomName}</p>
              )}
            </div>
          )}
        </div>

        {isBreak && (
          <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <Info className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Break periods cannot be edited</p>
          </div>
        )}

        {!isBreak && (
          <div className="space-y-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Actions
            </p>

            {/* Lock / Unlock */}
            {!isEmpty && (
              <Button
                fullWidth
                variant="outline"
                onClick={isLocked ? handleUnlock : handleLock}
                loading={loading}
                leftIcon={isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              >
                {isLocked ? 'Unlock Slot' : 'Lock Slot (prevent regeneration overwrite)'}
              </Button>
            )}

            {/* Clear */}
            {!isEmpty && !isLocked && (
              <Button
                fullWidth
                variant="outline"
                onClick={handleClear}
                loading={loading}
                className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Clear Slot
              </Button>
            )}

            {isLocked && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  This slot is locked. Unlock it first to clear or swap it.
                  Locked slots are preserved during timetable regeneration.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditSlotModal;