/**
 * diagnose_code_gap.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Diagnostic script to understand exactly why ~938 submissions have no code.
 *
 * Run: node diagnose_code_gap.mjs
 *
 * What this checks:
 *  1. Total problem + submission counts
 *  2. Breakdown of problems by "code availability" state
 *  3. Sample 5 problems from each category and show their submission shapes
 *  4. Identify if the Phase 1C filter is targeting the right documents
 *  5. Check for any data integrity issues (null platformProblemId, etc.)
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// ── inline minimal schemas to avoid import issues ────────────────────────────
const SubmissionSchema = new mongoose.Schema({
  submittedAt:  Date,
  verdict:      String,
  language:     String,
  code:         { type: String, default: '' },
  submissionId: { type: String, default: null },
}, { _id: true });

const ProblemSchema = new mongoose.Schema({
  user:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  platform:          String,
  platformProblemId: String,
  title:             String,
  status:            String,
  submissions:       [SubmissionSchema],
  aiAnalysisStatus:  String,
}, { timestamps: true });

const Problem = mongoose.models.Problem || mongoose.model('Problem', ProblemSchema);

await mongoose.connect(process.env.MONGO_URI);
console.log('✓ Connected to MongoDB\n');

// ── 1. Counts ─────────────────────────────────────────────────────────────────
const totalProblems   = await Problem.countDocuments({ platform: 'leetcode' });
const totalWithAnySub = await Problem.countDocuments({ platform: 'leetcode', 'submissions.0': { $exists: true } });
const totalNoSubs     = await Problem.countDocuments({ platform: 'leetcode', 'submissions.0': { $exists: false } });

// Aggregate: total submission entries across all problems
const subCountAgg = await Problem.aggregate([
  { $match: { platform: 'leetcode' } },
  { $project: { subCount: { $size: '$submissions' } } },
  { $group: { _id: null, total: { $sum: '$subCount' } } },
]);
const totalSubEntries = subCountAgg[0]?.total ?? 0;

// Count problems that have at least ONE submission with non-empty code
const withCodeProblems = await Problem.countDocuments({
  platform: 'leetcode',
  submissions: { $elemMatch: { code: { $gt: '' } } },
});

// Count problems that have submissions but ALL have empty code
const allSubsEmptyCode = await Problem.countDocuments({
  platform: 'leetcode',
  'submissions.0': { $exists: true },
  submissions: { $not: { $elemMatch: { code: { $gt: '' } } } },
});

// Count problems with an AC submission that has empty code (Phase 1C target)
const acWithEmptyCode = await Problem.countDocuments({
  platform: 'leetcode',
  submissions: {
    $elemMatch: {
      verdict: 'Accepted',
      $or: [{ code: '' }, { code: null }, { code: { $exists: false } }],
    },
  },
});

// Count problems with AC submission that HAS code
const acWithCode = await Problem.countDocuments({
  platform: 'leetcode',
  submissions: { $elemMatch: { verdict: 'Accepted', code: { $gt: '' } } },
});

// Count submissions with code (entry-level, not problem-level)
const subsWithCodeAgg = await Problem.aggregate([
  { $match: { platform: 'leetcode' } },
  { $unwind: '$submissions' },
  { $group: {
    _id: null,
    withCode:    { $sum: { $cond: [{ $gt: ['$submissions.code', ''] }, 1, 0] } },
    withoutCode: { $sum: { $cond: [{ $lte: ['$submissions.code', ''] }, 1, 0] } },
    acWithCode:  { $sum: { $cond: [
      { $and: [
        { $eq: ['$submissions.verdict', 'Accepted'] },
        { $gt:  ['$submissions.code', ''] }
      ]}, 1, 0
    ]}},
    acWithoutCode: { $sum: { $cond: [
      { $and: [
        { $eq: ['$submissions.verdict', 'Accepted'] },
        { $not: { $gt: ['$submissions.code', ''] } }
      ]}, 1, 0
    ]}},
  }},
]);
const subStats = subsWithCodeAgg[0] ?? {};

console.log('═══════════════════════════════════════════════════');
console.log('  PROBLEM-LEVEL COUNTS');
console.log('═══════════════════════════════════════════════════');
console.log(`  Total LeetCode problems:           ${totalProblems}`);
console.log(`  Problems with ≥1 submission:       ${totalWithAnySub}`);
console.log(`  Problems with 0 submissions:       ${totalNoSubs}`);
console.log(`  Problems with ≥1 code-bearing sub: ${withCodeProblems}`);
console.log(`  Problems where all subs empty:     ${allSubsEmptyCode}`);
console.log(`  Problems: AC sub exists, no code:  ${acWithEmptyCode}   ← Phase 1C target`);
console.log(`  Problems: AC sub exists, HAS code: ${acWithCode}`);
console.log();
console.log('═══════════════════════════════════════════════════');
console.log('  SUBMISSION-ENTRY COUNTS');
console.log('═══════════════════════════════════════════════════');
console.log(`  Total submission entries:          ${totalSubEntries}`);
console.log(`  Entries WITH code:                 ${subStats.withCode ?? '?'}`);
console.log(`  Entries WITHOUT code:              ${subStats.withoutCode ?? '?'}`);
console.log(`  AC entries WITH code:              ${subStats.acWithCode ?? '?'}`);
console.log(`  AC entries WITHOUT code:           ${subStats.acWithoutCode ?? '?'}`);
console.log();

// ── 2. Sample: problems with no submissions at all ────────────────────────────
const noSubSamples = await Problem.find(
  { platform: 'leetcode', 'submissions.0': { $exists: false } },
  { title: 1, platformProblemId: 1, status: 1 }
).limit(5).lean();

console.log('═══════════════════════════════════════════════════');
console.log(`  SAMPLE: Problems with 0 submissions (showing 5 of ${totalNoSubs})`);
console.log('═══════════════════════════════════════════════════');
noSubSamples.forEach(p => console.log(`  "${p.title}" (${p.platformProblemId}) status=${p.status}`));
console.log();

// ── 3. Sample: problems where all sub entries have empty code ─────────────────
const emptyCodeSamples = await Problem.find(
  {
    platform: 'leetcode',
    'submissions.0': { $exists: true },
    submissions: { $not: { $elemMatch: { code: { $gt: '' } } } },
  },
  { title: 1, platformProblemId: 1, submissions: 1 }
).limit(5).lean();

console.log('═══════════════════════════════════════════════════');
console.log(`  SAMPLE: Problems with submissions but ALL empty code (showing 5 of ${allSubsEmptyCode})`);
console.log('═══════════════════════════════════════════════════');
emptyCodeSamples.forEach(p => {
  console.log(`  "${p.title}" (${p.platformProblemId})`);
  p.submissions.slice(0, 3).forEach(s =>
    console.log(`    id=${s.submissionId} verdict=${s.verdict} lang=${s.language} code="${(s.code||'').slice(0,30)}" len=${(s.code||'').length}`)
  );
});
console.log();

// ── 4. Sample: problems with AC + empty code (Phase 1C target) ───────────────
const acEmptySamples = await Problem.find(
  {
    platform: 'leetcode',
    submissions: { $elemMatch: { verdict: 'Accepted', $or: [{ code: '' }, { code: null }] } },
  },
  { title: 1, platformProblemId: 1, submissions: 1 }
).limit(5).lean();

console.log('═══════════════════════════════════════════════════');
console.log(`  SAMPLE: Problems with AC-but-no-code (showing 5 of ${acWithEmptyCode})`);
console.log('═══════════════════════════════════════════════════');
acEmptySamples.forEach(p => {
  console.log(`  "${p.title}" (${p.platformProblemId})`);
  p.submissions.filter(s => s.verdict === 'Accepted').slice(0, 2).forEach(s =>
    console.log(`    AC id=${s.submissionId} lang=${s.language} code_len=${(s.code||'').length}`)
  );
});
console.log();

// ── 5. Sample: problems with code (to confirm what "has code" looks like) ─────
const withCodeSamples = await Problem.find(
  { platform: 'leetcode', submissions: { $elemMatch: { code: { $gt: '' } } } },
  { title: 1, platformProblemId: 1, submissions: 1 }
).limit(3).lean();

console.log('═══════════════════════════════════════════════════');
console.log('  SAMPLE: Problems WITH code (confirming format)');
console.log('═══════════════════════════════════════════════════');
withCodeSamples.forEach(p => {
  console.log(`  "${p.title}" (${p.platformProblemId})`);
  p.submissions.filter(s => s.code && s.code.length > 0).slice(0, 1).forEach(s =>
    console.log(`    id=${s.submissionId} verdict=${s.verdict} lang=${s.language} code_len=${s.code.length} starts="${s.code.slice(0,60).replace(/\n/g,'↵')}"`)
  );
});
console.log();

// ── 6. Check submissionId format (string vs number) ──────────────────────────
const numericIdSample = await Problem.find(
  { platform: 'leetcode', 'submissions.0': { $exists: true } },
  { 'submissions.submissionId': 1 }
).limit(10).lean();

const idTypes = new Set();
numericIdSample.forEach(p => p.submissions.forEach(s => idTypes.add(typeof s.submissionId)));

console.log('═══════════════════════════════════════════════════');
console.log('  SUBMISSION ID TYPE CHECK');
console.log('═══════════════════════════════════════════════════');
console.log(`  submissionId types found: ${[...idTypes].join(', ')}`);
console.log(`  Sample IDs:`);
numericIdSample.slice(0, 3).forEach(p =>
  p.submissions.slice(0, 2).forEach(s =>
    console.log(`    ${JSON.stringify(s.submissionId)} (${typeof s.submissionId})`)
  )
);
console.log();

// ── 7. Distribution of submission counts per problem ─────────────────────────
const distribution = await Problem.aggregate([
  { $match: { platform: 'leetcode' } },
  { $project: { subCount: { $size: '$submissions' } } },
  { $bucket: {
    groupBy: '$subCount',
    boundaries: [0, 1, 2, 5, 10, 20, 50, 200],
    default: '200+',
    output: { count: { $sum: 1 } },
  }},
]);

console.log('═══════════════════════════════════════════════════');
console.log('  SUBMISSION COUNT DISTRIBUTION (per problem)');
console.log('═══════════════════════════════════════════════════');
distribution.forEach(b => console.log(`  [${b._id}–${b._id === '200+' ? '∞' : b._id+9}]: ${b.count} problems`));

await mongoose.disconnect();
console.log('\n✓ Done');
