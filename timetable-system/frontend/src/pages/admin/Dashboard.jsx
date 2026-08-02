import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
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
  HelpCircle,
  Layers,
} from 'lucide-react';

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

  const steps = [
    {
      step: 1,
      title: 'Departments',
      count: stats.departments,
      unit: 'Departments',
      description: 'Add college departments (e.g. Computer Science, Electronics)',
      icon: Building2,
      to: '/admin/departments',
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      btnColor: 'from-blue-600 to-indigo-600',
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
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      btnColor: 'from-emerald-600 to-teal-600',
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
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      btnColor: 'from-purple-600 to-violet-600',
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
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      btnColor: 'from-amber-600 to-orange-600',
      done: stats.subjects > 0,
    },
  ];

  const canGenerate = stats.departments > 0 && stats.classes > 0 && stats.teachers > 0 && stats.subjects > 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Admin Control Center"
        description="Simple 4-step wizard to set up your college schedule and generate AI timetables"
        action={
          <Button
            onClick={() => navigate('/admin/timetable')}
            leftIcon={<Zap className="w-4 h-4" />}
          >
            Generate Timetable
          </Button>
        }
      />

      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-slate-900 text-white shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-cyan-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Simple Guide
            </div>
            <h2 className="text-2xl font-display font-extrabold tracking-tight">
              How to Create Your Timetable in 4 Steps
            </h2>
            <p className="text-slate-300 text-sm font-medium leading-relaxed max-w-2xl">
              Follow steps 1 to 4 below. Add your Departments, Classes, Teachers, and Subjects — then click <strong>Generate Timetable</strong>!
            </p>
          </div>

          <button
            onClick={() => navigate('/admin/timetable')}
            disabled={!canGenerate}
            className={`px-6 py-3.5 rounded-2xl font-display font-black text-sm tracking-wide flex items-center gap-2.5 transition-all shrink-0 ${
              canGenerate
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/30 hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-white/10 text-slate-400 border border-white/10 cursor-not-allowed'
            }`}
          >
            <span>{canGenerate ? 'Start AI Generator' : 'Add Required Data First'}</span>
            <ArrowRight className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2 text-xs font-black uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-500" /> Setup Progress Stack (Steps 1 to 4)
          </span>
          <span>Click Any Step to Manage</span>
        </div>

        {steps.map((item) => (
          <div
            key={item.step}
            onClick={() => navigate(item.to)}
            className="glass-panel p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-blue-500/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white font-display font-black text-sm flex items-center justify-center shrink-0 border border-slate-700 shadow-sm">
                #{item.step}
              </span>

              <div className={`p-3 rounded-2xl border ${item.color} shrink-0`}>
                <item.icon className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                    {item.title}
                  </h3>
                  {item.done ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase">
                      ✓ Configured ({item.count})
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase">
                      Needs Setup (0)
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              <div className="text-right px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Items</span>
                <span className="font-display font-black text-lg text-slate-900 dark:text-white leading-none">{item.count}</span>
              </div>

              <div className={`py-2.5 px-4 rounded-xl font-display font-bold text-xs flex items-center gap-2 text-white bg-gradient-to-r ${item.btnColor} shadow-sm group-hover:scale-105 transition-all`}>
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-emerald-500" />
            <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
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
          <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <p className="font-display font-bold text-lg text-emerald-950 dark:text-emerald-200">
                  {stats.acceptedTimetable.label || `Version ${stats.acceptedTimetable.version}`}
                </p>
              </div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                Ready & published for students and faculty
              </p>
            </div>

            <div className="text-right">
              <span className="font-display font-black text-3xl text-emerald-700 dark:text-emerald-300">
                {stats.acceptedTimetable.qualityScore?.overall || 98}/100
              </span>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Quality Score</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              No official timetable created yet. Follow steps 1 to 4 to generate one!
            </p>
            <Button
              size="sm"
              onClick={() => navigate('/admin/timetable')}
              leftIcon={<Zap className="w-4 h-4" />}
            >
              Go to Timetable Builder
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between px-2 text-xs font-black uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5 text-amber-500">
            <Trash2 className="w-4 h-4" /> Granular Reset Options (Safe Management)
          </span>
          <span>Choose exact scope to prevent accidental data loss</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Timetables Only (Safe Semester Reset) */}
          <div className="glass-panel p-5 rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                🟡 Safe Semester Reset
              </span>
              <h4 className="font-display font-extrabold text-base text-slate-900 dark:text-white">
                Clear Timetables Only
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed font-semibold">
                Deletes generated timetable schedules only.
              </p>
              <div className="p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[11px] font-bold text-amber-950 dark:text-amber-200">
                ✅ Keeps Departments, Classes, Teachers & Subjects safe!
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => setActiveResetType('timetables')}
              className="w-full justify-center text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50"
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Reset Timetables Only
            </Button>
          </div>

          {/* Card 2: Subjects & Timetables (Curriculum Reset) */}
          <div className="glass-panel p-5 rounded-3xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-950/20 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-800">
                🟠 Curriculum Reset
              </span>
              <h4 className="font-display font-extrabold text-base text-slate-900 dark:text-white">
                Clear Subjects & Timetables
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed font-semibold">
                Deletes subjects and generated timetables.
              </p>
              <div className="p-2.5 rounded-xl bg-orange-100/60 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 text-[11px] font-bold text-orange-950 dark:text-orange-200">
                ✅ Keeps Departments, Classes & Teachers safe!
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => setActiveResetType('subjects')}
              className="w-full justify-center text-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/50"
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Reset Subjects & Timetables
            </Button>
          </div>

          {/* Card 3: Full System Wipe (Danger Zone) */}
          <div className="glass-panel p-5 rounded-3xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                🔴 Danger Zone
              </span>
              <h4 className="font-display font-extrabold text-base text-slate-900 dark:text-white">
                Delete All System Data
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed font-semibold">
                Complete factory wipe of all data.
              </p>
              <div className="p-2.5 rounded-xl bg-rose-100/60 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-[11px] font-bold text-rose-950 dark:text-rose-200">
                ⚠️ Wipes Departments, Classes, Teachers, Subjects & Timetables.
              </div>
            </div>

            <Button
              variant="danger"
              onClick={() => setActiveResetType('all')}
              className="w-full justify-center"
              leftIcon={<Trash2 className="w-4 h-4" />}
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