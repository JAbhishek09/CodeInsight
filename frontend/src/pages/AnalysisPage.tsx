import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProblemById } from '../api/problems.api';
import { triggerAnalysis } from '../api/analysis.api';
import ComplexityCard from '../components/ComplexityCard';
import OptimizationList from '../components/OptimizationList';
import InterviewQACard from '../components/InterviewQACard';
import CodeViewer from '../components/CodeViewer';
import VerdictBadge from '../components/VerdictBadge';
import { Brain, ArrowLeft, Loader2, Zap, ExternalLink } from 'lucide-react';

interface AIAnalysis {
  complexityAnalysis: { current: string; optimal: string };
  optimizationAreas: string[];
  interviewerQuestions: { question: string; expectedAnswer: string }[];
  fromCache?: boolean;
  generatedAt?: string;
}

export default function AnalysisPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<any>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!problemId) return;
    setLoadingProblem(true);
    getProblemById(problemId)
      .then((res) => {
        setProblem(res.data);
        // If cached analysis exists, show it immediately
        if (res.data?.aiAnalysis?.complexityAnalysis) {
          setAnalysis({ ...res.data.aiAnalysis, fromCache: true });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingProblem(false));
  }, [problemId]);

  const runAnalysis = async () => {
    if (!problemId) return;
    setLoadingAnalysis(true);
    setError(null);
    try {
      const data = await triggerAnalysis(problemId);
      setAnalysis({ ...data.analysis, fromCache: data.fromCache });
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // FIX: Use the most recent submission that HAS code for the code viewer,
  // rather than just the most recent submission (which may have empty code).
  const sortedSubmissions = problem?.submissions?.slice().sort(
    (a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  ) ?? [];

  const latestSubmissionWithCode = sortedSubmissions.find(
    (s: any) => s.code?.trim().length > 0
  );

  // For the header verdict badge, show the most recent submission overall
  const latestSubmission = sortedSubmissions[0] ?? null;

  if (loadingProblem) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm font-mono">
        Problem not found.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="analysis-page">
      {/* Header */}
      <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-950 border-slate-800 text-slate-400 capitalize">
                {problem.platform}
              </span>
              {problem.difficulty && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  problem.difficulty === 'Easy' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' :
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
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 font-mono"
              >
                View Problem <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <button
            onClick={runAnalysis}
            disabled={loadingAnalysis || !latestSubmissionWithCode}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 disabled:opacity-40 text-white text-xs font-bold rounded-xl px-5 py-2.5 transition-all shadow-lg shadow-pink-950/20"
            title={!latestSubmissionWithCode ? 'No code available — use the Chrome Extension to capture submissions' : undefined}
          >
            {loadingAnalysis ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
            ) : (
              <><Brain className="w-4 h-4" /> Run AI Deep Dive</>
            )}
          </button>
        </div>

        {analysis?.fromCache !== undefined && (
          <div className="mt-3">
            {analysis.fromCache ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400">
                <Zap className="w-3 h-3" /> Loaded from cache
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                ✓ Fresh analysis complete
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 text-xs font-mono text-red-400">
          ✗ {error}
        </div>
      )}

      {/* Code Viewer — show latest submission with actual code */}
      {latestSubmissionWithCode ? (
        <CodeViewer code={latestSubmissionWithCode.code} language={latestSubmissionWithCode.language} />
      ) : (
        <CodeViewer code="" language="" />
      )}

      {/* Analysis Sections */}
      {analysis && (
        <div className="space-y-4">
          <ComplexityCard data={analysis.complexityAnalysis} />
          <OptimizationList items={analysis.optimizationAreas} />

          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Brain className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-100">Interview Questions</h3>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Goldman Sachs / Google L4 level</span>
            </div>
            {analysis.interviewerQuestions.map((qa, i) => (
              <InterviewQACard key={i} index={i} question={qa.question} answer={qa.expectedAnswer} />
            ))}
          </div>
        </div>
      )}

      {!analysis && !loadingAnalysis && (
        <div className="text-center py-10 border border-dashed border-slate-900 rounded-xl text-slate-500 text-xs font-mono">
          {latestSubmissionWithCode
            ? 'Click "Run AI Deep Dive" to get a full analysis of your submission.'
            : 'No code available. Use the Chrome Extension to capture your LeetCode submissions.'}
        </div>
      )}
    </div>
  );
}
