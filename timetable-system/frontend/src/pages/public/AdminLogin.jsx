import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import LoginForm from '../../components/auth/LoginForm';
import { GraduationCap, Moon, Sun, ArrowLeft, ShieldCheck } from 'lucide-react';

const AdminLogin = () => {
  const { adminLogin, isAuthenticated, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (data) => {
    try {
      setError('');
      setLoading(true);
      await adminLogin(data);
      navigate('/admin', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Check your admin credentials.';
      setError(msg);
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
              <ShieldCheck className="w-6 h-6" strokeWidth={1.5} />
            </div>
          </div>

          <LoginForm
            onSubmit={handleSubmit}
            loading={loading}
            title="System Administrator Portal"
            subtitle="Secure administrative access to AI Timetable Maker"
            error={error}
          />

          <div className="text-center space-y-3 pt-2">
            <Link
              to="/teacher/login"
              className="flex items-center justify-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs font-sans font-medium transition-colors"
            >
              <GraduationCap className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.5} />
              Are you a faculty member? Faculty Login →
            </Link>
            <Link
              to="/student"
              className="block text-[var(--text-muted)] hover:underline text-xs font-sans transition-colors"
            >
              Access student class viewer without login
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-[var(--text-muted)] font-sans font-medium">
        AI Timetable System v2.0 · Enterprise Edition
      </footer>
    </div>
  );
};

export default AdminLogin;