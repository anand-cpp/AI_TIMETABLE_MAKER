import api from './api';

const versionQuery = (versionId) => (versionId ? `?versionId=${versionId}` : '');

const filenameFromHeaders = (headers, fallback) => {
  const disposition = headers?.['content-disposition'] || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match ? decodeURIComponent(match[1]) : fallback;
};

const downloadFile = async (url, fallbackName) => {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const blob = new Blob([res.data], {
      type: res.headers['content-type'] || 'application/octet-stream',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filenameFromHeaders(res.headers, fallbackName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error('Download failed:', err?.response?.data?.message || err.message);
  }
};

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

  // Downloads — fetched with the auth token then saved as a blob so protected
  // endpoints work without leaking credentials in the URL.
  downloadClassPdf: (classId, versionId) =>
    downloadFile(`/download/pdf/class/${classId}${versionQuery(versionId)}`, 'class-timetable.pdf'),

  downloadAllClassesPdf: (versionId) =>
    downloadFile(`/download/pdf/all-classes${versionQuery(versionId)}`, 'all-classes-timetables.pdf'),

  downloadTeacherPdf: (teacherId, versionId) =>
    downloadFile(`/download/pdf/teacher/${teacherId}${versionQuery(versionId)}`, 'teacher-timetable.pdf'),

  downloadAllTeachersPdf: (versionId) =>
    downloadFile(`/download/pdf/all-teachers${versionQuery(versionId)}`, 'all-teacher-timetables.pdf'),

  downloadClassExcel: (classId, versionId) =>
    downloadFile(`/download/excel/class/${classId}${versionQuery(versionId)}`, 'class-timetable.xlsx'),

  downloadAllClassesExcel: (versionId) =>
    downloadFile(`/download/excel/all-classes${versionQuery(versionId)}`, 'all-classes-timetables.xlsx'),
};

export default timetableService;