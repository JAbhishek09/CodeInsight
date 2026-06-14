import api from './axiosInstance';

export const triggerAnalysis = async (problemId: string) => {
  const res = await api.post(`/analyze/${problemId}`);
  return res.data;
};
