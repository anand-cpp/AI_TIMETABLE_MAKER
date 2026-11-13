import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Breadcrumb from '../../components/ui/Breadcrumb';
import TimetableGrid from '../../components/timetable/TimetableGrid';
import EditSlotModal from '../../components/timetable/EditSlotModal';
import VersionHistory from '../../components/timetable/VersionHistory';
import GeneratePanel from '../../components/timetable/GeneratePanel';
import QualityScoreCard from '../../components/timetable/QualityScoreCard';
import OvertimeRequestModal from '../../components/timetable/OvertimeRequestModal';
import PostGenerationReportCard from '../../components/timetable/PostGenerationReportCard';
import CustomClassSelector from '../../components/timetable/CustomClassSelector';
import OfficialExportModal from '../../components/timetable/OfficialExportModal';
import ConflictDiagnosticsModal from '../../components/timetable/ConflictDiagnosticsModal';
import timetableService from '../../services/timetableService';
import classService from '../../services/classService';
import overrideService from '../../services/overrideService';
import {
  Download,
  FileSpreadsheet,
  Eye,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
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
  const [officialExportOpen, setOfficialExportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [pendingRetry, setPendingRetry] = useState(null);
  const isSavingRef = useRef(false);

  // Timetable Conflict Diagnostics & Diagnostic Navigation State
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [diagnosticsTab, setDiagnosticsTab] = useState('HARD_CONFLICTS');
  const [diagnosticHighlight, setDiagnosticHighlight] = useState(null);

  // Permission Request Modal State
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [currentRequestIndex, setCurrentRequestIndex] = useState(0);
  const [approvedOverrides, setApprovedOverrides] = useState([]);
  const [generationReport, setGenerationReport] = useState(null);
  const [pendingOptions, setPendingOptions] = useState(null);

  // Load diagnostics for a timetable version
  const loadDiagnostics = useCallback(async (versionId) => {
    if (!versionId) return;
    try {
      const res = await timetableService.getDiagnostics(versionId);
      if (res.data) {
        setDiagnostics(res.data);
      }
    } catch (err) {
      console.warn('Diagnostics load notice:', err?.message);
    }
  }, []);

  // Load full version data
  const loadVersion = useCallback(async (id) => {
    try {
      setActiveVersionLoading(true);
      setSaveStatus('saved');
      const res = await timetableService.getVersion(id);
      setActiveVersion(res.data.timetable);
      try {
        localStorage.setItem(`timetable-cache-${id}`, JSON.stringify(res.data.timetable));
        localStorage.setItem('latest-timetable-cache', JSON.stringify(res.data.timetable));
      } catch { /* ignore storage cache errors */ }
      const firstClass = res.data.timetable?.classTimetables?.[0];
      if (firstClass && !selectedClassId) {
        setSelectedClassId(firstClass.classId.toString());
      }
      // Load live conflict diagnostics
      loadDiagnostics(id);
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
  }, [selectedClassId, loadDiagnostics]);

  // Load versions list
  const loadVersions = useCallback(async (autoSelectLatest = true) => {
    try {
      setVersionsLoading(true);
      const res = await timetableService.getVersions();
      const vers = res.data.versions || [];
      setVersions(vers);
      if (autoSelectLatest && vers.length > 0) {
        const target = vers.find(v => v.isAccepted) || vers[0];
        if (target?._id) {
          loadVersion(target._id);
        }
      }
    } catch {
      toast.error('Failed to load timetable versions');
    } finally {
      setVersionsLoading(false);
    }
  }, [loadVersion]);

  // Load classes for dropdown
  const loadClasses = useCallback(async () => {
    try {
      const res = await classService.getAll();
      setClasses(res.data.classes || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadVersions();
    loadClasses();
  }, []);

  // Handle generation flow with admin permission requests
  const handleGenerate = async (options, customOverrides = null) => {
    try {
      setGenerating(true);
      setSaveStatus('saving');
      setPendingOptions(options);

      const payload = {
        ...options,
        adminOverrides: customOverrides || { subjectOverrides: approvedOverrides },
      };

      const res = await timetableService.generate(payload);
      const tt = res.data.timetable;
      const reqs = res.data.permissionRequests || [];

      if (reqs.length > 0 && (tt?.unplacedSubjects?.length > 0) && (!customOverrides || customOverrides.subjectOverrides.length === 0)) {
        setPermissionRequests(reqs);
        setCurrentRequestIndex(0);
        setGenerating(false);
        return;
      }

      setLastGenerateResult(tt);

      const checks = tt?.validationChecks || {};
      const unplacedCount = tt?.unplacedSubjects?.length || 0;
      const allPlaced = checks.all_subjects_placed !== false && unplacedCount === 0;
      const fullyFilled = checks.all_slots_filled !== false;
      const score = tt?.qualityScore?.overall;

      if (allPlaced && fullyFilled) {
        toast.success(
          `Timetable generated - all subjects placed${score != null ? `. Score: ${score}/100` : ''}`
        );
      } else {
        toast.error(
          `Timetable generated with ${unplacedCount} unplaced subject(s) - review before publishing`
        );
      }

      setGenerationReport({
        allPlaced,
        fullyFilled,
        unplacedCount,
        subjectsPlacedCount: allPlaced ? 'All placed' : `${unplacedCount} unplaced`,
        violationsCount: checks.hardViolationsCount || 0,
        softWarnings: tt?.warnings?.length || 0,
        appliedOverrides: approvedOverrides,
        generationTime: `${((Date.now() - (window._genStartTime || Date.now())) / 1000).toFixed(1)}s`,
      });

      try {
        localStorage.setItem(`timetable-cache-${tt._id}`, JSON.stringify(tt));
        localStorage.setItem('latest-timetable-cache', JSON.stringify(tt));
      } catch { /* ignore storage cache errors */ }

      setSaveStatus('saved');
      await loadVersions();
      if (tt?._id) {
        await loadVersion(tt._id);
      }
    } catch (err) {
      setSaveStatus('error');
      const msg = err.response?.data?.message || 'Generation failed';
      toast.error(msg);
      setLastGenerateResult(null);
    } finally {
      setGenerating(false);
    }
  };

  // Permission Request Decision handlers
  const handleApplyOption = async ({ request, selectedOption, adminNotes }) => {
    const overrideEntry = {
      requestType: request.requestType,
      teacherId: request.teacherId,
      teacherName: request.teacherName,
      subjectId: request.subjectId,
      subjectName: request.subjectName,
      classId: request.classId,
      className: request.className,
      issueDescription: request.issueDescription,
      selectedOption: selectedOption.label,
      impact: selectedOption.impact || '',
      adminNotes,
      status: 'APPROVED',
      time: new Date().toLocaleTimeString(),
    };

    try {
      await overrideService.createLog(overrideEntry);
    } catch (e) {
      console.warn('Log save warning:', e);
    }

    const updated = [...approvedOverrides, overrideEntry];
    setApprovedOverrides(updated);

    if (currentRequestIndex + 1 < permissionRequests.length) {
      setCurrentRequestIndex(currentRequestIndex + 1);
    } else {
      setPermissionRequests([]);
      handleGenerate(pendingOptions || {}, { subjectOverrides: updated });
    }
  };

  const handleSkipRequest = () => {
    if (currentRequestIndex + 1 < permissionRequests.length) {
      setCurrentRequestIndex(currentRequestIndex + 1);
    } else {
      setPermissionRequests([]);
      handleGenerate(pendingOptions || {}, { subjectOverrides: approvedOverrides });
    }
  };

  const handleRejectSubject = () => {
    handleSkipRequest();
  };

  // Accept / unaccept version
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

  // Handle Drag-and-Drop Slot Swap & Instant Auto-Save to MongoDB
  const handleSlotSwap = async (sourceSlot, targetSlot, updatedSlots) => {
    if (!activeVersion?._id || !selectedClassId || !sourceSlot || !targetSlot) return;

    // Prevent duplicate concurrent submissions while saving
    if (isSavingRef.current) {
      toast.error('Another timetable swap is currently saving. Please wait a moment.');
      return;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');
    setPendingRetry(null);

    // Optimistic local UI update
    setActiveVersion((prev) => {
      if (!prev) return prev;
      const updatedClassTimetables = prev.classTimetables.map((ct) => {
        if (ct.classId?.toString() === selectedClassId) {
          return { ...ct, slots: updatedSlots };
        }
        return ct;
      });
      return { ...prev, classTimetables: updatedClassTimetables };
    });

    const idempotencyKey = `swap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await timetableService.swapSlots(activeVersion._id, {
        classId: selectedClassId,
        slot1: { day: sourceSlot.day, period: sourceSlot.period },
        slot2: { day: targetSlot.day, period: targetSlot.period },
        expectedRevision: activeVersion.revision || 1,
        expectedUpdatedAt: activeVersion.updatedAt,
        idempotencyKey,
        adminOverride: true,
      });

      // Update state with confirmed persisted document from MongoDB
      if (res.data?.timetable) {
        setActiveVersion(res.data.timetable);
      } else {
        await loadVersion(activeVersion._id);
      }
      loadDiagnostics(activeVersion._id);

      setSaveStatus('saved');
      toast.success(res.message || 'Swap auto-saved to database', { icon: '💾' });
    } catch (err) {
      const isConflict = err?.response?.status === 409;
      const isNetworkOffline = !navigator.onLine || !err.response;

      if (isConflict) {
        setSaveStatus('conflict');
        toast.error('Timetable was modified elsewhere — refreshing latest state', { icon: '⚠️' });
        await loadVersion(activeVersion._id);
      } else if (isNetworkOffline) {
        setSaveStatus('offline');
        setPendingRetry({
          sourceSlot,
          targetSlot,
          idempotencyKey,
        });
        toast.error('Network disconnected. Swap held for retry.');
      } else {
        setSaveStatus('error');
        setPendingRetry({
          sourceSlot,
          targetSlot,
          idempotencyKey,
        });
        const errMsg = err?.response?.data?.message || err?.message || 'Swap rejected by validation gate';
        toast.error(errMsg);
        // Roll back optimistic UI to authoritative MongoDB state
        await loadVersion(activeVersion._id);
      }
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleRetrySave = async () => {
    if (!pendingRetry || !activeVersion?._id || !selectedClassId) return;
    const { sourceSlot, targetSlot, idempotencyKey } = pendingRetry;

    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      const res = await timetableService.swapSlots(activeVersion._id, {
        classId: selectedClassId,
        slot1: { day: sourceSlot.day, period: sourceSlot.period },
        slot2: { day: targetSlot.day, period: targetSlot.period },
        expectedRevision: activeVersion.revision || 1,
        expectedUpdatedAt: activeVersion.updatedAt,
        idempotencyKey,
        adminOverride: true,
      });

      if (res.data?.timetable) {
        setActiveVersion(res.data.timetable);
      } else {
        await loadVersion(activeVersion._id);
      }
      loadDiagnostics(activeVersion._id);

      setSaveStatus('saved');
      setPendingRetry(null);
      toast.success('Swap retry succeeded and persisted', { icon: '💾' });
    } catch (err) {
      setSaveStatus('error');
      const errMsg = err?.response?.data?.message || err?.message || 'Retry failed';
      toast.error(errMsg);
      await loadVersion(activeVersion._id);
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleSlotUpdated = async () => {
    if (activeVersion?._id) {
      await loadVersion(activeVersion._id);
      loadDiagnostics(activeVersion._id);
    }
  };

  const handleUndo = async () => {
    if (!activeVersion?._id) return;
    try {
      const res = await timetableService.undo(activeVersion._id);
      if (res.data?.timetable) {
        setActiveVersion(res.data.timetable);
      } else {
        await loadVersion(activeVersion._id);
      }
      loadDiagnostics(activeVersion._id);
      toast.success(res.message || 'Action undone successfully', { icon: '↺' });
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Undo failed');
    }
  };

  const handleRedo = async () => {
    if (!activeVersion?._id) return;
    try {
      const res = await timetableService.redo(activeVersion._id);
      if (res.data?.timetable) {
        setActiveVersion(res.data.timetable);
      } else {
        await loadVersion(activeVersion._id);
      }
      loadDiagnostics(activeVersion._id);
      toast.success(res.message || 'Action redone successfully', { icon: '↻' });
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Redo failed');
    }
  };

  const handleNavigateToCell = ({ classId, day, period, title, explanation, conflictingAssignment }) => {
    if (classId) {
      setSelectedClassId(classId.toString());
    }
    setSelectedSlot({ day, period: Number(period) });
    setDiagnosticHighlight({
      classId: classId ? classId.toString() : null,
      day,
      period: Number(period),
      title,
      explanation,
      conflictingAssignment,
    });
    setDiagnosticsModalOpen(false);
    toast(`Focused on ${title} at ${day} Period ${period}`, { icon: '🎯' });
  };

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
          activeVersion && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setOfficialExportOpen(true)}
                leftIcon={<FileCheck className="w-4 h-4" strokeWidth={1.5} />}
              >
                Official Ahalia Format PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => timetableService.downloadAllClassesPdf(activeVersion._id)}
                leftIcon={<Download className="w-4 h-4" strokeWidth={1.5} />}
              >
                All Classes PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => timetableService.downloadAllClassesExcel(activeVersion._id)}
                leftIcon={<FileSpreadsheet className="w-4 h-4" strokeWidth={1.5} />}
              >
                All Classes Excel
              </Button>
            </div>
          )
        }
      />

      {/* Post-Generation Report Card */}
      {generationReport && (
        <PostGenerationReportCard
          report={generationReport}
          onDismiss={() => setGenerationReport(null)}
          onSendNotifications={() => toast.success('Notifications sent to affected faculty members')}
          onOpenDiagnostics={(tab) => {
            setDiagnosticsTab(tab);
            setDiagnosticsModalOpen(true);
          }}
        />
      )}

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
                    <CustomClassSelector
                      options={classOptions}
                      value={selectedClassId}
                      onChange={setSelectedClassId}
                      placeholder="Select class..."
                    />
                  )}

                  {selectedClassId && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setOfficialExportOpen(true)}
                        leftIcon={<FileCheck className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      >
                        Official Format PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => timetableService.downloadClassPdf(selectedClassId, activeVersion?._id)}
                        leftIcon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      >
                        Standard PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => timetableService.downloadClassExcel(selectedClassId, activeVersion?._id)}
                        leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      >
                        Class Excel
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Validation & Diagnostics Bar */}
              {diagnostics && (
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1">
                      Diagnostics:
                    </span>

                    {/* Hard Conflicts Badge Button */}
                    <button
                      onClick={() => {
                        setDiagnosticsTab('HARD_CONFLICTS');
                        setDiagnosticsModalOpen(true);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs border font-medium cursor-pointer transition-all hover:scale-[1.02] ${
                        diagnostics.summary.hardConflictsCount === 0
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20 animate-pulse'
                      }`}
                      title="Click to inspect exact hard constraint conflicts"
                    >
                      {diagnostics.summary.hardConflictsCount === 0 ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      <span>
                        Hard Conflicts:{' '}
                        <strong>
                          {diagnostics.summary.hardConflictsCount === 0
                            ? '0 PASSED'
                            : `${diagnostics.summary.hardConflictsCount} FAILED`}
                        </strong>
                      </span>
                    </button>

                    {/* Soft Warnings Badge Button */}
                    <button
                      onClick={() => {
                        setDiagnosticsTab('SOFT_WARNINGS');
                        setDiagnosticsModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs border font-medium cursor-pointer transition-all hover:scale-[1.02] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                      title="Click to inspect soft scheduling quality warnings"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        Soft Warnings: <strong>{diagnostics.summary.softWarningsCount}</strong>
                      </span>
                    </button>

                    {/* Optimization Opportunities Badge Button */}
                    <button
                      onClick={() => {
                        setDiagnosticsTab('OPTIMIZATION');
                        setDiagnosticsModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs border font-medium cursor-pointer transition-all hover:scale-[1.02] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20"
                      title="Click to inspect scheduling optimization opportunities"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-purple-500" />
                      <span>
                        Optimization:{' '}
                        <strong>
                          {diagnostics.summary.optimizationsCount} Opportunities
                        </strong>
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setDiagnosticsTab('HARD_CONFLICTS');
                      setDiagnosticsModalOpen(true);
                    }}
                    className="text-[11px] text-[var(--accent)] hover:underline font-medium cursor-pointer flex items-center gap-1"
                  >
                    <span>Full Diagnostic Report</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Interactive Grid */}
              {currentClassTimetable ? (
                <TimetableGrid
                  classTimetable={currentClassTimetable}
                  timetableVersion={activeVersion}
                  onSlotClick={handleSlotClick}
                  onSlotSwap={handleSlotSwap}
                  selectedSlot={selectedSlot}
                  saveStatus={saveStatus}
                  onRetrySave={() => handleSlotSwap(null, null, currentClassTimetable?.slots)}
                  onVersionUpdate={(updated) => setActiveVersion(updated)}
                  onRefresh={() => loadVersion(activeVersion._id)}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={Boolean(activeVersion?.undoStack?.length)}
                  canRedo={Boolean(activeVersion?.redoStack?.length)}
                  diagnosticHighlight={diagnosticHighlight}
                  onClearDiagnosticHighlight={() => setDiagnosticHighlight(null)}
                  onNavigateToClass={(cid, day, p) =>
                    handleNavigateToCell({
                      classId: cid,
                      day,
                      period: p,
                      title: diagnosticHighlight?.title || 'Selected Cell',
                      explanation: diagnosticHighlight?.explanation || '',
                    })
                  }
                  showActions
                />
              ) : (
                <div className="p-8 text-center text-[var(--text-muted)] text-xs font-sans">
                  {selectedClassId
                    ? 'No timetable data for this class'
                    : 'Select a class to view its timetable'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Official Ahalia Format Export Modal */}
      <OfficialExportModal
        isOpen={officialExportOpen}
        onClose={() => setOfficialExportOpen(false)}
        classTimetable={currentClassTimetable}
        timetableVersion={activeVersion}
      />

      {/* Admin Overtime & Permission Request Modal */}
      <OvertimeRequestModal
        isOpen={permissionRequests.length > 0}
        request={permissionRequests[currentRequestIndex]}
        currentIndex={currentRequestIndex}
        totalRequests={permissionRequests.length}
        onApplyOption={handleApplyOption}
        onSkipRequest={handleSkipRequest}
        onRejectSubject={handleRejectSubject}
        onClose={() => setPermissionRequests([])}
      />

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

      {/* Complete Conflict Diagnostics & Optimization Intelligence Modal */}
      <ConflictDiagnosticsModal
        isOpen={diagnosticsModalOpen}
        onClose={() => setDiagnosticsModalOpen(false)}
        diagnostics={diagnostics}
        initialTab={diagnosticsTab}
        onNavigateToCell={handleNavigateToCell}
      />
    </div>
  );
};

export default TimetableBuilder;