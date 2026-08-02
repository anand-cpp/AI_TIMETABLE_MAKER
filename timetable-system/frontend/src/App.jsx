import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

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
import Settings from './pages/admin/Settings';
import Suggestions from './pages/admin/Suggestions';
import EmailManager from './pages/admin/EmailManager';
import Upload from './pages/admin/Upload';

// Teacher Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import MyTimetable from './pages/teacher/MyTimetable';
import MySuggestions from './pages/teacher/MySuggestions';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
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
            <Route path="upload" element={<Upload />} />
            <Route path="suggestions" element={<Suggestions />} />
            <Route path="email" element={<EmailManager />} />
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
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;