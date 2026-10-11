import { describe, expect, test } from '@jest/globals';

import type { Workout } from '../../data/types';
import { withoutWorkout } from './cache';

function workout(id: string): Workout {
  return {
    id,
    title: id,
    startedAt: '2026-10-08T12:00:00.000Z',
    endedAt: '2026-10-08T13:00:00.000Z',
    notes: null,
    exercises: [],
  };
}

describe('history cache', () => {
  test('drops a workout from lists and paged history', () => {
    const listed = [workout('a'), workout('b')];
    expect(withoutWorkout(listed, 'a')).toEqual([workout('b')]);
    const paged = { pages: [listed], pageParams: [undefined] };
    expect(withoutWorkout(paged, 'b')).toEqual({
      pages: [[workout('a')]],
      pageParams: [undefined],
    });
    expect(withoutWorkout({ untouched: true }, 'a')).toEqual({ untouched: true });
  });
});
