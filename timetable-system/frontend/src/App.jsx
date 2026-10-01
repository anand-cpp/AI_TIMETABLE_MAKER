import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SplashScreen from './components/common/SplashScreen';

// Layouts
import AdminLayout from './components/layout/AdminLayout';
import TeacherLayout from './components/layout/TeacherLayout';

// Public Pages
import Home from './pages/public/Home';
import AdminLogin from './pages/public/AdminLogin';
import TeacherLogin from './pages/public/TeacherLogin';
import StudentView from './pages/public/StudentView';
import SetupAdmin from './pages/public/SetupAdmin';
import NotFound from './pages/public/NotFound';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import Departments from './pages/admin/Departments';
import Classes from './pages/admin/Classes';
import Teachers from './pages/admin/Teachers';
import Subjects from './pages/admin/Subjects';
import TimetableBuilder from './pages/admin/TimetableBuilder';
import DepartmentTimetable from './pages/admin/DepartmentTimetable';
import YearTimetable from './pages/admin/YearTimetable';
import Settings from './pages/admin/Settings';
import Suggestions from './pages/admin/Suggestions';
import EmailManager from './pages/admin/EmailManager';
import Upload from './pages/admin/Upload';
import OverrideLog from './pages/admin/OverrideLog';

// Teacher Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import MyTimetable from './pages/teacher/MyTimetable';
import MySuggestions from './pages/teacher/MySuggestions';

import ErrorBoundary from './components/common/ErrorBoundary';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ErrorBoundary>
          {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
          
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/teacher/login" element={<TeacherLogin />} />
            <Route path="/student" element={<StudentView />} />
            <Route path="/setup-admin" element={<SetupAdmin />} />

            {/* Protected Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="departments" element={<Departments />} />
              <Route path="classes" element={<Classes />} />
              <Route path="teachers" element={<Teachers />} />
              <Route path="subjects" element={<Subjects />} />
              <Route path="timetable" element={<TimetableBuilder />} />
              <Route path="department-timetable" element={<DepartmentTimetable />} />
              <Route path="year-timetable" element={<YearTimetable />} />
              <Route path="upload" element={<Upload />} />
              <Route path="suggestions" element={<Suggestions />} />
              <Route path="email" element={<EmailManager />} />
              <Route path="override-log" element={<OverrideLog />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Protected Teacher Routes */}
            <Route
              path="/teacher"
              element={
                <ProtectedRoute requiredRole="teacher">
                  <TeacherLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<TeacherDashboard />} />
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="timetable" element={<MyTimetable />} />
              <Route path="suggestions" element={<MySuggestions />} />
            </Route>

            {/* 404 Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;