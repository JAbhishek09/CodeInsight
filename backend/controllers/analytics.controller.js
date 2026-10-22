/**
 * analytics.controller.js
 * Ready-made analytics for the dashboard and stats pages.
 * See docs/analytics-api.md for the response shape.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { buildAnalyticsSummary, isValidTimeZone, PLATFORMS } from '../services/analyticsService.js';
import { buildAiInsights } from '../services/aiInsightsService.js';
import { buildPatternReport } from '../services/patternReportService.js';
import { countMissingMeta, fillMissingMetaSoon, isFillingMeta } from '../services/problemMetaService.js';

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

  // LeetCode problems that came without topic tags (from the extension, or an
  // import without a session) get them in the background; the client checks
  // back while topicsLoading is true.
  data.topicsLoading = platform !== 'codeforces'
    && (await countMissingMeta(req.user._id)) > 0
    && (fillMissingMetaSoon(req.user._id) || isFillingMeta(req.user._id));

  res.status(200).json({ success: true, data });
});

/**
 * @desc    Text of every stored AI analysis (no code), review coverage and
 *          time-to-accepted, for the AI insights tab
 * @route   GET /api/analytics/ai-insights?platform=all|leetcode|codeforces
 * @access  Private
 */
export const getAiInsights = asyncHandler(async (req, res) => {
  const platform = typeof req.query.platform === 'string' && req.query.platform ? req.query.platform : 'all';
  if (!PLATFORMS.includes(platform)) {
    res.status(400);
    throw new Error(`Invalid platform. Use one of: ${PLATFORMS.join(', ')}`);
  }
  const data = await buildAiInsights({ userId: req.user._id, platform });
  res.status(200).json({ success: true, data });
});

/**
 * @desc    Per-pattern report: solved, spotted, how solutions fail, biggest
 *          gap; plus the mix-up grid (actual pattern × guess) with tips
 * @route   GET /api/analytics/patterns
 * @access  Private
 */
export const getPatternReport = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await buildPatternReport(req.user._id) });
});
