import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { cn } from '../../utils/cn';

const pageTitles = {
  '/teacher': 'Faculty Overview',
  '/teacher/timetable': 'Personal Teaching Schedule',
  '/teacher/suggestions': 'Schedule Suggestions & Preferences',
};

const TeacherLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Teacher Portal';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontSize: '13px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            padding: '12px 16px',
            fontWeight: '500',
            fontFamily: 'Inter, sans-serif',
          },
          success: {
            iconTheme: { primary: 'var(--success)', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: 'var(--error)', secondary: '#fff' },
          },
        }}
      />

      <Sidebar
        role="teacher"
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      <Topbar
        collapsed={collapsed}
        onMenuToggle={() => setCollapsed((c) => !c)}
        title={title}
      />

      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-200 ease-in-out',
          collapsed ? 'ml-16' : 'ml-[240px]'
        )}
      >
        <div className="p-8 md:p-10 max-w-6xl mx-auto space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default TeacherLayout;