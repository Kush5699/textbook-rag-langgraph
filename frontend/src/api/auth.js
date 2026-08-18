import api from './client';

export const syncUser = async () => {
  const response = await api.post('/api/auth/sync');
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};
