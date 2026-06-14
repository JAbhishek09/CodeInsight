import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    targetDailySolved: {
      type: Number,
      default: 1,
    },
    solvedProblemsCount: {
      type: Number,
      default: 0,
    },

    // ─── CodeInsight: Platform Handles ────────────────────────────────────────
    leetcodeHandle: {
      type: String,
      trim: true,
      default: null,
    },
    codeforcesHandle: {
      type: String,
      trim: true,
      default: null,
    },

    // ─── CodeInsight: Sync State ───────────────────────────────────────────────
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    syncStatus: {
      type: String,
      enum: ['idle', 'syncing', 'error'],
      default: 'idle',
    },

    // ─── CodeInsight: Historical Import State ─────────────────────────────────
    // Tracks whether the one-time full history import has been run.
    //
    //  'none'     — never run
    //  'partial'  — AC problem list imported, no code (session not provided)
    //  'full'     — full import with submission code completed (session provided)
    //
    // This is shown in the Profile UI so the user knows what data exists.
    historyImportStatus: {
      type: String,
      enum: ['none', 'partial', 'full'],
      default: 'none',
    },
    historyImportCount: {
      type: Number,
      default: 0,
    },
    lastHistoryImportAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save hook: hash password only when it is being set/modified.
 */
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

/**
 * Instance method: compare a plain password against the stored hash.
 */
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', UserSchema);
export default User;
