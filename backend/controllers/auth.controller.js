import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';
import Problem from '../models/Problem.js';
import generateToken from '../utils/generateToken.js';
import { parseLeetcodeHandle, parseCodeforcesHandle } from '../utils/parseHandle.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

/** Pilot mode: when PILOT_INVITE_CODE is set, sign-up needs that code. */
const inviteCode = () => (process.env.PILOT_INVITE_CODE || '').trim();

/**
 * @desc    What the sign-up screen needs to know
 * @route   GET /api/auth/config
 * @access  Public
 */
export const getAuthConfig = (req, res) => {
  res.status(200).json({ success: true, data: { inviteRequired: Boolean(inviteCode()) } });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
  
  const { name, email, password, targetDailySolved, invite } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please include name, email, and password');
  }
  if (inviteCode() && String(invite ?? '').trim().toLowerCase() !== inviteCode().toLowerCase()) {
    res.status(403);
    throw new Error('That invite code isn’t right. Ask the person running the pilot for it.');
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('A user already exists with this email address');
  }

  
  const user = await User.create({
    name,
    email,
    password,
    targetDailySolved: targetDailySolved ? Number(targetDailySolved) : 1,
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
 * @desc    Update the logged-in user's name and/or daily goal
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, targetDailySolved } = req.body ?? {};
  const updates = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 50) {
      res.status(400);
      throw new Error('Name must be between 1 and 50 characters.');
    }
    updates.name = name.trim();
  }
  if (targetDailySolved !== undefined) {
    const n = Number(targetDailySolved);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      res.status(400);
      throw new Error('Daily goal must be a whole number from 1 to 20.');
    }
    updates.targetDailySolved = n;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400);
    throw new Error('Nothing to update.');
  }

  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true }).select('-password');
  res.status(200).json({ success: true, data: user });
});

export const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    
    // Security tip: Don't tell the client if the email doesn't exist
    // Just pretend it worked to prevent email-guessing attacks.
    if (!user) {
      return res.status(200).json({ success: true, message: 'Email sent' });
    }

    // 1. Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 2. Hash the token and save it to the database (Security best practice!)
    // We hash it in the DB so if the DB leaks, attackers can't use the reset tokens.
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes from now
    
    await user.save();

    // 3. Create the reset URL pointing to your React frontend
    // Make sure to send the UNHASHED token in the email!
    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;

    // 4. Send the email using Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'Gmail', // or SendGrid, AWS SES, etc.
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    await transporter.sendMail({
      from: '"CodeInsight Support" <noreply@codeinsight.com>',
      to: user.email,
      subject: 'CodeInsight -Password Reset Request',
      html: `
       <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #db2777;">CodeInsight</h2>
          <h3>You requested a password reset</h3>
          <p>Click the button below to securely set a new password. This link will expire in 15 minutes.</p>
          <a href="${resetUrl}" style="background-color: #db2777; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
            Reset Password
          </a>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            If you did not request this, please ignore this email. Your password will remain unchanged.
          </p>
        </div>
      `
    });

    res.status(200).json({ success: true, message: 'Email sent' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
export const resetPassword = async (req, res) => {
  try {
    // 1. Get the token from the request body or URL params
    const { token, newPassword } = req.body ?? {};

    if (typeof token !== 'string' || !token || typeof newPassword !== 'string') {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // 2. Hash the incoming token so we can compare it to the one in the database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // 3. Find the user with this token AND ensure the token hasn't expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() } // $gt means "Greater Than" right now
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Token is invalid or has expired' });
    }

    // 4. Set the new password — the User pre('save') hook hashes it
    user.password = newPassword;

    // 5. CRITICAL: Clear out the reset fields so the token can never be used again
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();

    res.status(200).json({ success: true, message: 'Password successfully updated' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

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

  // One account = one LeetCode/Codeforces user. Switching to a different user
  // while the old one's problems are still here would mix two people's data.
  const current = await User.findById(req.user._id).select('leetcodeHandle codeforcesHandle');
  const switches = [
    ['leetcode', 'leetcodeHandle', 'LeetCode'],
    ['codeforces', 'codeforcesHandle', 'Codeforces'],
  ];
  for (const [platform, field, label] of switches) {
    const next = updateData[field];
    const prev = current?.[field];
    if (next === undefined || !prev || (next ?? '').toLowerCase() === prev.toLowerCase()) continue;
    const existing = await Problem.countDocuments({ user: req.user._id, platform });
    if (existing > 0) {
      res.status(409);
      throw new Error(
        `Your account already has ${existing} problems from ${label} user "${prev}". ` +
        `Remove that imported data first (Import → Remove imported data), then link a different user.`
      );
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
