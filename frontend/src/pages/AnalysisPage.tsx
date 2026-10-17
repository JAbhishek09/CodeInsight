import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProblemById } from '../api/problems.api';
import { triggerAnalysis } from '../api/analysis.api';
import ComplexityCard from '../components/ComplexityCard';
import OptimizationList from '../components/OptimizationList';
import InterviewQACard from '../components/InterviewQACard';
import CodeViewer from '../components/CodeViewer';
import VerdictBadge from '../components/VerdictBadge';
import { Brain, ArrowLeft, Loader2, Zap, ExternalLink, Lightbulb, ShieldAlert, ChevronDown } from 'lucide-react';
import InlineCode from '../components/InlineCode';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OptimizationItem {
  description: string;
  snippet?: string;
}

interface AIAnalysis {
  complexityAnalysis?: { current: string; optimal: string; explanation?: string };
  hints?: string[];
  optimizationAreas?: (OptimizationItem | string)[];
  edgeCasesToConsider?: string[];
  interviewerQuestions?: { question: string; expectedAnswer: string }[];
  fromCache?: boolean;
  generatedAt?: string;
}


// ── Hints accordion — collapsed so user thinks before reading ─────────────────
function HintsSection({ hints }: { hints: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#0b0e14] border border-indigo-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-indigo-950/10 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-100">Think First — Hints</p>
          <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider mt-0.5">
            Socratic nudges before you read the answers
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-slate-950">
          {hints.map((hint, i) => (
            <div key={i} className="flex gap-3 pt-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 text-[9px] font-mono font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                <InlineCode text={hint} />
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Edge Cases section ────────────────────────────────────────────────────────
function EdgeCasesSection({ cases }: { cases: string[] }) {
  return (
    <div className="bg-[#0b0e14] border border-rose-500/15 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-950 pb-3">
        <ShieldAlert className="w-4 h-4 text-rose-400" />
        <h3 className="text-sm font-bold text-slate-100">Edge Cases to Consider</h3>
        <span className="ml-auto text-[10px] font-mono text-slate-500">Prep for follow-up questions</span>
      </div>
      <ul className="space-y-2.5">
        {cases.map((c, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-950/30 border border-rose-500/20 text-rose-400 text-[9px] font-mono font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              <InlineCode text={c} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Polling config for when the backend reports a background job in flight (HTTP 202)
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 15;

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<any>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Stop polling on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPoll();
    };
  }, [clearPoll]);

  useEffect(() => {
    if (!problemId) return;
    clearPoll();
    setPendingMessage(null);
    setLoadingProblem(true);
    getProblemById(problemId)
      .then((res) => {
        setProblem(res.data);
        if (res.data?.aiAnalysis?.complexityAnalysis) {
          setAnalysis({ ...res.data.aiAnalysis, fromCache: true });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingProblem(false));
  }, [problemId, clearPoll]);

  const runAnalysis = async (attempt = 0) => {
    if (!problemId) return;
    clearPoll();
    setLoadingAnalysis(true);
    setError(null);
    try {
      const data = await triggerAnalysis(problemId);
      if (!mountedRef.current) return;

      if (data.pending || !data.analysis) {
        // A background job is already generating this analysis — poll until ready.
        if (attempt + 1 >= MAX_POLL_ATTEMPTS) {
          setPendingMessage(null);
          setError('Analysis is still being generated. Please try again in a minute.');
          setLoadingAnalysis(false);
          return;
        }
        setPendingMessage(data.message || 'AI analysis is in progress. Checking again shortly...');
        pollTimerRef.current = setTimeout(() => runAnalysis(attempt + 1), POLL_INTERVAL_MS);
        return; // keep loadingAnalysis=true while polling
      }

      setPendingMessage(null);
      setAnalysis({ ...data.analysis, fromCache: data.fromCache });
      setLoadingAnalysis(false);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setPendingMessage(null);
      setError(e.message || 'Analysis failed');
      setLoadingAnalysis(false);
    }
  };

  const sortedSubmissions = problem?.submissions?.slice().sort(
    (a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  ) ?? [];
  const latestSubmissionWithCode = sortedSubmissions.find((s: any) => s.code?.trim().length > 0);
  const latestSubmission = sortedSubmissions[0] ?? null;

  if (loadingProblem) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!problem) {
    return <div className="text-center py-12 text-slate-500 text-sm font-mono">Problem not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="analysis-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-950 border-slate-800 text-slate-400 capitalize">
                {problem.platform}
              </span>
              {problem.difficulty && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  problem.difficulty === 'Easy'   ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' :
                  problem.difficulty === 'Medium' ? 'bg-amber-950/30 text-amber-400 border-amber-500/20' :
                  'bg-rose-950/30 text-rose-400 border-rose-500/20'
                }`}>
                  {problem.difficulty}
                </span>
              )}
              {latestSubmission && <VerdictBadge verdict={latestSubmission.verdict} />}
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">{problem.title}</h1>
            {problem.url && (
              <a href={problem.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 font-mono">
                View Problem <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <button
            onClick={() => runAnalysis()}
            disabled={loadingAnalysis || !latestSubmissionWithCode}
            title={!latestSubmissionWithCode ? 'No code available — use the Chrome Extension to capture submissions' : undefined}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 disabled:opacity-40 text-white text-xs font-bold rounded-xl px-5 py-2.5 transition-all shadow-lg shadow-pink-950/20"
          >
            {loadingAnalysis
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              : <><Brain className="w-4 h-4" /> Run AI Deep Dive</>
            }
          </button>
        </div>

        {analysis?.fromCache !== undefined && (
          <div className="mt-3">
            {analysis.fromCache
              ? <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400"><Zap className="w-3 h-3" /> Loaded from cache</span>
              : <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">✓ Fresh analysis complete</span>
            }
          </div>
        )}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 text-xs font-mono text-red-400">✗ {error}</div>
      )}

      {/* ── Pending (background job in flight) ─────────────────────────────── */}
      {pendingMessage && (
        <div className="flex items-center gap-2 bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 text-xs font-mono text-indigo-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> {pendingMessage}
        </div>
      )}

      {/* ── Code Viewer ────────────────────────────────────────────────────── */}
      {latestSubmissionWithCode
        ? <CodeViewer code={latestSubmissionWithCode.code} language={latestSubmissionWithCode.language} />
        : <CodeViewer code="" language="" />
      }

      {/* ── Analysis Sections ──────────────────────────────────────────────── */}
      {analysis && (
        <div className="space-y-4">

          {/* 1. Complexity — dynamic colors + explanation */}
          {analysis.complexityAnalysis && (
            <ComplexityCard data={analysis.complexityAnalysis} />
          )}

          {/* 2. Hints — accordion, collapsed by default */}
          {analysis.hints && analysis.hints.length > 0 && (
            <HintsSection hints={analysis.hints} />
          )}

          {/* 3. Optimization Areas — inline code + snippet blocks + severity icons */}
          <OptimizationList items={analysis.optimizationAreas ?? []} />

          {/* 4. Edge Cases */}
          {analysis.edgeCasesToConsider && analysis.edgeCasesToConsider.length > 0 && (
            <EdgeCasesSection cases={analysis.edgeCasesToConsider} />
          )}

          {/* 5. Interview Q&A */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Brain className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-100">Interview Questions</h3>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Goldman Sachs / Google L4 level</span>
            </div>
            {(analysis.interviewerQuestions ?? []).map((qa, i) => (
              <InterviewQACard key={i} index={i} question={qa.question} answer={qa.expectedAnswer} />
            ))}
          </div>

        </div>
      )}

      {!analysis && !loadingAnalysis && (
        <div className="text-center py-10 border border-dashed border-slate-900 rounded-xl text-slate-500 text-xs font-mono">
          {latestSubmissionWithCode
            ? 'Click "Run AI Deep Dive" to get a full analysis of your submission.'
            : 'No code available. Use the Chrome Extension to capture your LeetCode submissions.'
          }
        </div>
      )}
    </div>
  );
}
