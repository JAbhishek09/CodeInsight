import jwt from 'jsonwebtoken';

/**
 * Generates a signed JSON Web Token (JWT) with the user ID as payload.
 * 
 * @param {string} id - The MongoDB user document ID
 * @returns {string} The signed JWT token string
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d', // Expires in 30 days for comfortable session times
  });
};

export default generateToken;