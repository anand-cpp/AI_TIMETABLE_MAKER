import api from './api';

const emailService = {
  getConfig: async () => {
    const res = await api.get('/email/config');
    return res.data;
  },

  updateConfig: async (data) => {
    const res = await api.put('/email/config', data);
    return res.data;
  },

  testConfig: async () => {
    const res = await api.post('/email/test');
    return res.data;
  },

  sendTimetableEmails: async (recipients) => {
    const res = await api.post('/email/send', { recipients });
    return res.data;
  },
};

export default emailService;