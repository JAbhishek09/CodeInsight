import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { parseLeetcodeHandle, parseCodeforcesHandle } from '../utils/parseHandle.js';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
  console.log('[REGISTER] Received request:', { body: req.body });
  
  const { name, email, password, targetDailySolved } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please include name, email, and password');
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('A user already exists with this email address');
  }

  console.log('[REGISTER] Creating user:', { name, email, targetDailySolved });
  
  const user = await User.create({
    name,
    email,
    password,
    targetDailySolved: targetDailySolved ? Number(targetDailySolved) : 1,
  });

  console.log('[REGISTER] User created successfully:', { id: user._id });

  if (user) {
    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        targetDailySolved: user.targetDailySolved,
        solvedProblemsCount: user.solvedProblemsCount,
        leetcodeHandle: user.leetcodeHandle,
        codeforcesHandle: user.codeforcesHandle,
        token: generateToken(user._id),
      },
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

/**
 * @desc    Login user & return JWT
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

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
        leetcodeHandle: user.leetcodeHandle,
        codeforcesHandle: user.codeforcesHandle,
        lastSyncedAt: user.lastSyncedAt,
        syncStatus: user.syncStatus,
        token: generateToken(user._id),
      },
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

/**
 * @desc    Save platform handles for the logged-in user
 * @route   PUT /api/auth/handles
 * @access  Private
 *
 * FIX BUG-SYNC-001: Parse URLs before saving so that both plain usernames
 * and full profile URLs (e.g. https://leetcode.com/u/krishna_rathi66/) are
 * normalised to a bare username before being stored and later sent to
 * external APIs.  This prevents sanitizeHandle() in sync.controller.js from
 * mangling a URL into a garbage string like "httpsleetcodecomu…".
 */
export const saveHandles = asyncHandler(async (req, res) => {
  const { leetcode, codeforces } = req.body;

  const updateData = {};

  if (leetcode !== undefined) {
    if (leetcode.trim() === '') {
      updateData.leetcodeHandle = null;
    } else {
      const parsed = parseLeetcodeHandle(leetcode);
      if (parsed === null) {
        res.status(400);
        throw new Error(
          `Could not extract a valid LeetCode username from "${leetcode}". ` +
          'Accepted formats: "username", "https://leetcode.com/u/username/", ' +
          '"https://leetcode.com/username/"'
        );
      }
      updateData.leetcodeHandle = parsed;
    }
  }

  if (codeforces !== undefined) {
    if (codeforces.trim() === '') {
      updateData.codeforcesHandle = null;
    } else {
      const parsed = parseCodeforcesHandle(codeforces);
      if (parsed === null) {
        res.status(400);
        throw new Error(
          `Could not extract a valid Codeforces handle from "${codeforces}". ` +
          'Accepted formats: "handle", "https://codeforces.com/profile/handle"'
        );
      }
      updateData.codeforcesHandle = parsed;
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true });

  res.status(200).json({
    success: true,
    data: {
      leetcodeHandle: user.leetcodeHandle,
      codeforcesHandle: user.codeforcesHandle,
    },
  });
});
