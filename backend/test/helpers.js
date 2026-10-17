import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET ||= 'test-secret';

let mongod;

export async function startDb() {
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
