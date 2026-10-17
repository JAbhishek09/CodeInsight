/**
 * tutor.controller.js — pattern-aware "why did this fail?" and the AI quota.
 */

import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import Problem from '../models/Problem.js';
import { askTutor, failedSubmissions, listTutorAnswers } from '../services/tutorService.js';
import { getAiQuota } from '../utils/aiQuota.js';

async function ownProblem(req, res) {
  if (!mongoose.isValidObjectId(req.params.problemId)) { res.status(404); throw new Error('Problem not found'); }
  const problem = await Problem.findOne({ _id: req.params.problemId, user: req.user._id });
  if (!problem) { res.status(404); throw new Error('Problem not found'); }
  return problem;
}

/**
 * @desc    Explain a failed submission (default: the latest failed one)
 * @route   POST /api/tutor/:problemId  { submissionId? }
 * @access  Private
 */
export const ask = asyncHandler(async (req, res) => {
  const problem = await ownProblem(req, res);
  try {
    const data = await askTutor({ userId: req.user._id, problem, submissionId: req.body?.submissionId });
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.statusCode) res.status(err.statusCode);
    throw err;
  }
});

/**
 * @desc    Saved tutor answers for a problem + which failed attempts can be asked about
 * @route   GET /api/tutor/:problemId
 * @access  Private
 */
export const list = asyncHandler(async (req, res) => {
  const problem = await ownProblem(req, res);
  const [answers, quota] = await Promise.all([listTutorAnswers(req.user._id, problem._id), getAiQuota(req.user._id)]);
  const failed = failedSubmissions(problem).map((s) => ({
    submissionId: String(s.submissionId ?? s._id),
    verdict: s.verdict,
    submittedAt: s.submittedAt,
  }));
  res.status(200).json({ success: true, data: { answers, failed, quota } });
});

/**
 * @desc    Today's AI usage for the logged-in student
 * @route   GET /api/tutor/quota
 * @access  Private
 */
export const quota = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await getAiQuota(req.user._id) });
});
