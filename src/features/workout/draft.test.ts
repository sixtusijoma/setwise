import { describe, expect, jest, test } from '@jest/globals';

import type { Exercise, Workout } from '../../data/types';
import { lbToKg } from '../../lib/units';
import {
  defaultTitle,
  draftFromWorkout,
  finishPrompt,
  parseWeightText,
  prepareFinish,
  progressLabel,
  type Draft,
} from './draft';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  },
}));

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    title: 'Thursday Workout',
    startedAt: '2026-10-08T15:00:00.000Z',
    restEndsAt: null,
    exercises: [
      {
        id: '00000000-0000-4000-8000-000000000011',
        exerciseId: '00000000-0000-4000-8000-000000000012',
        notes: '  pause  ',
        sets: [
          {
            id: '00000000-0000-4000-8000-000000000013',
            weightText: '135',
            weightKg: lbToKg(135),
            repsText: '8',
            completed: true,
          },
          {
            id: '00000000-0000-4000-8000-000000000014',
            weightText: '',
            weightKg: null,
            repsText: '',
            completed: false,
          },
          {
            id: '00000000-0000-4000-8000-000000000015',
            weightText: '',
            weightKg: null,
            repsText: '',
            completed: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('workout draft', () => {
  test('names a workout after the weekday', () => {
    expect(defaultTitle(new Date(2026, 9, 8))).toBe('Thursday Workout');
  });

  test('stores typed pounds as kilograms', () => {
    expect(parseWeightText('225', 'imperial')).toBe(lbToKg(225));
    expect(parseWeightText('60', 'metric')).toBe(60);
    expect(parseWeightText('', 'imperial')).toBeNull();
  });

  test('finish drops empty sets and keeps the rest', () => {
    const result = prepareFinish(draft(), '2026-10-08T16:00:00.000Z');
    expect(finishPrompt(2)).toBe('Finish and drop 2 empty sets?');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dropped).toBe(2);
    expect(result.input.exercises[0]?.sets).toEqual([
      { id: '00000000-0000-4000-8000-000000000013', reps: 8, weightKg: lbToKg(135) },
    ]);
    expect(result.input.exercises[0]?.notes).toBe('pause');
  });

  test('finish refuses a workout with nothing logged', () => {
    const empty = draft();
    empty.exercises[0].sets = empty.exercises[0].sets.map((set) => ({
      ...set,
      weightText: '',
      weightKg: null,
      repsText: '',
      completed: false,
    }));
    expect(prepareFinish(empty, '2026-10-08T16:00:00.000Z')).toEqual({
      ok: false,
      message: 'Log at least one set before finishing.',
    });
  });

  test('progress counts completed sets and their volume', () => {
    expect(progressLabel(draft(), new Map(), 'imperial')).toBe('1 of 3 sets · 1,080 lb');
    const assisted: Exercise = {
      id: '00000000-0000-4000-8000-000000000012',
      ownerId: null,
      slug: 'assisted-pull-up',
      name: 'Assisted Pull-Up',
      muscleGroup: 'back',
      equipment: 'machine',
      aliases: [],
      track: null,
    };
    expect(progressLabel(draft(), new Map([[assisted.id, assisted]]), 'imperial')).toBe(
      '1 of 3 sets · 0 lb',
    );
    const carry: Exercise = { ...assisted, slug: null, ownerId: 'user', track: 'weighted-time' };
    expect(progressLabel(draft(), new Map([[carry.id, carry]]), 'imperial')).toBe(
      '1 of 3 sets · 0 lb',
    );
  });

  test('load-for-edit keeps ids and marks sets done', () => {
    const workout: Workout = {
      id: '00000000-0000-4000-8000-000000000020',
      title: 'Push',
      startedAt: '2026-10-08T15:00:00.000Z',
      endedAt: '2026-10-08T16:00:00.000Z',
      notes: null,
      exercises: [
        {
          id: '00000000-0000-4000-8000-000000000021',
          exerciseId: '00000000-0000-4000-8000-000000000022',
          position: 0,
          notes: null,
          sets: [
            { id: '00000000-0000-4000-8000-000000000023', position: 0, reps: 5, weightKg: 100 },
          ],
        },
      ],
    };
    const loaded = draftFromWorkout(workout, 'metric');
    expect(loaded.id).toBe(workout.id);
    expect(loaded.endedAt).toBe(workout.endedAt);
    expect(loaded.exercises[0]?.sets[0]).toMatchObject({
      weightText: '100',
      repsText: '5',
      completed: true,
    });
    const finished = prepareFinish(loaded, '2026-12-01T00:00:00.000Z');
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;
    expect(finished.input.id).toBe(workout.id);
    expect(finished.input.endedAt).toBe('2026-10-08T16:00:00.000Z');
  });
});
