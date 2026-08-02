import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  GraduationCap,
  Users,
  Moon,
  Sun,
  Sparkles,
  Heart,
  ArrowRight,
  Zap,
  CheckCircle2,
  Star,
  Award,
  RotateCcw,
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
    badge: '⚡ SYSTEM ADMIN',
  },
  {
    id: 'teacher',
    title: 'Faculty Portal',
    subtitle: 'Teacher Dashboard',
    description: 'Personalized teaching schedules, unavailability preferences, and direct timetable feedback.',
    icon: GraduationCap,
    href: '/teacher/login',
    badge: '🎓 FACULTY MEMBER',
  },
  {
    id: 'student',
    title: 'Student View',
    subtitle: 'Class Timetable',
    description: 'Instant, login-free access to weekly class schedules, lecture room allocations, and course slots.',
    icon: Users,
    href: '/student',
    badge: '📚 STUDENT ACCESS',
  },
];

// Helper for floating star particles
const particles = Array.from({ length: 24 }).map((_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 4 + 2,
  duration: Math.random() * 6 + 4,
  delay: Math.random() * 3,
}));

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [inBootScreen, setInBootScreen] = useState(true);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0A0A0F] text-[#0F172A] dark:text-[#FFFFFF] relative overflow-hidden transition-colors duration-500 font-sans">
      
      {/* ── FIXED TOP-RIGHT THEME TOGGLE BUTTON ─────────────────── */}
      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 px-4 rounded-full bg-white dark:bg-[#12121C] text-[#0F172A] dark:text-white border border-[#CBD5E1] dark:border-white/10 shadow-xl hover:scale-105 active:scale-95 transition-all text-xs font-black tracking-wider uppercase flex items-center gap-2"
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          <motion.div
            key={theme}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-[#00D4FF]" />
            ) : (
              <Moon className="w-5 h-5 text-[#6C63FF]" />
            )}
          </motion.div>
          <span className="hidden sm:inline text-xs font-extrabold tracking-wide text-[#0F172A] dark:text-white">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
        </button>
      </div>

      {/* ── CINEMATIC ANIMATED BOOT SCREEN ───────────────────────────────── */}
      <AnimatePresence>
        {inBootScreen && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-40 bg-[#F8FAFC] dark:bg-[#0A0A0F] text-[#0F172A] dark:text-[#FFFFFF] flex flex-col items-center justify-center p-6 text-center overflow-hidden"
          >
            {/* Ambient Aurora Gradient Blobs */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-[#6C63FF]/20 via-[#00D4FF]/20 to-purple-600/15 rounded-full blur-[120px] pointer-events-none animate-[auroraMove_16s_linear_infinite]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(15,23,42,0.05)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,10,15,0.85)_100%)] pointer-events-none" />

            {/* Floating Star Particle Mesh */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="absolute rounded-full bg-[#6C63FF] dark:bg-[#00D4FF] opacity-40"
                  style={{
                    top: p.top,
                    left: p.left,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    animation: `floatParticle ${p.duration}s ease-in-out infinite ${p.delay}s`,
                  }}
                />
              ))}
            </div>

            {/* Center Content Container */}
            <div className="relative z-10 max-w-2xl mx-auto space-y-9 flex flex-col items-center">
              
              {/* Scale-in Logo Badge */}
              <motion.div
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 0.8, type: 'spring', stiffness: 180 }}
                className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#6C63FF] via-[#00D4FF] to-purple-600 p-[2px] shadow-2xl"
              >
                <div className="w-full h-full bg-white dark:bg-[#0A0A0F] rounded-[22px] flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-[#6C63FF] dark:text-[#00D4FF] animate-pulse" />
                </div>
              </motion.div>

              {/* Title & Text Reveal */}
              <div className="space-y-4 max-w-lg">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                >
                  <span className="inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase bg-[#6C63FF]/15 border border-[#6C63FF]/30 text-[#6C63FF] dark:text-[#00D4FF]">
                    AI Timetable System v2.0
                  </span>
                </motion.div>

                {/* Made by TinkerHub ASET */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="font-display text-4xl sm:text-5xl font-black tracking-tight shimmer-text"
                >
                  Made by TinkerHub ASET
                </motion.h1>

                {/* Dedicated to Dhanya Miss */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7, duration: 0.6 }}
                  className="pt-2"
                >
                  <div className="gold-ribbon inline-flex items-center gap-2.5 px-6 py-3 rounded-full font-medium italic text-base sm:text-lg backdrop-blur-xl">
                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500 animate-pulse" />
                    <span>Dedicated to <strong className="font-extrabold not-italic text-[#78350F] dark:text-amber-200">Dhanya Miss</strong></span>
                  </div>
                </motion.div>
              </div>

              {/* ONLY ONE BUTTON VISIBLE ON BOOT SCREEN: ENTER BUTTON */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="pt-4"
              >
                <button
                  onClick={() => setInBootScreen(false)}
                  className="glass-pill glow-pulse px-10 py-4 rounded-full font-display font-extrabold text-sm sm:text-base tracking-widest uppercase text-white flex items-center gap-3 cursor-pointer group shadow-2xl"
                >
                  <span>Enter</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LANDING & PORTALS HUB ───────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 pt-16 pb-24">
        
        {/* Navigation Header */}
        <header className="flex items-center justify-between border-b border-[#CBD5E1] dark:border-white/10 pb-8 mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6C63FF] to-[#00D4FF] flex items-center justify-center shadow-lg shadow-[#6C63FF]/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-black text-2xl tracking-tight text-[#0F172A] dark:text-white">
                Timetable<span className="text-[#6C63FF] dark:text-[#00D4FF]">.AI</span>
              </span>
              <span className="hidden sm:inline-block ml-3 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-[#6C63FF]/15 border border-[#6C63FF]/30 text-[#6C63FF] dark:text-[#00D4FF]">
                Pro v2.0
              </span>
            </div>
          </div>

          <button
            onClick={() => setInBootScreen(true)}
            className="p-2.5 px-4 rounded-2xl bg-white dark:bg-white/5 border border-[#CBD5E1] dark:border-white/10 text-xs font-bold flex items-center gap-2 text-[#0F172A] dark:text-white hover:border-[#6C63FF] transition-all"
            title="Replay intro animation"
          >
            <RotateCcw className="w-4 h-4 text-[#6C63FF] dark:text-[#00D4FF]" />
            <span className="hidden sm:inline">Replay Intro</span>
          </button>
        </header>

        {/* Hero Title */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6C63FF]/15 border border-[#6C63FF]/30 text-[#6C63FF] dark:text-[#00D4FF] text-xs font-black uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#6C63FF] dark:bg-[#00D4FF] animate-ping" />
            <span>AI Timetable System 2.0</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-black tracking-tight text-[#0F172A] dark:text-white">
            Select Your Access Portal
          </h1>

          <p className="text-[#334155] dark:text-[#A0A0B0] text-base sm:text-lg font-semibold leading-relaxed max-w-2xl mx-auto">
            Experience conflict-free academic scheduling powered by Genetic Algorithms. Choose your role below to get started.
          </p>
        </div>

        {/* 3 Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {portals.map((portal) => (
            <div
              key={portal.id}
              className="glass-panel p-8 rounded-3xl flex flex-col justify-between space-y-6 group hover:-translate-y-2 transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-[#6C63FF]/15 text-[#6C63FF] dark:text-[#00D4FF] border border-[#6C63FF]/30">
                    {portal.badge}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] dark:bg-white/5 flex items-center justify-center border border-[#E2E8F0] dark:border-white/10">
                    <portal.icon className="w-6 h-6 text-[#6C63FF] dark:text-[#00D4FF]" />
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-2xl font-black text-[#0F172A] dark:text-white">
                    {portal.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#334155] dark:text-[#A0A0B0] mt-2 leading-relaxed">
                    {portal.description}
                  </p>
                </div>
              </div>

              <Link
                to={portal.href}
                className="w-full py-4 px-6 rounded-2xl font-display font-black text-sm tracking-wide flex items-center justify-center gap-2 bg-gradient-to-r from-[#6C63FF] to-[#00D4FF] text-white shadow-lg shadow-[#6C63FF]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Enter {portal.title}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        {/* System Highlights */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { value: '100%', label: 'Conflict Free Guarantee', icon: CheckCircle2 },
            { value: '< 2.0s', label: 'AI Generation Speed', icon: Zap },
            { value: '99.9%', label: 'Constraint Accuracy', icon: Star },
          ].map((stat) => (
            <div key={stat.label} className="glass-panel p-6 rounded-3xl text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-[#6C63FF]/15 text-[#6C63FF] dark:text-[#00D4FF] flex items-center justify-center mx-auto mb-3 border border-[#6C63FF]/30">
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="font-display text-3xl font-black text-[#0F172A] dark:text-white">
                {stat.value}
              </div>
              <div className="text-xs font-black uppercase tracking-wider text-[#475569] dark:text-[#A0A0B0]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-[#CBD5E1] dark:border-white/10 py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-extrabold text-[#334155] dark:text-[#A0A0B0]">
          <div className="flex items-center gap-2">
            <span>Made by</span>
            <span className="font-black text-[#6C63FF] dark:text-[#00D4FF]">TinkerHub ASET</span>
          </div>

          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Dedicated to</span>
            <span className="font-black text-amber-700 dark:text-amber-300">Dhanya Miss</span>
          </div>
        </div>
      </footer>

    </div>
  );
}