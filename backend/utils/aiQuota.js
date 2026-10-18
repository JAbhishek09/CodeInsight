/**
 * aiQuota.js — per-student daily limit on AI requests (analysis, tutor,
 * background review). Cached answers are free. The day resets at 00:00 UTC.
 */

import AiUsage from '../models/AiUsage.js';

export const dailyAiLimit = () => {
  const n = Number.parseInt(process.env.AI_DAILY_LIMIT ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
};

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getAiQuota(userId, now = new Date()) {
  const since = startOfUtcDay(now);
  const used = await AiUsage.countDocuments({ user: userId, createdAt: { $gte: since } });
  const limit = dailyAiLimit();
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetsAt: new Date(since.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export class AiQuotaError extends Error {
  constructor(quota) {
    super(`You've used all ${quota.limit} AI requests for today. They reset at midnight UTC.`);
    this.statusCode = 429;
    this.quota = quota;
  }
}

/**
 * Charge one request. Throws AiQuotaError when the limit is reached.
 * Call it right before the AI request, after any cache check.
 */
export async function consumeAiQuota(userId, kind) {
  const quota = await getAiQuota(userId);
  if (quota.remaining <= 0) throw new AiQuotaError(quota);
  const usage = await AiUsage.create({ user: userId, kind });
  return { ...quota, used: quota.used + 1, remaining: quota.remaining - 1, usageId: usage._id };
}

/** Give a request back when the AI call itself failed (not the student's fault). */
export async function refundAiQuota(usageId) {
  if (usageId) await AiUsage.deleteOne({ _id: usageId });
}

/** Like consumeAiQuota but returns false instead of throwing (background jobs). */
export async function tryConsumeAiQuota(userId, kind) {
  try {
    await consumeAiQuota(userId, kind);
    return true;
  } catch (err) {
    if (err instanceof AiQuotaError) return false;
    throw err;
  }
}
