import { useState } from 'react';
import { Link } from 'react-router-dom';
import ClassDropdowns from '../../components/student/ClassDropdowns';
import StudentTimetableGrid from '../../components/student/StudentTimetableGrid';
import api from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { useTheme } from '../../context/ThemeContext';
import {
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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200 relative overflow-hidden">
      {/* Top Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto border-b border-[var(--border)]">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center border border-[var(--border)]">
            <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-serif font-normal text-xl tracking-tight text-[var(--text-primary)]">
              Timetable.AI
            </span>
            <span className="px-2 py-0.5 text-[10px] font-sans font-semibold uppercase tracking-widest rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)]">
              Student Portal
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-sm bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200 cursor-pointer"
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" strokeWidth={1.5} />
            ) : (
              <Moon className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 py-10">
        {!timetable ? (
          /* Search panel */
          <div className="w-full max-w-md mx-auto">
            {/* Logo / header */}
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-[var(--accent-soft)] border border-[var(--border)] rounded-md flex items-center justify-center mx-auto mb-4 text-[var(--accent)]">
                <BookOpen className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl font-serif font-normal text-[var(--text-primary)] tracking-tight">
                Class Timetable Portal
              </h1>
              <p className="text-[var(--text-secondary)] mt-2 text-sm font-sans">
                Select department, semester, & section to view live schedule
              </p>
            </div>

            {/* Search form */}
            <div className="bg-[var(--bg-surface)] p-6 sm:p-8 rounded-md border border-[var(--border)]">
              <div className="space-y-4">
                <ClassDropdowns onSearch={handleSearch} loading={loading} />
              </div>
            </div>

            {/* Not found message */}
            {notFound && searched && (
              <div className="mt-5 p-4 bg-[var(--bg-surface-alt)] border border-[var(--error)]/40 rounded-md text-center">
                <p className="text-[var(--error)] text-sm font-semibold">
                  No published timetable found for this section
                </p>
                <p className="text-[var(--text-secondary)] text-xs mt-1">
                  The schedule may still be under administrative review. Please check back later.
                </p>
              </div>
            )}

            {/* Links */}
            <div className="mt-8 flex justify-center gap-6 text-xs font-sans font-medium">
              <Link
                to="/teacher/login"
                className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              >
                <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
                Teacher Login
              </Link>
              <Link
                to="/admin/login"
                className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              >
                <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
                Admin Login
              </Link>
            </div>
          </div>
        ) : (
          /* Timetable display */
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4 bg-[var(--bg-surface)] p-6 rounded-md border border-[var(--border)]">
              <div>
                <h2 className="text-2xl font-serif font-normal text-[var(--text-primary)]">
                  {classInfo?.department?.name}
                  <span className="text-[var(--accent)] ml-2 text-lg font-sans font-medium">
                    Semester {classInfo?.semester} · Section {classInfo?.section}
                  </span>
                </h2>
                <p className="text-[var(--text-secondary)] text-xs font-sans mt-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--success)]" strokeWidth={1.5} />
                  Published {formatDate(timetable.acceptedAt || timetable.generatedAt)}
                  {' '}· Version {timetable.version}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-xs font-sans font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                Search Another Class
              </button>
            </div>

            {/* Timetable Grid Container */}
            <div className="bg-[var(--bg-surface)] rounded-md border border-[var(--border)] p-2 sm:p-4">
              <StudentTimetableGrid slots={timetable.slots || []} />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-[var(--text-secondary)] text-xs font-sans font-medium">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs bg-[var(--accent-soft)] border border-[var(--border)] inline-block" />
                Theory Lecture
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs bg-[var(--bg-surface-alt)] border border-[var(--border)] inline-block" />
                Practical Lab
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs bg-[var(--accent)] border border-[var(--accent)] inline-block" />
                Elective Course
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs bg-[var(--border)] inline-block" />
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