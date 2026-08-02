import api from './api';

const authService = {
  // Check if admin has been set up
  getSetupStatus: async () => {
    const res = await api.get('/auth/setup-status');
    return res.data;
  },

  // One-time admin setup
  setupAdmin: async (data) => {
    const res = await api.post('/auth/setup', data);
    return res.data;
  },

  // Admin login
  adminLogin: async (credentials) => {
    const res = await api.post('/auth/admin/login', credentials);
    return res.data;
  },

  // Teacher login
  teacherLogin: async (credentials) => {
    const res = await api.post('/auth/teacher/login', credentials);
    return res.data;
  },

  // Get current logged-in user
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  // Store token and user in localStorage
  saveSession: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  // Clear session
  clearSession: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Get stored user
  getStoredUser: () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  // Get stored token
  getToken: () => {
    return localStorage.getItem('token');
  },

  // Check if logged in
  isLoggedIn: () => {
    return !!localStorage.getItem('token');
  },
};

export default authService;