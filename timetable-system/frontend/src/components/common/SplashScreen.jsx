import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, ArrowRight } from 'lucide-react';

const ButterflySVG = ({ size = 32, className = '' }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} className={className}>
    <g className="animate-butterfly-wing">
      <path d="M20 20 Q10 5, 5 15 Q5 25, 20 20" fill="currentColor" opacity="0.7" />
      <path d="M20 20 Q30 5, 35 15 Q35 25, 20 20" fill="currentColor" opacity="0.7" />
      <path d="M20 20 Q12 30, 8 28 Q10 22, 20 20" fill="currentColor" opacity="0.5" />
      <path d="M20 20 Q28 30, 32 28 Q30 22, 20 20" fill="currentColor" opacity="0.5" />
    </g>
    <ellipse cx="20" cy="20" rx="1.5" ry="8" fill="currentColor" />
  </svg>
);

const SplashScreen = ({ onFinish }) => {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => {
      try {
        sessionStorage.setItem('timetable_splash_dismissed', 'true');
      } catch {
        // Ignore storage error
      }
      onFinish?.();
    }, 400);
  }, [exiting, onFinish]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] px-6 overflow-y-auto select-none transition-opacity duration-400 ease-in-out ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 3-5 Floating Butterflies Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden text-[var(--accent)]">
        <div className="absolute top-[12%] left-[10%] opacity-35 animate-butterfly-float-1">
          <ButterflySVG size={32} />
        </div>
        <div className="absolute top-[20%] right-[12%] opacity-30 animate-butterfly-float-2" style={{ animationDelay: '1.5s' }}>
          <ButterflySVG size={28} />
        </div>
        <div className="absolute bottom-[25%] left-[14%] opacity-25 animate-butterfly-float-1" style={{ animationDelay: '3s' }}>
          <ButterflySVG size={34} />
        </div>
        <div className="absolute bottom-[18%] right-[10%] opacity-35 animate-butterfly-float-2" style={{ animationDelay: '4.5s' }}>
          <ButterflySVG size={30} />
        </div>
      </div>

      <div className="relative z-10 max-w-xl w-full flex flex-col items-center text-center py-10">
        {/* Top Header Icon */}
        <div className="mb-4 text-[var(--text-primary)]">
          <GraduationCap className="w-6 h-6" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 className="font-serif text-5xl sm:text-7xl font-normal text-[var(--accent)] tracking-tight leading-none mb-3">
          Timetable.AI
        </h1>

        {/* Thin Divider */}
        <div className="w-15 h-[1px] bg-[var(--border)] my-3" />

        {/* Subtitle */}
        <p className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-10">
          INTELLIGENT SCHEDULING SYSTEM
        </p>

        {/* PREMIUM DEDICATION BLOCK */}
        <div
          className="relative max-w-[480px] w-full px-8 sm:px-12 py-9 rounded-[2px] border border-[var(--dedication-gold)]/20 bg-[var(--bg-surface-alt)]/40 dark:bg-[var(--accent-soft)]/30 backdrop-blur-xs mb-10 transition-all shadow-[inset_0_0_40px_rgba(200,169,97,0.05)] dark:shadow-[0_0_80px_rgba(200,169,97,0.08)]"
        >
          {/* Corner L-brackets in gold */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-[var(--dedication-gold)] opacity-70 animate-bracket-pulse" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-[var(--dedication-gold)] opacity-70 animate-bracket-pulse" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-[var(--dedication-gold)] opacity-70 animate-bracket-pulse" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-[var(--dedication-gold)] opacity-70 animate-bracket-pulse" />

          {/* Ornamental Top Divider */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="w-14 h-[1px] bg-[var(--dedication-gold)]/40" />
            <span className="text-[var(--dedication-gold)] text-xs inline-block animate-ornament-rotate">
              ✦
            </span>
            <span className="w-14 h-[1px] bg-[var(--dedication-gold)]/40" />
          </div>

          {/* Crafted with devotion by */}
          <p className="font-serif italic text-sm text-[var(--text-secondary)] mb-1.5" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
            Crafted with devotion by
          </p>

          {/* TINKERHUB ASET (No middle dot) */}
          <h2
            className="font-serif text-2xl sm:text-3xl font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)] mb-6 dark:drop-shadow-[0_0_20px_rgba(240,208,128,0.15)]"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            TinkerHub ASET
          </h2>

          {/* Separator (❦ Aldus Leaf) */}
          <div className="flex items-center justify-center gap-4 my-6">
            <span className="w-10 h-[1px] bg-[var(--dedication-gold)]/30" />
            <span className="text-[var(--dedication-gold)] text-lg animate-aldus-pulse">
              ❦
            </span>
            <span className="w-10 h-[1px] bg-[var(--dedication-gold)]/30" />
          </div>

          {/* Dedicated with gratitude to */}
          <p className="font-serif italic text-sm text-[var(--text-secondary)] mb-1.5" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
            Dedicated with gratitude to
          </p>

          {/* Hero Name: Dhanya Miss with Golden Particles & Wavy Underline */}
          <div className="relative inline-block mb-4">
            {/* Orbiting Golden Particles */}
            <div className="absolute -top-2 -left-4 w-1.5 h-1.5 rounded-full bg-[var(--dedication-gold)] opacity-50 animate-ping" />
            <div className="absolute -bottom-1 -right-3 w-1.5 h-1.5 rounded-full bg-[var(--dedication-gold)] opacity-50 animate-pulse" />

            <h2
              className="font-serif italic text-3xl sm:text-4xl font-medium text-[var(--dedication-gold)] tracking-normal dark:drop-shadow-[0_0_30px_rgba(240,208,128,0.3)]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Dhanya Miss
            </h2>

            {/* Handwritten SVG Wavy Underline */}
            <svg
              className="w-full h-3 text-[var(--dedication-gold)] mt-0.5"
              viewBox="0 0 200 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 8 C 45 2, 85 11, 130 5 C 155 2, 180 8, 197 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.6"
              />
            </svg>
          </div>

          {/* Dedication Quote */}
          <p
            className="font-serif italic text-sm text-[var(--text-muted)] max-w-[380px] mx-auto leading-relaxed mt-2"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            "For your endless guidance, patience, and belief in us."
          </p>

          {/* Ornamental Bottom Divider */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="w-14 h-[1px] bg-[var(--dedication-gold)]/40" />
            <span className="text-[var(--dedication-gold)] text-xs inline-block animate-ornament-rotate">
              ✦
            </span>
            <span className="w-14 h-[1px] bg-[var(--dedication-gold)]/40" />
          </div>
        </div>

        {/* Enter Action */}
        <div className="flex flex-col items-center space-y-3">
          <button
            onClick={handleDismiss}
            className="group inline-flex items-center gap-3 px-8 py-3 bg-[var(--accent)] text-[var(--accent-text)] font-sans font-medium text-sm rounded-sm transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.98] cursor-pointer"
          >
            <span>Enter Dashboard</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} />
          </button>
          <p className="text-[11px] font-serif italic text-[var(--text-muted)]">
            Press Enter or click to continue
          </p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
