import { describe, expect, jest, test } from '@jest/globals';

import type { Workout } from '../../data/types';
import { lbToKg } from '../../lib/units';
import { draftFromTemplate, type Draft } from '../workout/draft';
import { templateFromDraft, templateFromWorkout, templateSummary } from './templates';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  },
}));

const bench = '00000000-0000-4000-8000-000000000012';
const hang = '00000000-0000-4000-8000-000000000022';

describe('workout templates', () => {
  test('keeps planned sets from a draft, blanks counting as zero', () => {
    const draft: Draft = {
      id: '00000000-0000-4000-8000-000000000010',
      title: 'Push',
      startedAt: '2026-10-08T15:00:00.000Z',
      restEndsAt: null,
      exercises: [
        {
          id: '00000000-0000-4000-8000-000000000011',
          exerciseId: bench,
          notes: '',
          sets: [
            { id: 'a', weightText: '135', weightKg: lbToKg(135), repsText: '8', completed: true },
            { id: 'b', weightText: '', weightKg: null, repsText: '', completed: false },
          ],
        },
      ],
    };
    const template = templateFromDraft(draft, 'Push day');
    expect(template.name).toBe('Push day');
    expect(template.exercises).toEqual([
      {
        exerciseId: bench,
        sets: [
          { reps: 8, weightKg: lbToKg(135) },
          { reps: 0, weightKg: 0 },
        ],
      },
    ]);
    expect(templateSummary(template)).toBe('1 exercise · 2 sets');
  });

  test('orders a finished workout by position', () => {
    const workout: Workout = {
      id: '00000000-0000-4000-8000-000000000030',
      title: 'Pull',
      startedAt: '2026-10-08T15:00:00.000Z',
      endedAt: '2026-10-08T16:00:00.000Z',
      notes: null,
      exercises: [
        { id: 'e2', exerciseId: hang, position: 1, notes: null, sets: [] },
        {
          id: 'e1',
          exerciseId: bench,
          position: 0,
          notes: null,
          sets: [
            { id: 's2', position: 1, reps: 5, weightKg: 100 },
            { id: 's1', position: 0, reps: 8, weightKg: 80 },
          ],
        },
      ],
    };
    const template = templateFromWorkout(workout, 'Pull');
    expect(template.exercises.map((exercise) => exercise.exerciseId)).toEqual([bench, hang]);
    expect(template.exercises[0].sets).toEqual([
      { reps: 8, weightKg: 80 },
      { reps: 5, weightKg: 100 },
    ]);
  });

  test('starts an unchecked draft with the planned values filled in', () => {
    const draft = draftFromTemplate(
      {
        id: '00000000-0000-4000-8000-000000000040',
        name: 'Pull',
        exercises: [
          { exerciseId: bench, sets: [{ reps: 8, weightKg: 100 }] },
          { exerciseId: hang, sets: [{ reps: 45, weightKg: 0 }] },
          { exerciseId: bench, sets: [] },
        ],
      },
      'metric',
      new Date('2026-10-09T12:00:00.000Z'),
    );
    expect(draft.title).toBe('Pull');
    expect(draft.startedAt).toBe('2026-10-09T12:00:00.000Z');
    expect(draft.endedAt).toBeNull();
    expect(
      draft.exercises.map((exercise) =>
        exercise.sets.map((set) => [set.weightText, set.repsText, set.completed]),
      ),
    ).toEqual([[['100', '8', false]], [['', '45', false]], [['', '', false]]]);
  });
});
