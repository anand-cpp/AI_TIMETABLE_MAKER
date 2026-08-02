import { useState } from 'react';
import { Link } from 'react-router-dom';
import ClassDropdowns from '../../components/student/ClassDropdowns';
import StudentTimetableGrid from '../../components/student/StudentTimetableGrid';
import api from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { useTheme } from '../../context/ThemeContext';
import {
  Sparkles,
  RefreshCw,
  Calendar,
  ShieldCheck,
  GraduationCap,
  Moon,
  Sun,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';

const StudentView = () => {
  const { theme, toggleTheme } = useTheme();
  const [timetable, setTimetable] = useState(null);
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async ({ departmentId, semester, section }) => {
    try {
      setLoading(true);
      setNotFound(false);
      setTimetable(null);
      setClassInfo(null);
      setSearched(true);

      const res = await api.get(
        `/student/timetable/${departmentId}/${semester}/${section}`
      );
      setTimetable(res.data.data.timetable);
      setClassInfo(res.data.data.class);
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        toast.error(err.response?.data?.message || 'Failed to load timetable');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTimetable(null);
    setClassInfo(null);
    setSearched(false);
    setNotFound(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500 relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6 max-w-7xl mx-auto border-b border-slate-200/50 dark:border-slate-800/50">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-display font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
              Timetable<span className="text-blue-600 dark:text-blue-400">.AI</span>
            </span>
            <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Student Viewer
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl glass hover:scale-105 transition-transform duration-200"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-slate-700" />
            ) : (
              <Sun className="w-5 h-5 text-amber-400" />
            )}
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 py-10">
        {!timetable ? (
          /* Search panel */
          <div className="w-full max-w-md mx-auto animate-fade-in">
            {/* Logo / header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-teal-500/20">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
                Class Timetable Portal
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
                Select department, semester, & section to view live schedule
              </p>
            </div>

            {/* Search form */}
            <div className="glass p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800">
              <div className="space-y-4">
                <ClassDropdowns onSearch={handleSearch} loading={loading} />
              </div>
            </div>

            {/* Not found message */}
            {notFound && searched && (
              <div className="mt-5 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl text-center">
                <p className="text-rose-700 dark:text-rose-300 text-sm font-bold">
                  No published timetable found for this section
                </p>
                <p className="text-rose-600/80 dark:text-rose-400/80 text-xs mt-1">
                  The schedule may still be under administrative review. Please check back later.
                </p>
              </div>
            )}

            {/* Links */}
            <div className="mt-8 flex justify-center gap-6 text-xs font-semibold">
              <Link
                to="/teacher/login"
                className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <GraduationCap className="w-4 h-4" />
                Teacher Login
              </Link>
              <Link
                to="/admin/login"
                className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Login
              </Link>
            </div>
          </div>
        ) : (
          /* Timetable display */
          <div className="animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4 glass p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800">
              <div>
                <h2 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white">
                  {classInfo?.department?.name}
                  <span className="text-blue-600 dark:text-blue-400 ml-2 text-lg font-bold">
                    Semester {classInfo?.semester} · Section {classInfo?.section}
                  </span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  Published {formatDate(timetable.acceptedAt || timetable.generatedAt)}
                  {' '}· Version {timetable.version}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Search Another Class
              </button>
            </div>

            {/* Timetable Grid Container */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 p-2 sm:p-4">
              <StudentTimetableGrid slots={timetable.slots || []} />
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-slate-600 dark:text-slate-400 text-xs font-bold">
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-blue-100 dark:bg-blue-900/60 border border-blue-300 dark:border-blue-700 inline-block" />
                Theory Lecture
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-purple-100 dark:bg-purple-900/60 border border-purple-300 dark:border-purple-700 inline-block" />
                Practical Lab
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 inline-block" />
                Elective Course
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-slate-200 dark:bg-slate-800 inline-block" />
                Interval Break
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentView;