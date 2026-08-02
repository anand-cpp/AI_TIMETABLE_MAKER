import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
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
import { cn } from '../../utils/cn';

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

  // Load full version data
  const loadVersion = useCallback(async (id) => {
    try {
      setActiveVersionLoading(true);
      const res = await timetableService.getVersion(id);
      setActiveVersion(res.data.timetable);
      // Auto-select first class
      const firstClass = res.data.timetable?.classTimetables?.[0];
      if (firstClass && !selectedClassId) {
        setSelectedClassId(firstClass.classId.toString());
      }
    } catch {
      toast.error('Failed to load timetable version');
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
      const res = await timetableService.generate(options);
      setLastGenerateResult(res.data.timetable);
      toast.success(`Timetable generated! Score: ${res.data.timetable?.qualityScore?.overall || 0}/100`);
      await loadVersions();
      // Auto-load newly generated version
      if (res.data.timetable?._id) {
        await loadVersion(res.data.timetable._id);
      }
    } catch (err) {
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

  // After edit
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
    <div>
      <PageHeader
        title="Timetable Builder"
        description="Generate, review, edit and publish timetables"
        action={
          activeVersion?.isAccepted && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => timetableService.downloadAllClassesPdf()}
                leftIcon={<Download className="w-4 h-4" />}
              >
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => timetableService.downloadAllClassesExcel()}
                leftIcon={<FileSpreadsheet className="w-4 h-4" />}
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

          <div className="glass-panel p-5 rounded-3xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
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
        <div className="xl:col-span-3">
          {!activeVersion && !activeVersionLoading && (
            <div className="glass-panel p-12 text-center rounded-3xl">
              <Eye className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                No timetable selected
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                Generate a new timetable or select a version from the history
              </p>
              {versions.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => loadVersion(versions[0]._id)}
                  leftIcon={<Eye className="w-4 h-4" />}
                >
                  View Latest Version
                </Button>
              )}
            </div>
          )}

          {activeVersionLoading && (
            <div className="glass-panel p-12 flex items-center justify-center rounded-3xl">
              <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">Loading timetable...</p>
              </div>
            </div>
          )}

          {activeVersion && !activeVersionLoading && (
            <div className="glass-panel p-0 rounded-3xl overflow-hidden shadow-xl">
              {/* Class selector + actions */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeVersion.label || `Version ${activeVersion.version}`}
                  </span>
                  {activeVersion.isAccepted && (
                    <span className="px-2.5 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full font-black">
                      Published
                    </span>
                  )}
                </div>

                <div className="ml-auto flex items-center gap-3">
                  {classOptions.length > 0 && (
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="text-xs font-bold border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                    >
                      <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Select class...</option>
                      {classOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
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
                        leftIcon={<Download className="w-3.5 h-3.5" />}
                      >
                        PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => timetableService.downloadClassExcel(selectedClassId)}
                        leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                      >
                        Excel
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {activeVersion.warnings?.length > 0 && (
                <div className="px-6 py-3 bg-amber-50/80 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50">
                  <p className="text-xs font-black text-amber-900 dark:text-amber-200 mb-1">
                    ⚠ {activeVersion.warnings.length} Warning(s)
                  </p>
                  {activeVersion.warnings.slice(0, 2).map((w, i) => (
                    <p key={i} className="text-xs font-medium text-amber-800 dark:text-amber-300">• {w}</p>
                  ))}
                </div>
              )}

              {/* Grid */}
              {currentClassTimetable ? (
                <TimetableGrid
                  classTimetable={currentClassTimetable}
                  onSlotClick={handleSlotClick}
                  selectedSlot={selectedSlot}
                  showActions
                />
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm font-semibold">
                  {selectedClassId
                    ? 'No timetable data for this class'
                    : 'Select a class to view its timetable'}
                </div>
              )}

              {/* Unplaced subjects */}
              {activeVersion.unplacedSubjects?.length > 0 && (
                <div className="px-6 py-4 border-t border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/40">
                  <p className="text-xs font-black text-rose-900 dark:text-rose-200 mb-2">
                    ✗ {activeVersion.unplacedSubjects.length} Subject(s) Could Not Be Placed
                  </p>
                  <div className="space-y-1">
                    {activeVersion.unplacedSubjects.map((s, i) => (
                      <p key={i} className="text-xs font-medium text-rose-800 dark:text-rose-300">
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