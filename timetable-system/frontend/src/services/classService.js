import api from './api';

const classService = {
  getAll: async (params = {}) => {
    const res = await api.get('/classes', { params });
    return res.data;
  },

  getById: async (id) => {
    const res = await api.get(`/classes/${id}`);
    return res.data;
  },

  create: async (data) => {
    const res = await api.post('/classes', data);
    return res.data;
  },

  update: async (id, data) => {
    const res = await api.put(`/classes/${id}`, data);
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/classes/${id}`);
    return res.data;
  },

  // Public cascading dropdowns
  getSemestersByDepartment: async (departmentId) => {
    const res = await api.get(`/classes/semesters/${departmentId}`);
    return res.data;
  },

  getSectionsByDepartmentAndSemester: async (departmentId, semester) => {
    const res = await api.get(`/classes/sections/${departmentId}/${semester}`);
    return res.data;
  },
};

export default classService;