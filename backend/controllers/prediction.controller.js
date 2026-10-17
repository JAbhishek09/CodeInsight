/**
 * prediction.controller.js — pattern guesses and recognition feedback.
 * See docs/PATTERN_MVP_PLAN.md.
 */

import asyncHandler from '../utils/asyncHandler.js';
import {
  isValidPrediction, isValidSlug, latestFeedback, predictionStats, recordPrediction,
} from '../services/predictionService.js';

/**
 * @desc    Save a pattern guess. source=extension waits for the submission;
 *          source=app resolves now and returns the feedback.
 * @route   POST /api/predictions  { slug, predicted, source }
 * @access  Private
 */
export const createPrediction = asyncHandler(async (req, res) => {
  const { slug, predicted, source = 'extension' } = req.body ?? {};
  if (!isValidSlug(slug)) { res.status(400); throw new Error('Invalid problem slug.'); }
  if (!isValidPrediction(predicted)) { res.status(400); throw new Error('Unknown pattern.'); }
  if (!['extension', 'app'].includes(source)) { res.status(400); throw new Error('Invalid source.'); }

  const { prediction, feedback } = await recordPrediction({ userId: req.user._id, slug, predicted, source });
  res.status(201).json({ success: true, data: { predictionId: String(prediction._id), feedback } });
});

/**
 * @desc    Feedback from the most recent resolved guess on a problem
 * @route   GET /api/predictions/latest?slug=two-sum
 * @access  Private
 */
export const getLatestFeedback = asyncHandler(async (req, res) => {
  const { slug } = req.query;
  if (!isValidSlug(slug)) { res.status(400); throw new Error('Invalid problem slug.'); }
  res.status(200).json({ success: true, data: await latestFeedback(req.user._id, slug) });
});

/**
 * @desc    Recognition accuracy overall, per pattern, and common confusions
 * @route   GET /api/predictions/stats
 * @access  Private
 */
export const getPredictionStats = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await predictionStats(req.user._id) });
});
