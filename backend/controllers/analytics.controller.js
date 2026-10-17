/**
 * analytics.controller.js
 * Ready-made analytics for the dashboard and stats pages.
 * See docs/analytics-api.md for the response shape.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { buildAnalyticsSummary, isValidTimeZone, PLATFORMS } from '../services/analyticsService.js';

/**
 * @desc    Get analytics summary for the logged-in user
 * @route   GET /api/analytics/summary?platform=all|leetcode|codeforces&tz=<IANA zone>
 * @access  Private
 */
export const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const platform = typeof req.query.platform === 'string' && req.query.platform ? req.query.platform : 'all';
  const tz = typeof req.query.tz === 'string' && req.query.tz ? req.query.tz : 'UTC';

  if (!PLATFORMS.includes(platform)) {
    res.status(400);
    throw new Error(`Invalid platform. Use one of: ${PLATFORMS.join(', ')}`);
  }
  if (!isValidTimeZone(tz)) {
    res.status(400);
    throw new Error('Invalid tz. Use an IANA time zone name such as "Asia/Kolkata".');
  }

  const data = await buildAnalyticsSummary({
    userId: req.user._id,
    platform,
    tz,
    targetDailySolved: req.user.targetDailySolved,
  });

  res.status(200).json({ success: true, data });
});
