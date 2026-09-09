import api from './client';

export const syncUser = async () => {
  const response = await api.post('/api/auth/sync');
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

export const validateEmail = async (email) => {
  const response = await api.post('/api/auth/validate-email', { email });
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await api.put('/api/auth/profile', profileData);
  return response.data;
};
