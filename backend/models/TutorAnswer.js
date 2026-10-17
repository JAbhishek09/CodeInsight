import mongoose from 'mongoose';

/** A cached "why did this fail?" answer for one failed submission. */
const TutorAnswerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    submissionId: { type: String, required: true },
    codeHash: { type: String, required: true },
    verdict: { type: String, default: null },
    patternKey: { type: String, default: null },
    answer: {
      diagnosis: String,
      summary: String,
      nudge: String,
      checks: [String],
      patternTip: String,
    },
  },
  { timestamps: true }
);

TutorAnswerSchema.index({ user: 1, problem: 1, submissionId: 1, codeHash: 1 }, { unique: true });

const TutorAnswer = mongoose.model('TutorAnswer', TutorAnswerSchema);
export default TutorAnswer;
