import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';

const JWT_ERRORS = new Set(['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError']);

/**
 * Middleware to protect private API routes.
 * Decodes the Bearer token sent in Authorization headers & attaches the active user model object.
 *
 * 401 means "this token is no good" and makes the app sign the user out, so it
 * is only sent for a missing/invalid/expired token or a deleted account. A
 * database failure while looking the user up is a 503: the session is fine,
 * the server just can't check it right now.
 */
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer')) {
    res.status(401);
    throw new Error('Not authorized: Missing Authorization Bearer token header');
  }

  let decoded;
  try {
    decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch (error) {
    if (!JWT_ERRORS.has(error.name)) throw error;
    console.error(`🔒 Auth Middleware Token Verification Failed: ${error.message}`);
    res.status(401);
    throw new Error('Not authorized: Failed authentication signature verification');
  }

  try {
    req.user = await User.findById(decoded.id).select('-password');
  } catch (error) {
    console.error(`🔒 Auth Middleware user lookup failed: ${error.message}`);
    res.status(503);
    throw new Error('Service temporarily unavailable. Please try again.');
  }

  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized: Verified user account no longer exists');
  }
  return next();
});
