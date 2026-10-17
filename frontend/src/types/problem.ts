export type Platform = 'leetcode' | 'codeforces' | 'manual';

export type LeetCodeDifficulty = 'Easy' | 'Medium' | 'Hard';
export type CodeforcesDifficulty = 'Div1' | 'Div2' | 'Div3' | 'unrated';
export type Difficulty = LeetCodeDifficulty | CodeforcesDifficulty;

export type ProblemStatus = 'Solved' | 'Attempted' | 'To Do';

export type AIAnalysisStatus = 'idle' | 'pending' | 'ready' | 'error';

/** A tracked problem as returned by GET /api/problems and /api/problems/:id. */
export interface Problem {
  _id: string;
  title: string;
  url?: string;
  difficulty: Difficulty;
  status: ProblemStatus;
  category: string;
  notes?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  platform?: Platform;
  submissions?: any[];
  tags?: string[];
  aiAnalysis?: any;
  aiAnalysisStatus?: AIAnalysisStatus;
  createdAt?: string;
  updatedAt?: string;
}
