import mongoose from 'mongoose';

/** One AI request charged to a student's daily limit (see utils/aiQuota.js). */
const AiUsageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['analysis', 'tutor', 'background'], required: true },
  createdAt: { type: Date, default: Date.now },
});

AiUsageSchema.index({ user: 1, createdAt: -1 });
// Only today's usage matters; keep two days for safety, then drop.
AiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 24 * 60 * 60 });

const AiUsage = mongoose.model('AiUsage', AiUsageSchema);
export default AiUsage;
