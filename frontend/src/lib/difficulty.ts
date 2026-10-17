import type { Difficulty } from '../types/problem';

/**
 * Single source of truth for how a difficulty is labelled and coloured.
 *
 * LeetCode difficulties use the fixed easy/medium/hard hues. Codeforces
 * divisions are not a difficulty scale in the same sense, so they get the
 * accent (Div1/Div2) or neutral (Div3/unrated) treatment — never Hard red.
 */
export interface DifficultyStyle {
  label: string;
  /** Text colour class for the difficulty on its own (e.g. a count). */
  text: string;
  /** Solid fill class for dots, bars and legend swatches. */
  dot: string;
  /** Tinted pill: background + text + border. */
  badge: string;
  /** CSS colour value (var(--…)) for SVG / chart fills. */
  color: string;
}

const NEUTRAL: DifficultyStyle = {
  label: 'Unrated',
  text: 'text-muted-foreground',
  dot: 'bg-subtle',
  badge: 'bg-surface-2 text-muted-foreground border border-border',
  color: 'var(--text-muted)',
};

const STYLES: Record<string, DifficultyStyle> = {
  Easy: {
    label: 'Easy',
    text: 'text-easy',
    dot: 'bg-easy',
    badge: 'bg-easy/10 text-easy border border-easy/25',
    color: 'var(--easy)',
  },
  Medium: {
    label: 'Medium',
    text: 'text-medium',
    dot: 'bg-medium',
    badge: 'bg-medium/10 text-medium border border-medium/25',
    color: 'var(--medium)',
  },
  Hard: {
    label: 'Hard',
    text: 'text-hard',
    dot: 'bg-hard',
    badge: 'bg-hard/10 text-hard border border-hard/25',
    color: 'var(--hard)',
  },
  Div1: {
    label: 'Div 1',
    text: 'text-primary',
    dot: 'bg-primary',
    badge: 'bg-primary/15 text-primary border border-primary/30',
    color: 'var(--primary)',
  },
  Div2: {
    label: 'Div 2',
    text: 'text-primary',
    dot: 'bg-primary/60',
    badge: 'bg-primary/5 text-primary border border-primary/20',
    color: 'color-mix(in oklab, var(--primary) 60%, transparent)',
  },
  Div3: {
    label: 'Div 3',
    text: 'text-foreground',
    dot: 'bg-subtle',
    badge: 'bg-surface-3 text-foreground border border-border-strong',
    color: 'var(--text-secondary)',
  },
  unrated: NEUTRAL,
};

export const LEETCODE_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export const CODEFORCES_DIFFICULTIES = ['Div1', 'Div2', 'Div3', 'unrated'] as const;

export function difficultyStyle(difficulty: Difficulty | string | undefined | null): DifficultyStyle {
  if (!difficulty) return NEUTRAL;
  return STYLES[difficulty] ?? { ...NEUTRAL, label: difficulty };
}

export function difficultyLabel(difficulty: Difficulty | string | undefined | null): string {
  return difficultyStyle(difficulty).label;
}
