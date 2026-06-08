import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

/**
 * @desc    Register a new user profile
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, targetDailySolved } = req.body;

  // Basic validation checks
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please include name, email, and password fields');
  }

  // Check if a user with that email already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('A user profile already exists with this email address');
  }

  // Create the new user. The pre('save') hook encrypts the password.
  const user = await User.create({
    name,
    email,
    password,
    targetDailySolved: targetDailySolved ? Number(targetDailySolved) : 1
  });

  if (user) {
    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        targetDailySolved: user.targetDailySolved,
        solvedProblemsCount: user.solvedProblemsCount,
        token: generateToken(user._id),
      }
    });
  } else {
    res.status(400);
    throw new Error('Invalid user creation parameters');
  }
});

/**
 * @desc    Authenticate user login & issue token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please include both email and password to log in');
  }

  // Find user by email and explicitly select password hash
  const user = await User.findOne({ email }).select('+password');

  if (user && (await user.matchPassword(password))) {
    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        targetDailySolved: user.targetDailySolved,
        solvedProblemsCount: user.solvedProblemsCount,
        token: generateToken(user._id),
      }
    });
  } else {
    res.status(401);
    throw new Error('Invalid credentials, please sign in with alternate logs');
  }
});

/**
 * @desc    Get current logged in user metadata
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  // Use req.user which was resolved inside our auth protection middleware
  res.status(200).json({
    success: true,
    data: req.user
  });
});
