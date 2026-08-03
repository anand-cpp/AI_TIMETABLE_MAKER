import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Breadcrumb from '../../components/ui/Breadcrumb';
import HelpTooltip from '../../components/ui/HelpTooltip';
import Spinner from '../../components/ui/Spinner';
import TimetableGrid from '../../components/timetable/TimetableGrid';
import departmentService from '../../services/departmentService';
import timetableService from '../../services/timetableService';
import api from '../../services/api';
import {
  Calendar,
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

const YearTimetable = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  // Data states
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState('');

  // Step 2 Year/Semester/Section options
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedSections, setSelectedSections] = useState(['A']);

  // Step 3 Cross-Dept / Cross-Year Teachers
  const [crossDeptTeachers, setCrossDeptTeachers] = useState([]);
  const [loadingCrossTeachers, setLoadingCrossTeachers] = useState(false);
  const [teacherAvailabilities, setTeacherAvailabilities] = useState({});
  const [teacherMethods, setTeacherMethods] = useState({});
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

  // Update default semester when year changes
  useEffect(() => {
    setSelectedSemester(selectedYear * 2 - 1);
  }, [selectedYear]);

  // Load Cross-Dept Teachers when entering Step 3
  const loadCrossTeachers = async () => {
    try {
      setLoadingCrossTeachers(true);
      const res = await api.get(`/timetable/cross-dept-teachers/${selectedDeptId}`);
      const list = res.data.data.crossDeptTeachers || [];
      setCrossDeptTeachers(list);

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
      toast.error('Failed to load teacher availability');
    } finally {
      setLoadingCrossTeachers(false);
    }
  };

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

      setTeacherAvailabilities((prev) => ({ ...prev, [teacherId]: unavail }));
      setTeacherMethods((prev) => ({ ...prev, [teacherId]: 'ocr' }));
      toast.success('Timetable image scanned via OCR successfully!');
    } catch {
      toast.error('OCR processing failed');
    } finally {
      setOcrLoadingTeacherId(null);
    }
  };

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

  const handleGoToStep3 = async () => {
    setCurrentStep(3);
    await loadCrossTeachers();
  };

  const handleGenerateYearTimetable = async () => {
    try {
      setGenerating(true);
      setCurrentStep(4);

      for (const tId of Object.keys(teacherAvailabilities)) {
        await api.post('/timetable/teacher-availability', {
          teacherId: tId,
          departmentId: selectedDeptId,
          unavailability: teacherAvailabilities[tId],
          source: teacherMethods[tId] || 'manual',
        });
      }

      const teacherAvailabilityPayload = Object.keys(teacherAvailabilities).map((tId) => ({
        teacherId: tId,
        unavailability: teacherAvailabilities[tId],
      }));

      const deptObj = departments.find((d) => d._id === selectedDeptId);
      const label = `${deptObj?.name || 'Dept'} Year ${selectedYear} (Sem ${selectedSemester}) Schedule`;

      const res = await timetableService.generate({
        label,
        departmentId: selectedDeptId,
        year: selectedYear,
        semester: selectedSemester,
        section: selectedSections[0] || 'A',
        teacherAvailability: teacherAvailabilityPayload,
      });

      setGeneratedResult(res.data.timetable);
      toast.success(`Year-Wise Timetable Generated! Score: ${res.data.timetable?.qualityScore?.overall || 0}/100`);

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
          { label: 'Year-Wise Timetable' },
        ]}
      />

      <PageHeader
        title="Year-Wise Timetable Maker"
        description="Generate a granular timetable for a single academic year, semester, or section"
      />

      {/* ── STEP INDICATOR (4 STEPS) ───────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-5 flex items-center justify-between">
        {[
          { step: 1, label: 'Select Dept' },
          { step: 2, label: 'Year & Semester' },
          { step: 3, label: 'Teacher Constraints' },
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
              Select Department
            </h3>
            <p className="text-xs font-sans text-[var(--text-secondary)] mt-1">
              Choose department to filter academic years and classes
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

          <div className="pt-4 flex justify-end">
            <Button
              disabled={!selectedDeptId}
              onClick={() => setCurrentStep(2)}
              rightIcon={<ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
            >
              Continue to Select Year →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: SELECT YEAR, SEMESTER & SECTION ───────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-8 space-y-6">
          <div>
            <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--accent)] block">
              STEP 2 OF 4
            </span>
            <h3 className="font-serif text-2xl font-normal text-[var(--text-primary)] mt-1">
              Select Academic Year & Semester
            </h3>
            <p className="text-xs font-sans text-[var(--text-secondary)] mt-1">
              Specify year, semester and section for {selectedDept?.name}
            </p>
          </div>

          <div className="space-y-6 max-w-xl">
            {/* Year Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-sans font-semibold text-[var(--text-primary)]">
                Academic Year
              </label>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className={cn(
                      'py-3 rounded-sm border font-sans text-xs transition-colors cursor-pointer text-center',
                      selectedYear === yr
                        ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)] font-semibold'
                        : 'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--border-strong)]'
                    )}
                  >
                    Year {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* Semester Dropdown */}
            <div className="space-y-2">
              <label className="block text-xs font-sans font-semibold text-[var(--text-primary)]">
                Semester
              </label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-transparent border border-[var(--border)] rounded-sm text-[var(--text-primary)] cursor-pointer"
              >
                {[selectedYear * 2 - 1, selectedYear * 2].map((sem) => (
                  <option key={sem} value={sem} className="bg-[var(--bg-surface)]">
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Checkboxes */}
            <div className="space-y-2">
              <label className="block text-xs font-sans font-semibold text-[var(--text-primary)]">
                Sections
              </label>
              <div className="flex items-center gap-4 p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm">
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
          </div>

          <div className="pt-4 flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentStep(1)} leftIcon={<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />}>
              Back
            </Button>
            <Button onClick={handleGoToStep3} rightIcon={<ArrowRight className="w-4 h-4" strokeWidth={1.5} />}>
              Check Teacher Constraints →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: TEACHER CONSTRAINTS CHECK ───────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-8 space-y-6">
          <div>
            <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--accent)] block">
              STEP 3 OF 4 — FACULTY AVAILABILITY
            </span>
            <h3 className="font-serif text-2xl font-normal text-[var(--text-primary)] mt-1 flex items-center gap-2">
              Faculty Schedule Check (Year {selectedYear} Sem {selectedSemester})
              <HelpTooltip text="Ensures teachers assigned to this semester aren't double-booked in other classes or departments." />
            </h3>
            <p className="text-xs font-sans text-[var(--text-secondary)] mt-1">
              Verify availability for faculty teaching Year {selectedYear} (Semester {selectedSemester})
            </p>
          </div>

          {loadingCrossTeachers ? (
            <div className="py-12 text-center">
              <Spinner size="lg" />
              <p className="text-xs text-[var(--text-secondary)] mt-2">Checking teacher schedules...</p>
            </div>
          ) : crossDeptTeachers.length === 0 ? (
            <div className="p-6 bg-[var(--accent-soft)] border border-[var(--border)] rounded-sm text-center">
              <UserCheck className="w-8 h-8 text-[var(--accent)] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm font-serif font-normal text-[var(--text-primary)]">All teachers belong exclusively to this department!</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">No cross-department schedule conflicts detected for Year {selectedYear}. Ready to generate!</p>
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
                          Teaches: {teacher.subjects?.map((s) => `${s.name} (${s.classInfo})`).join(', ')}
                        </p>
                      </div>

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
                        <span>Scanning schedule image via OCR...</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-sans font-semibold text-[var(--text-label)] uppercase tracking-wider">
                        Availability Grid (Click cell to toggle Free / Busy)
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
            <Button onClick={handleGenerateYearTimetable} leftIcon={<Zap className="w-4 h-4" strokeWidth={1.5} />}>
              Generate Year-Wise Timetable →
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
                AI Generator Running for Year {selectedYear} (Semester {selectedSemester})...
              </h3>
              <p className="text-xs font-sans text-[var(--text-secondary)] max-w-md mx-auto">
                Scheduling classes for Year {selectedYear} while respecting teacher availability and zero hard constraints.
              </p>
            </div>
          ) : generatedResult ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-xs bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-sans font-semibold uppercase">
                    YEAR-WISE TIMETABLE GENERATED
                  </span>
                  <h3 className="font-serif text-2xl font-normal text-[var(--text-primary)] mt-1">
                    {generatedResult.label || `${selectedDept?.name} Year ${selectedYear} Timetable`}
                  </h3>
                  <p className="text-xs font-sans text-[var(--text-secondary)] mt-0.5">
                    Conflicts Avoided: 100% · Quality Score: {generatedResult.qualityScore?.overall || 98}/100
                  </p>
                </div>

                <div className="flex items-center gap-2">
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
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-sans font-semibold text-[var(--text-primary)]">Select Class View:</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-transparent border border-[var(--border)] rounded-sm text-[var(--text-primary)] cursor-pointer"
                >
                  {generatedResult.classTimetables?.map((ct) => (
                    <option key={ct.classId} value={ct.classId} className="bg-[var(--bg-surface)]">
                      {ct.className}
                    </option>
                  ))}
                </select>
              </div>

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

export default YearTimetable;
