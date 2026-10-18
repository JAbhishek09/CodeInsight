import mongoose from 'mongoose';

/**
 * A problem queued for spaced re-solving. One per (student, problem).
 * See services/reviewService.js and docs/PATTERN_MVP_PLAN.md.
 */
const ReviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    slug: { type: String, required: true },
    reason: { type: String, enum: ['recognition', 'struggle', 'manual'], required: true },
    dueAt: { type: Date, required: true },
    intervalDays: { type: Number, default: 2 },
    reps: { type: Number, default: 0 },
    lastResult: { type: String, enum: ['easy', 'hard', null], default: null },
    lastReviewedAt: { type: Date, default: null },
    done: { type: Boolean, default: false },   // retired after long enough intervals
  },
  { timestamps: true }
);

ReviewSchema.index({ user: 1, slug: 1 }, { unique: true });
ReviewSchema.index({ user: 1, done: 1, dueAt: 1 });

const Review = mongoose.model('Review', ReviewSchema);
export default Review;
