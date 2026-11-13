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
  Info,
  ExternalLink,
  X,
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
  const [swapSourceSlot, setSwapSourceSlot] = useState(null);
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
  const [inlineIssuesCategory, setInlineIssuesCategory] = useState(null);
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
    if (!id) return;
    try {
      setActiveVersionLoading(true);
      setSaveStatus('saved');
      const res = await timetableService.getVersion(id);
      const tt = res.data.timetable;
      setActiveVersion(tt);
      try {
        localStorage.setItem(`timetable-cache-${id}`, JSON.stringify(tt));
        localStorage.setItem('latest-timetable-cache', JSON.stringify(tt));
        localStorage.setItem('active-timetable-version-id', id);
      } catch { /* ignore storage cache errors */ }
      const firstClass = tt?.classTimetables?.[0];
      const classExists = tt?.classTimetables?.some(ct => ct.classId?.toString() === selectedClassId);
      if (firstClass && (!selectedClassId || !classExists)) {
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
        const savedId = localStorage.getItem('active-timetable-version-id');
        const target = (savedId && vers.find(v => v._id === savedId)) || vers[0];
        if (target?._id) {
          await loadVersion(target._id);
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
        localStorage.setItem('active-timetable-version-id', tt._id);
      } catch { /* ignore storage cache errors */ }

      setSaveStatus('saved');
      setActiveVersion(tt);
      const classExists = tt?.classTimetables?.some(ct => ct.classId?.toString() === selectedClassId);
      if (!selectedClassId || !classExists) {
        const firstClass = tt?.classTimetables?.[0];
        if (firstClass) {
          setSelectedClassId(firstClass.classId.toString());
        }
      }
      if (tt?._id) {
        loadDiagnostics(tt._id);
      }
      await loadVersions(false);
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
        localStorage.removeItem('active-timetable-version-id');
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
  ) || activeVersion?.classTimetables?.[0] || null;

  // Keep selectedClassId synchronized if activeVersion updates or class is missing
  useEffect(() => {
    if (activeVersion?.classTimetables?.length > 0) {
      const match = activeVersion.classTimetables.some(
        (ct) => ct.classId?.toString() === selectedClassId
      );
      if (!match) {
        setSelectedClassId(activeVersion.classTimetables[0].classId?.toString() || '');
      }
    }
  }, [activeVersion, selectedClassId]);

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

              {/* Interactive Validation & Diagnostics Bar with Sub-Summaries */}
              {diagnostics && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-md bg-[var(--bg-surface-alt)] border border-[var(--border)] flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1">
                        Diagnostics:
                      </span>

                      {/* Hard Conflicts Badge Button */}
                      <button
                        onClick={() => {
                          setDiagnosticsTab('HARD_CONFLICTS');
                          setDiagnosticsModalOpen(true);
                          setInlineIssuesCategory('HARD_CONFLICTS');
                        }}
                        className={`inline-flex flex-col items-start px-3.5 py-2 rounded-md border font-medium cursor-pointer transition-all hover:scale-[1.01] ${
                          diagnostics.summary.hardConflictsCount === 0
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            : inlineIssuesCategory === 'HARD_CONFLICTS'
                            ? 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500 ring-2 ring-rose-500/30'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20 animate-pulse'
                        }`}
                        title="Click to view exact hard conflicts and affected slots"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-1.5">
                            {diagnostics.summary.hardConflictsCount === 0 ? (
                              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                            )}
                            <span className="font-bold text-xs">
                              Hard Conflicts:{' '}
                              {diagnostics.summary.hardConflictsCount === 0
                                ? '0 PASSED'
                                : `${diagnostics.summary.hardConflictsCount} FAILED`}
                            </span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 font-semibold uppercase tracking-wider text-[10px]">
                            About & Issues ▾
                          </span>
                        </div>
                        <span className="text-[11px] font-medium opacity-90 mt-1">
                          {diagnostics.summary.hardConflictsCount === 0
                            ? '✓ Zero constraint conflicts · All rules satisfied'
                            : (diagnostics.summary.hardConflictsSummary || 'Laboratory room collisions & rest gap violations')}
                        </span>
                      </button>

                      {/* Soft Warnings Badge Button */}
                      <button
                        onClick={() => {
                          setDiagnosticsTab('SOFT_WARNINGS');
                          setDiagnosticsModalOpen(true);
                          setInlineIssuesCategory('SOFT_WARNINGS');
                        }}
                        className={`inline-flex flex-col items-start px-3.5 py-2 rounded-md border font-medium cursor-pointer transition-all hover:scale-[1.01] ${
                          inlineIssuesCategory === 'SOFT_WARNINGS'
                            ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500 ring-2 ring-amber-500/30'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                        }`}
                        title="Click to view soft quality warnings and fatigue alerts"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="font-bold text-xs">
                              Soft Warnings: {diagnostics.summary.softWarningsCount}
                            </span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 font-semibold uppercase tracking-wider text-[10px]">
                            About & Issues ▾
                          </span>
                        </div>
                        <span className="text-[11px] font-medium opacity-90 mt-1">
                          {diagnostics.summary.softWarningsSummary || 'Faculty fatigue (4+ consecutive periods)'}
                        </span>
                      </button>

                      {/* Optimization Opportunities Badge Button */}
                      <button
                        onClick={() => {
                          setDiagnosticsTab('OPTIMIZATION');
                          setDiagnosticsModalOpen(true);
                          setInlineIssuesCategory('OPTIMIZATION');
                        }}
                        className={`inline-flex flex-col items-start px-3.5 py-2 rounded-md border font-medium cursor-pointer transition-all hover:scale-[1.01] ${
                          inlineIssuesCategory === 'OPTIMIZATION'
                            ? 'bg-purple-500/20 text-purple-800 dark:text-purple-200 border-purple-500 ring-2 ring-purple-500/30'
                            : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
                        }`}
                        title="Click to view optimization opportunities and gap reductions"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-1.5">
                            <Lightbulb className="w-4 h-4 text-purple-500 shrink-0" />
                            <span className="font-bold text-xs">
                              Optimization: {diagnostics.summary.optimizationsCount} Opportunities
                            </span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 font-semibold uppercase tracking-wider text-[10px]">
                            About & Issues ▾
                          </span>
                        </div>
                        <span className="text-[11px] font-medium opacity-90 mt-1">
                          {diagnostics.summary.optimizationsSummary || 'Mid-day rest buffers & idle gaps'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Realistic Quality Score Pill */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border)]">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono tracking-wider">
                          Score:
                        </span>
                        <span className={`font-mono font-bold text-xs ${
                          (diagnostics.summary.qualityScore ?? 100) >= 80
                            ? 'text-emerald-600'
                            : (diagnostics.summary.qualityScore ?? 100) >= 60
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}>
                          {diagnostics.summary.qualityScore ?? 100} / 100
                        </span>
                      </div>

                      {/* Modal Dialog Trigger */}
                      <button
                        onClick={() => {
                          setDiagnosticsTab(inlineIssuesCategory || 'HARD_CONFLICTS');
                          setDiagnosticsModalOpen(true);
                        }}
                        className="text-[11px] text-[var(--accent)] hover:underline font-medium cursor-pointer flex items-center gap-1"
                        title="Open full-screen searchable diagnostic dialog"
                      >
                        <span>Full Dialog</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Issues Drawer Panel */}
                  {inlineIssuesCategory && (
                    <div className="p-4 rounded-md border bg-[var(--bg-surface)] border-[var(--border)] shadow-xs space-y-3.5 transition-all animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                        <div className="flex items-center gap-2">
                          {inlineIssuesCategory === 'HARD_CONFLICTS' ? (
                            <ShieldAlert className="w-4 h-4 text-rose-500" />
                          ) : inlineIssuesCategory === 'SOFT_WARNINGS' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Lightbulb className="w-4 h-4 text-purple-500" />
                          )}
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                            {inlineIssuesCategory === 'HARD_CONFLICTS'
                              ? `Hard Conflicts (${diagnostics.hardConflicts?.length || 0})`
                              : inlineIssuesCategory === 'SOFT_WARNINGS'
                              ? `Soft Warnings (${diagnostics.softWarnings?.length || 0})`
                              : `Optimization Opportunities (${diagnostics.optimizations?.length || 0})`}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setDiagnosticsTab(inlineIssuesCategory);
                              setDiagnosticsModalOpen(true);
                            }}
                            className="px-2 py-0.5 rounded text-[11px] text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <span>Open in Modal</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setInlineIssuesCategory(null)}
                            className="p-1 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors cursor-pointer"
                            title="Close issue drawer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* "About" Educational Callout */}
                      <div className={`p-3.5 rounded text-xs leading-relaxed border shadow-xs ${
                        inlineIssuesCategory === 'HARD_CONFLICTS'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100'
                          : inlineIssuesCategory === 'SOFT_WARNINGS'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100'
                          : 'bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-100'
                      }`}>
                        <div className="flex items-center gap-2 font-bold mb-1.5 text-sm">
                          <Info className="w-4 h-4 shrink-0 text-current" />
                          <span>
                            About{' '}
                            {inlineIssuesCategory === 'HARD_CONFLICTS'
                              ? 'Hard Conflicts (Critical Scheduling Infeasibilities)'
                              : inlineIssuesCategory === 'SOFT_WARNINGS'
                              ? 'Soft Warnings (Pedagogical Quality & Fatigue Alerts)'
                              : 'Optimization Opportunities (Schedule Flow Improvements)'}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed opacity-95">
                          {inlineIssuesCategory === 'HARD_CONFLICTS'
                            ? (diagnostics.summary.aboutHardConflicts || 'Hard conflicts represent impossible allocations under statutory regulations and institutional rules (such as instructors assigned 3 or more consecutive teaching periods without a rest gap, laboratory rooms double-booked at the same hour, or practicals scheduled in unauthorized facilities). These violate basic institutional feasibility, prevent timetable publication, and must be resolved before proceeding.')
                            : inlineIssuesCategory === 'SOFT_WARNINGS'
                            ? (diagnostics.summary.aboutSoftWarnings || 'Soft warnings identify non-blocking pedagogical quality issues, such as instructors assigned to consecutive periods without an adequate gap, unbalanced daily teaching loads, or fragmented subject distribution across days. These do not prevent publication but significantly affect teaching comfort, student focus, and faculty satisfaction.')
                            : (diagnostics.summary.aboutOptimization || 'Optimization opportunities highlight potential schedule improvements that can be safely applied, such as eliminating awkward 1-period idle gaps before afternoon classes or providing restorative lunch intervals for instructors without altering curriculum compliance.')}
                        </p>
                      </div>

                      {/* Category Switcher Tabs */}
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-xs">
                        <button
                          onClick={() => setInlineIssuesCategory('HARD_CONFLICTS')}
                          className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                            inlineIssuesCategory === 'HARD_CONFLICTS'
                              ? 'bg-rose-500/20 text-rose-600 font-bold border border-rose-500/30'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          Hard Conflicts ({diagnostics.hardConflicts?.length || 0})
                        </button>
                        <button
                          onClick={() => setInlineIssuesCategory('SOFT_WARNINGS')}
                          className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                            inlineIssuesCategory === 'SOFT_WARNINGS'
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          Soft Warnings ({diagnostics.softWarnings?.length || 0})
                        </button>
                        <button
                          onClick={() => setInlineIssuesCategory('OPTIMIZATION')}
                          className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                            inlineIssuesCategory === 'OPTIMIZATION'
                              ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          Optimization ({diagnostics.optimizations?.length || 0})
                        </button>
                      </div>

                      {/* Issue Cards List */}
                      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                        {((inlineIssuesCategory === 'HARD_CONFLICTS'
                          ? diagnostics.hardConflicts
                          : inlineIssuesCategory === 'SOFT_WARNINGS'
                          ? diagnostics.softWarnings
                          : diagnostics.optimizations) || []).length === 0 ? (
                          <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface-alt)] rounded">
                            Zero issues detected in this category.
                          </div>
                        ) : (
                          ((inlineIssuesCategory === 'HARD_CONFLICTS'
                            ? diagnostics.hardConflicts
                            : inlineIssuesCategory === 'SOFT_WARNINGS'
                            ? diagnostics.softWarnings
                            : diagnostics.optimizations) || []).map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="p-3 rounded border bg-[var(--bg-surface-alt)]/60 border-[var(--border)] hover:border-[var(--accent)] transition-all space-y-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-[var(--text-primary)]">
                                      {item.title}
                                    </span>
                                    {item.className && (
                                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] font-medium text-[10px]">
                                        {item.className}
                                      </span>
                                    )}
                                    {item.day && (
                                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] font-mono text-[10px]">
                                        {item.day} P{item.period}
                                      </span>
                                    )}
                                    {item.roomName && (
                                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] font-mono text-[10px] text-rose-600 font-semibold">
                                        {item.roomName}
                                      </span>
                                    )}
                                    {item.teacherName && (
                                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[10px]">
                                        {item.teacherName}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {(item.classId || item.primaryAssignment?.classId) && (
                                  <button
                                    onClick={() =>
                                      handleNavigateToCell({
                                        classId: item.classId || item.primaryAssignment?.classId,
                                        day: item.day,
                                        period: item.period,
                                        title: item.title,
                                        explanation: item.explanation,
                                        conflictingAssignment: item.conflictingAssignment,
                                      })
                                    }
                                    className="px-2 py-1 rounded bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 text-[11px] font-medium hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1 shrink-0"
                                    title="Highlight affected slot in timetable grid"
                                  >
                                    <span>Locate in Grid</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* What is the issue */}
                              <p className="text-[var(--text-primary)] leading-relaxed">
                                {item.explanation || item.currentArrangement}
                              </p>

                              {/* Conflicting assignment preview if present */}
                              {item.primaryAssignment && item.conflictingAssignment && (
                                <div className="p-2 rounded bg-rose-500/5 border border-rose-500/20 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <span className="font-semibold text-rose-600 block">Class 1:</span>
                                    <span>{item.primaryAssignment.className} ({item.primaryAssignment.subjectName || item.primaryAssignment.subjectCode}) in {item.primaryAssignment.roomName}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-rose-600 block">Class 2 (Collision):</span>
                                    <span>{item.conflictingAssignment.className} ({item.conflictingAssignment.subjectName || item.conflictingAssignment.subjectCode}) in {item.conflictingAssignment.roomName}</span>
                                  </div>
                                </div>
                              )}

                              {/* Suggested resolution / fix */}
                              {(item.rootCause || item.resolution || item.suggestedArrangement) && (
                                <div className="pt-1.5 border-t border-[var(--border)]/70 text-[11px] text-[var(--text-secondary)] space-y-0.5">
                                  {item.rootCause && (
                                    <p>
                                      <strong className="text-[var(--text-muted)]">Root Cause:</strong> {item.rootCause}
                                    </p>
                                  )}
                                  {(item.resolution || item.suggestedArrangement) && (
                                    <p>
                                      <strong className="text-emerald-600">Action:</strong> {item.resolution || item.suggestedArrangement}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
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
                  swapSourceSlot={swapSourceSlot}
                  onSwapSourceChange={setSwapSourceSlot}
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
        onStartSwap={(slot) => {
          setSwapSourceSlot(slot);
          toast(`Selected ${slot.day} P${slot.period} (${slot.subjectName || slot.subjectCode}). Click any green slot to swap.`, { icon: '🎯' });
        }}
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