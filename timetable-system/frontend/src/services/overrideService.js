import api from './api';

const overrideService = {
  getLogs: async () => {
    const response = await api.get('/overrides');
    return response.data;
  },

  createLog: async (logData) => {
    const response = await api.post('/overrides', logData);
    return response.data;
  },

  revertLog: async (id) => {
    const response = await api.delete(`/overrides/${id}`);
    return response.data;
  },
};

export default overrideService;
