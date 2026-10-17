/** See backend/services/patternService.js. */
export interface PatternSummary {
  key: string;
  name: string;
  short: string;
  level: number;
  requires: string[];
  total: number;
  solved: number;
  attempted: number;
}

export interface PatternsOverview {
  patterns: PatternSummary[];
  totals: { problems: number; solved: number; attempted: number };
}

export interface PatternProblem {
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  cue: string;
  complexity: string;
  primary: boolean;
  url: string;
  status: 'solved' | 'attempted' | 'todo';
  problemId: string | null;
}

export interface PatternDetail {
  key: string;
  name: string;
  short: string;
  level: number;
  requires: string[];
  explanation: string;
  cues: string[];
  wrongTurns: string[];
  template: string;
  problems: PatternProblem[];
}

/** Attached to GET /api/problems/:id when the problem is mapped. */
export interface ProblemPattern {
  key: string;
  name: string;
  short: string;
  cue: string;
  complexity: string;
  secondary: { key: string; name: string } | null;
}

/** See backend/services/predictionService.js buildFeedback(). */
export interface PatternFeedback {
  predictionId: string;
  slug: string;
  predicted: string;
  predictedName: string;
  verdict: string | null;
  source: 'extension' | 'app';
  createdAt: string;
  mapped: boolean;
  outcome: 'recognised' | 'right-pattern-bug' | 'missed' | 'wrong-approach' | 'unsure' | 'unmapped';
  title: string;
  message: string;
  isCorrect?: boolean | null;
  pattern?: { key: string; name: string; cue: string; complexity: string };
  secondary?: { key: string; name: string } | null;
}

export interface PredictionStats {
  attempts: number;
  correct: number;
  accuracy: number | null;
  perPattern: { key: string; attempts: number; correct: number; unsure: number; accuracy: number | null }[];
  confusions: { actual: string; actualName: string; predicted: string; predictedName: string; count: number }[];
}

/** See backend/services/diagnosisService.js. */
export interface DiagnosisSignal {
  type: string;
  severity: 'high' | 'medium' | 'good';
  title: string;
  detail: string;
}
export interface Diagnosis {
  status: 'clean' | 'solved-with-struggle' | 'stuck' | 'in-progress' | 'none';
  attempts: number;
  triesToAc?: number | null;
  signals: DiagnosisSignal[];
  checklist: string[];
  reviewOn: string | null;
  pattern: { key: string; name: string; complexity: string } | null;
}

export interface AiQuota { limit: number; used: number; remaining: number; resetsAt: string }

export interface TutorAnswer {
  id: string;
  submissionId: string;
  verdict: string | null;
  pattern: { key: string; name: string } | null;
  answer: {
    diagnosis: 'wrong-pattern' | 'right-pattern-too-slow' | 'implementation-bug' | 'edge-case' | 'other';
    summary: string;
    nudge: string;
    checks: string[];
    patternTip: string;
  };
  createdAt: string;
  cached?: boolean;
  quota?: AiQuota;
}

export interface TutorState {
  answers: TutorAnswer[];
  failed: { submissionId: string; verdict: string; submittedAt: string }[];
  quota: AiQuota;
}
