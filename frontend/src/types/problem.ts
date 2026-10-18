export type Platform = 'leetcode' | 'codeforces' | 'manual';

export type LeetCodeDifficulty = 'Easy' | 'Medium' | 'Hard';
export type CodeforcesDifficulty = 'Div1' | 'Div2' | 'Div3' | 'unrated';
export type Difficulty = LeetCodeDifficulty | CodeforcesDifficulty;

export type ProblemStatus = 'Solved' | 'Attempted' | 'To Do';

export type AIAnalysisStatus = 'idle' | 'pending' | 'ready' | 'error';

export type Verdict = 'Accepted' | 'Wrong Answer' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'Pending';

export interface Submission {
  _id: string;
  submittedAt: string;
  verdict: Verdict | string;
  language: string;
  code?: string;
  submissionId?: string | null;
}

/** The AI analysis stored on a problem (shape produced by backend/services/aiService.js). */
export interface AIAnalysis {
  generatedAt?: string;
  codeSnapshotHash?: string | null;
  complexityAnalysis?: { current?: string; optimal?: string; explanation?: string };
  hints?: string[];
  /** Older analyses stored plain strings. */
  optimizationAreas?: (string | { description: string; snippet?: string })[];
  edgeCasesToConsider?: string[];
  interviewerQuestions?: { question: string; expectedAnswer: string }[];
}

/** See backend/docs/analytics-api.md — GET /api/problems/:id. */
export interface AIAnalysisMeta {
  status: AIAnalysisStatus;
  error: string | null;
  generatedAt: string | null;
  analyzedHash: string | null;
  latestAcceptedHash: string | null;
  latestCodeHash: string | null;
  isStale: boolean;
  pendingSince: string | null;
}

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
  /** LeetCode titleSlug / Codeforces id for imported problems. */
  platformProblemId?: string | null;
  submissions?: Submission[];
  tags?: string[];
  aiAnalysis?: AIAnalysis | null;
  aiAnalysisStatus?: AIAnalysisStatus;
  /** Only on GET /api/problems/:id — freshness of aiAnalysis vs the current code. */
  aiAnalysisMeta?: AIAnalysisMeta;
  /** Only on GET /api/problems/:id — the mapped pattern, or null. */
  pattern?: import('./pattern').ProblemPattern | null;
  /** Only on GET /api/problems/:id — rule-based "what went wrong". */
  diagnosis?: import('./pattern').Diagnosis;
  createdAt?: string;
  updatedAt?: string;
}
