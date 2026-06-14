/**
 * aiService.js — Google Gemini AI wrapper
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { md5 } from '../utils/hashCode.js';  // BUG-AI-003: use shared md5 instead of inlining crypto

// ─── Singleton Gemini client ──────────────────────────────────────────────────
let _genAI = null;
let _model = null;

function getModel() {
  if (_model) return _model;
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // gemini-2.0-flash-lite was shut down June 1 2026.
  // gemini-2.5-flash-lite is the current stable drop-in replacement —
  // same price tier, same API shape, no SDK change needed.
  _model = _genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
  });
  return _model;
}

// ─── Strict system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior competitive programming coach and technical interview specialist.
You analyze submitted code solutions and return structured, actionable feedback.

YOUR TASK:
Analyze the user's submitted code for the given problem and return a JSON object.

OUTPUT FORMAT — Return ONLY this JSON object. No markdown fences. No explanation.
No preamble. No postamble. The response MUST be parseable by JSON.parse() directly.

{
  "complexityAnalysis": {
    "current": "<exact Big-O time complexity> time, <exact Big-O space complexity> space",
    "optimal": "<best known Big-O time> time, <best known Big-O space> space"
  },
  "optimizationAreas": [
    "<specific bottleneck — reference actual code structure, variable names, loop patterns>",
    "<bottleneck 2>",
    "<bottleneck 3>"
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
2. Reference actual identifiers, loop constructs, or data structures from the submitted code.
3. If verdict is TLE: prioritize nested loop complexity, unnecessary recomputation, wrong DS.
4. If verdict is Wrong Answer: focus on edge cases — empty input, duplicates, overflow, indices.
5. If verdict is MLE: focus on unbounded data structures or recursive stack depth.
6. Interview questions must be at Google/Goldman Sachs L4-L5 interview difficulty.
7. Never produce generic advice ('use a better algorithm'). Always be specific.
8. complexityAnalysis.current must reflect the SUBMITTED code's actual complexity.
9. Keep each optimizationArea under 80 words.
10. Keep each expectedAnswer under 120 words — dense, not verbose.`;

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
 *
 * BUG-AI-002 FIX: Added 3-attempt retry loop with exponential back-off around
 * the Gemini API call.  Previously a single transient 503/429 from Gemini would
 * permanently leave aiAnalysis as null, requiring manual re-analysis.
 * With retries, transient errors are recovered automatically.
 *
 * BUG-AI-003 FIX: Uses the shared md5() from hashCode.js instead of an inline
 * crypto.createHash('md5') call.  If the hash algorithm ever changes it only
 * needs updating in one place.
 */
export async function analyzeCode({ problemTitle, problemLink, verdict, code, language }) {
  const model = getModel();
  const userPrompt = buildUserPrompt({ problemTitle, problemLink, verdict, code, language });

  let rawText;
  let lastErr;

  // BUG-AI-002: Retry up to 3 times with exponential back-off on transient failures
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      rawText = result.response.text();
      break; // success — exit retry loop
    } catch (err) {
      lastErr = err;
      console.warn(`[AI] Gemini attempt ${attempt}/3 failed:`, err.message);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, 2s back-off
      }
    }
  }

  if (!rawText) {
    throw new Error(`Gemini API call failed after 3 attempts: ${lastErr.message}`);
  }

  // Strip any accidental markdown fences before parsing
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Gemini returned non-JSON response. Raw: ${rawText.slice(0, 200)}`
    );
  }

  if (!parsed.complexityAnalysis || !parsed.optimizationAreas || !parsed.interviewerQuestions) {
    throw new Error('Gemini response is missing required analysis fields.');
  }

  // BUG-AI-003: Use shared md5() from hashCode.js (imported at top of file)
  const hash = md5(code);
  return { parsed, hash };
}
