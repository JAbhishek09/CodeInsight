import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Redact password from log so it doesn't appear in console/logs
    const redacted = (process.env.MONGO_URI || '').replace(/:([^@]+)@/, ':<redacted>@');
    console.log('MONGO_URI (redacted):', redacted);

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,  // fail fast: surface Atlas errors in 8s not 30s
      connectTimeoutMS: 10000,
    });
    
    console.log(`=========================================`);
    console.log(` MongoDB Connected Successfully!`);
    console.log(` Host: ${conn.connection.host}`);
    console.log(` Database: ${conn.connection.name}`);
    console.log(`=========================================`);

    // ── Index Migration ────────────────────────────────────────────────────────
    // Drop the old sparse index on problems collection if it still exists.
    // The old index allowed duplicate (user, platform, null platformProblemId)
    // which blocked users from adding more than one manual problem.
    // The replacement uses partialFilterExpression (defined in Problem.js).
    try {
      const problemsCollection = conn.connection.collection('problems');
      const indexes = await problemsCollection.indexes();
      const oldIndex = indexes.find(ix =>
        ix.name === 'user_1_platform_1_platformProblemId_1' && ix.sparse === true
      );
      if (oldIndex) {
        await problemsCollection.dropIndex('user_1_platform_1_platformProblemId_1');
        console.log('✅ Dropped old sparse index on problems — new partialFilterExpression index applied.');
      }
    } catch (migrationErr) {
      // Non-fatal — log and continue; new index will still be created by Mongoose
      console.warn('⚠ Index migration warning:', migrationErr.message);
    }

  } catch (error) {
    console.error(`=========================================`);
    console.error(`❌ MongoDB Connection Failed!`);
    console.error(` NAME: ${error.name}`);
    console.error(` MESSAGE: ${error.message}`);
    console.error(` CODE: ${error.code}`);
    console.error(`=========================================`);
    console.error(` FULL STACK:`, error.stack);
    process.exit(1);
  }
};

export default connectDB;
