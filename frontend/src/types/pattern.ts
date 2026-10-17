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
