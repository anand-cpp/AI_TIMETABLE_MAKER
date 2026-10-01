import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Breadcrumb from '../../components/ui/Breadcrumb';
import departmentService from '../../services/departmentService';
import classService from '../../services/classService';
import teacherService from '../../services/teacherService';
import subjectService from '../../services/subjectService';
import timetableService from '../../services/timetableService';
import settingsService from '../../services/settingsService';
import {
  Building2,
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  Zap,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';

const AnimatedCounter = ({ value }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!value) {
      setCount(0);
      return;
    }
    let start = 0;
    const duration = 800;
    const stepTime = 30;
    const steps = Math.max(Math.floor(duration / stepTime), 1);
    const increment = value / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{count}</span>;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [activeResetType, setActiveResetType] = useState(null); // 'timetables' | 'subjects' | 'all'

  const [stats, setStats] = useState({
    departments: 0,
    classes: 0,
    teachers: 0,
    subjects: 0,
    acceptedTimetable: null,
  });

  const loadStats = async () => {
    try {
      setLoading(true);
      const [depts, classes, teachers, subjects] = await Promise.allSettled([
        departmentService.getAll(),
        classService.getAll(),
        teacherService.getAll(),
        subjectService.getAll(),
      ]);

      let acceptedTimetable = null;
      try {
        const accepted = await timetableService.getAccepted();
        acceptedTimetable = accepted.data.timetable;
      } catch {
        acceptedTimetable = null;
      }

      setStats({
        departments: depts.value?.data?.departments?.length || 0,
        classes: classes.value?.data?.classes?.length || 0,
        teachers: teachers.value?.data?.teachers?.length || 0,
        subjects: subjects.value?.data?.subjects?.length || 0,
        acceptedTimetable,
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    const handleKeyDown = async (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        try {
          toast.loading('Dev Seed: Populating KTU dataset...', { id: 'dev-seed' });
          const { seedKTUDummyData } = await import('../../data/seedDummyData');
          await seedKTUDummyData();
          toast.success('Dev Seed Complete!', { id: 'dev-seed' });
          loadStats();
        } catch (err) {
          toast.error('Dev Seed Failed', { id: 'dev-seed' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResetExecute = async () => {
    try {
      setClearing(true);
      if (activeResetType === 'timetables') {
        await settingsService.clearTimetables();
        toast.success('Generated timetables cleared. Departments, classes, teachers, and subjects retained!');
      } else if (activeResetType === 'subjects') {
        await settingsService.clearSubjectsAndTimetables();
        toast.success('Subjects & timetables cleared. Departments, classes, and teachers retained!');
      } else if (activeResetType === 'all') {
        await settingsService.wipeAllData();
        toast.success('All system data deleted. Admin account retained!');
      }
      setActiveResetType(null);
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // Calculate setup progress percentage
  const completedSteps = [
    stats.departments > 0,
    stats.classes > 0,
    stats.teachers > 0,
    stats.subjects > 0,
  ].filter(Boolean).length;
  const progressPercent = Math.round((completedSteps / 4) * 100);

  const nextStepUrl =
    stats.departments === 0
      ? '/admin/departments'
      : stats.classes === 0
      ? '/admin/classes'
      : stats.teachers === 0
      ? '/admin/teachers'
      : stats.subjects === 0
      ? '/admin/subjects'
      : '/admin/timetable';

  const steps = [
    {
      step: 1,
      title: 'Departments',
      count: stats.departments,
      unit: 'Departments',
      description: 'Add college departments (e.g. Computer Science, Electronics)',
      icon: Building2,
      to: '/admin/departments',
      done: stats.departments > 0,
    },
    {
      step: 2,
      title: 'Classes & Sections',
      count: stats.classes,
      unit: 'Classes',
      description: 'Add class sections and semesters (e.g. Semester 5 - Section A)',
      icon: GraduationCap,
      to: '/admin/classes',
      done: stats.classes > 0,
    },
    {
      step: 3,
      title: 'Faculty / Teachers',
      count: stats.teachers,
      unit: 'Teachers',
      description: 'Add teacher profiles & workload limits',
      icon: Users,
      to: '/admin/teachers',
      done: stats.teachers > 0,
    },
    {
      step: 4,
      title: 'Subjects & Labs',
      count: stats.subjects,
      unit: 'Subjects',
      description: 'Add subjects, weekly hours, and assign faculty members',
      icon: BookOpen,
      to: '/admin/subjects',
      done: stats.subjects > 0,
    },
  ];

  const canGenerate = completedSteps === 4;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <Breadcrumb items={[{ label: 'Dashboard' }]} />

      <PageHeader
        title="Control Dashboard"
        description="Simple, guided overview to build and manage your college timetables"
      />

      {/* ── TOP HERO SECTION ───────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] border-l-[4px] border-l-[var(--accent)] rounded-md px-8 py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--accent)] block">
            AI TIMETABLE MAKER V2.0
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[var(--text-primary)]">
            Welcome back, Admin 👋
          </h2>
          <p className="font-sans text-sm text-[var(--text-secondary)] leading-relaxed">
            Let's build your timetable in 4 easy steps. Complete your college setup below or generate your schedules automatically.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
          <Button
            size="md"
            variant="outline"
            onClick={() => navigate(nextStepUrl)}
            leftIcon={<ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
            className="w-full sm:w-auto justify-center"
          >
            {completedSteps < 4 ? 'Continue Setup' : 'Review Setup'}
          </Button>
          <Button
            size="md"
            onClick={() => navigate('/admin/timetable')}
            disabled={!canGenerate}
            leftIcon={<Zap className="w-4 h-4" strokeWidth={1.5} />}
            className="w-full sm:w-auto justify-center"
          >
            Create Timetable Now
          </Button>
        </div>
      </div>

      {/* ── VISUAL PROGRESS OVERVIEW CARD ───────────────────────────────────── */}
      <div className="bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-md p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-serif text-xl font-normal text-[var(--text-primary)]">
              Setup Progress Checklist
            </h3>
            <p className="font-sans text-xs text-[var(--text-secondary)] mt-0.5">
              {completedSteps === 4
                ? "You're 100% all set! Ready to generate timetables."
                : `You're ${progressPercent}% ready to generate timetables!`}
            </p>
          </div>
          <span className="font-mono text-xl font-bold text-[var(--accent)]">
            {progressPercent}% Complete
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 4 Step Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {steps.map((s) => (
            <div
              key={s.step}
              onClick={() => navigate(s.to)}
              className="p-3 rounded-sm bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-between cursor-pointer hover:border-[var(--border-strong)] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <s.icon className={`w-4 h-4 shrink-0 ${s.done ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} strokeWidth={1.5} />
                <span className="text-xs font-sans truncate text-[var(--text-primary)]">
                  {s.step}. {s.title.split(' ')[0]}
                </span>
              </div>
              {s.done ? (
                <span className="text-xs font-semibold text-[var(--accent)] shrink-0">✓</span>
              ) : (
                <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">0</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK ACTIONS GRID (3 CARDS) ───────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--text-label)]">
          TIMETABLE CREATION PORTALS
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Full College Timetable */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 flex flex-col justify-between space-y-4 hover:border-[var(--border-strong)] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center">
                <Zap className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="font-serif text-xl font-normal text-[var(--text-primary)]">
                  Quick Timetable
                </h4>
                <p className="font-sans text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Generate a conflict-free timetable for all college departments and classes simultaneously.
                </p>
              </div>
            </div>

            <Button
              fullWidth
              onClick={() => navigate('/admin/timetable')}
              disabled={!canGenerate}
              size="sm"
              leftIcon={<Sparkles className="w-4 h-4" strokeWidth={1.5} />}
            >
              Create Full Timetable
            </Button>
          </div>

          {/* Card 2: Department Timetable */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 flex flex-col justify-between space-y-4 hover:border-[var(--border-strong)] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center">
                <Building2 className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="font-serif text-xl font-normal text-[var(--text-primary)]">
                  Department Timetable
                </h4>
                <p className="font-sans text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Generate a schedule for a single department with cross-department teacher availability checks.
                </p>
              </div>
            </div>

            <Button
              fullWidth
              variant="secondary"
              onClick={() => navigate('/admin/department-timetable')}
              disabled={stats.departments === 0}
              size="sm"
              leftIcon={<Building2 className="w-4 h-4" strokeWidth={1.5} />}
            >
              Create Dept Timetable
            </Button>
          </div>

          {/* Card 3: Year-Wise Timetable */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 flex flex-col justify-between space-y-4 hover:border-[var(--border-strong)] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center">
                <Calendar className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="font-serif text-xl font-normal text-[var(--text-primary)]">
                  Year-Wise Timetable
                </h4>
                <p className="font-sans text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Generate a granular schedule for a specific academic year, semester, or section.
                </p>
              </div>
            </div>

            <Button
              fullWidth
              variant="secondary"
              onClick={() => navigate('/admin/year-timetable')}
              disabled={stats.classes === 0}
              size="sm"
              leftIcon={<Calendar className="w-4 h-4" strokeWidth={1.5} />}
            >
              Create Year-Wise Timetable
            </Button>
          </div>
        </div>
      </div>

      {/* Official Published Timetable Section */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[var(--accent)]" strokeWidth={1.5} />
            <h3 className="font-serif text-xl font-normal text-[var(--text-primary)]">
              Official Published Timetable
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/timetable')}
          >
            View Timetables
          </Button>
        </div>

        {stats.acceptedTimetable ? (
          <div className="p-5 bg-[var(--accent-soft)] rounded-md border border-[var(--border)] flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[var(--accent)]" strokeWidth={1.5} />
                <p className="font-serif text-lg text-[var(--text-primary)]">
                  {stats.acceptedTimetable.label || `Version ${stats.acceptedTimetable.version}`}
                </p>
              </div>
              <p className="font-sans text-xs text-[var(--text-secondary)] mt-1">
                Ready & published for students and faculty
              </p>
            </div>

            <div className="text-right">
              <span className="font-mono text-3xl font-medium text-[var(--accent)]">
                {stats.acceptedTimetable.qualityScore?.overall || 98}/100
              </span>
              <p className="font-sans text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
                QUALITY SCORE
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-[var(--bg-surface-alt)] rounded-md border border-dashed border-[var(--border)] space-y-3">
            <p className="font-sans text-sm text-[var(--text-secondary)]">
              No official timetable published yet. Complete setup and click Create Timetable!
            </p>
            <Button
              size="sm"
              onClick={() => navigate('/admin/timetable')}
              leftIcon={<Zap className="w-4 h-4" strokeWidth={1.5} />}
            >
              Go to Timetable Builder
            </Button>
          </div>
        )}
      </div>

      {/* Granular Reset Options */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between px-1 font-sans text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          <span className="flex items-center gap-2 text-[var(--warning)]">
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            Granular Reset Options (Safe Management)
          </span>
          <span>Choose exact scope to prevent accidental data loss</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Timetables Only */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-sm text-[10px] font-sans font-semibold uppercase tracking-widest bg-[var(--bg-surface-alt)] text-[var(--warning)] border border-[var(--border)] inline-block">
                🟡 Safe Semester Reset
              </span>
              <h4 className="font-serif text-lg font-normal text-[var(--text-primary)]">
                Clear Timetables Only
              </h4>
              <p className="font-sans text-xs text-[var(--text-secondary)] leading-relaxed">
                Deletes generated timetable schedules only.
              </p>
              <div className="p-3 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] font-sans text-[11px] font-medium text-[var(--text-secondary)]">
                ✅ Keeps Departments, Classes, Teachers & Subjects safe!
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => setActiveResetType('timetables')}
              className="w-full justify-center text-[var(--text-primary)]"
              leftIcon={<Trash2 className="w-4 h-4" strokeWidth={1.5} />}
            >
              Reset Timetables Only
            </Button>
          </div>

          {/* Card 2: Subjects & Timetables */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-sm text-[10px] font-sans font-semibold uppercase tracking-widest bg-[var(--bg-surface-alt)] text-[var(--warning)] border border-[var(--border)] inline-block">
                🟠 Curriculum Reset
              </span>
              <h4 className="font-serif text-lg font-normal text-[var(--text-primary)]">
                Clear Subjects & Timetables
              </h4>
              <p className="font-sans text-xs text-[var(--text-secondary)] leading-relaxed">
                Deletes subjects and generated timetables.
              </p>
              <div className="p-3 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] font-sans text-[11px] font-medium text-[var(--text-secondary)]">
                ✅ Keeps Departments, Classes & Teachers safe!
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => setActiveResetType('subjects')}
              className="w-full justify-center text-[var(--text-primary)]"
              leftIcon={<Trash2 className="w-4 h-4" strokeWidth={1.5} />}
            >
              Reset Subjects & Timetables
            </Button>
          </div>

          {/* Card 3: Full System Wipe */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-sm text-[10px] font-sans font-semibold uppercase tracking-widest bg-[var(--bg-surface-alt)] text-[var(--error)] border border-[var(--border)] inline-block">
                🔴 Danger Zone
              </span>
              <h4 className="font-serif text-lg font-normal text-[var(--text-primary)]">
                Delete All System Data
              </h4>
              <p className="font-sans text-xs text-[var(--text-secondary)] leading-relaxed">
                Complete factory wipe of all data.
              </p>
              <div className="p-3 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] font-sans text-[11px] font-medium text-[var(--error)]">
                ⚠️ Wipes Departments, Classes, Teachers, Subjects & Timetables.
              </div>
            </div>

            <Button
              variant="danger"
              onClick={() => setActiveResetType('all')}
              className="w-full justify-center"
              leftIcon={<Trash2 className="w-4 h-4" strokeWidth={1.5} />}
            >
              Wipe Everything
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!activeResetType}
        onClose={() => setActiveResetType(null)}
        onConfirm={handleResetExecute}
        loading={clearing}
        title={
          activeResetType === 'timetables'
            ? 'Clear Timetables Only?'
            : activeResetType === 'subjects'
            ? 'Clear Subjects & Timetables?'
            : 'Delete All System Data?'
        }
        message={
          activeResetType === 'timetables'
            ? 'This will delete generated timetables only. Your Departments, Classes, Teachers, and Subjects will NOT be touched. Continue?'
            : activeResetType === 'subjects'
            ? 'This will delete subjects and timetables. Your Departments, Classes, and Teachers will NOT be touched. Continue?'
            : '⚠️ WARNING: This will delete ALL departments, classes, teachers, subjects, and timetables. Your admin login account will remain active.'
        }
        confirmText={
          activeResetType === 'timetables'
            ? 'Yes, Clear Timetables'
            : activeResetType === 'subjects'
            ? 'Yes, Clear Subjects & Timetables'
            : 'Yes, Delete Everything'
        }
        cancelText="Cancel"
        variant={activeResetType === 'all' ? 'danger' : 'warning'}
      />
    </div>
  );
};

export default Dashboard;