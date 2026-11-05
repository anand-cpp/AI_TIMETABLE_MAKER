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

  getFacultyProfile: async (id) => {
    const res = await api.get(`/teachers/${id}/profile`);
    return res.data;
  },

  // ═══════════════════════════════════════════════════════════════
  // TEACHER SUBJECT ALLOCATIONS
  // ═══════════════════════════════════════════════════════════════

  addAllocation: async (teacherId, allocationData) => {
    const res = await api.post(`/teachers/${teacherId}/allocations`, allocationData);
    return res.data;
  },

  removeAllocation: async (teacherId, allocId) => {
    const res = await api.delete(`/teachers/${teacherId}/allocations/${allocId}`);
    return res.data;
  },

  editAllocation: async (teacherId, allocId, allocationData) => {
    const res = await api.put(`/teachers/${teacherId}/allocations/${allocId}`, allocationData);
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

  // ═══════════════════════════════════════════════════════════════
  // TEACHER SUBSTITUTIONS
  // ═══════════════════════════════════════════════════════════════

  getSubstitutions: async (teacherId) => {
    const res = await api.get(`/substitutions/teacher/${teacherId}`);
    return res.data;
  },

  createSubstitution: async (substitutionData) => {
    const res = await api.post(`/substitutions`, substitutionData);
    return res.data;
  },

  cancelSubstitution: async (substitutionId) => {
    const res = await api.delete(`/substitutions/${substitutionId}`);
    return res.data;
  },
};

export default teacherService;