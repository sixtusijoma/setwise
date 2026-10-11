import { describe, expect, test } from '@jest/globals';

import type { Workout } from '../../data/types';
import {
  isTopSetPr,
  lastSetLabel,
  previousLabel,
  previousSets,
  recentExerciseIds,
} from './history';
import { trackOf } from './tracks';

function workout(id: string, startedAt: string, exercises: Workout['exercises']): Workout {
  return { id, title: null, startedAt, endedAt: startedAt, notes: null, exercises };
}

describe('exercise history', () => {
  const workouts = [
    workout('new', '2026-10-08T12:00:00.000Z', [
      {
        id: 'we1',
        exerciseId: 'bench',
        position: 0,
        notes: null,
        sets: [{ id: 's1', position: 0, reps: 5, weightKg: 100 }],
      },
      {
        id: 'we2',
        exerciseId: 'row',
        position: 1,
        notes: null,
        sets: [{ id: 's2', position: 0, reps: 8, weightKg: 80 }],
      },
    ]),
    workout('old', '2026-10-01T12:00:00.000Z', [
      {
        id: 'we3',
        exerciseId: 'squat',
        position: 0,
        notes: null,
        sets: [{ id: 's3', position: 0, reps: 5, weightKg: 140 }],
      },
      {
        id: 'we4',
        exerciseId: 'bench',
        position: 1,
        notes: null,
        sets: [
          { id: 's4', position: 0, reps: 8, weightKg: 90 },
          { id: 's5', position: 1, reps: 5, weightKg: 100 },
        ],
      },
    ]),
  ];

  test('recent ids follow newest workouts and stay unique', () => {
    expect(recentExerciseIds(workouts)).toEqual(['bench', 'row', 'squat']);
  });

  test('previous sets come from the latest other session', () => {
    expect(previousSets(workouts, 'bench', 'draft')).toEqual([{ reps: 5, weightKg: 100 }]);
    expect(previousSets(workouts, 'bench', 'new')[0]).toEqual({ reps: 8, weightKg: 90 });
  });

  test('last label uses the heaviest set', () => {
    expect(
      lastSetLabel(
        [
          { reps: 8, weightKg: 90 },
          { reps: 5, weightKg: 100 },
        ],
        'metric',
      ),
    ).toBe('Last: 100 × 5');
  });

  test('labels follow how the lift is logged', () => {
    expect(previousLabel({ reps: 45, weightKg: 0 }, 'metric', 'time')).toBe('0:45');
    expect(previousLabel({ reps: 10, weightKg: 0 }, 'metric', 'reps')).toBe('10 reps');
    expect(previousLabel({ reps: 8, weightKg: 20 }, 'metric', 'assisted')).toBe('−20 × 8');
    expect(previousLabel({ reps: 45, weightKg: 40 }, 'metric', 'weighted-time')).toBe('40 × 0:45');
    expect(
      lastSetLabel(
        [
          { reps: 8, weightKg: 30 },
          { reps: 8, weightKg: 20 },
        ],
        'metric',
        'assisted',
      ),
    ).toBe('Last: −20 × 8');
  });

  test('a custom exercise uses its stored track, library lifts the library', () => {
    expect(trackOf({ slug: null, track: 'time' })).toBe('time');
    expect(trackOf({ slug: null, track: null })).toBe('weight');
    expect(trackOf({ slug: 'farmers-carry', track: null })).toBe('weighted-time');
    expect(trackOf({ slug: 'assisted-pull-up', track: null })).toBe('assisted');
  });

  test('a heavier set than history is a PR', () => {
    expect(isTopSetPr([{ reps: 5, weightKg: 100 }], 3, 102)).toBe(true);
    expect(isTopSetPr([{ reps: 5, weightKg: 100 }], 5, 100)).toBe(false);
    expect(isTopSetPr([{ reps: 5, weightKg: 100 }], 6, 100)).toBe(true);
  });
});
