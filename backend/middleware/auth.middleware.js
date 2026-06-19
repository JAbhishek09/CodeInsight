import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';

/**
 * Middleware to protect private API routes.
 * Decodes the Bearer token sent in Authorization headers & attaches the active user model object.
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;
console.log(req.headers.authorization);
  // Retrieve token from Authorization header (Bearer style)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Split "Bearer <token>" and extract index 1
      token = req.headers.authorization.split(' ')[1];

      // Decode payload to verify token signature
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch user data from database excluding secure password hashes
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized: Verified user account no longer exists');
      }

      return next(); // ← explicit return prevents falling through to the !token check below
    } catch (error) {
      console.error(`🔒 Auth Middleware Token Verification Failed: ${error.message}`);
      res.status(401);
      throw new Error('Not authorized: Failed authentication signature verification');
    }
  }

  // Reached only when the Authorization header was absent entirely
  res.status(401);
  throw new Error('Not authorized: Missing Authorization Bearer token header');
});
