import mongoose from 'mongoose';

/**
 * A student's guess of a problem's pattern, made before (extension) or
 * instead of (app) seeing the answer. See docs/PATTERN_MVP_PLAN.md.
 *
 * Extension predictions stay open until the next submission for that problem
 * arrives; app and drill (guess-the-pattern mode) predictions resolve
 * immediately.
 */
const PredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    slug: { type: String, required: true },                 // LeetCode titleSlug
    source: { type: String, enum: ['extension', 'app', 'drill'], required: true },
    predicted: { type: String, required: true },            // pattern key or 'unsure'
    actual: { type: String, default: null },                // pattern key, null if unmapped
    isCorrect: { type: Boolean, default: null },            // null when unmapped or unsure
    verdict: { type: String, default: null },               // first submission's verdict after predicting
    submissionId: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PredictionSchema.index({ user: 1, slug: 1, createdAt: -1 });
PredictionSchema.index({ user: 1, resolvedAt: 1 });

const Prediction = mongoose.model('Prediction', PredictionSchema);
export default Prediction;
