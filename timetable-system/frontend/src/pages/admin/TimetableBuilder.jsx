import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Tabs from '../../components/ui/Tabs';
import TimetableGrid from '../../components/timetable/TimetableGrid';
import EditSlotModal from '../../components/timetable/EditSlotModal';
import VersionHistory from '../../components/timetable/VersionHistory';
import GeneratePanel from '../../components/timetable/GeneratePanel';
import QualityScoreCard from '../../components/timetable/QualityScoreCard';
import timetableService from '../../services/timetableService';
import classService from '../../services/classService';
import {
  Download,
  FileSpreadsheet,
  Eye,
  RefreshCw,
} from 'lucide-react';

const TimetableBuilder = () => {
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [activeVersion, setActiveVersion] = useState(null);
  const [activeVersionLoading, setActiveVersionLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lastGenerateResult, setLastGenerateResult] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');

  // Load versions list
  const loadVersions = useCallback(async () => {
    try {
      setVersionsLoading(true);
      const res = await timetableService.getVersions();
      setVersions(res.data.versions || []);
    } catch {
      toast.error('Failed to load timetable versions');
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  // Load full version data with localStorage fallback
  const loadVersion = useCallback(async (id) => {
    try {
      setActiveVersionLoading(true);
      setSaveStatus('saved');
      const res = await timetableService.getVersion(id);
      setActiveVersion(res.data.timetable);
      try {
        localStorage.setItem(`timetable-cache-${id}`, JSON.stringify(res.data.timetable));
        localStorage.setItem('latest-timetable-cache', JSON.stringify(res.data.timetable));
      } catch {}
      const firstClass = res.data.timetable?.classTimetables?.[0];
      if (firstClass && !selectedClassId) {
        setSelectedClassId(firstClass.classId.toString());
      }
    } catch {
      const cached = localStorage.getItem(`timetable-cache-${id}`) || localStorage.getItem('latest-timetable-cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setActiveVersion(parsed);
          setSaveStatus('offline');
          toast.success('Loaded timetable from local cache fallback');
        } catch {
          toast.error('Failed to load timetable version');
        }
      } else {
        toast.error('Failed to load timetable version');
      }
    } finally {
      setActiveVersionLoading(false);
    }
  }, [selectedClassId]);

  // Load classes for dropdown
  const loadClasses = useCallback(async () => {
    try {
      const res = await classService.getAll();
      setClasses(res.data.classes || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadVersions();
    loadClasses();
  }, []);

  // Generate
  const handleGenerate = async (options) => {
    try {
      setGenerating(true);
      setSaveStatus('saving');
      const res = await timetableService.generate(options);
      setLastGenerateResult(res.data.timetable);
      toast.success(`Timetable generated! Score: ${res.data.timetable?.qualityScore?.overall || 0}/100`);
      try {
        localStorage.setItem(`timetable-cache-${res.data.timetable._id}`, JSON.stringify(res.data.timetable));
        localStorage.setItem('latest-timetable-cache', JSON.stringify(res.data.timetable));
      } catch {}
      setSaveStatus('saved');
      await loadVersions();
      if (res.data.timetable?._id) {
        await loadVersion(res.data.timetable._id);
      }
    } catch (err) {
      setSaveStatus('error');
      const msg = err.response?.data?.message || 'Generation failed';
      const feasErrors = err.response?.data?.feasibilityErrors;
      if (feasErrors?.length) {
        toast.error(`Feasibility failed: ${feasErrors[0]}`);
      } else {
        toast.error(msg);
      }
      setLastGenerateResult(null);
    } finally {
      setGenerating(false);
    }
  };

  // Accept / unaccept
  const handleAccept = async (versionId) => {
    try {
      const version = versions.find((v) => v._id === versionId);
      if (version?.isAccepted) {
        await timetableService.unacceptVersion(versionId);
        toast.success('Timetable unpublished');
      } else {
        await timetableService.acceptVersion(versionId);
        toast.success('Timetable published as official!');
      }
      await loadVersions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  // Delete version
  const handleDeleteVersion = async () => {
    try {
      setDeleteLoading(true);
      await timetableService.deleteVersion(deleteTarget._id);
      toast.success('Version deleted');
      setDeleteTarget(null);
      if (activeVersion?._id === deleteTarget._id) {
        setActiveVersion(null);
      }
      await loadVersions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete version');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Slot click
  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setEditModalOpen(true);
  };

  // Handle Drag-and-Drop Slot Swap & Persistence
  const handleSlotSwap = async (sourceSlot, targetSlot, updatedSlots) => {
    if (!activeVersion?._id || !selectedClassId) return;

    // Optimistically update local activeVersion state
    setActiveVersion((prev) => {
      if (!prev) return prev;
      const updatedClassTimetables = prev.classTimetables.map((ct) => {
        if (ct.classId?.toString() === selectedClassId) {
          return { ...ct, slots: updatedSlots };
        }
        return ct;
      });
      const updatedObj = { ...prev, classTimetables: updatedClassTimetables };
      try {
        localStorage.setItem(`timetable-cache-${prev._id}`, JSON.stringify(updatedObj));
        localStorage.setItem('latest-timetable-cache', JSON.stringify(updatedObj));
      } catch {}
      return updatedObj;
    });

    if (sourceSlot && targetSlot) {
      try {
        setSaveStatus('saving');
        await timetableService.swapSlots(activeVersion._id, {
          classId: selectedClassId,
          slot1: { day: sourceSlot.day, period: sourceSlot.period },
          slot2: { day: targetSlot.day, period: targetSlot.period },
        });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Swap save error:', err);
        if (!navigator.onLine) {
          setSaveStatus('offline');
        } else {
          setSaveStatus('error');
        }
      }
    }
  };

  // After edit modal update
  const handleSlotUpdated = async () => {
    if (activeVersion?._id) {
      await loadVersion(activeVersion._id);
    }
  };

  // Current class timetable
  const currentClassTimetable = activeVersion?.classTimetables?.find(
    (ct) => ct.classId?.toString() === selectedClassId
  );

  const classOptions = activeVersion?.classTimetables?.map((ct) => ({
    value: ct.classId?.toString(),
    label: ct.className,
  })) || classes.map((c) => ({
    value: c._id,
    label: `${c.departmentId?.code || ''} S${c.semester}${c.section}`,
  }));

  return (
    <div className="space-y-6 font-sans">
      <Breadcrumb items={[{ label: 'Create Timetable', to: '/admin/timetable' }, { label: 'Quick Timetable' }]} />

      <PageHeader
        title="Quick Timetable Builder"
        description="Generate, review, drag-and-drop shuffle, and publish timetables"
        action={
          activeVersion?.isAccepted && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => timetableService.downloadAllClassesPdf()}
                leftIcon={<Download className="w-4 h-4" strokeWidth={1.5} />}
              >
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => timetableService.downloadAllClassesExcel()}
                leftIcon={<FileSpreadsheet className="w-4 h-4" strokeWidth={1.5} />}
              >
                Excel
              </Button>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left sidebar */}
        <div className="xl:col-span-1 space-y-4">
          <GeneratePanel
            onGenerate={handleGenerate}
            generating={generating}
            lastResult={lastGenerateResult}
          />

          {activeVersion && (
            <QualityScoreCard qualityScore={activeVersion.qualityScore} />
          )}

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 rounded-md">
            <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-[var(--text-label)] mb-3">
              Version History
            </h3>
            <VersionHistory
              versions={versions}
              loading={versionsLoading}
              activeVersionId={activeVersion?._id}
              onSelect={(id) => loadVersion(id)}
              onAccept={handleAccept}
              onDelete={setDeleteTarget}
            />
          </div>
        </div>

        {/* Main timetable area */}
        <div className="xl:col-span-3 space-y-4">
          {!activeVersion && !activeVersionLoading && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-12 text-center rounded-md">
              <Eye className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" strokeWidth={1.5} />
              <h3 className="text-lg font-serif font-normal text-[var(--text-primary)] mb-2">
                No timetable selected
              </h3>
              <p className="text-xs font-sans text-[var(--text-secondary)] mb-6">
                Generate a new timetable or select a version from the history
              </p>
              {versions.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => loadVersion(versions[0]._id)}
                  leftIcon={<Eye className="w-4 h-4" strokeWidth={1.5} />}
                >
                  View Latest Version
                </Button>
              )}
            </div>
          )}

          {activeVersionLoading && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-12 flex items-center justify-center rounded-md">
              <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-3 text-xs font-sans text-[var(--text-secondary)]">Loading timetable...</p>
              </div>
            </div>
          )}

          {activeVersion && !activeVersionLoading && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md overflow-hidden p-6 space-y-4">
              {/* Class selector + actions */}
              <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-serif font-normal text-[var(--text-primary)]">
                    {activeVersion.label || `Version ${activeVersion.version}`}
                  </span>
                  {activeVersion.isAccepted && (
                    <span className="px-2.5 py-0.5 text-[10px] bg-[var(--accent-soft)] text-[var(--accent)] rounded-xs font-sans font-semibold uppercase tracking-wider">
                      Published
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {classOptions.length > 0 && (
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="text-xs font-sans border border-[var(--border)] bg-transparent text-[var(--text-primary)] rounded-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                    >
                      <option value="" className="bg-[var(--bg-surface)]">Select class...</option>
                      {classOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[var(--bg-surface)]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedClassId && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => timetableService.downloadClassPdf(selectedClassId)}
                        leftIcon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      >
                        PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => timetableService.downloadClassExcel(selectedClassId)}
                        leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      >
                        Excel
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {activeVersion.warnings?.length > 0 && (
                <div className="px-4 py-3 bg-[var(--accent-soft)] border border-[var(--border)] rounded-sm">
                  <p className="text-xs font-sans font-semibold text-[var(--text-primary)] mb-1">
                    ⚠ {activeVersion.warnings.length} Warning(s)
                  </p>
                  {activeVersion.warnings.slice(0, 2).map((w, i) => (
                    <p key={i} className="text-xs font-sans text-[var(--text-secondary)]">• {w}</p>
                  ))}
                </div>
              )}

              {/* Interactive Grid with DND & Persistence */}
              {currentClassTimetable ? (
                <TimetableGrid
                  classTimetable={currentClassTimetable}
                  timetableVersion={activeVersion}
                  onSlotClick={handleSlotClick}
                  onSlotSwap={handleSlotSwap}
                  selectedSlot={selectedSlot}
                  saveStatus={saveStatus}
                  onRetrySave={() => handleSlotSwap(null, null, currentClassTimetable?.slots)}
                  showActions
                />
              ) : (
                <div className="p-8 text-center text-[var(--text-muted)] text-xs font-sans">
                  {selectedClassId
                    ? 'No timetable data for this class'
                    : 'Select a class to view its timetable'}
                </div>
              )}

              {/* Unplaced subjects */}
              {activeVersion.unplacedSubjects?.length > 0 && (
                <div className="p-4 border border-[var(--error)]/30 bg-[var(--error)]/10 rounded-sm">
                  <p className="text-xs font-sans font-bold text-[var(--error)] mb-2">
                    ✗ {activeVersion.unplacedSubjects.length} Subject(s) Could Not Be Placed
                  </p>
                  <div className="space-y-1">
                    {activeVersion.unplacedSubjects.map((s, i) => (
                      <p key={i} className="text-xs font-sans text-[var(--error)]">
                        • <strong>{s.subjectName}</strong>: {s.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Slot Modal */}
      <EditSlotModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedSlot(null);
        }}
        slot={selectedSlot}
        timetableId={activeVersion?._id}
        classId={selectedClassId}
        onUpdate={handleSlotUpdated}
      />

      {/* Delete Version Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteVersion}
        loading={deleteLoading}
        title="Delete Version"
        message={`Delete "${deleteTarget?.label || `Version ${deleteTarget?.version}`}"? This cannot be undone.`}
        confirmText="Delete Version"
        variant="danger"
      />
    </div>
  );
};

export default TimetableBuilder;