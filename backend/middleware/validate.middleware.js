/**
 * validate.middleware.js — Request Payload Validation Middleware
 *
 * Provides reusable Express middleware functions for validating incoming
 * request bodies before they reach controller logic.
 *
 * Pattern: each validator calls next() on success, or responds with 400
 * and a descriptive error on failure. Controllers receive clean data.
 */

// ─── Extension Submission Validator ──────────────────────────────────────────

const VALID_VERDICTS = ['Accepted', 'Wrong Answer', 'TLE', 'MLE', 'RE', 'CE', 'Pending'];

const VALID_LANGUAGES = [
  'cpp', 'java', 'python3', 'python', 'c', 'csharp',
  'javascript', 'typescript', 'golang', 'rust',
  'kotlin', 'swift', 'scala', 'ruby', 'php',
  // Allow unknown languages without rejecting — just pass them through
];

/**
 * Validates the payload sent by the Chrome Extension for LeetCode submissions.
 *
 * @type {import('express').RequestHandler}
 */
export const validateExtensionSubmission = (req, res, next) => {
  const {
    problemSlug,
    submissionId,
    title,
    verdict,
    language,
    code,
    submittedAt,
    _nonce,
    _ts,
  } = req.body;

  const errors = [];

  // Required string fields
  const requiredStrings = { problemSlug, submissionId, title, language, code, submittedAt };
  for (const [key, val] of Object.entries(requiredStrings)) {
    if (!val || typeof val !== 'string' || val.trim() === '') {
      errors.push(`"${key}" is required and must be a non-empty string.`);
    }
  }

  // Verdict must be from allowed set
  if (!verdict || !VALID_VERDICTS.includes(verdict)) {
    errors.push(`"verdict" must be one of: ${VALID_VERDICTS.join(', ')}.`);
  }

  // problemSlug: only lowercase alphanumeric + hyphens
  if (problemSlug && !/^[a-z0-9-]+$/.test(problemSlug)) {
    errors.push('"problemSlug" must contain only lowercase letters, numbers, and hyphens.');
  }

  // submissionId: numeric string
  if (submissionId && !/^\d+$/.test(String(submissionId))) {
    errors.push('"submissionId" must be a numeric string.');
  }

  // title length cap
  if (title && title.length > 200) {
    errors.push('"title" cannot exceed 200 characters.');
  }

  // code size cap (500 KB)
  if (code && code.length > 500_000) {
    errors.push('"code" exceeds maximum allowed size of 500 KB.');
  }

  // submittedAt: valid ISO date
  if (submittedAt && isNaN(new Date(submittedAt).getTime())) {
    errors.push('"submittedAt" must be a valid ISO 8601 date string.');
  }

  // Nonce: 32-char hex string
  if (!_nonce || typeof _nonce !== 'string' || !/^[0-9a-f]{32}$/.test(_nonce)) {
    errors.push('"_nonce" is required and must be a 32-character hex string.');
  }

  // Timestamp: number, not null
  if (!_ts || typeof Number(_ts) !== 'number' || isNaN(Number(_ts))) {
    errors.push('"_ts" is required and must be a Unix millisecond timestamp.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors,
    });
  }

  next();
};
