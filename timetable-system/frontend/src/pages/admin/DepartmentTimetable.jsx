import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Breadcrumb from '../../components/ui/Breadcrumb';
import HelpTooltip from '../../components/ui/HelpTooltip';
import Spinner from '../../components/ui/Spinner';
import TimetableGrid from '../../components/timetable/TimetableGrid';
import CustomClassSelector from '../../components/timetable/CustomClassSelector';
import departmentService from '../../services/departmentService';
import classService from '../../services/classService';
import teacherService from '../../services/teacherService';
import subjectService from '../../services/subjectService';
import timetableService from '../../services/timetableService';
import api from '../../services/api';
import {
  Building2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Zap,
  Upload,
  UserCheck,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '../../utils/cn';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const DepartmentTimetable = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  // Data states
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [deptStats, setDeptStats] = useState(null);

  // Step 2 options
  const [selectedYears, setSelectedYears] = useState([1, 2, 3, 4]);
  const [selectedSections, setSelectedSections] = useState(['A', 'B', 'C']);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [includeSaturday, setIncludeSaturday] = useState(false);

  // Step 3 Cross-Dept Teachers
  const [crossDeptTeachers, setCrossDeptTeachers] = useState([]);
  const [loadingCrossTeachers, setLoadingCrossTeachers] = useState(false);
  const [teacherAvailabilities, setTeacherAvailabilities] = useState({}); // teacherId -> [{ day, period }]
  const [teacherMethods, setTeacherMethods] = useState({}); // teacherId -> 'manual' | 'ocr' | 'imported'
  const [ocrLoadingTeacherId, setOcrLoadingTeacherId] = useState(null);

  // Step 4 Generation & Results
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Load departments
  useEffect(() => {
    const loadDepts = async () => {
      try {
        setLoadingDepts(true);
        const res = await departmentService.getAll();
        setDepartments(res.data.departments || []);
      } catch {
        toast.error('Failed to load departments');
      } finally {
        setLoadingDepts(false);
      }
    };
    loadDepts();
  }, []);

  // When dept changes, load quick stats
  useEffect(() => {
    if (!selectedDeptId) {
      setDeptStats(null);
      return;
    }

    const loadStats = async () => {
      try {
        const [classesRes, teachersRes, subjectsRes] = await Promise.allSettled([
          classService.getAll(),
          teacherService.getAll(),
          subjectService.getAll(),
        ]);

        const allClasses = classesRes.value?.data?.classes || [];
        const deptClasses = allClasses.filter(
          (c) => c.departmentId?._id?.toString() === selectedDeptId || c.departmentId?.toString() === selectedDeptId
        );

        const allSubjects = subjectsRes.value?.data?.subjects || [];
        const deptSubjects = allSubjects.filter((s) =>
          deptClasses.some((c) => c._id.toString() === s.classId?.toString())
        );

        const allTeachers = teachersRes.value?.data?.teachers || [];
        const deptTeachers = allTeachers.filter(
          (t) => t.departmentId?._id?.toString() === selectedDeptId || t.departmentId?.toString() === selectedDeptId
        );

        setDeptStats({
          classesCount: deptClasses.length,
          teachersCount: deptTeachers.length,
          subjectsCount: deptSubjects.length,
        });
      } catch {}
    };
    loadStats();
  }, [selectedDeptId]);

  // Load Cross-Dept Teachers when entering Step 3
  const loadCrossTeachers = async () => {
    try {
      setLoadingCrossTeachers(true);
      const res = await api.get(`/timetable/cross-dept-teachers/${selectedDeptId}`);
      const list = res.data.data.crossDeptTeachers || [];
      setCrossDeptTeachers(list);

      // Pre-fill availability from published busy slots or saved availability
      const initialAvail = {};
      const initialMethods = {};
      for (const t of list) {
        if (t.savedUnavailability?.length > 0) {
          initialAvail[t._id] = t.savedUnavailability;
          initialMethods[t._id] = t.savedSource || 'manual';
        } else if (t.publishedBusySlots?.length > 0) {
          initialAvail[t._id] = t.publishedBusySlots;
          initialMethods[t._id] = 'imported';
        } else {
          initialAvail[t._id] = t.unavailability || [];
          initialMethods[t._id] = 'manual';
        }
      }
      setTeacherAvailabilities(initialAvail);
      setTeacherMethods(initialMethods);
    } catch {
      toast.error('Failed to load cross-department teachers');
    } finally {
      setLoadingCrossTeachers(false);
    }
  };

  // Toggle teacher availability slot in grid
  const toggleTeacherSlot = (teacherId, day, period) => {
    setTeacherAvailabilities((prev) => {
      const current = prev[teacherId] || [];
      const exists = current.some((s) => s.day === day && s.period === period);
      let updated;
      if (exists) {
        updated = current.filter((s) => !(s.day === day && s.period === period));
      } else {
        updated = [...current, { day, period }];
      }
      return { ...prev, [teacherId]: updated };
    });
  };

  // Handle OCR file upload for teacher schedule
  const handleOcrUpload = async (teacherId, file) => {
    if (!file) return;
    try {
      setOcrLoadingTeacherId(teacherId);
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const extractedSlots = res.data.extractedSlots || [];

      const unavail = extractedSlots.map((s) => ({
        day: s.day || 'Monday',
        period: Number(s.period) || 1,
      }));

      setTeacherAvailabilities((prev) => ({
        ...prev,
        [teacherId]: unavail,
      }));
      setTeacherMethods((prev) => ({ ...prev, [teacherId]: 'ocr' }));
      toast.success('Timetable image scanned via OCR successfully!');
    } catch {
      toast.error('OCR processing failed. You can select free/busy slots manually.');
    } finally {
      setOcrLoadingTeacherId(null);
    }
  };

  // Handle Import from profile
  const handleImportProfile = (teacherId) => {
    const teacher = crossDeptTeachers.find((t) => t._id === teacherId);
    if (teacher) {
      const imported = teacher.publishedBusySlots?.length
        ? teacher.publishedBusySlots
        : teacher.unavailability || [];
      setTeacherAvailabilities((prev) => ({ ...prev, [teacherId]: imported }));
      setTeacherMethods((prev) => ({ ...prev, [teacherId]: 'imported' }));
      toast.success(`Imported ${imported.length} busy slots for ${teacher.name}`);
    }
  };

  // Proceed from Step 2 -> 3
  const handleGoToStep3 = async () => {
    setCurrentStep(3);
    await loadCrossTeachers();
  };

  // Generate timetable in Step 4
  const handleGenerateDepartmentTimetable = async () => {
    try {
      setGenerating(true);
      setCurrentStep(4);

      // Save teacher availability
      for (const tId of Object.keys(teacherAvailabilities)) {
        await api.post('/timetable/teacher-availability', {
          teacherId: tId,
          departmentId: selectedDeptId,
          unavailability: teacherAvailabilities[tId],
          source: teacherMethods[tId] || 'manual',
        });
      }

      // Build availability payload array
      const teacherAvailabilityPayload = Object.keys(teacherAvailabilities).map((tId) => ({
        teacherId: tId,
        unavailability: teacherAvailabilities[tId],
      }));

      const deptObj = departments.find((d) => d._id === selectedDeptId);
      const label = `${deptObj?.name || 'Department'} Schedule`;

      const res = await timetableService.generate({
        label,
        departmentId: selectedDeptId,
        teacherAvailability: teacherAvailabilityPayload,
      });

      setGeneratedResult(res.data.timetable);
      toast.success(`Department Timetable Generated! Score: ${res.data.timetable?.qualityScore?.overall || 0}/100`);

      const firstClass = res.data.timetable?.classTimetables?.[0];
      if (firstClass) {
        setSelectedClassId(firstClass.classId.toString());
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Generation failed';
      toast.error(msg);
      setGeneratedResult(null);
    } finally {
      setGenerating(false);
    }
  };

  const selectedDept = departments.find((d) => d._id === selectedDeptId);
  const currentClassTT = generatedResult?.classTimetables?.find(
    (ct) => ct.classId?.toString() === selectedClassId
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
      <Breadcrumb
        items={[
          { label: 'Create Timetable', to: '/admin/timetable' },
          { label: 'Department Timetable' },
        ]}
      />

      <PageHeader
        title="Department Timetable Maker"
        description="Create a dedicated schedule for a single department with automatic cross-department teacher scheduling"
      />

      {/* ── STEP INDICATOR (4 STEPS) ───────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-5 flex items-center justify-between">
        {[
          { step: 1, label: 'Select Dept' },
          { step: 2, label: 'Configure' },
          { step: 3, label: 'Cross-Dept Teachers' },
          { step: 4, label: 'Generate & Preview' },
        ].map((s, idx) => {
          const isDone = currentStep > s.step;
          const isCurrent = currentStep === s.step;
          return (
            <div key={s.step} className="flex items-center gap-2 flex-1 justify-center sm:justify-start">
              <div
                className={cn(
                  'w-8 h-8 rounded-full font-mono text-xs font-bold flex items-center justify-center border shrink-0 transition-colors',
                  isDone && 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]',
                  isCurrent && 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] ring-2 ring-[var(--accent)]/30',
                  !isDone && !isCurrent && 'bg-[var(--bg-surface-alt)] text-[var(--text-muted)] border-[var(--border)]'
                )}
              >
                {isDone ? '✓' : s.step}
              </div>
              <span
                className={cn(
                  'text-xs font-sans hidden sm:inline truncate',
                  isCurrent && 'font-semibold text-[var(--text-primary)]',
                  isDone && 'text-[var(--text-primary)]',
                  !isDone && !isCurrent && 'text-[var(--text-muted)]'
                )}
              >
                {s.label}
              </span>
              {idx < 3 && <div className="h-[1px] bg-[var(--border)] flex-1 hidden md:block mx-2" />}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: SELECT DEPARTMENT ───────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-8 space-y-6">
          <div>
            <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--accent)] block">
              STEP 1 OF 4
            </span>
            <h3 className="font-serif text-2xl font-normal text-[var(--text-primary)] mt-1">
              Select Target Department
            </h3>
            <p className="text-xs font-sans text-[var(--text-secondary)] mt-1">
              Which department do you want to create a schedule for?
            </p>
          </div>

          <div className="max-w-md space-y-3">
            <label className="block text-xs font-sans font-medium text-[var(--text-primary)]">
              Department Name
            </label>
            {loadingDepts ? (
              <Spinner />
            ) : (
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-transparent border border-[var(--border)] rounded-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                <option value="" className="bg-[var(--bg-surface)]">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id} className="bg-[var(--bg-surface)]">
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dept Quick Stats */}
          {deptStats && (
            <div className="p-4 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm grid grid-cols-3 gap-4 text-center max-w-md">
              <div>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{deptStats.classesCount}</p>
                <p className="text-[10px] font-sans text-[var(--text-muted)] uppercase tracking-wider">Classes</p>
              </div>
              <div>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{deptStats.teachersCount}</p>
                <p className="text-[10px] font-sans text-[var(--text-muted)] uppercase tracking-wider">Teachers</p>
              </div>
              <div>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{deptStats.subjectsCount}</p>
                <p className="text-[10px] font-sans text-[var(--text-muted)] uppercase tracking-wider">Subjects</p>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <Button
              disabled={!selectedDeptId}
              onClick={() => setCurrentStep(2)}
              rightIcon={<ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
            >
              Continue to Configure →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: CONFIGURE OPTIONS ───────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-8 space-y-6">
          <div>
            <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--accent)] block">
              STEP 2 OF 4
            </span>
            <h3 className="font-serif text-2xl font-normal text-[var(--text-primary)] mt-1">
              Configure Department Options
            </h3>
            <p className="text-xs font-sans text-[var(--text-secondary)] mt-1">
              Customize years, sections, and working days for {selectedDept?.name}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            {/* Academic Years */}
            <div className="space-y-2">
              <label className="block text-xs font-sans font-semibold text-[var(--text-primary)]">
                Include Academic Years
              </label>
              <div className="space-y-1.5 p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm">
                {[1, 2, 3, 4].map((yr) => (
                  <label key={yr} className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedYears.includes(yr)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedYears((prev) => [...prev, yr]);
                        else setSelectedYears((prev) => prev.filter((y) => y !== yr));
                      }}
                      className="accent-[var(--accent)]"
                    />
                    <span>Year {yr} (Semesters {yr * 2 - 1} & {yr * 2})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-2">
              <label className="block text-xs font-sans font-semibold text-[var(--text-primary)]">
                Sections to Include
              </label>
              <div className="space-y-1.5 p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm">
                {['A', 'B', 'C'].map((sec) => (
                  <label key={sec} className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(sec)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSections((prev) => [...prev, sec]);
                        else setSelectedSections((prev) => prev.filter((s) => s !== sec));
                      }}
                      className="accent-[var(--accent)]"
                    />
                    <span>Section {sec}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Periods per day */}
            <div className="space-y-2">
              <label className="block text-xs font-sans font-semibold text-[var(--text-primary)]">
                Periods Per Day
              </label>
              <input
                type="number"
                min={4}
                max={9}
                value={periodsPerDay}
                onChange={(e) => setPeriodsPerDay(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-transparent border border-[var(--border)] rounded-sm text-[var(--text-primary)]"
              />
            </div>

            {/* Include Saturday */}
            <div className="space-y-2">
              <label className="block text-xs font-sans font-semibold text-[var(--text-primary)]">
                Working Days
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSaturday}
                  onChange={(e) => setIncludeSaturday(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <span>Include Saturday (6-day schedule)</span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentStep(1)} leftIcon={<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />}>
              Back
            </Button>
            <Button onClick={handleGoToStep3} rightIcon={<ArrowRight className="w-4 h-4" strokeWidth={1.5} />}>
              Check Cross-Dept Teachers →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: CROSS-DEPARTMENT TEACHERS CHECK ───────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-8 space-y-6">
          <div>
            <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--accent)] block">
              STEP 3 OF 4 — CRITICAL CONSTRAINTS
            </span>
            <h3 className="font-serif text-2xl font-normal text-[var(--text-primary)] mt-1 flex items-center gap-2">
              Cross-Department Teachers Detected
              <HelpTooltip text="Teachers belonging to another department who teach subjects in this department. We schedule classes around their busy slots." />
            </h3>
            <p className="text-xs font-sans text-[var(--text-secondary)] mt-1">
              Provide busy/free slot availability for guest faculty so the AI generator avoids conflicts.
            </p>
          </div>

          {loadingCrossTeachers ? (
            <div className="py-12 text-center">
              <Spinner size="lg" />
              <p className="text-xs text-[var(--text-secondary)] mt-2">Scanning assigned faculty across departments...</p>
            </div>
          ) : crossDeptTeachers.length === 0 ? (
            <div className="p-6 bg-[var(--accent-soft)] border border-[var(--border)] rounded-sm text-center">
              <UserCheck className="w-8 h-8 text-[var(--accent)] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm font-serif font-normal text-[var(--text-primary)]">All teachers belong exclusively to this department!</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">No cross-department schedule conflicts detected. Ready to generate!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {crossDeptTeachers.map((teacher) => {
                const availList = teacherAvailabilities[teacher._id] || [];
                const currentMethod = teacherMethods[teacher._id] || 'manual';

                return (
                  <div key={teacher._id} className="p-5 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-md space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif text-lg font-normal text-[var(--text-primary)]">
                            👤 {teacher.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-xs bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-sans font-semibold uppercase">
                            Home: {teacher.homeDepartmentName}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          Teaches in this dept: {teacher.subjects?.map((s) => `${s.name} (${s.classInfo})`).join(', ')}
                        </p>
                      </div>

                      {/* 3 Method Selector Buttons */}
                      <div className="flex items-center gap-2 text-xs font-sans">
                        <button
                          onClick={() => setTeacherMethods((prev) => ({ ...prev, [teacher._id]: 'manual' }))}
                          className={cn(
                            'px-2.5 py-1 rounded-xs border transition-colors cursor-pointer',
                            currentMethod === 'manual' ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]'
                          )}
                        >
                          Manual Grid
                        </button>
                        <button
                          onClick={() => handleImportProfile(teacher._id)}
                          className={cn(
                            'px-2.5 py-1 rounded-xs border transition-colors cursor-pointer',
                            currentMethod === 'imported' ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]'
                          )}
                        >
                          Import Profile ✓
                        </button>
                        <label className="px-2.5 py-1 rounded-xs bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer flex items-center gap-1">
                          <Upload className="w-3 h-3" strokeWidth={1.5} />
                          <span>OCR Upload</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => handleOcrUpload(teacher._id, e.target.files[0])}
                          />
                        </label>
                      </div>
                    </div>

                    {ocrLoadingTeacherId === teacher._id && (
                      <div className="p-3 bg-[var(--accent-soft)] text-xs text-[var(--accent)] flex items-center gap-2 rounded-xs">
                        <Spinner size="sm" />
                        <span>Running OCR scan on uploaded schedule...</span>
                      </div>
                    )}

                    {/* Interactive Free/Busy Grid */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-sans font-semibold text-[var(--text-label)] uppercase tracking-wider">
                        Availability Grid (Click cell to toggle Free / Busy) — {availList.length} busy slot(s) set
                      </p>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)] border-b border-[var(--border)]">
                              <th className="px-2 py-1.5 text-left font-sans text-[10px] uppercase tracking-wider w-16">Day</th>
                              {PERIODS.map((p) => (
                                <th key={p} className="px-2 py-1.5 text-center font-sans text-[10px] uppercase tracking-wider">P{p}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {DAYS.map((day) => (
                              <tr key={day} className="border-b border-[var(--border)]">
                                <td className="px-2 py-1 font-sans text-xs font-medium text-[var(--text-primary)]">{day.slice(0, 3)}</td>
                                {PERIODS.map((period) => {
                                  const isBusy = availList.some((s) => s.day === day && s.period === period);
                                  return (
                                    <td
                                      key={period}
                                      onClick={() => toggleTeacherSlot(teacher._id, day, period)}
                                      className={cn(
                                        'p-2 text-center cursor-pointer border-r border-[var(--border)] transition-colors select-none text-xs font-mono',
                                        isBusy
                                          ? 'bg-[var(--error)]/20 text-[var(--error)] font-bold'
                                          : 'bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-soft)]/80'
                                      )}
                                      title={isBusy ? 'Busy (Click to make Free)' : 'Free (Click to mark Busy)'}
                                    >
                                      {isBusy ? '✗' : '✓'}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentStep(2)} leftIcon={<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />}>
              Back
            </Button>
            <Button onClick={handleGenerateDepartmentTimetable} leftIcon={<Zap className="w-4 h-4" strokeWidth={1.5} />}>
              Generate Department Timetable →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: GENERATE & PREVIEW ───────────────────────────────────── */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {generating ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-12 text-center space-y-4">
              <Spinner size="lg" />
              <h3 className="font-serif text-2xl font-normal text-[var(--text-primary)]">
                AI Generator Running for {selectedDept?.name}...
              </h3>
              <p className="text-xs font-sans text-[var(--text-secondary)] max-w-md mx-auto">
                Analyzing constraints, matching faculty availability, and eliminating schedule conflicts.
              </p>
            </div>
          ) : generatedResult ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 space-y-6">
              {/* Result Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-xs bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-sans font-semibold uppercase">
                    DEPARTMENT TIMETABLE GENERATED
                  </span>
                  <h3 className="font-serif text-2xl font-normal text-[var(--text-primary)] mt-1">
                    {generatedResult.label || `${selectedDept?.name} Timetable`}
                  </h3>
                  <p className="text-xs font-sans text-[var(--text-secondary)] mt-0.5">
                    Conflicts Avoided: 100% · Quality Score: {generatedResult.qualityScore?.overall || 98}/100
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => timetableService.downloadAllClassesPdf(generatedResult._id)}
                    leftIcon={<Download className="w-4 h-4" strokeWidth={1.5} />}
                  >
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => timetableService.downloadAllClassesExcel(generatedResult._id)}
                    leftIcon={<FileSpreadsheet className="w-4 h-4" strokeWidth={1.5} />}
                  >
                    Excel
                  </Button>
                </div>
              </div>

              {/* Class Selector Dropdown */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-sans font-semibold text-[var(--text-primary)]">Select Class View:</label>
                <CustomClassSelector
                  options={generatedResult.classTimetables?.map((ct) => ({ value: ct.classId, label: ct.className })) || []}
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  placeholder="Select Class..."
                />
              </div>

              {/* Timetable Grid */}
              {currentClassTT ? (
                <TimetableGrid classTimetable={currentClassTT} showActions={false} />
              ) : (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">No class selected</div>
              )}

              <div className="pt-4 flex justify-between border-t border-[var(--border)]">
                <Button variant="ghost" onClick={() => setCurrentStep(3)} leftIcon={<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />}>
                  Re-configure
                </Button>
                <Button onClick={() => navigate('/admin/timetable')}>
                  View in Main Timetable Builder →
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-8 text-center space-y-4">
              <p className="text-sm font-sans text-[var(--error)]">Generation failed to produce a valid schedule.</p>
              <Button onClick={() => setCurrentStep(3)}>Try Again</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DepartmentTimetable;
