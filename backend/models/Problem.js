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
    language:     { type: String, required: true },
    code:         { type: String, default: '' },
    submissionId: { type: String, default: null },
  },
  { _id: true }
);

// ─── Sub-document: Cached AI Analysis Result ─────────────────────────────────
const AIAnalysisSchema = new mongoose.Schema(
  {
    generatedAt:      { type: Date, default: Date.now },
    codeSnapshotHash: { type: String, default: null },

    complexityAnalysis: {
      current:     { type: String, default: '' },
      optimal:     { type: String, default: '' },
      // New: 1-sentence explanation of WHY current complexity is what it is
      explanation: { type: String, default: '' },
    },

    // New: Socratic hints — questions that nudge the user without spoiling the answer
    hints: [{ type: String }],

    // Updated shape: each area now has a description + optional code snippet
    optimizationAreas: [
      {
        description: { type: String },
        snippet:     { type: String, default: '' },
      },
    ],

    // New: specific edge cases the interviewer might probe
    edgeCasesToConsider: [{ type: String }],

    interviewerQuestions: [
      {
        question:       { type: String },
        expectedAnswer: { type: String },
      },
    ],
  },
  { _id: false }
);

// ─── Main Problem Schema ──────────────────────────────────────────────────────
const ProblemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Problem must be associated with a user'],
    },
    platform: {
      type: String,
      enum: ['leetcode', 'codeforces', 'manual'],
      default: 'manual',
    },
    platformProblemId: { type: String, default: null },
    title: {
      type: String,
      required: [true, 'Please provide the coding problem title'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    url:        { type: String, trim: true },
    difficulty: {
      type: String,
      enum: { values: ['Easy', 'Medium', 'Hard', 'Div1', 'Div2', 'Div3', 'unrated'], message: 'Invalid difficulty value' },
      default: 'Medium',
    },
    tags: [{ type: String }],

    // Legacy fields for manual problems
    status:         { type: String, enum: { values: ['Solved', 'Attempted', 'To Do'], message: 'Invalid status' }, default: 'Solved' },
    category:       { type: String, trim: true, default: 'General' },
    notes:          { type: String, trim: true },
    timeComplexity:  { type: String, trim: true, default: 'O(N)' },
    spaceComplexity: { type: String, trim: true, default: 'O(N)' },

    submissions: [SubmissionSchema],

    // null = not yet analysed; object = cached result
    aiAnalysis: { type: AIAnalysisSchema, default: null },

    aiAnalysisStatus: {
      type: String,
      enum: ['idle', 'pending', 'ready', 'error'],
      default: 'idle',
    },
    aiAnalysisError: { type: String, default: null },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
ProblemSchema.index({ user: 1, platform: 1 });
ProblemSchema.index(
  { user: 1, platform: 1, platformProblemId: 1 },
  { unique: true, partialFilterExpression: { platformProblemId: { $type: 'string' } } }
);
ProblemSchema.index({ 'submissions.verdict': 1 });

// ─── Hooks ────────────────────────────────────────────────────────────────────
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
