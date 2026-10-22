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
  /** Same focus as Home's plan (server decides). */
  focusKey: string | null;
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
  source: 'extension' | 'app' | 'drill';
  /** Drill answer given after the hint (a right one is worth half). */
  hinted?: boolean;
  createdAt: string;
  mapped: boolean;
  outcome: 'recognised' | 'right-pattern-bug' | 'missed' | 'wrong-approach' | 'unsure' | 'unmapped';
  title: string;
  message: string;
  isCorrect?: boolean | null;
  pattern?: { key: string; name: string; short?: string; cue: string; complexity: string };
  secondary?: { key: string; name: string } | null;
  problem?: { title: string; difficulty: 'Easy' | 'Medium' | 'Hard'; url: string };
  /** After a wrong guess: how to tell the real pattern from the one picked. */
  contrast?: { key: string; name: string; tip: string } | null;
}

export interface PredictionStats {
  attempts: number;
  correct: number;
  accuracy: number | null;
  perPattern: { key: string; attempts: number; correct: number; unsure: number; accuracy: number | null }[];
  confusions: { actual: string; actualName: string; predicted: string; predictedName: string; count: number; tip: string | null }[];
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

/** See backend/services/practiceService.js todayPlan(). */
export interface PlanItem {
  kind: 'review' | 'retry' | 'new';
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pattern: { key: string; name: string };
  url: string;
  problemId: string | null;
  reason: string;
  reviewId?: string;
  dueAt?: string;
}

export interface TodayPlan {
  date: string;
  focus: {
    key: string; name: string; short: string; solved: number; total: number;
    recognition: { attempts: number; accuracy: number | null } | null;
  } | null;
  plan: PlanItem[];
  doneToday: { slug: string; title: string; problemId: string; pattern: string | null }[];
  reviews: { due: number; upcomingThisWeek: number };
  recognition: { attempts: number; accuracy: number | null };
  patterns: { key: string; name: string; solved: number; total: number; accuracy: number | null }[];
  onboarding: Onboarding;
  /** Problems first solved today vs the daily target (same as Analytics). */
  goal: { date: string; solved: number; target: number; remaining: number; goalMet: boolean };
  /** Consecutive days with an accepted submission; alive until today ends. */
  streak: { current: number; longest: number; activeToday: boolean; lastActiveDay: string | null };
}

/** Getting-started steps; see backend/services/pilotService.js. */
export interface Onboarding {
  leetcodeLinked: boolean;
  imported: boolean;
  drilled: boolean;
  extension: boolean;
  done: boolean;
}

/** One week of recognition accuracy (Monday start). firstTry ignores repeat guesses on a problem. */
export interface RecognitionWeek {
  weekStart: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
  firstTry: { attempts: number; correct: number; accuracy: number | null };
  bySource: { drill: number; extension: number; app: number };
  activeDays: number;
}

/** See backend/services/drillService.js drillDeck(). */
export interface DrillCard {
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prompt: string;
  /** The hint: words in the prompt that carry the clue. */
  clues: string[];
  missedBefore: boolean;
  hintedBefore: boolean;
}

/** See backend/services/drillService.js drillStreak(). */
export interface DrillStreak {
  /** Cards to answer in a day for it to count. */
  target: number;
  today: { date: string; cards: number; done: boolean };
  streak: { current: number; longest: number; activeToday: boolean; lastActiveDay: string | null };
}

export interface DrillDeck {
  pattern: { key: string; name: string } | null;
  cards: DrillCard[];
  options: { key: string; name: string }[];
}

/** See backend/services/patternReportService.js. */
export type PatternGap = 'not-started' | 'recognition' | 'speed' | 'edge-cases' | 'unfinished' | 'on-track';

export interface PatternReportRow {
  key: string;
  name: string;
  level: number;
  total: number;
  solved: number;
  attempted: number;
  recognition: { attempts: number; correct: number; accuracy: number | null };
  submissions: number;
  failures: { wrongAnswer: number; slow: number; crash: number };
  firstSubmit: { solved: number; accepted: number; rate: number | null };
  attemptsToAccept: number | null;
  gap: PatternGap;
}

export interface PatternReport {
  totals: {
    keyProblems: number;
    solved: number;
    attempted: number;
    recognition: { attempts: number; correct: number; accuracy: number | null };
    firstSubmit: { solved: number; accepted: number; rate: number | null };
    failures: { wrongAnswer: number; slow: number; crash: number };
  };
  patterns: PatternReportRow[];
  /** rows: actual pattern; columns: the guess (8 patterns + 'unsure'); right guesses sit on the diagonal. */
  matrix: { rows: string[]; columns: string[]; counts: number[][] };
  mixups: { actual: string; predicted: string; count: number; tip: string | null }[];
}
