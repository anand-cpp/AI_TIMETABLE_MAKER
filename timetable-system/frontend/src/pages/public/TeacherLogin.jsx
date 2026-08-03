import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import LoginForm from '../../components/auth/LoginForm';
import { ShieldCheck, GraduationCap, Moon, Sun, ArrowLeft } from 'lucide-react';

const TeacherLogin = () => {
  const { teacherLogin, isAuthenticated, isTeacher } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated && isTeacher) {
      navigate('/teacher', { replace: true });
    }
  }, [isAuthenticated, isTeacher, navigate]);

  const handleSubmit = async (data) => {
    try {
      setError('');
      setLoading(true);
      await teacherLogin(data);
      navigate('/teacher', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Login failed. Check your username and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200 flex flex-col justify-between relative overflow-hidden">
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto w-full border-b border-[var(--border)]">
        <Link to="/" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs font-sans font-medium uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Back to Home
        </Link>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-sm bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200 cursor-pointer"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" strokeWidth={1.5} /> : <Moon className="w-5 h-5" strokeWidth={1.5} />}
        </button>
      </nav>

      {/* Body */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="w-6 h-6" strokeWidth={1.5} />
            </div>
          </div>

          <LoginForm
            onSubmit={handleSubmit}
            loading={loading}
            title="Faculty Portal Access"
            subtitle="Sign in with your assigned teacher credentials"
            error={error}
          />

          <div className="text-center space-y-3 pt-2">
            <div className="p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm text-[var(--text-secondary)] text-xs font-sans">
              <p className="font-semibold text-[var(--accent)] mb-0.5">Faculty Login Hint</p>
              <p className="text-[var(--text-muted)]">Username: lowercased name (e.g. <code className="text-[var(--text-primary)] font-mono">john</code>)</p>
              <p className="text-[var(--text-muted)]">Default Password: <code className="text-[var(--text-primary)] font-mono">john123</code></p>
            </div>

            <Link
              to="/admin/login"
              className="flex items-center justify-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs font-sans font-medium transition-colors pt-2"
            >
              <ShieldCheck className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.5} />
              Administrator login →
            </Link>
            <Link
              to="/student"
              className="block text-[var(--text-muted)] hover:underline text-xs font-sans transition-colors"
            >
              Access student class viewer
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-[var(--text-muted)] font-sans font-medium">
        Faculty Portal · AI Timetable System v2.0
      </footer>
    </div>
  );
};

export default TeacherLogin;