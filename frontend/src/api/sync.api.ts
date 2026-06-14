import api from './axiosInstance';

export const triggerSync = async () => {
  const res = await api.post('/sync');
  return res.data;
};
