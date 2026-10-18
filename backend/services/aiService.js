/**
 * aiService.js — Google Gemini AI wrapper
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { md5 } from '../utils/hashCode.js';

// ─── Gemini client ────────────────────────────────────────────────────────────
// Free-tier keys get a separate daily allowance per model, so requests walk a
// chain of models: when one is out of quota the next one answers.
// GEMINI_MODELS overrides the chain (comma-separated, first = preferred);
// GEMINI_MODEL alone still works and goes first.
// Gemma is last: slower, but a separate free allowance.
const DEFAULT_CHAIN = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemma-4-26b-a4b-it'];
export function modelChain() {
  const list = process.env.GEMINI_MODELS
    ? process.env.GEMINI_MODELS.split(',')
    : [process.env.GEMINI_MODEL, ...DEFAULT_CHAIN];
  return [...new Set(list.map((m) => m?.trim()).filter(Boolean))];
}
const REQUEST_TIMEOUT_MS = 30_000;
// Long code costs tokens and rarely helps; the start of a solution carries the idea.
export const MAX_CODE_CHARS = 20_000;

let _genAI = null;
const _models = new Map(); // `${model}\n${systemInstruction}` → model handle

/** Gemma models take no system instruction or JSON mode: fold both into the prompt. */
const isGemma = (name) => name.startsWith('gemma');

function getModel(name, systemInstruction) {
  const key = `${name}\n${systemInstruction}`;
  if (_models.has(key)) return _models.get(key);
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  _genAI ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = isGemma(name)
    ? _genAI.getGenerativeModel({ model: name })
    : _genAI.getGenerativeModel({ model: name, systemInstruction, generationConfig: { responseMimeType: 'application/json' } });
  _models.set(key, model);
  return model;
}

async function callModel(name, system, prompt) {
  if (_generate) return _generate({ system, prompt, model: name });
  const input = isGemma(name) ? `${system}\n\n${prompt}\n\nReply with the JSON object only.` : prompt;
  const { response } = await getModel(name, system).generateContent(input, { timeout: REQUEST_TIMEOUT_MS });
  // Thinking models (Gemma) return their reasoning as separate "thought" parts: keep only the answer.
  const parts = response.candidates?.[0]?.content?.parts;
  return parts ? parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('') : response.text();
}

/** The provider's own daily/billing quota — retrying won't help for hours. */
const isProviderQuota = (err) => /quota|billing|RESOURCE_EXHAUSTED/i.test(err?.message ?? '');
/** This model can't be used with this key (retired, renamed, not on the free tier). */
const isUnavailableModel = (err) => /\b404\b|not found|is not supported|not available|permission denied|\b403\b/i.test(err?.message ?? '');

/** Rate limits, server errors and timeouts are worth retrying; bad requests are not. */
function isTransient(err) {
  if (isProviderQuota(err)) return false;
  const status = err?.status ?? err?.response?.status;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  return /timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(err?.message ?? '');
}

// A model that reported its quota as used up is skipped for a while, so later
// requests go straight to the next model instead of failing first.
const QUOTA_REST_MS = 60 * 60 * 1000;
const UNAVAILABLE_REST_MS = 24 * 60 * 60 * 1000;
const _restingUntil = new Map(); // model → timestamp
const resting = (m) => (_restingUntil.get(m) ?? 0) > Date.now();

// Tests replace the model call with a stub (see test/tutor.test.js).
let _generate = null;
export function __setGeneratorForTests(fn) { _generate = fn; _restingUntil.clear(); }

/**
 * Send a prompt and parse the JSON reply. Walks the model chain; on each model
 * retries transient failures up to 3 times, each call bounded by a timeout.
 */
