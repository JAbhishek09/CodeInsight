/**
 * Aggregation expressions for whether a problem is solved / attempted.
 *
 * `status` alone is not trustworthy for platform problems: sync upserts create
 * problem docs before pushing submissions, so they get the schema default
 * status 'Solved' even when every submission failed. So:
 *   - any Accepted submission                        → solved
 *   - manual problem with status 'Solved'            → solved
 *   - platform problem with status 'Solved' and no
 *     submissions at all (imported from a solved list) → solved
 *   - otherwise, any submission or status 'Attempted' → attempted
 *   - otherwise                                       → to do
 *
 * @param {object} p  expressions for submissions count, accepted count
 */
export function solvedExpr({ subCount, acCount }) {
  return {
    $or: [
      { $gt: [acCount, 0] },
      {
        $and: [
          { $eq: ['$status', 'Solved'] },
          { $or: [{ $eq: ['$platform', 'manual'] }, { $eq: [subCount, 0] }] },
        ],
      },
    ],
  };
}

export function attemptedExpr({ solved, subCount }) {
  return {
    $and: [
      { $not: [solved] },
      { $or: [{ $gt: [subCount, 0] }, { $eq: ['$status', 'Attempted'] }] },
    ],
  };
}
