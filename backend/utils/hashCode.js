import crypto from 'crypto';

/**
 * Compute an MD5 hash of a string.
 * Used for AI analysis cache invalidation — NOT for security.
 * MD5 is chosen over SHA-256 for speed (collision resistance is irrelevant here).
 *
 * @param {string} str
 * @returns {string} hex digest
 */
export function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}