export async function generateJson({ system, prompt }) {
  let rawText;
  let lastErr;
  let sawQuota = false;
  const chain = modelChain();
  const available = chain.filter((m) => !resting(m));
  if (available.length === 0) sawQuota = true;

  for (const name of available) {
    let moveOn = false; // only quota / unusable-model errors are worth another model
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        rawText = await callModel(name, system, prompt);
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[AI] ${name} attempt ${attempt}/3 failed:`, err.message);
        if (isProviderQuota(err)) { sawQuota = true; moveOn = true; _restingUntil.set(name, Date.now() + QUOTA_REST_MS); break; }
        if (isUnavailableModel(err)) { moveOn = true; _restingUntil.set(name, Date.now() + UNAVAILABLE_REST_MS); break; }
        if (!isTransient(err) || attempt === 3) break;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    if (rawText || !moveOn) break;
  }

  if (!rawText) {
    // Full provider details go to the server log, a plain message to the student.
    console.error('[AI] All models failed:', lastErr?.message ?? 'every model is resting after a quota error');
    if (sawQuota) {
      throw new Error('The free AI allowance is used up for today. Everything else works — try the AI again tomorrow.');
    }
    throw new Error('The AI service is unavailable right now. Try again in a minute.');
  }

  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Gemma sometimes wraps the JSON in prose
    const m = cleaned.match(/\{[\s\S]*\}/);
    try { if (m) return JSON.parse(m[0]); } catch { /* fall through */ }
    throw new Error('The AI returned an unreadable answer. Try again.');
  }
}

export const truncateCode = (code) =>
  code.length > MAX_CODE_CHARS ? `${code.slice(0, MAX_CODE_CHARS)}
/* … truncated … */` : code;

// ─── Upgraded System Prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior competitive programming coach and technical interview specialist.
You analyze submitted code solutions and return structured, actionable feedback.

YOUR TASK:
Analyze the user's submitted code for the given problem and return a JSON object.

OUTPUT FORMAT — Return ONLY this JSON object. No markdown fences. No explanation.
No preamble. No postamble. The response MUST be parseable by JSON.parse() directly.

{
  "complexityAnalysis": {
    "current": "<exact Big-O time complexity> time, <exact Big-O space complexity> space",
    "optimal": "<best known Big-O time> time, <best known Big-O space> space",
    "explanation": "<1 sentence explaining WHY the current complexity is what it is — reference actual variable names with backticks>"
  },
  "hints": [
    "<A Socratic nudge — ask a question that leads the user toward the optimization without giving it away. Reference actual code constructs with backticks.>"
  ],
  "optimizationAreas": [
    {
      "description": "<specific bottleneck — reference actual variable names, loop patterns, data structures using backticks>",
      "snippet": "<1-3 lines of code showing the optimized approach. Empty string if not applicable.>"
    }
  ],
  "edgeCasesToConsider": [
    "<specific edge case this code might fail on>"
  ],
  "interviewerQuestions": [
    {
      "question": "<question a Goldman Sachs / Google interviewer would ask about this specific approach>",
      "expectedAnswer": "<concise, technically complete answer a strong candidate gives>"
    }
  ]
}

STRICT RULES:
1. Base ALL analysis on the ACTUAL CODE PROVIDED — not on the problem statement alone.
2. Reference actual identifiers, loop constructs, and data structures using backticks.
3. If verdict is TLE: prioritize nested loop complexity, unnecessary recomputation, wrong DS.
4. If verdict is Wrong Answer: focus intensely on the edgeCasesToConsider array.
5. If verdict is MLE: focus on unbounded data structures or recursive stack depth.
6. Interview questions must be at Google/Goldman Sachs L4-L5 interview difficulty.
7. Hints must be Socratic — ask a question, never directly state the answer.
8. Keep each optimizationArea.description under 80 words.
9. Keep each expectedAnswer under 120 words — dense, not verbose.
10. complexityAnalysis.explanation must cite actual variable names or loop constructs from the code.`;

function buildUserPrompt({ problemTitle, problemLink, verdict, code, language }) {
  return `Problem: ${problemTitle}
Link: ${problemLink}
Verdict: ${verdict}
Language: ${language}

Submitted Code:
\`\`\`${language}
${code}
\`\`\``;
}

/**
 * Analyse a submission using Gemini and return parsed JSON + the code hash.
 * Retries up to 3 times with exponential back-off on transient failures.
 */
export async function analyzeCode({ problemTitle, problemLink, verdict, code, language }) {
  const parsed = await generateJson({
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt({ problemTitle, problemLink, verdict, code: truncateCode(code), language }),
  });

  if (!parsed.complexityAnalysis || !parsed.optimizationAreas || !parsed.interviewerQuestions) {
    throw new Error('Gemini response is missing required analysis fields.');
  }

  return { parsed, hash: md5(code) };
}
