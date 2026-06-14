import jwt from 'jsonwebtoken';

/**
 * Generates a signed JSON Web Token (JWT) with the user ID as payload.
 * FIX BUG-003: Reads expiry from JWT_EXPIRES_IN env var (default 7d, not 30d).
 *
 * @param {string} id - The MongoDB user document ID
 * @returns {string} The signed JWT token string
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

export default generateToken;
