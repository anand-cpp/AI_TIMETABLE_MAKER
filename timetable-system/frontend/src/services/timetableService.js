import api from './api';

const timetableService = {
  // Versions
  getVersions: async () => {
    const res = await api.get('/timetable/versions');
    return res.data;
  },

  getVersion: async (id) => {
    const res = await api.get(`/timetable/versions/${id}`);
    return res.data;
  },

  getAccepted: async () => {
    const res = await api.get('/timetable/accepted');
    return res.data;
  },

  getTeacherTimetable: async (teacherId) => {
    const res = await api.get(`/timetable/teacher/${teacherId}`);
    return res.data;
  },

  getEditHistory: async (id) => {
    const res = await api.get(`/timetable/versions/${id}/history`);
    return res.data;
  },

  // Generation
  generate: async (options = {}) => {
    const res = await api.post('/timetable/generate', options);
    return res.data;
  },

  // Version management
  acceptVersion: async (id) => {
    const res = await api.patch(`/timetable/versions/${id}/accept`);
    return res.data;
  },

  unacceptVersion: async (id) => {
    const res = await api.patch(`/timetable/versions/${id}/unaccept`);
    return res.data;
  },

  updateLabel: async (id, label) => {
    const res = await api.patch(`/timetable/versions/${id}/label`, { label });
    return res.data;
  },

  deleteVersion: async (id) => {
    const res = await api.delete(`/timetable/versions/${id}`);
    return res.data;
  },

  // Manual editing
  setSlot: async (id, data) => {
    const res = await api.patch(`/timetable/versions/${id}/edit/set`, data);
    return res.data;
  },

  clearSlot: async (id, data) => {
    const res = await api.patch(`/timetable/versions/${id}/edit/clear`, data);
    return res.data;
  },

  swapSlots: async (id, data) => {
    const res = await api.patch(`/timetable/versions/${id}/edit/swap`, data);
    return res.data;
  },

  lockSlot: async (id, data) => {
    const res = await api.patch(`/timetable/versions/${id}/edit/lock`, data);
    return res.data;
  },

  unlockSlot: async (id, data) => {
    const res = await api.patch(`/timetable/versions/${id}/edit/unlock`, data);
    return res.data;
  },

  // Downloads
  downloadClassPdf: (classId) => {
    window.open(`${import.meta.env.VITE_API_URL}/download/pdf/class/${classId}`, '_blank');
  },

  downloadAllClassesPdf: () => {
    window.open(`${import.meta.env.VITE_API_URL}/download/pdf/all-classes`, '_blank');
  },

  downloadTeacherPdf: (teacherId) => {
    window.open(`${import.meta.env.VITE_API_URL}/download/pdf/teacher/${teacherId}`, '_blank');
  },

  downloadAllTeachersPdf: () => {
    window.open(`${import.meta.env.VITE_API_URL}/download/pdf/all-teachers`, '_blank');
  },

  downloadClassExcel: (classId) => {
    window.open(`${import.meta.env.VITE_API_URL}/download/excel/class/${classId}`, '_blank');
  },

  downloadAllClassesExcel: () => {
    window.open(`${import.meta.env.VITE_API_URL}/download/excel/all-classes`, '_blank');
  },
};

export default timetableService;