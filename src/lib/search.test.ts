import { describe, expect, test } from '@jest/globals';

import library from '../../data/exercise-library.json';
import { searchExercises, searchScore } from './search';

const lifts = library as { name: string; aliases?: string[] }[];

describe('search', () => {
  test('ohp finds Overhead Press', () => {
    const matches = searchExercises(lifts, 'ohp');
    expect(matches[0]?.name).toBe('Overhead Press');
  });

  test('ranks a name prefix ahead of a later mention', () => {
    const matches = searchExercises(lifts, 'bench');
    expect(matches[0]?.name).toBe('Bench Press');
    expect(matches.some((item) => item.name === 'Incline Bench Press')).toBe(true);
  });

  test('matches multi-word aliases', () => {
    expect(searchScore({ name: 'Romanian Deadlift', aliases: ['rdl'] }, 'rdl')).toBeGreaterThan(0);
    const rows = searchExercises([{ name: 'One-Arm Dumbbell Row', aliases: ['db row'] }], 'db row');
    expect(rows).toHaveLength(1);
  });

  test('empty query keeps the original list', () => {
    const items = [{ name: 'B' }, { name: 'A' }];
    expect(searchExercises(items, '   ')).toEqual(items);
  });

  test('ignores punctuation and case', () => {
    expect(searchScore({ name: 'Pull-Up' }, 'PULL up')).toBeGreaterThan(0);
  });
});
