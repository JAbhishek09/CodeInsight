/**
 * pattern.controller.js — pattern knowledge base + the student's progress.
 * See docs/PATTERN_MVP_PLAN.md.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { getPattern, listPatterns } from '../services/patternService.js';
import { predictionStats } from '../services/predictionService.js';
import { chooseFocus } from '../services/practiceService.js';

/**
 * @desc    All patterns with this student's progress on the mapped problems
 * @route   GET /api/patterns
 * @access  Private
 */
export const getPatterns = asyncHandler(async (req, res) => {
  const [data, stats] = await Promise.all([listPatterns(req.user._id), predictionStats(req.user._id)]);
  // Same focus as Home's plan (weak solving + weak recognition), so the two never disagree
  const accMap = new Map(stats.perPattern.filter((p) => p.accuracy !== null).map((p) => [p.key, p]));
  data.focusKey = chooseFocus(data.patterns, accMap)?.key ?? null;
  res.status(200).json({ success: true, data });
});

/**
 * @desc    One pattern: explanation, cues, wrong turns, template, problems + status
 * @route   GET /api/patterns/:key
 * @access  Private
 */
export const getPatternByKey = asyncHandler(async (req, res) => {
  const data = await getPattern(req.user._id, req.params.key);
  if (!data) {
    res.status(404);
    throw new Error('Pattern not found');
  }
  res.status(200).json({ success: true, data });
});
