import axiosInstance from './axiosInstance';

export interface ProblemPayload {
  title: string;
  url?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status?: 'Solved' | 'Attempted' | 'To Do';
  category?: string;
  notes?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
}

/**
 * Retrieves tracked coding problems for the current authenticated user.
 * Supports optional filter query parameters.
 */
export const getProblems = async (filters: Record<string, any> = {}) => {
  const response = await axiosInstance.get('/problems', { params: filters });
  return response.data;
};

/**
 * Retrieves a single problem by ID.
 */
export const getProblemById = async (id: string) => {
  const response = await axiosInstance.get(`/problems/${id}`);
  return response.data;
};

/**
 * Creates and tracks a new coding problem.
 */
export const createProblem = async (problemData: ProblemPayload) => {
  const response = await axiosInstance.post('/problems', problemData);
  return response.data;
};

/**
 * Updates an existing tracked coding problem by ID.
 */
export const updateProblem = async (id: string, problemData: Partial<ProblemPayload>) => {
  const response = await axiosInstance.put(`/problems/${id}`, problemData);
  return response.data;
};

/**
 * Deletes a tracked coding problem by ID.
 */
export const deleteProblem = async (id: string) => {
  const response = await axiosInstance.delete(`/problems/${id}`);
  return response.data;
};
