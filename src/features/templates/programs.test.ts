import { describe, expect, test } from '@jest/globals';

import library from '../../../data/exercise-library.json';
import type { Exercise } from '../../data/types';
import { timed, trackOf } from '../exercises/tracks';
import { PROGRAMS, programTemplate } from './programs';

const slugs = new Set((library as { slug: string }[]).map((row) => row.slug));
const lifts = PROGRAMS.flatMap((program) => program.days.flatMap((day) => day.lifts));

describe('built-in programs', () => {
  test('every program slug is in the exercise library', () => {
    expect(lifts.filter(([slug]) => !slugs.has(slug))).toEqual([]);
  });

  test('targets follow how the lift is logged', () => {
    for (const [slug, sets, reps] of lifts) {
      const seconds = timed(trackOf({ slug }));
      expect([slug, sets >= 3 && sets <= 4]).toEqual([slug, true]);
      expect([slug, seconds ? reps >= 20 : reps <= 20]).toEqual([slug, true]);
    }
  });

  test('a day becomes a template with blank weights', () => {
    const push = PROGRAMS[0].days[0];
    const exercises = push.lifts.map(([slug], index) => ({ id: `id-${index}`, slug }) as Exercise);
    const template = programTemplate(PROGRAMS[0], push, exercises);
    expect(template.name).toBe('Push/Pull/Legs · Push');
    expect(template.exercises[0]).toEqual({
      exerciseId: 'id-0',
      sets: Array.from({ length: 4 }, () => ({ reps: 6, weightKg: 0 })),
    });
    expect(template.exercises).toHaveLength(push.lifts.length);
  });
});
