import api from './api';

const teacherService = {
  getAll: async (params = {}) => {
    const res = await api.get('/teachers', { params });
    return res.data;
  },

  getById: async (id) => {
    const res = await api.get(`/teachers/${id}`);
    return res.data;
  },

  getMyProfile: async () => {
    const res = await api.get('/teachers/me/profile');
    return res.data;
  },

  create: async (data) => {
    const res = await api.post('/teachers', data);
    return res.data;
  },

  update: async (id, data) => {
    const res = await api.put(`/teachers/${id}`, data);
    return res.data;
  },

  updateUnavailability: async (id, unavailability) => {
    const res = await api.put(`/teachers/${id}/unavailability`, { unavailability });
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/teachers/${id}`);
    return res.data;
  },
};

export default teacherService;