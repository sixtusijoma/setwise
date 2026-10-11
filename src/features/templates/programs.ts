import * as Crypto from 'expo-crypto';

import type { Exercise, Template } from '../../data/types';

/** Library slug, sets, and target reps. Timed lifts hold seconds in `reps`, as logged sets do. */
type Lift = [slug: string, sets: number, reps: number];

export type ProgramDay = { name: string; lifts: Lift[] };

export type Program = { id: string; name: string; description: string; days: ProgramDay[] };

export const PROGRAMS: Program[] = [
  {
    id: 'ppl',
    name: 'Push/Pull/Legs',
    description: 'Three days, each muscle group once. Run it twice a week for six.',
    days: [
      {
        name: 'Push',
        lifts: [
          ['barbell-bench-press', 4, 6],
          ['overhead-press', 3, 8],
          ['incline-dumbbell-press', 3, 10],
          ['lateral-raise', 3, 12],
          ['triceps-pushdown', 3, 12],
          ['overhead-cable-extension', 3, 12],
        ],
      },
      {
        name: 'Pull',
        lifts: [
          ['deadlift', 3, 5],
          ['pull-up', 3, 8],
          ['barbell-row', 3, 8],
          ['face-pull', 3, 15],
          ['dumbbell-curl', 3, 12],
          ['hammer-curl', 3, 12],
        ],
      },
      {
        name: 'Legs',
        lifts: [
          ['back-squat', 4, 6],
          ['romanian-deadlift', 3, 8],
          ['leg-press', 3, 10],
          ['lying-leg-curl', 3, 12],
          ['standing-calf-raise', 4, 12],
          ['plank', 3, 45],
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper/Lower',
    description: 'Four days alternating upper and lower body.',
    days: [
      {
        name: 'Upper A',
        lifts: [
          ['barbell-bench-press', 4, 6],
          ['barbell-row', 4, 6],
          ['overhead-press', 3, 8],
          ['lat-pulldown', 3, 10],
          ['ez-bar-curl', 3, 10],
          ['triceps-pushdown', 3, 12],
        ],
      },
      {
        name: 'Lower A',
        lifts: [
          ['back-squat', 4, 6],
          ['romanian-deadlift', 3, 8],
          ['leg-press', 3, 10],
          ['lying-leg-curl', 3, 12],
          ['standing-calf-raise', 4, 12],
          ['hanging-leg-raise', 3, 12],
        ],
      },
      {
        name: 'Upper B',
        lifts: [
          ['overhead-press', 4, 6],
          ['pull-up', 4, 8],
          ['incline-dumbbell-press', 3, 10],
          ['seated-cable-row', 3, 10],
          ['lateral-raise', 3, 15],
          ['hammer-curl', 3, 12],
          ['overhead-cable-extension', 3, 12],
        ],
      },
      {
        name: 'Lower B',
        lifts: [
          ['deadlift', 3, 5],
          ['front-squat', 3, 8],
          ['bulgarian-split-squat', 3, 10],
          ['seated-leg-curl', 3, 12],
          ['seated-calf-raise', 4, 15],
          ['plank', 3, 60],
        ],
      },
    ],
  },
  {
    id: 'bro-split',
    name: 'Bro Split',
    description: 'Five days, one muscle group each.',
    days: [
      {
        name: 'Chest',
        lifts: [
          ['barbell-bench-press', 4, 8],
          ['incline-dumbbell-press', 3, 10],
          ['chest-dip', 3, 12],
          ['cable-crossover', 3, 15],
        ],
      },
      {
        name: 'Back',
        lifts: [
          ['deadlift', 3, 5],
          ['lat-pulldown', 3, 10],
          ['barbell-row', 3, 10],
          ['seated-cable-row', 3, 12],
          ['straight-arm-pulldown', 3, 15],
        ],
      },
      {
        name: 'Shoulders',
        lifts: [
          ['overhead-press', 4, 8],
          ['arnold-press', 3, 10],
          ['lateral-raise', 4, 15],
          ['rear-delt-fly', 3, 15],
          ['dumbbell-shrug', 3, 12],
        ],
      },
      {
        name: 'Arms',
        lifts: [
          ['barbell-curl', 3, 10],
          ['skull-crusher', 3, 10],
          ['hammer-curl', 3, 12],
          ['rope-pushdown', 3, 12],
          ['incline-dumbbell-curl', 3, 12],
          ['overhead-cable-extension', 3, 12],
        ],
      },
      {
        name: 'Legs',
        lifts: [
          ['back-squat', 4, 8],
          ['leg-press', 3, 12],
          ['romanian-deadlift', 3, 10],
          ['leg-extension', 3, 15],
          ['lying-leg-curl', 3, 12],
          ['standing-calf-raise', 4, 15],
        ],
      },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body 3x/week',
    description: 'Three whole-body sessions a week. A solid start for beginners.',
    days: [
      {
        name: 'Day A',
        lifts: [
          ['back-squat', 3, 5],
          ['barbell-bench-press', 3, 5],
          ['barbell-row', 3, 8],
          ['plank', 3, 45],
        ],
      },
      {
        name: 'Day B',
        lifts: [
          ['deadlift', 3, 5],
          ['overhead-press', 3, 5],
          ['pull-up', 3, 8],
          ['walking-lunge', 3, 10],
        ],
      },
      {
        name: 'Day C',
        lifts: [
          ['front-squat', 3, 8],
          ['incline-dumbbell-press', 3, 10],
          ['seated-cable-row', 3, 10],
          ['farmers-carry', 3, 40],
        ],
      },
    ],
  },
  {
    id: 'arnold',
    name: 'Arnold Split',
    description: 'Arnold’s classic pairings. Three days, run twice a week.',
    days: [
      {
        name: 'Chest & Back',
        lifts: [
          ['barbell-bench-press', 4, 8],
          ['pull-up', 4, 8],
          ['incline-dumbbell-press', 3, 10],
          ['barbell-row', 3, 10],
          ['dumbbell-fly', 3, 12],
          ['lat-pulldown', 3, 12],
        ],
      },
      {
        name: 'Shoulders & Arms',
        lifts: [
          ['overhead-press', 4, 8],
          ['arnold-press', 3, 10],
          ['lateral-raise', 3, 12],
          ['barbell-curl', 3, 10],
          ['skull-crusher', 3, 10],
          ['hammer-curl', 3, 12],
          ['triceps-pushdown', 3, 12],
        ],
      },
      {
        name: 'Legs',
        lifts: [
          ['back-squat', 4, 8],
          ['romanian-deadlift', 3, 10],
          ['leg-press', 3, 12],
          ['lying-leg-curl', 3, 12],
          ['standing-calf-raise', 4, 15],
          ['hanging-leg-raise', 3, 12],
        ],
      },
    ],
  },
  {
    id: 'phul',
    name: 'PHUL',
    description: 'Power Hypertrophy Upper Lower: two heavy days, two volume days.',
    days: [
      {
        name: 'Upper Power',
        lifts: [
          ['barbell-bench-press', 4, 5],
          ['barbell-row', 4, 5],
          ['overhead-press', 3, 6],
          ['weighted-pull-up', 3, 6],
          ['barbell-curl', 3, 8],
          ['skull-crusher', 3, 8],
        ],
      },
      {
        name: 'Lower Power',
        lifts: [
          ['back-squat', 4, 5],
          ['deadlift', 3, 5],
          ['leg-press', 3, 8],
          ['lying-leg-curl', 3, 8],
          ['standing-calf-raise', 4, 8],
        ],
      },
      {
        name: 'Upper Hypertrophy',
        lifts: [
          ['incline-dumbbell-press', 3, 10],
          ['cable-crossover', 3, 12],
          ['seated-cable-row', 3, 12],
          ['lat-pulldown', 3, 12],
          ['lateral-raise', 3, 15],
          ['incline-dumbbell-curl', 3, 12],
          ['rope-pushdown', 3, 12],
        ],
      },
      {
        name: 'Lower Hypertrophy',
        lifts: [
          ['front-squat', 3, 10],
          ['bulgarian-split-squat', 3, 10],
          ['romanian-deadlift', 3, 10],
          ['leg-extension', 3, 15],
          ['seated-leg-curl', 3, 15],
          ['seated-calf-raise', 4, 15],
        ],
      },
    ],
  },
];

/** A day as a fresh template. Weight stays 0 for the user to fill in; slugs missing from the catalog are skipped. */
export function programTemplate(
  program: Program,
  day: ProgramDay,
  exercises: readonly Exercise[],
): Template {
  const bySlug = new Map(exercises.map((exercise) => [exercise.slug, exercise.id]));
  return {
    id: Crypto.randomUUID(),
    name: `${program.name} · ${day.name}`,
    exercises: day.lifts.flatMap(([slug, sets, reps]) => {
      const exerciseId = bySlug.get(slug);
      if (!exerciseId) return [];
      return [{ exerciseId, sets: Array.from({ length: sets }, () => ({ reps, weightKg: 0 })) }];
    }),
  };
}
