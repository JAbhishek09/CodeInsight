/**
 * prediction.controller.js — pattern guesses and recognition feedback.
 * See docs/PATTERN_MVP_PLAN.md.
 */

import asyncHandler from '../utils/asyncHandler.js';
import {
  isValidPrediction, isValidSlug, latestFeedback, predictionStats, recordPrediction,
} from '../services/predictionService.js';
import { DEFAULT_WEEKS, weeklyRecognition } from '../services/pilotService.js';
import { isValidTimeZone } from '../services/analyticsService.js';
import User from '../models/User.js';

/**
 * @desc    Save a pattern guess. source=extension waits for the submission;
 *          source=app|drill resolves now and returns the feedback. A drill
 *          answer given after the hint sends hinted: true (half credit).
 * @route   POST /api/predictions  { slug, predicted, source, hinted? }
 * @access  Private
 */
export const createPrediction = asyncHandler(async (req, res) => {
  const { slug, predicted, source = 'extension', hinted = false } = req.body ?? {};
  if (!isValidSlug(slug)) { res.status(400); throw new Error('Invalid problem slug.'); }
  if (!isValidPrediction(predicted)) { res.status(400); throw new Error('Unknown pattern.'); }
  if (!['extension', 'app', 'drill'].includes(source)) { res.status(400); throw new Error('Invalid source.'); }
  if (typeof hinted !== 'boolean') { res.status(400); throw new Error('hinted must be true or false.'); }

  if (source === 'extension') await User.updateOne({ _id: req.user._id }, { $set: { extensionSeenAt: new Date() } });
  const { prediction, feedback } = await recordPrediction({ userId: req.user._id, slug, predicted, source, hinted });
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

/**
 * @desc    Recognition accuracy per week (all guesses and first try per problem)
 * @route   GET /api/predictions/weekly?tz=Asia/Kolkata&weeks=8
 * @access  Private
 */
export const getWeeklyRecognition = asyncHandler(async (req, res) => {
  const tz = typeof req.query.tz === 'string' && req.query.tz ? req.query.tz : 'UTC';
  if (!isValidTimeZone(tz)) { res.status(400); throw new Error('Invalid tz.'); }
  const weeks = Math.min(26, Math.max(1, Number.parseInt(req.query.weeks, 10) || DEFAULT_WEEKS));
  res.status(200).json({ success: true, data: await weeklyRecognition(req.user._id, { tz, weeks }) });
});
