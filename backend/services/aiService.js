/**
 * aiService.js — Google Gemini AI wrapper
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { md5 } from '../utils/hashCode.js';

// ─── Singleton Gemini client ──────────────────────────────────────────────────
let _genAI = null;
let _model = null;

function getModel() {
  if (_model) return _model;
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  _model = _genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
  });
  return _model;
}

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
  const model = getModel();
  const userPrompt = buildUserPrompt({ problemTitle, problemLink, verdict, code, language });

  let rawText;
  let lastErr;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      rawText = result.response.text();
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`[AI] Gemini attempt ${attempt}/3 failed:`, err.message);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  if (!rawText) {
    throw new Error(`Gemini API call failed after 3 attempts: ${lastErr.message}`);
  }

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned non-JSON response. Raw: ${rawText.slice(0, 200)}`);
  }

  if (!parsed.complexityAnalysis || !parsed.optimizationAreas || !parsed.interviewerQuestions) {
    throw new Error('Gemini response is missing required analysis fields.');
  }

  const hash = md5(code);
  return { parsed, hash };
}
