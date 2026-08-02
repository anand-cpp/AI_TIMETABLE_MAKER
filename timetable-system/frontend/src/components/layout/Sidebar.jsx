import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  Settings,
  MessageSquare,
  Mail,
  Upload,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const adminNavItems = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    ],
  },
  {
    group: 'Setup Steps',
    items: [
      { label: 'Departments', to: '/admin/departments', icon: Building2 },
      { label: 'Classes', to: '/admin/classes', icon: GraduationCap },
      { label: 'Teachers', to: '/admin/teachers', icon: Users },
      { label: 'Subjects', to: '/admin/subjects', icon: BookOpen },
    ],
  },
  {
    group: 'Timetable',
    items: [
      { label: 'Timetable Builder', to: '/admin/timetable', icon: Calendar },
      { label: 'Upload / OCR', to: '/admin/upload', icon: Upload },
    ],
  },
  {
    group: 'Communication',
    items: [
      { label: 'Suggestions', to: '/admin/suggestions', icon: MessageSquare },
      { label: 'Email Manager', to: '/admin/email', icon: Mail },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Settings', to: '/admin/settings', icon: Settings },
    ],
  },
];

const teacherNavItems = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', to: '/teacher', icon: LayoutDashboard, end: true },
    ],
  },
  {
    group: 'My Schedule',
    items: [
      { label: 'My Timetable', to: '/teacher/timetable', icon: Calendar },
      { label: 'My Suggestions', to: '/teacher/suggestions', icon: MessageSquare },
    ],
  },
];

const Sidebar = ({ role = 'admin', collapsed, onToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = role === 'admin' ? adminNavItems : teacherNavItems;

  const handleLogout = () => {
    logout();
    navigate(role === 'admin' ? '/admin/login' : '/teacher/login');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full glass-panel text-slate-900 dark:text-white flex flex-col',
        'transition-all duration-300 ease-in-out z-40 border-r border-slate-200 dark:border-white/10 shadow-2xl select-none',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo Header */}
      <div className="flex items-center gap-3 px-4 py-4.5 border-b border-slate-200 dark:border-white/10 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="font-display font-black text-sm text-slate-900 dark:text-white tracking-tight truncate">
              Timetable<span className="text-blue-600 dark:text-cyan-400">.AI</span>
            </p>
            <p className="text-[10px] font-black text-blue-600 dark:text-cyan-400 uppercase tracking-wider truncate">
              {role === 'admin' ? 'Admin Control' : 'Faculty Portal'}
            </p>
          </div>
        )}
      </div>

      {/* Navigation items with proper scrollbar padding */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-4 px-3 pr-3">
        {navItems.map((group) => (
          <div key={group.group} className="space-y-1">
            {!collapsed && (
              <p className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 truncate">
                {group.group}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group',
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 font-black'
                          : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10',
                        collapsed && 'justify-center px-2'
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110" />
                    {!collapsed && (
                      <span className="truncate tracking-tight whitespace-nowrap">{item.label}</span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-slate-200 dark:border-white/10 p-3 space-y-2 shrink-0">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                {user.name || user.username}
              </p>
              <p className="text-[10px] font-bold text-blue-600 dark:text-cyan-400 capitalize truncate">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4.5 h-4.5 shrink-0" />
          {!collapsed && <span className="tracking-tight whitespace-nowrap">Logout</span>}
        </button>
      </div>

      {/* Collapse button */}
      <button
        onClick={onToggle}
        className={cn(
          'absolute -right-3.5 top-5 w-7 h-7 rounded-full',
          'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700',
          'flex items-center justify-center',
          'hover:scale-110 active:scale-95 transition-all cursor-pointer z-50'
        )}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
        )}
      </button>
    </aside>
  );
};

export default Sidebar;