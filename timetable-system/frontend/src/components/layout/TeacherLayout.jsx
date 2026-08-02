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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontSize: '13px',
            borderRadius: '14px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
            padding: '12px 16px',
            fontWeight: '600',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#fff' },
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
          'pt-16 min-h-screen transition-all duration-300 ease-in-out',
          collapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default TeacherLayout;