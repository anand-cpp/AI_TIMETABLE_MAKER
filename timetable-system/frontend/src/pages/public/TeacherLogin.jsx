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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden selection:bg-purple-600 selection:text-white">
      {/* Grid background & orbs */}
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 right-1/2 translate-x-1/2 w-[600px] h-[400px] bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6 max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4 text-slate-200" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>
      </nav>

      {/* Body */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-in space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/20">
              <GraduationCap className="w-7 h-7 text-white" />
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
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-300 text-xs font-medium">
              <p className="font-bold text-amber-300 mb-0.5">Faculty Login Hint</p>
              <p className="text-slate-400">Username: lowercased name (e.g. <code className="text-purple-300">john</code>)</p>
              <p className="text-slate-400">Default Password: <code className="text-purple-300">john123</code></p>
            </div>

            <Link
              to="/admin/login"
              className="flex items-center justify-center gap-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors pt-2"
            >
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Administrator login →
            </Link>
            <Link
              to="/student"
              className="block text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors"
            >
              Access student class viewer
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-slate-500 font-medium">
        Faculty Portal · AI Timetable System v2.0
      </footer>
    </div>
  );
};

export default TeacherLogin;