// Run with: npm test
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deckScore, drillResult, formatScore, markClues } from './drill.ts';

describe('scoring', () => {
  test('a right answer after the hint is half a point', () => {
    assert.equal(drillResult({ predicted: 'stack', hinted: false, isCorrect: true }), 'right');
    assert.equal(drillResult({ predicted: 'stack', hinted: true, isCorrect: true }), 'hinted');
    assert.equal(drillResult({ predicted: 'stack', hinted: true, isCorrect: false }), 'wrong');
    assert.equal(drillResult({ predicted: 'unsure', hinted: true, isCorrect: null }), 'unsure');
    assert.equal(deckScore(['right', 'hinted', 'wrong', 'unsure', 'right', 'hinted', 'hinted']), 3.5);
  });

  test('halves print as ½', () => {
    assert.equal(formatScore(6.5), '6½');
    assert.equal(formatScore(0.5), '½');
    assert.equal(formatScore(7), '7');
    assert.equal(formatScore(0), '0');
  });
});

describe('hint highlighting', () => {
  const prompt = 'An ascending array and a target. Use only constant extra memory.';

  test('marks each clue where it first appears, in prompt order', () => {
    assert.deepEqual(markClues(prompt, ['constant extra memory', 'An ascending array']), [
      { text: 'An ascending array', clue: true },
      { text: ' and a target. Use only ', clue: false },
      { text: 'constant extra memory', clue: true },
      { text: '.', clue: false },
    ]);
  });

  test('overlapping clues merge, and missing ones are skipped', () => {
    assert.deepEqual(markClues(prompt, ['ascending array and', 'array and a target', 'nowhere']), [
      { text: 'An ', clue: false },
      { text: 'ascending array and a target', clue: true },
      { text: '. Use only constant extra memory.', clue: false },
    ]);
    assert.deepEqual(markClues(prompt, []), [{ text: prompt, clue: false }]);
  });

  test('the segments always rebuild the prompt', () => {
    for (const clues of [['target'], ['An', 'memory.'], ['a', 'a target']]) {
      assert.equal(markClues(prompt, clues).map((s) => s.text).join(''), prompt);
    }
  });
});
