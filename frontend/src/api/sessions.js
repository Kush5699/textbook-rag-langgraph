import api from './client';

export const getSessions = async () => {
  const response = await api.get('/api/sessions');
  return response.data;
};

export const createSession = async (title = 'New Session') => {
  const response = await api.post('/api/sessions', { title });
  return response.data;
};

export const getSessionHistory = async (sessionId) => {
  const response = await api.get(`/api/sessions/${sessionId}/history`);
  return response.data;
};

export const deleteSession = async (sessionId) => {
  const response = await api.delete(`/api/sessions/${sessionId}`);
  return response.data;
};
