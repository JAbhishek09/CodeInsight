/**
 * origins.js — the websites the API answers to (CORS), and the ones a link the
 * server emails out may point at. CLIENT_URL may list several, comma-separated.
 */

const isProduction = process.env.NODE_ENV === 'production';

export const allowedOrigins = [
  ...(process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
  ...(isProduction ? [] : ['http://localhost:5000', 'http://localhost:5174']),
];

/** The page making the request is served by this same server (SERVE_CLIENT). */
export const isSameHost = (req, origin) => {
  try { return new URL(origin).host === req.get('host'); } catch { return false; }
};

/**
 * The site an emailed link should open: the page that asked, when it is this
 * site or a configured client — never just any Origin, or anyone could have a
 * reset link sent to a victim pointing at their own site. Otherwise the first
 * CLIENT_URL.
 */
export function siteUrlFor(req) {
  const origin = (req.get('origin') || '').replace(/\/+$/, '');
  if (origin && (isSameHost(req, origin) || allowedOrigins.includes(origin))) return origin;
  return allowedOrigins[0];
}
