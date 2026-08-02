import api from './api';

const settingsService = {
  get: async () => {
    const res = await api.get('/settings');
    return res.data;
  },

  update: async (data) => {
    const res = await api.put('/settings', data);
    return res.data;
  },

  reset: async () => {
    const res = await api.post('/settings/reset');
    return res.data;
  },

  clearTimetables: async () => {
    const res = await api.post('/settings/clear-timetables');
    return res.data;
  },

  clearSubjectsAndTimetables: async () => {
    const res = await api.post('/settings/clear-subjects-timetables');
    return res.data;
  },

  wipeAllData: async () => {
    const res = await api.post('/settings/wipe-all');
    return res.data;
  },
};

export default settingsService;