import mongoose from 'mongoose';

// ─── Sub-document: A Single Platform Submission ───────────────────────────────
const SubmissionSchema = new mongoose.Schema(
  {
    submittedAt:  { type: Date, required: true },
    verdict: {
      type: String,
      enum: ['Accepted', 'Wrong Answer', 'TLE', 'MLE', 'RE', 'CE', 'Pending'],
      required: true,
    },
    language:     { type: String, required: true },   // 'cpp', 'java', 'python3', etc.
    code:         { type: String, default: '' },       // raw source text (may be empty for CF)
    submissionId: { type: String, default: null },     // platform's own submission ID
  },
  { _id: true }
);

// ─── Sub-document: Cached AI Analysis Result ─────────────────────────────────
// Stored alongside the problem so we never call the LLM twice for the same code.
// codeSnapshotHash is an MD5 of the code that was analysed — used for cache
// invalidation: if the user resubmits with different code the hash will differ
// and we will call the LLM again.
const AIAnalysisSchema = new mongoose.Schema(
  {
    generatedAt:       { type: Date, default: Date.now },
    codeSnapshotHash:  { type: String, default: null },
    complexityAnalysis: {
      current: { type: String, default: '' },
      optimal: { type: String, default: '' },
    },
    optimizationAreas:    [{ type: String }],
    interviewerQuestions: [
      {
        question:       { type: String },
        expectedAnswer: { type: String },
      },
    ],
  },
  { _id: false }
);

// ─── Main Problem Schema (Bucket Pattern) ─────────────────────────────────────
// One document per unique (user, platform, problemId) triplet.
// Submissions are embedded (bounded by problem scope — no 16 MB risk).
// AI analysis is cached in the same document (single read to serve the full view).
const ProblemSchema = new mongoose.Schema(
  {
    // Link to the owning user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Problem must be associated with a user'],
    },

    // ── Platform Origin ────────────────────────────────────────────────────────
    // 'manual' = problems added by hand through the old tracker UI
    platform: {
      type: String,
      enum: ['leetcode', 'codeforces', 'manual'],
      default: 'manual',
    },
    // LeetCode: titleSlug  |  Codeforces: "contestId+index" e.g. "1234A"
    platformProblemId: {
      type: String,
      default: null,
    },

    // ── Problem Metadata ───────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Please provide the coding problem title'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    url: {
      type: String,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: {
        values: ['Easy', 'Medium', 'Hard', 'Div1', 'Div2', 'Div3', 'unrated'],
        message: 'Invalid difficulty value',
      },
      default: 'Medium',
    },
    // Tags / topics (e.g. ['Dynamic Programming', 'Graph'])
    tags: [{ type: String }],

    // ── Legacy fields (kept for backward-compat with existing manual problems) ─
    status: {
      type: String,
      enum: { values: ['Solved', 'Attempted', 'To Do'], message: 'Invalid status' },
      default: 'Solved',
    },
    category:      { type: String, trim: true, default: 'General' },
    notes:         { type: String, trim: true },
    timeComplexity:  { type: String, trim: true, default: 'O(N)' },
    spaceComplexity: { type: String, trim: true, default: 'O(N)' },

    // ── Submissions Array (Bucket Pattern) ────────────────────────────────────
    // Bounded per-problem — safe to embed.
    // Note: capped at 200 submissions per problem via $slice in all write paths.
    // Oldest submissions are pruned when the cap is reached.
    submissions: [SubmissionSchema],

    // ── Cached AI Analysis ────────────────────────────────────────────────────
    // null  = not yet analysed
    // object = cached result; invalidated when codeSnapshotHash changes
    aiAnalysis: {
      type: AIAnalysisSchema,
      default: null,
    },

    // ── AI Analysis Lifecycle Status (BUG-AI-001 fix) ─────────────────────────
    // Tracks whether a background AI job is in flight so the on-demand analysis
    // endpoint (analysis.controller) can return HTTP 202 instead of firing a
    // second parallel Gemini call while the first is still running.
    //
    //  'idle'    — no analysis in progress; aiAnalysis may be null (never run)
    //              or populated (cached result available)
    //  'pending' — background analysis triggered by extension ingestion is
    //              in progress; frontend should poll
    //  'ready'   — analysis completed successfully; aiAnalysis is populated
    //  'error'   — last analysis attempt failed; aiAnalysis is null;
    //              aiAnalysisError has the failure message
    aiAnalysisStatus: {
      type: String,
      enum: ['idle', 'pending', 'ready', 'error'],
      default: 'idle',
    },

    // Human-readable error from the last failed AI analysis attempt.
    // Cleared to null on the next successful analysis.
    aiAnalysisError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary dashboard query: all problems for a user, ordered by platform
ProblemSchema.index({ user: 1, platform: 1 });

// Unique constraint: prevent duplicate synced problems per platform.
// Only enforce when platformProblemId is actually set (non-null).
// Manual problems (platformProblemId: null) are excluded via the partialFilterExpression
// so users can add multiple manual entries without hitting E11000 duplicate key errors.
ProblemSchema.index(
  { user: 1, platform: 1, platformProblemId: 1 },
  {
    unique: true,
    partialFilterExpression: { platformProblemId: { $type: 'string' } },
  }
);

// Analytics: filter across submissions by verdict
ProblemSchema.index({ 'submissions.verdict': 1 });

// ─── Post-save hook (legacy: keep solvedProblemsCount in sync for manual problems) ─
ProblemSchema.post('save', async function (doc, next) {
  if (doc.platform !== 'manual') return next();
  try {
    const solvedCount = await doc.constructor.countDocuments({ user: doc.user, status: 'Solved' });
    await mongoose.model('User').findByIdAndUpdate(doc.user, { solvedProblemsCount: solvedCount });
  } catch (err) {
    console.error('Error updating solvedProblemsCount on save:', err.message);
  }
  next();
});

ProblemSchema.post('findOneAndDelete', async function (doc, next) {
  if (doc && doc.platform === 'manual') {
    try {
      const solvedCount = await mongoose.model('Problem').countDocuments({ user: doc.user, status: 'Solved' });
      await mongoose.model('User').findByIdAndUpdate(doc.user, { solvedProblemsCount: solvedCount });
    } catch (err) {
      console.error('Error updating solvedProblemsCount on delete:', err.message);
    }
  }
  next();
});

ProblemSchema.post('findOneAndUpdate', async function (doc, next) {
  if (doc && doc.platform === 'manual') {
    try {
      const solvedCount = await mongoose.model('Problem').countDocuments({ user: doc.user, status: 'Solved' });
      await mongoose.model('User').findByIdAndUpdate(doc.user, { solvedProblemsCount: solvedCount });
    } catch (err) {
      console.error('Error updating solvedProblemsCount on update:', err.message);
    }
  }
  next();
});

const Problem = mongoose.model('Problem', ProblemSchema);
export default Problem;
