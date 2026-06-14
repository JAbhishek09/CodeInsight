/**
 * analytics.controller.js
 * Platform-level analytics aggregations (submission stats by verdict, difficulty, etc.)
 * These power the DashboardPage charts.
 */

import asyncHandler from '../utils/asyncHandler.js';
import Problem from '../models/Problem.js';

/**
 * @desc    Get submission analytics for the logged-in user
 * @route   GET /api/analytics/summary
 * @access  Private
 */
export const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Total problems by platform
  const byPlatform = await Problem.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$platform', count: { $sum: 1 } } },
  ]);

  // Verdict distribution across all submissions
  const verdictDist = await Problem.aggregate([
    { $match: { user: userId } },
    { $unwind: '$submissions' },
    { $group: { _id: '$submissions.verdict', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Problems with at least one TLE or WA (candidates for analysis)
  const needsAnalysis = await Problem.countDocuments({
    user: userId,
    'submissions.verdict': { $in: ['TLE', 'Wrong Answer', 'RE', 'MLE'] },
  });

  res.status(200).json({
    success: true,
    data: { byPlatform, verdictDist, needsAnalysis },
  });
});
