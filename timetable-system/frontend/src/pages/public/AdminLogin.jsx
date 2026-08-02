import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import LoginForm from '../../components/auth/LoginForm';
import { GraduationCap, Sparkles, Moon, Sun, ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0A0A0F] text-[#0F172A] dark:text-white flex flex-col justify-between relative overflow-hidden">
      {/* Grid background & orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#6C63FF]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6 max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 text-[#475569] dark:text-[#A0A0B0] hover:text-[#0F172A] dark:hover:text-white transition-colors text-xs font-bold uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white dark:bg-white/10 border border-[#CBD5E1] dark:border-white/10 text-[#0F172A] dark:text-white hover:scale-105 transition-all"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4 text-[#6C63FF]" /> : <Sun className="w-4 h-4 text-[#00D4FF]" />}
        </button>
      </nav>

      {/* Body */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-in space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#6C63FF] to-[#00D4FF] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#6C63FF]/30">
              <Sparkles className="w-7 h-7 text-white" />
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
              className="flex items-center justify-center gap-2 text-[#475569] dark:text-[#A0A0B0] hover:text-[#0F172A] dark:hover:text-white text-xs font-extrabold transition-colors"
            >
              <GraduationCap className="w-4 h-4 text-[#6C63FF]" />
              Are you a faculty member? Faculty Login →
            </Link>
            <Link
              to="/student"
              className="block text-[#64748B] dark:text-slate-400 hover:underline text-xs font-semibold transition-colors"
            >
              Access student class viewer without login
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-[#475569] dark:text-[#A0A0B0] font-extrabold">
        AI Timetable System v2.0 · Enterprise Edition
      </footer>
    </div>
  );
};

export default AdminLogin;