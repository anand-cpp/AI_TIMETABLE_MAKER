import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';
import { Menu, Moon, Sun, Shield, GraduationCap } from 'lucide-react';

const Topbar = ({ collapsed, onMenuToggle, title }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 bg-[var(--bg-primary)] border-b border-[var(--border)] z-30',
        'flex items-center justify-between px-10',
        'transition-all duration-200 ease-in-out',
        collapsed ? 'left-16' : 'left-[240px]'
      )}
    >
      {/* Left Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] lg:hidden cursor-pointer"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
        {title && (
          <h1 className="text-xl sm:text-2xl font-serif font-normal text-[var(--text-primary)] tracking-tight">
            {title}
          </h1>
        )}
      </div>

      {/* Right Controls & Theme Toggle */}
      <div className="flex items-center gap-5">
        {/* Theme Toggle Button */}
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

        {/* User Profile Badge */}
        <div className="flex items-center gap-3 pl-4 border-l border-[var(--border)]">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-serif font-bold text-sm flex items-center justify-center border border-[var(--border)]">
            {user?.role === 'admin' ? (
              <Shield className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-sans font-medium text-[var(--text-primary)] leading-none">
              {user?.name || user?.username || 'admin'}
            </p>
            <p className="text-[10px] font-sans font-semibold text-[var(--text-muted)] tracking-widest uppercase mt-0.5">
              {user?.role || 'Admin'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;