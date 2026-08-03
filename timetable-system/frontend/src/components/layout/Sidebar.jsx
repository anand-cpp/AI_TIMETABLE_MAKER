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
  Zap,
} from 'lucide-react';

const adminNavItems = [
  {
    group: 'HOME',
    items: [
      { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    ],
  },
  {
    group: 'SETUP',
    subtitle: 'Add basic college info',
    items: [
      { label: 'Departments', to: '/admin/departments', icon: Building2 },
      { label: 'Classes', to: '/admin/classes', icon: GraduationCap },
      { label: 'Teachers', to: '/admin/teachers', icon: Users },
      { label: 'Subjects', to: '/admin/subjects', icon: BookOpen },
    ],
  },
  {
    group: 'CREATE TIMETABLE',
    subtitle: 'Generate schedules',
    items: [
      { label: 'Quick Timetable', to: '/admin/timetable', icon: Zap },
      { label: 'Department Timetable', to: '/admin/department-timetable', icon: Building2 },
      { label: 'Year-Wise Timetable', to: '/admin/year-timetable', icon: Calendar },
      { label: 'Upload / OCR', to: '/admin/upload', icon: Upload },
    ],
  },
  {
    group: 'MESSAGES',
    subtitle: 'Feedback & emails',
    items: [
      { label: 'Suggestions', to: '/admin/suggestions', icon: MessageSquare },
      { label: 'Email Manager', to: '/admin/email', icon: Mail },
    ],
  },
  {
    group: 'SETTINGS',
    subtitle: 'Preferences',
    items: [
      { label: 'Settings', to: '/admin/settings', icon: Settings },
    ],
  },
];

const teacherNavItems = [
  {
    group: 'HOME',
    items: [
      { label: 'Dashboard', to: '/teacher', icon: LayoutDashboard, end: true },
    ],
  },
  {
    group: 'MY SCHEDULE',
    subtitle: 'Your classes',
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
        'fixed left-0 top-0 h-full bg-[var(--bg-surface)] text-[var(--text-primary)] flex flex-col',
        'transition-all duration-200 ease-in-out z-40 border-r border-[var(--border)] py-5 select-none',
        collapsed ? 'w-16 px-2' : 'w-[240px] px-4'
      )}
    >
      {/* Top Section — Logo */}
      <div className="flex flex-col border-b border-[var(--border)] pb-3 mb-3 shrink-0 px-2">
        <div className="flex items-center gap-2.5">
          <GraduationCap className="w-5 h-5 text-[var(--heading-gold)] shrink-0" strokeWidth={1.5} />
          {!collapsed && (
            <span className="font-serif font-normal text-lg text-[var(--heading-gold)] tracking-tight">
              Timetable.AI
            </span>
          )}
        </div>
        {!collapsed && (
          <span className="text-[10px] font-sans font-semibold text-[var(--text-label)] tracking-widest uppercase mt-0.5 pl-7">
            {role === 'admin' ? 'ADMIN CONTROL' : 'FACULTY PORTAL'}
          </span>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto space-y-3 px-1">
        {navItems.map((group) => (
          <div key={group.group} className="space-y-1">
            {!collapsed && (
              <div className="px-2 pt-2 pb-0.5">
                <p className="text-[10px] font-sans font-semibold uppercase tracking-widest text-[var(--text-label)] truncate">
                  {group.group}
                </p>
                {group.subtitle && (
                  <p className="text-[9px] font-sans text-[var(--text-muted)] truncate -mt-0.5">
                    {group.subtitle}
                  </p>
                )}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-1.5 rounded-sm text-xs font-sans transition-colors duration-150 group',
                        isActive
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-l-[3px] border-[var(--accent)] font-semibold'
                          : 'text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)]',
                        collapsed && 'justify-center px-2 py-2'
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-colors',
                            isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--accent)]'
                          )}
                          strokeWidth={1.5}
                        />
                        {!collapsed && (
                          <span className="truncate tracking-tight">{item.label}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom Section — Admin Profile & Logout */}
      <div className="border-t border-[var(--border)] pt-3 mt-auto space-y-2 shrink-0 px-1">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-serif font-bold text-sm flex items-center justify-center shrink-0 border border-[var(--border)]">
              {(user.name || user.username || 'A')?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="font-serif text-xs font-normal text-[var(--text-primary)] truncate leading-tight">
                {user.name || user.username || 'admin'}
              </p>
              <p className="text-[9px] font-sans font-semibold text-[var(--text-label)] tracking-widest uppercase">
                {user.role || 'Admin'}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-1.5 rounded-sm text-xs font-sans text-[var(--error)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0 text-[var(--error)]" strokeWidth={1.5} />
          {!collapsed && <span className="tracking-tight">Logout</span>}
        </button>
      </div>

      {/* Collapse button */}
      <button
        onClick={onToggle}
        className={cn(
          'absolute -right-3 top-5 w-6 h-6 rounded-full',
          'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)]',
          'flex items-center justify-center',
          'hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer z-50'
        )}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
        )}
      </button>
    </aside>
  );
};

export default Sidebar;