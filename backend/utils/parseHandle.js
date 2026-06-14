/**
 * parseHandle.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Extracts a clean platform username from whatever the user pastes:
 *   - bare username:                  "krishna_rathi66"
 *   - /u/ URL:                        "https://leetcode.com/u/krishna_rathi66/"
 *   - legacy URL:                     "https://leetcode.com/krishna_rathi66/"
 *   - Codeforces profile URL:         "https://codeforces.com/profile/tourist"
 *   - trailing slash / whitespace:    handled automatically
 *
 * Returns null if the input is empty or yields an empty/invalid string.
 */

/**
 * Extract a LeetCode username from a URL or plain string.
 *
 * Supported patterns:
 *   leetcode.com/u/<username>
 *   leetcode.com/<username>        (legacy / direct)
 *   bare username (no slashes)
 *
 * Username must be at least 2 characters (LeetCode minimum).
 * The min-3-char URL pattern prevents matching the literal path segment "u"
 * when the user types "leetcode.com/u/" with no username after it.
 *
 * @param {string} input
 * @returns {string|null}
 */
export function parseLeetcodeHandle(input) {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match full URLs: leetcode.com/u/<user> or leetcode.com/<user>
  // Username capture group requires ≥3 chars to avoid capturing the literal "u" path segment.
  const urlPattern = /leetcode\.com\/(?:u\/)?([A-Za-z0-9_\-\.]{3,})\/?$/i;
  const urlMatch = trimmed.match(urlPattern);
  if (urlMatch) {
    return urlMatch[1];
  }

  // If there's a slash or colon, it's a URL we couldn't parse — reject it
  // so we don't send garbage to the GraphQL API.
  if (trimmed.includes('/') || trimmed.includes(':')) {
    return null;
  }

  // Plain username — strip any stray non-allowed chars, require ≥2 chars
  const plain = trimmed.replace(/[^A-Za-z0-9_\-\.]/g, '');
  return plain.length >= 2 ? plain : null;
}

/**
 * Extract a Codeforces handle from a URL or plain string.
 *
 * Supported patterns:
 *   codeforces.com/profile/<handle>
 *   bare handle (no slashes)
 *
 * @param {string} input
 * @returns {string|null}
 */
export function parseCodeforcesHandle(input) {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match codeforces.com/profile/<handle>
  const urlPattern = /codeforces\.com\/profile\/([A-Za-z0-9_\-\.]{2,})\/?$/i;
  const urlMatch = trimmed.match(urlPattern);
  if (urlMatch) {
    return urlMatch[1];
  }

  // If it looks like any URL, reject
  if (trimmed.includes('/') || trimmed.includes(':')) {
    return null;
  }

  const plain = trimmed.replace(/[^A-Za-z0-9_\-\.]/g, '');
  return plain.length >= 2 ? plain : null;
}
