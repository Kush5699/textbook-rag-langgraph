import axios from 'axios';
import { auth } from '../firebase';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Failed to get Firebase token:', error);
  }
  return config;
});

// Log errors but do NOT auto-redirect on 401
// ProtectedRoute handles auth state via Firebase onAuthStateChanged
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(`API error ${error.response.status}:`, error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
