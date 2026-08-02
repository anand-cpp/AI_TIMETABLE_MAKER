import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminExists, setAdminExists] = useState(null);

  // ── Initialize from localStorage ───────────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = authService.getToken();
        const storedUser = authService.getStoredUser();

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);

          // Verify token is still valid
          try {
            const res = await authService.getMe();
            setUser(res.data.user);
          } catch {
            // Token invalid - clear session
            authService.clearSession();
            setToken(null);
            setUser(null);
          }
        }

        // Check admin setup status
        const statusRes = await authService.getSetupStatus();
        setAdminExists(statusRes.data.adminExists);
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // ── Admin Setup ────────────────────────────────────────────────────────────
  const setupAdmin = useCallback(async (data) => {
    const res = await authService.setupAdmin(data);
    const { token: newToken, user: newUser } = res.data;
    authService.saveSession(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    setAdminExists(true);
    return res;
  }, []);

  // ── Admin Login ────────────────────────────────────────────────────────────
  const adminLogin = useCallback(async (credentials) => {
    const res = await authService.adminLogin(credentials);
    const { token: newToken, user: newUser } = res.data;
    authService.saveSession(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    return res;
  }, []);

  // ── Teacher Login ──────────────────────────────────────────────────────────
  const teacherLogin = useCallback(async (credentials) => {
    const res = await authService.teacherLogin(credentials);
    const { token: newToken, user: newUser } = res.data;
    authService.saveSession(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    return res;
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    authService.clearSession();
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
  }, []);

  // ── Computed ───────────────────────────────────────────────────────────────
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isAuthenticated = !!user && !!token;

  const value = {
    user,
    token,
    loading,
    adminExists,
    isAdmin,
    isTeacher,
    isAuthenticated,
    setupAdmin,
    adminLogin,
    teacherLogin,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;