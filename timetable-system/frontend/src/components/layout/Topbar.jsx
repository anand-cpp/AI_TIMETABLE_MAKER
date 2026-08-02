import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';
import { Menu, Moon, Sun, Shield, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';

const Topbar = ({ collapsed, onMenuToggle, title }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 glass-panel border-b border-[#CBD5E1] dark:border-white/10 z-30',
        'flex items-center justify-between px-6',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'left-16' : 'left-64'
      )}
    >
      {/* Left Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="text-[#475569] dark:text-[#A0A0B0] hover:text-[#0F172A] dark:hover:text-white lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <h1 className="text-base font-display font-black text-[#0F172A] dark:text-white tracking-tight">
            {title}
          </h1>
        )}
      </div>

      {/* Right Controls & Theme Toggle */}
      <div className="flex items-center gap-4">
        {/* Animated Sun/Moon Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-[#F1F5F9] dark:bg-white/5 border border-[#CBD5E1] dark:border-white/10 text-[#0F172A] dark:text-white transition-all hover:scale-105 active:scale-95 shadow-xs"
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
              <Sun className="w-4 h-4 text-[#00D4FF]" />
            ) : (
              <Moon className="w-4 h-4 text-[#6C63FF]" />
            )}
          </motion.div>
        </button>

        {/* User profile pill */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#CBD5E1] dark:border-white/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6C63FF] to-[#00D4FF] flex items-center justify-center text-white text-xs font-bold shadow-md shadow-[#6C63FF]/30">
            {user?.role === 'admin' ? (
              <Shield className="w-4 h-4" />
            ) : (
              <GraduationCap className="w-4 h-4" />
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-black text-[#0F172A] dark:text-white leading-none">
              {user?.name || user?.username || 'Authenticated User'}
            </p>
            <p className="text-[10px] font-extrabold text-[#6C63FF] dark:text-[#00D4FF] capitalize mt-0.5">
              {user?.role}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;