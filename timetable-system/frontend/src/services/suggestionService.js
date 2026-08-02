import api from './api';

const suggestionService = {
  // Teacher
  create: async (message) => {
    const res = await api.post('/suggestions', { message });
    return res.data;
  },

  getMine: async () => {
    const res = await api.get('/suggestions/mine');
    return res.data;
  },

  // Admin
  getAll: async (params = {}) => {
    const res = await api.get('/suggestions', { params });
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await api.patch(`/suggestions/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await api.patch('/suggestions/read-all');
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/suggestions/${id}`);
    return res.data;
  },
};

export default suggestionService;