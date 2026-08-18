import api from './client';
import { auth } from '../firebase';

export const getDocuments = async () => {
  const response = await api.get('/api/documents');
  return response.data;
};

export const uploadDocument = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/ingest', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percent);
        }
      : undefined,
  });
  return response.data;
};

export const deleteDocument = async (id) => {
  const response = await api.delete(`/api/documents/${id}`);
  return response.data;
};

export const getDocumentPdfUrl = async (docId) => {
  const currentUser = auth.currentUser;
  const token = currentUser ? await currentUser.getIdToken() : '';
  return `/api/documents/${docId}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
};
