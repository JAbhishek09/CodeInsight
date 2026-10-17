/**
 * practice.controller.js — today's plan and the review queue.
 */

import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import { todayPlan } from '../services/practiceService.js';
import { completeReview } from '../services/reviewService.js';
import { isValidTimeZone } from '../services/analyticsService.js';

/**
 * @desc    Focus pattern, today's practice plan, reviews due, done today
 * @route   GET /api/practice/today?tz=Asia/Kolkata
 * @access  Private
 */
export const getToday = asyncHandler(async (req, res) => {
  const tz = typeof req.query.tz === 'string' && req.query.tz ? req.query.tz : 'UTC';
  if (!isValidTimeZone(tz)) { res.status(400); throw new Error('Invalid tz.'); }
  res.status(200).json({ success: true, data: await todayPlan(req.user._id, { tz }) });
});

/**
 * @desc    Record a review result and reschedule it
 * @route   POST /api/practice/reviews/:id  { result: 'easy' | 'hard' }
 * @access  Private
 */
export const postReview = asyncHandler(async (req, res) => {
  const { result } = req.body ?? {};
  if (!['easy', 'hard'].includes(result)) { res.status(400); throw new Error('result must be "easy" or "hard".'); }
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404); throw new Error('Review not found'); }
  const r = await completeReview(req.user._id, req.params.id, result);
  if (!r) { res.status(404); throw new Error('Review not found'); }
  res.status(200).json({ success: true, data: { id: String(r._id), dueAt: r.dueAt, intervalDays: r.intervalDays, done: r.done } });
});
