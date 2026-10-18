/**
 * pattern.controller.js — pattern knowledge base + the student's progress.
 * See docs/PATTERN_MVP_PLAN.md.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { getPattern, listPatterns } from '../services/patternService.js';

/**
 * @desc    All patterns with this student's progress on the mapped problems
 * @route   GET /api/patterns
 * @access  Private
 */
export const getPatterns = asyncHandler(async (req, res) => {
  const data = await listPatterns(req.user._id);
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
