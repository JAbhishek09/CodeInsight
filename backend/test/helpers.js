import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { __setGeneratorForTests } from '../services/aiService.js';

process.env.JWT_SECRET ||= 'test-secret';

let mongod;

// Tests must never call the real Gemini API (it costs the developer's quota).
// Any code path that reaches the AI gets this stub unless a test sets its own.
const OFFLINE_AI_REPLY = JSON.stringify({
  complexityAnalysis: { current: 'O(n) time, O(1) space', optimal: 'O(n) time, O(1) space', explanation: 'stub' },
  hints: [], optimizationAreas: [], edgeCasesToConsider: [], interviewerQuestions: [],
});

export async function startDb() {
  __setGeneratorForTests(async () => OFFLINE_AI_REPLY);
  // First start on Windows can be slow (binary scan), so allow more than the 10s default
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongod.getUri());
}

export async function stopDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export const ac = (submittedAt, extra = {}) => ({
  submittedAt: new Date(submittedAt), verdict: 'Accepted', language: 'cpp', ...extra,
});

export const sub = (submittedAt, verdict, extra = {}) => ({
  submittedAt: new Date(submittedAt), verdict, language: 'cpp', ...extra,
});
