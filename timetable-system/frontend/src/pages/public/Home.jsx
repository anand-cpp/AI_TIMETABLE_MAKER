import { Link } from 'react-router-dom';
import {
  Shield,
  GraduationCap,
  Users,
  Moon,
  Sun,
  GraduationCap as CapIcon,
  ArrowRight,
  Zap,
  CheckCircle2,
  Star,
  Award,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const portals = [
  {
    id: 'admin',
    title: 'Admin Portal',
    subtitle: 'System Control Center',
    description: 'Full administrative control over departments, teachers, classes, subjects, & generator configurations.',
    icon: Shield,
    href: '/admin/login',
    badge: 'SYSTEM ADMIN',
  },
  {
    id: 'teacher',
    title: 'Faculty Portal',
    subtitle: 'Teacher Dashboard',
    description: 'Personalized teaching schedules, unavailability preferences, and direct timetable feedback.',
    icon: GraduationCap,
    href: '/teacher/login',
    badge: 'FACULTY MEMBER',
  },
  {
    id: 'student',
    title: 'Student View',
    subtitle: 'Class Timetable',
    description: 'Instant, login-free access to weekly class schedules, lecture room allocations, and course slots.',
    icon: Users,
    href: '/student',
    badge: 'STUDENT ACCESS',
  },
];

export default function Home() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative overflow-hidden transition-colors duration-200 font-sans">
      
      {/* ── FIXED TOP-RIGHT THEME TOGGLE BUTTON ─────────────────── */}
      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-2.5 px-4 rounded-sm bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-all text-xs font-sans font-medium uppercase tracking-wider flex items-center gap-2 cursor-pointer"
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <Moon className="w-4 h-4" strokeWidth={1.5} />
          )}
          <span className="hidden sm:inline text-xs font-sans">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
        </button>
      </div>

      {/* ── MAIN LANDING & PORTALS HUB ───────────────────────────────────── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 pt-16 pb-24">
        
        {/* Navigation Header */}
        <header className="flex items-center justify-between border-b border-[var(--border)] pb-8 mb-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center border border-[var(--border)]">
              <CapIcon className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <span className="font-serif font-normal text-2xl tracking-tight text-[var(--text-primary)]">
                Timetable.AI
              </span>
              <span className="hidden sm:inline-block ml-3 px-2 py-0.5 text-[10px] font-sans font-semibold uppercase tracking-widest rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)]">
                Enterprise v2.0
              </span>
            </div>
          </div>
        </header>

        {/* Hero Title */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[var(--accent-soft)] border border-[var(--border)] text-[var(--accent)] text-[11px] font-sans font-semibold uppercase tracking-widest">
            <span>AI Timetable System 2.0</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-6xl font-normal tracking-tight text-[var(--text-primary)]">
            Select Your Access Portal
          </h1>

          <p className="text-[var(--text-secondary)] text-base sm:text-lg font-sans font-normal leading-relaxed max-w-2xl mx-auto">
            Experience conflict-free academic scheduling powered by Genetic Algorithms. Choose your role below to get started.
          </p>
        </div>

        {/* 3 Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((portal) => (
            <div
              key={portal.id}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-8 flex flex-col justify-between space-y-6 hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)] transition-all duration-150"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-sm text-[10px] font-sans font-semibold uppercase tracking-widest bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)]">
                    {portal.badge}
                  </span>
                  <div className="w-10 h-10 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)]">
                    <portal.icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                </div>

                <div>
                  <h3 className="font-serif text-2xl font-normal text-[var(--text-primary)]">
                    {portal.title}
                  </h3>
                  <p className="text-xs font-sans text-[var(--text-secondary)] mt-2 leading-relaxed">
                    {portal.description}
                  </p>
                </div>
              </div>

              <Link
                to={portal.href}
                className="w-full py-3 px-6 rounded-sm font-sans font-medium text-sm tracking-wide flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-all"
              >
                <span>Enter {portal.title}</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </Link>
            </div>
          ))}
        </div>

        {/* System Highlights */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { value: '100%', label: 'Conflict Free Guarantee', icon: CheckCircle2 },
            { value: '< 2.0s', label: 'AI Generation Speed', icon: Zap },
            { value: '99.9%', label: 'Constraint Accuracy', icon: Star },
          ].map((stat) => (
            <div key={stat.label} className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 rounded-md text-center space-y-2">
              <div className="w-9 h-9 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center mx-auto mb-2">
                <stat.icon className="w-4.5 h-4.5" strokeWidth={1.5} />
              </div>
              <div className="font-mono text-3xl font-medium text-[var(--text-primary)]">
                {stat.value}
              </div>
              <div className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 relative z-10">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-sans font-medium text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <span>Made by</span>
            <span className="font-semibold text-[var(--text-primary)]">TinkerHub ASET</span>
          </div>

          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[var(--dedication-gold)]" strokeWidth={1.5} />
            <span>Dedicated to</span>
            <span className="font-serif italic text-sm text-[var(--dedication-gold)]">Dhanya Miss</span>
          </div>
        </div>
      </footer>

    </div>
  );
}