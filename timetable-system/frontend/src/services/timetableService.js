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

  // Downloads (Safe relative & full URL helpers)
  downloadClassPdf: (classId, versionId) => {
    const query = versionId ? `?versionId=${versionId}` : '';
    window.open(`/api/download/pdf/class/${classId}${query}`, '_blank');
  },

  downloadAllClassesPdf: (versionId) => {
    const query = versionId ? `?versionId=${versionId}` : '';
    window.open(`/api/download/pdf/all-classes${query}`, '_blank');
  },

  downloadTeacherPdf: (teacherId, versionId) => {
    const query = versionId ? `?versionId=${versionId}` : '';
    window.open(`/api/download/pdf/teacher/${teacherId}${query}`, '_blank');
  },

  downloadAllTeachersPdf: (versionId) => {
    const query = versionId ? `?versionId=${versionId}` : '';
    window.open(`/api/download/pdf/all-teachers${query}`, '_blank');
  },

  downloadClassExcel: (classId, versionId) => {
    const query = versionId ? `?versionId=${versionId}` : '';
    window.open(`/api/download/excel/class/${classId}${query}`, '_blank');
  },

  downloadAllClassesExcel: (versionId) => {
    const query = versionId ? `?versionId=${versionId}` : '';
    window.open(`/api/download/excel/all-classes${query}`, '_blank');
  },
};

export default timetableService;