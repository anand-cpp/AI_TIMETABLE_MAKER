import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  FlaskConical,
  Layers,
  Award,
  Users,
  Clock,
  Calendar,
  Plus as PlusIcon,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Building,
  Mail,
  Phone,
  CheckCircle2,
  CalendarDays,
  FileText,
  Edit
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import teacherService from '../../services/teacherService';
import TeacherForm from '../../components/teachers/TeacherForm';
import classService from '../../services/classService';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const FacultyProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION: ROBUST BACK BUTTON
  // ═══════════════════════════════════════════════════════════════
  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/admin/teachers');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null); // 'not_found' | 'server_error'
  const [activeTab, setActiveTab] = useState('allocations');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfileLoading, setEditProfileLoading] = useState(false);

  // Add/Edit allocation modal state
  const [showAddAllocation, setShowAddAllocation] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      subjectCode: '',
      subjectName: '',
      classId: '',
      type: 'theory',
      weeklyHours: '',
      L: '',
      T: '',
      P: '',
      electiveGroup: '',
    },
  });

  const [classes, setClasses] = useState([]);
  const [selectedType, setSelectedType] = useState('theory');

  // Substitution modal state
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substitutions, setSubstitutions] = useState([]);
  const [substitutionLoading, setSubstitutionLoading] = useState(false);

  const {
    register: regSub,
    handleSubmit: handleSubSubmit,
    reset: resetSub,
    formState: { errors: subErrors },
  } = useForm({
    defaultValues: {
      absentTeacherId: '',
      date: '',
      period: '',
      classId: '',
      subjectId: '',
      substituteTeacherId: '',
      reason: '',
    },
  });

  const [substituteTeachers, setSubstituteTeachers] = useState([]);
  const [subjectsForSubstitution, setSubjectsForSubstitution] = useState([]);

  // Teaching hours modal state
  const [showTeachingHoursModal, setShowTeachingHoursModal] = useState(false);

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADER
  // ═══════════════════════════════════════════════════════════════
  const loadProfile = async () => {
    if (!id) {
      setError('Invalid faculty ID');
      setErrorType('not_found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      const res = await teacherService.getFacultyProfile(id);
      // Defensive response extraction
      const profileData = res?.data?.profile || res?.profile || res?.data;

      if (!profileData || !profileData.teacher) {
        throw new Error('Teacher profile not found');
      }

      setProfile(profileData);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      if (status === 404 || msg?.toLowerCase().includes('not found')) {
        setError('Teacher profile not found.');
        setErrorType('not_found');
      } else {
        setError('Unable to load teacher workload. Please try again.');
        setErrorType('server_error');
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const loadClasses = async () => {
      try {
        const res = await classService.getAll();
        const classList =
          res?.data?.classes ||
          res?.classes ||
          (Array.isArray(res?.data) ? res.data : []) ||
          (Array.isArray(res) ? res : []);
        setClasses(Array.isArray(classList) ? classList : []);
      } catch (err) {
        console.warn('Failed to load classes for allocation dropdown', err);
        setClasses([]);
      }
    };
    loadClasses();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const loadSubstitutions = async () => {
      setSubstitutionLoading(true);
      try {
        const res = await teacherService.getSubstitutions(id);
        const subList = res?.data?.substitutions || res?.substitutions || [];
        setSubstitutions(Array.isArray(subList) ? subList : []);
      } catch (err) {
        console.warn('Failed to load substitutions', err);
        setSubstitutions([]);
      } finally {
        setSubstitutionLoading(false);
      }
    };
    loadSubstitutions();
  }, [id]);

  // ═══════════════════════════════════════════════════════════════
  // EARLY RETURNS: LOADING & ERROR STATES
  // ═══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <div className="w-10 h-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-sans text-[var(--text-secondary)]">Loading teacher profile & workload data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        </div>

        <Card className="p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-2">
            {errorType === 'not_found' ? 'Profile Not Found' : 'Failed to Load Profile'}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Teachers
            </Button>
            {errorType !== 'not_found' && (
              <Button
                variant="primary"
                size="sm"
                onClick={loadProfile}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Retry
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const {
    teacher,
    summary,
    assignedWorkload,
    scheduledWorkload,
    semesterBreakdown,
    allocations,
    labAllocations,
  } = profile || {};

  const typeColors = {
    theory: 'bg-blue-500/15 text-blue-700 dark:text-cyan-300 border-blue-500',
    lab: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500',
    elective: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500',
  };

  // ═══════════════════════════════════════════════════════════════
  // ALL ALLOCATIONS COLUMNS (Required Phase 3.C)
  // | Subject Code | Subject Name | Semester | Class/Section | Theory Hours | Tutorial Hours | Lab Hours | Total Hours |
  // ═══════════════════════════════════════════════════════════════
  const allocationColumns = [
    {
      key: 'subjectCode',
      title: 'Subject Code',
      render: (val, row) => (
        <span className="font-mono text-xs font-bold text-[var(--accent)] tracking-wider">
          {val || row.courseCode || '—'}
        </span>
      ),
    },
    {
      key: 'subjectName',
      title: 'Subject Name',
      render: (val, row) => {
        const Icon = row.type === 'lab' ? FlaskConical : row.type === 'elective' ? Layers : BookOpen;
        return (
          <div className="flex items-center gap-2.5">
            <div className={`w-6 h-6 rounded-xs flex items-center justify-center border ${typeColors[row.type] || typeColors.theory}`}>
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-serif font-normal text-sm text-[var(--text-primary)] leading-tight">{val}</p>
              {row.electiveGroup && (
                <p className="text-[11px] text-purple-600 dark:text-purple-400 font-sans">{row.electiveGroup}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'semester',
      title: 'Semester',
      render: (val) => (
        <span className="px-2 py-0.5 rounded-xs bg-[var(--accent-soft)] text-[var(--accent)] text-[11px] font-sans font-semibold">
          S{val}
        </span>
      ),
    },
    {
      key: 'className',
      title: 'Class / Section',
      render: (val, row) => (
        <span className="text-xs font-sans font-medium text-[var(--text-primary)]">
          {val || `${row.branch} S${row.semester}${row.section}`}
        </span>
      ),
    },
    {
      key: 'theoryHours',
      title: 'Theory (L)',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (val, row) => (
        <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">
          {row.type === 'elective' || row.isElective ? '—' : `${row.theoryHours ?? 0} hrs`}
        </span>
      ),
    },
    {
      key: 'tutorialHours',
      title: 'Tutorial (T)',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (val, row) => (
        <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">
          {row.type === 'elective' || row.isElective ? '—' : `${row.tutorialHours ?? 0} hrs`}
        </span>
      ),
    },
    {
      key: 'labHours',
      title: 'Lab / Practical (P)',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (val, row) => (
        <span className={`text-xs font-mono font-bold ${(row.labHours || row.P) ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-secondary)]'}`}>
          {row.type === 'elective' || row.isElective ? '—' : `${row.labHours ?? 0} hrs`}
        </span>
      ),
    },
    {
      key: 'totalHours',
      title: 'Total Hours',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (val, row) => (
        <span className={`text-xs font-sans font-bold px-2 py-0.5 rounded-xs ${
          row.type === 'elective' || row.isElective
            ? 'text-purple-700 bg-purple-100 dark:bg-purple-950 dark:text-purple-300'
            : row.type === 'lab'
            ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
            : 'text-[var(--accent)] bg-[var(--accent-soft)]'
        }`}>
          {val ?? row.hours ?? 0} hrs
        </span>
      ),
    },
    {
      key: 'role',
      title: 'Role / Details',
      render: (_, row) => (
        <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
          <p className="font-medium text-[var(--text-primary)]">{row.facultyRole || (row.isMainTeacher ? 'Main' : 'Instructor')}</p>
          {row.labRoom && <p className="text-[11px] text-emerald-600">Room: {row.labRoom}</p>}
          {row.batch && <p className="text-[11px] text-blue-600">{row.batch}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      cellClassName: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleOpenEdit(row)}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => onRemoveAllocation(row.subjectId)}
            className="text-xs font-medium text-[var(--error)] hover:underline"
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  // ═══════════════════════════════════════════════════════════════
  // LABORATORY BREAKDOWN COLUMNS (Required Phase 3.E)
  // | Lab Subject | Subject Code | Semester | Section | Faculty Allocation | Weekly Lab Hours |
  // ═══════════════════════════════════════════════════════════════
  const labColumns = [
    {
      key: 'subjectName',
      title: 'Lab Subject',
      render: (val, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-xs flex items-center justify-center border bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500">
            <FlaskConical className="w-3.5 h-3.5" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-serif font-normal text-sm text-[var(--text-primary)]">{val}</p>
            {row.batch && <p className="text-[11px] font-sans text-blue-600 dark:text-blue-400">{row.batch}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'subjectCode',
      title: 'Subject Code',
      render: (val) => (
        <span className="font-mono text-xs font-bold text-[var(--accent)]">
          {val}
        </span>
      ),
    },
    {
      key: 'semester',
      title: 'Semester',
      render: (val) => (
        <span className="px-2 py-0.5 rounded-xs bg-[var(--accent-soft)] text-[var(--accent)] text-[11px] font-sans font-semibold">
          S{val}
        </span>
      ),
    },
    {
      key: 'section',
      title: 'Section',
      render: (val, row) => (
        <span className="text-xs font-sans font-medium text-[var(--text-primary)]">
          {row.className || val}
        </span>
      ),
    },
    {
      key: 'facultyAllocation',
      title: 'Faculty Allocation',
      render: (val) => (
        <Badge variant="success">
          {val || 'Main Lab Faculty'}
        </Badge>
      ),
    },
    {
      key: 'weeklyLabHours',
      title: 'Weekly Lab Hours',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (val) => (
        <span className="text-sm font-sans font-bold text-emerald-600 dark:text-emerald-400">
          {val} hrs/week
        </span>
      ),
    },
    {
      key: 'labRoom',
      title: 'Lab Facility',
      render: (val) => (
        <span className="text-xs font-sans font-medium text-[var(--text-secondary)]">
          {val || 'Assigned Lab'}
        </span>
      ),
    },
  ];

  const tabLabels = {
    allocations: 'All Allocations',
    labs: 'Laboratory Breakdown',
    semesters: 'Semester Breakdown',
    summary: 'Workload Summary',
    substitutions: 'Substitutions',
  };

  // ═══════════════════════════════════════════════════════════════

  const handleUpdateProfile = async (formData) => {
    try {
      setEditProfileLoading(true);
      await teacherService.update(id, formData);
      toast.success('Teacher profile updated successfully');
      setShowEditProfileModal(false);
      await loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update teacher profile');
    } finally {
      setEditProfileLoading(false);
    }
  };

  // ALLOCATION ACTIONS
  // ═══════════════════════════════════════════════════════════════
  const handleOpenEdit = (alloc) => {
    setEditingAlloc(alloc);
    setSelectedType(alloc.type || 'theory');
    reset({
      subjectCode: alloc.courseCode || alloc.subjectCode || '',
      subjectName: alloc.subjectName || '',
      classId: alloc.classId?._id || alloc.classId || '',
      type: alloc.type || 'theory',
      weeklyHours: alloc.hours || alloc.weeklyHours || '',
      L: alloc.L || 0,
      T: alloc.T || 0,
      P: alloc.P || 0,
      electiveGroup: alloc.electiveGroup || '',
    });
    setShowAddAllocation(true);
  };

  const handleOpenAdd = () => {
    setEditingAlloc(null);
    setSelectedType('theory');
    reset({
      subjectCode: '',
      subjectName: '',
      classId: '',
      type: 'theory',
      weeklyHours: '',
      L: '',
      T: '',
      P: '',
      electiveGroup: '',
    });
    setShowAddAllocation(true);
  };

  const onAddAllocationSubmit = async (data) => {
    try {
      const allocationData = {
        subjectCode: data.subjectCode.trim().toUpperCase(),
        subjectName: data.subjectName.trim(),
        classId: data.classId,
        type: data.type,
        weeklyHours: data.type !== 'lab' ? Number(data.weeklyHours || 0) : 0,
        L: data.type === 'lab' ? Number(data.L || 0) : 0,
        T: data.type === 'lab' ? Number(data.T || 0) : 0,
        P: data.type === 'lab' ? Number(data.P || 0) : 0,
        electiveGroup: data.electiveGroup || '',
      };

      if (editingAlloc) {
        await teacherService.editAllocation(id, editingAlloc.subjectId, allocationData);
        toast.success('Subject allocation updated successfully');
      } else {
        await teacherService.addAllocation(id, allocationData);
        toast.success('Subject allocation added successfully');
      }
      setShowAddAllocation(false);
      setEditingAlloc(null);
      await loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save allocation');
    }
  };

  const onRemoveAllocation = async (allocId) => {
    if (!window.confirm('Are you sure you want to remove this subject allocation?')) return;
    try {
      await teacherService.removeAllocation(id, allocId);
      toast.success('Subject allocation removed successfully');
      await loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove allocation');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // SUBSTITUTION ACTIONS
  // ═══════════════════════════════════════════════════════════════
  const loadSubstituteTeachers = async () => {
    try {
      const res = await teacherService.getAll();
      const list = res?.data?.teachers || res?.teachers || (Array.isArray(res?.data) ? res.data : []) || (Array.isArray(res) ? res : []);
      const others = (Array.isArray(list) ? list : []).filter(t => t._id !== id && t.isActive !== false);
      setSubstituteTeachers(others);
    } catch (err) {
      console.warn('Failed to load substitute teachers', err);
      setSubstituteTeachers([]);
    }
  };

  const loadSubjectsForSubstitution = async () => {
    try {
      const res = await teacherService.getFacultyProfile(id);
      const allocs = res?.data?.profile?.allocations || res?.profile?.allocations || [];
      const subs = (Array.isArray(allocs) ? allocs : []).map(a => ({
        value: a.subjectId,
        label: `${a.subjectName} (${a.courseCode || a.subjectCode || 'Subj'}) - S${a.semester} ${a.section}`,
      }));
      setSubjectsForSubstitution(subs);
    } catch (err) {
      console.warn('Failed to load subjects for substitution', err);
      setSubjectsForSubstitution([]);
    }
  };

  const onSubstitutionSubmit = async (data) => {
    try {
      const payload = {
        absentTeacherId: id,
        date: data.date,
        period: Number(data.period),
        classId: data.classId,
        subjectId: data.subjectId,
        substituteTeacherId: data.substituteTeacherId,
        reason: data.reason || '',
      };

      await teacherService.createSubstitution(payload);
      setShowSubstitutionModal(false);
      resetSub();
      await loadProfile();
      toast.success('Substitution assigned successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign substitution');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER MAIN VIEW
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ── BACK BUTTON & TOP BREADCRUMB ──────────────────────────── */}
      <div className="flex items-center justify-between pb-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back
        </Button>
        <span className="text-xs font-sans text-[var(--text-secondary)]">
          Faculty Directory / {teacher?.name || 'Profile'}
        </span>
      </div>

      {/* ── TEACHER PROFILE HEADER & INFORMATION ─────────────────── */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-serif text-2xl font-bold border border-[var(--accent)]/30">
              {teacher?.name ? teacher.name.charAt(0) : 'T'}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[var(--text-primary)] tracking-tight">
                  {teacher?.name || 'Faculty Profile'}
                </h1>
                <Badge variant={teacher?.isActive !== false ? 'success' : 'danger'}>
                  {teacher?.isActive !== false ? 'Active Faculty' : 'Inactive'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-xs font-sans text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                  <Award className="w-3.5 h-3.5 text-[var(--accent)]" />
                  {teacher?.designation || 'Faculty Member'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  {teacher?.department?.name || 'Department'} ({teacher?.department?.code || 'CSE'})
                </span>
                <span className="font-mono text-[var(--accent)] bg-[var(--bg-surface-alt)] px-2 py-0.5 rounded-xs border border-[var(--border)]">
                  Faculty ID: @{teacher?.username || '—'}
                </span>
                {teacher?.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    {teacher.email}
                  </span>
                )}
                {teacher?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    {teacher.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEditProfileModal(true)}
              leftIcon={<Edit className="w-4 h-4" />}
            >
              Edit Profile
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                loadSubstituteTeachers();
                loadSubjectsForSubstitution();
                setShowSubstitutionModal(true);
              }}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Substitution
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTeachingHoursModal(true)}
              leftIcon={<Clock className="w-4 h-4" />}
            >
              Manage Hours
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              leftIcon={<PlusIcon className="w-4 h-4" />}
            >
              Add Allocation
            </Button>
          </div>
        </div>
      </Card>

      {/* ── 8 REQUIRED WORKLOAD SUMMARY METRICS (Phase 2 & Phase 3.B) ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-sans font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Academic Workload Statistics
          </h2>
          <span className="text-xs text-[var(--text-secondary)]">5 Days / 6 Periods Schedule</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* 1. Total Weekly Hours */}
          <Card className="p-3.5 border-t-2 border-t-[var(--accent)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-medium text-[var(--text-secondary)]">Total Weekly</span>
              <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
            </div>
            <p className="text-2xl font-bold font-sans text-[var(--text-primary)]">
              {summary?.totalWeeklyHours || 0}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Contact hrs/week</p>
          </Card>

          {/* 2. Theory Hours */}
          <Card className="p-3.5 border-t-2 border-t-blue-500">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-medium text-[var(--text-secondary)]">Theory (L)</span>
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold font-sans text-[var(--text-primary)]">
              {summary?.theoryHours || 0}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Lectures/week</p>
          </Card>

          {/* 3. Tutorial Hours */}
          <Card className="p-3.5 border-t-2 border-t-indigo-500">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-medium text-[var(--text-secondary)]">Tutorial (T)</span>
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold font-sans text-[var(--text-primary)]">
              {summary?.tutorialHours || 0}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Tutorial hrs/week</p>
          </Card>

          {/* 4. Lab / Practical Hours (SEPARATE & PROMINENT) */}
          <Card className="p-3.5 border-t-2 border-t-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-bold text-emerald-700 dark:text-emerald-400">Lab / Practical</span>
              <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold font-sans text-emerald-700 dark:text-emerald-400">
              {summary?.labHours || 0}
            </p>
            <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Practical hrs/week</p>
          </Card>

          {/* 5. Elective Hours */}
          <Card className="p-3.5 border-t-2 border-t-purple-500">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-medium text-[var(--text-secondary)]">Elective</span>
              <Layers className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold font-sans text-[var(--text-primary)]">
              {summary?.electiveHours || 0}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Elective hrs/week</p>
          </Card>

          {/* 6. Subjects Assigned */}
          <Card className="p-3.5 border-t-2 border-t-amber-500">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-medium text-[var(--text-secondary)]">Subjects</span>
              <Award className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold font-sans text-[var(--text-primary)]">
              {summary?.subjectsAssigned ?? summary?.totalSubjects ?? 0}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Distinct subjects</p>
          </Card>

          {/* 7. Sections Handled */}
          <Card className="p-3.5 border-t-2 border-t-cyan-500">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-medium text-[var(--text-secondary)]">Sections</span>
              <Users className="w-3.5 h-3.5 text-cyan-500" />
            </div>
            <p className="text-2xl font-bold font-sans text-[var(--text-primary)]">
              {summary?.sectionsHandled ?? summary?.totalSections ?? 0}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Class sections</p>
          </Card>

          {/* 8. Substitutions */}
          <Card className="p-3.5 border-t-2 border-t-rose-500">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-medium text-[var(--text-secondary)]">Substitutions</span>
              <UserPlus className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <p className="text-2xl font-bold font-sans text-[var(--text-primary)]">
              {summary?.substitutions ?? substitutions?.length ?? 0}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Duty records</p>
          </Card>
        </div>
      </div>

      {/* ── TAB NAVIGATION ────────────────────────────────────────── */}
      <div className="border-b border-[var(--border)]">
        <nav className="flex space-x-6">
          {Object.entries(tabLabels).map(([key, label]) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`py-3 px-1 border-b-2 font-sans text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                }`}
              >
                {label}
                {key === 'labs' && (
                  <span className="ml-2 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                    {labAllocations?.length || 0}
                  </span>
                )}
                {key === 'allocations' && (
                  <span className="ml-2 px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--accent-soft)] text-[var(--accent)] font-bold">
                    {allocations?.length || 0}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── TAB CONTENT ───────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* TAB 1: ALL ALLOCATIONS (Required Phase 3.C) */}
        {activeTab === 'allocations' && (
          <Card>
            <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--text-primary)]">All Subject Allocations</h3>
                <p className="text-xs text-[var(--text-secondary)]">Complete list of academic classes and subjects assigned to this faculty</p>
              </div>
              <Button
                variant="outline"
                size="xs"
                onClick={handleOpenAdd}
                leftIcon={<PlusIcon className="w-3.5 h-3.5" />}
              >
                Assign Subject
              </Button>
            </div>
            <Table
              columns={allocationColumns}
              data={allocations || []}
              loading={false}
              emptyMessage="No academic allocations found for this teacher."
              emptyIcon={BookOpen}
            />
          </Card>
        )}

        {/* TAB 2: DEDICATED LABORATORY BREAKDOWN (Required Phase 3.E) */}
        {activeTab === 'labs' && (
          <Card>
            <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/30 dark:bg-emerald-950/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[var(--text-primary)]">
                    Laboratory & Practical Breakdown
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Exclusively dedicated to practical courses, lab blocks, batch splits, and physical laboratory rooms
                  </p>
                </div>
              </div>
              <Badge variant="success">
                Total Practical Workload: {summary?.labHours || 0} hrs/week
              </Badge>
            </div>
            <Table
              columns={labColumns}
              data={labAllocations || []}
              loading={false}
              emptyMessage="No laboratory or practical allocations assigned to this teacher."
              emptyIcon={FlaskConical}
            />
          </Card>
        )}

        {/* TAB 3: SEMESTER BREAKDOWN (Required Phase 3.D) */}
        {activeTab === 'semesters' && (
          <div className="space-y-4">
            {(!semesterBreakdown || semesterBreakdown.length === 0) ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-[var(--text-secondary)]">No academic allocations found for this teacher.</p>
              </Card>
            ) : (
              semesterBreakdown.map((sem) => (
                <Card key={sem.semester}>
                  <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-surface-alt)] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-xs bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold text-xs">
                        S{sem.semester}
                      </div>
                      <h4 className="text-sm font-bold font-serif text-[var(--text-primary)]">
                        Semester {sem.semester} Workload
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium">
                        Theory: {sem.theoryHours || 0}h
                      </span>
                      <span className="px-2 py-0.5 rounded-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium">
                        Tut: {sem.tutorialHours || 0}h
                      </span>
                      <span className="px-2 py-0.5 rounded-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                        Lab: {sem.labHours || 0}h
                      </span>
                      {sem.electiveHours > 0 && (
                        <span className="px-2 py-0.5 rounded-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-medium">
                          Elective: {sem.electiveHours}h
                        </span>
                      )}
                      <Badge variant="info">
                        Total: {sem.totalWeeklyHours} hrs/week
                      </Badge>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        ({sem.assignedSubjectsCount} subjects, {sem.sectionsHandledCount} sections)
                      </span>
                    </div>
                  </div>

                  <Table
                    columns={allocationColumns.filter(c => c.key !== 'semester')}
                    data={sem.subjects || []}
                    loading={false}
                    emptyMessage="No subjects found in this semester."
                    emptyIcon={BookOpen}
                  />
                </Card>
              ))
            )}
          </div>
        )}

        {/* TAB 4: WORKLOAD SUMMARY (Phase 2 & Phase 7) */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {/* Workload Category Comparison */}
            <Card className="p-5">
              <h4 className="text-sm font-bold font-serif text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--accent)]" />
                Workload Category Classification & Timetable Parity
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-[var(--border)]">
                  <thead>
                    <tr className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)] text-left text-xs font-semibold text-[var(--text-muted)] uppercase">
                      <th className="px-3 py-2.5">Workload Category</th>
                      <th className="px-3 py-2.5 text-right">Assigned Hours</th>
                      <th className="px-3 py-2.5 text-right">Scheduled Slots (Timetable)</th>
                      <th className="px-3 py-2.5">Curricular Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] font-sans">
                    <tr>
                      <td className="px-3 py-2.5 font-medium flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-blue-500" /> Theory Hours (L)
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{summary?.theoryHours || 0} hrs</td>
                      <td className="px-3 py-2.5 text-right font-mono">{scheduledWorkload?.theoryHours ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">Direct lecture instruction sessions</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-medium flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" /> Tutorial Hours (T)
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{summary?.tutorialHours || 0} hrs</td>
                      <td className="px-3 py-2.5 text-right font-mono">—</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">Small group tutorial problem sessions</td>
                    </tr>
                    <tr className="bg-emerald-50/20 dark:bg-emerald-950/10">
                      <td className="px-3 py-2.5 font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                        <FlaskConical className="w-3.5 h-3.5 text-emerald-600" /> Lab / Practical Hours (P)
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {summary?.labHours || 0} hrs
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {scheduledWorkload?.labHours ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                        Hands-on laboratory, systems lab, and project practical blocks
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 font-medium flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-purple-500" /> Elective Hours
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-purple-600">{summary?.electiveHours || 0} hrs</td>
                      <td className="px-3 py-2.5 text-right font-mono text-purple-600">{scheduledWorkload?.electiveHours ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                        Tracked category (included in theory/tut above; not double-counted in total)
                      </td>
                    </tr>
                    <tr className="bg-[var(--accent-soft)] font-bold">
                      <td className="px-3 py-2.5 text-[var(--accent)] font-serif">Total Weekly Workload</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[var(--accent)]">{summary?.totalWeeklyHours || 0} hrs</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[var(--accent)]">{scheduledWorkload?.totalWeeklyHours ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-primary)]">
                        Sum of Theory + Tutorial + Practical contact hours
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Categorized Subject Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Theory Subjects */}
              <Card className="p-4">
                <h4 className="text-sm font-bold font-serif text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" /> Theory Course Allocations
                </h4>
                <div className="space-y-2">
                  {allocations?.filter(a => a.type === 'theory').length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)]">No theory subjects assigned.</p>
                  ) : (
                    allocations?.filter(a => a.type === 'theory').map((alloc, idx) => (
                      <div key={idx} className="p-2 rounded-xs bg-[var(--bg-surface-alt)] flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">{alloc.subjectName}</p>
                          <p className="font-mono text-[var(--text-muted)]">{alloc.courseCode} • {alloc.branch} S{alloc.semester} {alloc.section}</p>
                        </div>
                        <span className="font-mono font-bold text-blue-600">{alloc.totalHours} hrs</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Lab Subjects */}
              <Card className="p-4">
                <h4 className="text-sm font-bold font-serif text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-emerald-500" /> Laboratory Course Allocations
                </h4>
                <div className="space-y-2">
                  {allocations?.filter(a => a.type === 'lab' || a.labHours > 0).length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)]">No laboratory subjects assigned.</p>
                  ) : (
                    allocations?.filter(a => a.type === 'lab' || a.labHours > 0).map((alloc, idx) => (
                      <div key={idx} className="p-2 rounded-xs bg-emerald-50/20 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">{alloc.subjectName}</p>
                          <p className="font-mono text-[var(--text-muted)]">
                            {alloc.courseCode} • {alloc.branch} S{alloc.semester} {alloc.section} {alloc.batch ? `(${alloc.batch})` : ''}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-emerald-600">{alloc.labHours || alloc.totalHours} hrs</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 5: SUBSTITUTIONS HISTORY */}
        {activeTab === 'substitutions' && (
          <div className="space-y-4">
            <Card>
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-[var(--text-primary)]">Substitution Records</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Historical coverage and temporary class assignments for this faculty</p>
                </div>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => {
                    loadSubstituteTeachers();
                    loadSubjectsForSubstitution();
                    setShowSubstitutionModal(true);
                  }}
                  leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                >
                  Assign Substitution
                </Button>
              </div>

              {substitutionLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : substitutions?.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
                  No substitution records found for this teacher.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-[var(--border)] font-sans">
                    <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Period</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Class</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Subject</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Substitute</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {substitutions.map((s) => (
                        <tr key={s._id} className="hover:bg-[var(--bg-hover)]">
                          <td className="px-3 py-2">{new Date(s.date).toLocaleDateString()}</td>
                          <td className="px-3 py-2 font-mono">Period {s.period}</td>
                          <td className="px-3 py-2">{s.classId?.name || 'Class'}</td>
                          <td className="px-3 py-2 font-medium">{s.subjectId?.name || 'Subject'}</td>
                          <td className="px-3 py-2">{s.substituteTeacherId?.name || '—'}</td>
                          <td className="px-3 py-2">
                            <Badge variant={s.status === 'approved' ? 'success' : 'warning'}>
                              {s.status || 'pending'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* ── MODALS (PRESERVED & ENHANCED) ─────────────────────────── */}
      {/* 1. Add / Edit Allocation Modal */}
      {showAddAllocation && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddAllocation(false)}
          size="lg"
          title={editingAlloc ? 'Edit Subject Allocation' : 'Add Subject Allocation'}
        >
          <form
            onSubmit={handleSubmit((data) => onAddAllocationSubmit(data))}
            className="space-y-4 font-sans text-sm"
          >
            <Input
              label="Subject Code"
              required
              placeholder="e.g. CST448"
              {...register('subjectCode', {
                required: 'Subject code is required',
                pattern: {
                  value: /^[A-Z0-9]+$/,
                  message: 'Must be alphanumeric uppercase',
                },
              })}
            />
            <Input
              label="Subject Name"
              required
              placeholder="e.g. Internet of Things"
              {...register('subjectName', {
                required: 'Subject name is required',
                minLength: { value: 2, message: 'Min 2 characters' },
              })}
            />
            <Select
              label="Class / Section"
              placeholder="Select a class"
              required
              options={(Array.isArray(classes) ? classes : []).map((c) => ({
                value: c._id || c.id,
                label: `${c.name || `S${c.semester} ${c.section}`} (${c.departmentId?.name || 'CSE'})`.trim(),
              }))}
              {...register('classId', { required: 'Class is required' })}
            />
            <Select
              label="Subject Type"
              placeholder="Select type"
              required
              options={[
                { label: 'Theory', value: 'theory' },
                { label: 'Lab / Practical', value: 'lab' },
                { label: 'Elective', value: 'elective' },
              ]}
              value={selectedType}
              {...register('type', {
                required: 'Subject type is required',
                onChange: (e) => setSelectedType(e.target.value),
              })}
            />
            {(selectedType === 'theory' || selectedType === 'elective') && (
              <Input
                label="Weekly Contact Hours"
                type="number"
                placeholder="e.g. 4"
                {...register('weeklyHours', {
                  required: 'Weekly hours are required for theory/elective',
                  min: { value: 1, message: 'Must be at least 1' },
                })}
              />
            )}
            {selectedType === 'lab' && (
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="L (Lecture)"
                  type="number"
                  placeholder="0"
                  {...register('L', { min: { value: 0, message: 'Must be >= 0' } })}
                />
                <Input
                  label="T (Tutorial)"
                  type="number"
                  placeholder="0"
                  {...register('T', { min: { value: 0, message: 'Must be >= 0' } })}
                />
                <Input
                  label="P (Practical)"
                  type="number"
                  placeholder="3"
                  {...register('P', { min: { value: 0, message: 'Must be >= 0' } })}
                />
              </div>
            )}
            {selectedType === 'elective' && (
              <Input
                label="Elective Group (optional)"
                placeholder="e.g. S8 CSE Elective 3"
                {...register('electiveGroup')}
              />
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddAllocation(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
              >
                {editingAlloc ? 'Save Changes' : 'Add Allocation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. Assign Substitution Modal */}
      {showSubstitutionModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowSubstitutionModal(false)}
          size="lg"
          title="Assign Faculty Substitution"
        >
          <form
            onSubmit={handleSubSubmit((data) => onSubstitutionSubmit(data))}
            className="space-y-4 font-sans text-sm"
          >
            <Input
              label="Absent Faculty Member"
              placeholder={teacher?.name || 'Current faculty'}
              defaultValue={teacher?.name || ''}
              disabled
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Date"
                type="date"
                required
                {...regSub('date', { required: 'Date is required' })}
              />
              <Select
                label="Period"
                placeholder="Select period"
                required
                options={[
                  { value: '1', label: 'Period 1' },
                  { value: '2', label: 'Period 2' },
                  { value: '3', label: 'Period 3' },
                  { value: '4', label: 'Period 4' },
                  { value: '5', label: 'Period 5' },
                  { value: '6', label: 'Period 6' },
                ]}
                {...regSub('period', { required: 'Period is required' })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Class / Section"
                placeholder="Select a class"
                required
                options={(Array.isArray(classes) ? classes : []).map((c) => ({
                  value: c._id || c.id,
                  label: c.name || `S${c.semester} ${c.section}`,
                }))}
                {...regSub('classId', { required: 'Class is required' })}
              />
              <Select
                label="Subject"
                placeholder="Select a subject"
                required
                options={subjectsForSubstitution}
                {...regSub('subjectId', { required: 'Subject is required' })}
              />
            </div>
            <Select
              label="Substitute Teacher"
              placeholder="Select substitute teacher"
              required
              options={(Array.isArray(substituteTeachers) ? substituteTeachers : []).map((t) => ({
                value: t._id || t.id,
                label: `${t.name} (@${t.username || 'faculty'})`,
              }))}
              {...regSub('substituteTeacherId', { required: 'Substitute teacher is required' })}
            />
            <Input
              label="Reason (optional)"
              placeholder="e.g. University duty / Medical leave"
              {...regSub('reason')}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSubstitutionModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
              >
                Assign Substitution
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Manage Teaching Hours Modal */}
      {showTeachingHoursModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowTeachingHoursModal(false)}
          size="xl"
          title="Manage Faculty Teaching Hours"
        >
          <div className="space-y-4 font-sans text-sm">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h3 className="font-serif font-bold text-base text-[var(--text-primary)]">
                {teacher?.name} — Teaching Hours
              </h3>
              <Badge variant="info">{summary?.totalWeeklyHours || 0} hrs/week</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-[var(--border)]">
                <thead className="bg-[var(--bg-surface-alt)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Subject</th>
                    <th className="px-3 py-2 text-left font-semibold">Class / Section</th>
                    <th className="px-3 py-2 text-left font-semibold">Semester</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-right font-semibold">Hours</th>
                    <th className="px-3 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {allocations?.map((alloc) => (
                    <tr key={alloc.subjectId || alloc.subjectName}>
                      <td className="px-3 py-2 font-medium">{alloc.subjectName} ({alloc.courseCode})</td>
                      <td className="px-3 py-2">{alloc.className || `${alloc.branch} ${alloc.section}`}</td>
                      <td className="px-3 py-2 font-mono">S{alloc.semester}</td>
                      <td className="px-3 py-2">
                        <Badge variant={alloc.type === 'lab' ? 'success' : alloc.type === 'elective' ? 'purple' : 'blue'}>
                          {alloc.type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-[var(--accent)]">{alloc.totalHours || alloc.hours} hrs</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => {
                            setShowTeachingHoursModal(false);
                            handleOpenEdit(alloc);
                          }}
                          className="text-xs text-[var(--accent)] hover:underline mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onRemoveAllocation(alloc.subjectId)}
                          className="text-xs text-[var(--error)] hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FacultyProfile;
