import api from './axiosInstance';

/**
 * Response shapes from POST /analyze/:problemId
 *  - 200: { success, fromCache, analysis }
 *  - 202: { success, pending: true, message } — a background job is already
 *         generating the analysis; the client should poll again shortly.
 */
export interface TriggerAnalysisResponse {
  success: boolean;
  pending?: boolean;
  fromCache?: boolean;
  message?: string;
  analysis?: any;
}

export const triggerAnalysis = async (problemId: string): Promise<TriggerAnalysisResponse> => {
  const res = await api.post(`/analyze/${problemId}`);
  return res.data;
};
