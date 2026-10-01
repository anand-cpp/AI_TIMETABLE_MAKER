import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { AlertTriangle, CheckCircle2, ShieldCheck, Info } from 'lucide-react';

const PublishConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  versionNumber = 1,
  qualityScore = 85,
  softViolationsCount = 34,
}) => {
  const [publishOption, setPublishOption] = useState('as_is');
  const [adminNotes, setAdminNotes] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handleConfirm = async () => {
    setPublishing(true);
    try {
      await onConfirm({ publishOption, adminNotes });
      onClose();
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚠ Publish Timetable Version with Warnings"
      size="md"
    >
      <div className="space-y-4 font-sans text-xs">
        {/* Header Alert Card */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-[var(--text-primary)]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-1">
                Version {versionNumber} (Quality Score: {qualityScore}/100)
              </h4>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                This version has <span className="font-bold text-amber-500">{softViolationsCount} soft warnings</span> (optimization preferences/teacher gaps). There are <span className="font-bold text-emerald-500">0 hard conflicts</span> and <span className="font-bold text-emerald-500">0 unplaced subjects</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Soft Warning Categorization Breakdown */}
        <div className="p-3.5 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-md space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            <Info className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.5} />
            <span>Optimization Summary</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-[var(--text-primary)]">
            <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Hard Conflicts:</span>
              <span className="font-bold text-emerald-500">0 (PASSED)</span>
            </div>
            <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Subject Placement:</span>
              <span className="font-bold text-emerald-500">100% (PASSED)</span>
            </div>
            <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Grid Utilization:</span>
              <span className="font-bold text-emerald-500">100% (PASSED)</span>
            </div>
            <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Soft Warnings:</span>
              <span className="font-bold text-amber-500">{softViolationsCount} (OPTIMIZATION)</span>
            </div>
          </div>
        </div>

        {/* Publishing Options Selection */}
        <div className="space-y-2">
          <label className="font-semibold text-[var(--text-primary)] uppercase text-[10px] tracking-wider">
            Select Publishing Action:
          </label>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2.5 p-2.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] cursor-pointer">
              <input
                type="radio"
                name="publish_opt"
                value="as_is"
                checked={publishOption === 'as_is'}
                onChange={() => setPublishOption('as_is')}
                className="accent-[var(--accent)]"
              />
              <span className="text-[var(--text-primary)] font-medium">Publish as-is (Accept current quality & schedule)</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] cursor-pointer">
              <input
                type="radio"
                name="publish_opt"
                value="hod_review"
                checked={publishOption === 'hod_review'}
                onChange={() => setPublishOption('hod_review')}
                className="accent-[var(--accent)]"
              />
              <span className="text-[var(--text-primary)] font-medium">Publish + notify department HODs for review</span>
            </label>
          </div>
        </div>

        {/* Admin Notes Input */}
        <div className="space-y-1">
          <label className="font-semibold text-[var(--text-primary)] uppercase text-[10px] tracking-wider">
            Admin Publishing Notes (Optional):
          </label>
          <input
            type="text"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="e.g. Approved for Week 1 draft after faculty review..."
            className="w-full bg-[var(--bg-surface)] text-[var(--text-primary)] px-3 py-2 border border-[var(--border)] rounded-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={publishing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={publishing}
            leftIcon={<ShieldCheck className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />}
          >
            ✓ Publish Anyway
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PublishConfirmationModal;
