import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';
import Problem from '../models/Problem.js';
import generateToken from '../utils/generateToken.js';
import { verifyGoogleIdToken } from '../utils/googleIdToken.js';
import { mailConfigured, sendMail } from '../utils/mailer.js';
import { siteUrlFor } from '../utils/origins.js';
import { parseLeetcodeHandle, parseCodeforcesHandle } from '../utils/parseHandle.js';
import crypto from 'crypto';

/** Emails are stored lowercased and trimmed; match lookups to that. */
const normalizeEmail = (e) => (typeof e === 'string' ? e.trim().toLowerCase() : '');

/** Pilot mode: when PILOT_INVITE_CODE is set, sign-up needs that code. */
const inviteCode = () => (process.env.PILOT_INVITE_CODE || '').trim();
const inviteOk = (invite) => !inviteCode() || String(invite ?? '').trim().toLowerCase() === inviteCode().toLowerCase();
const WRONG_INVITE = 'That invite code isn’t right. Ask the person running the pilot for it.';

/** Google sign-in is on when GOOGLE_CLIENT_ID (a Web client ID) is set. */
const googleClientId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();

/** What sign-in, sign-up and Google sign-in send back: the user and a token. */
const authPayload = (user) => ({
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
});

/**
 * @desc    What the sign-in and sign-up screens need to know
 * @route   GET /api/auth/config
 * @access  Public
 */
export const getAuthConfig = (req, res) => {
  res.status(200).json({ success: true, data: { inviteRequired: Boolean(inviteCode()), googleClientId: googleClientId() || null } });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
  
  const { name, password, targetDailySolved, invite } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please include name, email, and password');
  }
  if (!inviteOk(invite)) {
    res.status(403);
    throw new Error(WRONG_INVITE);
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
    res.status(201).json({ success: true, data: authPayload(user) });
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
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  const user = await User.findOne({ email }).select('+password');

  if (user && (await user.matchPassword(password))) {
    res.status(200).json({ success: true, data: authPayload(user) });
  } else {
    res.status(401);
    // Same message whether or not the account exists (no email guessing)
    throw new Error(googleClientId()
      ? 'Invalid email or password. If you signed up with Google, use Continue with Google.'
      : 'Invalid email or password');
  }
});

/**
 * @desc    Sign in or sign up with Google. The page sends the ID token from
 *          Google's "Sign in with Google" button; it must be valid for our
 *          GOOGLE_CLIENT_ID. One email is one account: an existing account
 *          with the same (Google-verified) email is signed in and linked.
 *          A new account needs the pilot invite code, like email sign-up.
 * @route   POST /api/auth/google  { credential, invite?, targetDailySolved? }
 * @access  Public
 */
export const googleAuth = asyncHandler(async (req, res) => {
  const clientId = googleClientId();
  if (!clientId) {
    res.status(404);
    throw new Error('Google sign-in isn’t set up on this server.');
  }
  const { credential, invite, targetDailySolved } = req.body ?? {};
  if (typeof credential !== 'string' || !credential) {
    res.status(400);
    throw new Error('Missing the Google sign-in credential.');
  }

  let profile;
  try {
    profile = await verifyGoogleIdToken(credential, clientId);
  } catch {
    res.status(401);
    throw new Error('Google sign-in didn’t go through. Try again.');
  }
  const email = normalizeEmail(profile?.email);
  if (!profile?.sub || !email || profile.email_verified !== true) {
    res.status(401);
    throw new Error('Your Google account’s email isn’t verified, so it can’t be used to sign in.');
  }

  let user = await User.findOne({ googleId: profile.sub }) ?? await User.findOne({ email });
  if (user) {
    if (user.googleId && user.googleId !== profile.sub) {
      res.status(409);
      throw new Error('This email is linked to a different Google account.');
    }
    if (!user.googleId) {
      user.googleId = profile.sub;
      await user.save();
    }
    return res.status(200).json({ success: true, data: authPayload(user) });
  }

  if (!inviteOk(invite)) {
    res.status(403);
    throw new Error(String(invite ?? '').trim()
      ? WRONG_INVITE
      : 'There’s no account for this Google email yet. Create one on the sign-up page with your invite code.');
  }
  const goal = Number(targetDailySolved);
  user = await User.create({
    name: (profile.name || email.split('@')[0]).trim().slice(0, 50),
    email,
    googleId: profile.sub,
    targetDailySolved: Number.isInteger(goal) && goal >= 1 && goal <= 20 ? goal : 1,
  });
  res.status(201).json({ success: true, data: authPayload(user) });
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

const RESET_MINUTES = 15;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The reset email: a button plus the plain link, in the app's indigo. */
function resetEmail(name, resetUrl) {
  const text = [
    `Hi ${name},`,
    '',
    `Someone (hopefully you) asked to reset the password for your CodeInsight account. Open this link within ${RESET_MINUTES} minutes to choose a new one:`,
    '',
    resetUrl,
    '',
    'If you didn’t ask for this, ignore this email; your password stays the same.',
  ].join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; padding: 24px; color: #18181b;">
      <p style="margin: 0 0 16px; font-weight: 600; color: #4f46e5;">CodeInsight</p>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Someone (hopefully you) asked to reset the password for your CodeInsight account. Use the button within ${RESET_MINUTES} minutes to choose a new one.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; display: inline-block;">Choose a new password</a>
      </p>
      <p style="font-size: 13px; color: #52525b;">Or open this link: <a href="${resetUrl}" style="color: #4f46e5;">${resetUrl}</a></p>
      <p style="font-size: 13px; color: #52525b;">If you didn’t ask for this, ignore this email; your password stays the same.</p>
    </div>`;
  return { text, html };
}

/**
 * @desc    Email a password-reset link. Also how an account made with Google
 *          adds a password. The link opens the site the request came from.
 * @route   POST /api/auth/forgot-password  { email }
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  if (!mailConfigured()) {
    res.status(503);
    throw new Error('Password reset by email isn’t set up on this server yet.'
      + (googleClientId() ? ' If you signed up with Google, use Continue with Google.' : ''));
  }

  // Same answer whether or not the account exists (no email guessing)
  const done = { success: true, message: 'If an account exists for that email, a reset link is on its way.' };
  const email = normalizeEmail(req.body?.email);
  const user = email ? await User.findOne({ email }) : null;
  if (!user) return res.status(200).json(done);

  // Only a hash of the token is stored, so a database leak can't reset passwords
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpire = Date.now() + RESET_MINUTES * 60 * 1000;
  await user.save();

  const resetUrl = `${siteUrlFor(req)}/reset-password?token=${resetToken}`;
  try {
    await sendMail({ to: user.email, subject: 'Reset your CodeInsight password', ...resetEmail(user.name, resetUrl) });
  } catch (err) {
    console.error(`[Mail] Reset email to user ${user._id} failed: ${err.message}`);
    res.status(502);
    throw new Error('Couldn’t send the reset email right now. Try again in a few minutes.');
  }
  res.status(200).json(done);
});
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
