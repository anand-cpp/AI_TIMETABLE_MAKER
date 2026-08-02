import api from './api';

const departmentService = {
  getAll: async () => {
    const res = await api.get('/departments');
    return res.data;
  },

  getById: async (id) => {
    const res = await api.get(`/departments/${id}`);
    return res.data;
  },

  create: async (data) => {
    const res = await api.post('/departments', data);
    return res.data;
  },

  update: async (id, data) => {
    const res = await api.put(`/departments/${id}`, data);
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/departments/${id}`);
    return res.data;
  },
};

export default departmentService;