import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Sparkles } from 'lucide-react';

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">
            AI Timetable Maker
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <Outlet />
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 p-4 text-center">
        <p className="text-white/40 text-xs">
          AI Timetable Maker — Automated Scheduling System
        </p>
      </footer>
    </div>
  );
};

export default PublicLayout;