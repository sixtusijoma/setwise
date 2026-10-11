import { describe, expect, test } from '@jest/globals';

import type { Exercise, Workout } from '../../data/types';
import { lbToKg } from '../../lib/units';
import {
  allTimeReminderLabel,
  personalRecordKeys,
  prLabel,
  recordKey,
  workoutSetCount,
  workoutVolumeKg,
} from './records';

function workout(
  id: string,
  startedAt: string,
  exercises: { exerciseId: string; sets: { id: string; reps: number; weightKg: number }[] }[],
): Workout {
  return {
    id,
    title: null,
    startedAt,
    endedAt: startedAt,
    notes: null,
    exercises: exercises.map((exercise, index) => ({
      id: `${id}-e${index}`,
      exerciseId: exercise.exerciseId,
      position: index,
      notes: null,
      sets: exercise.sets.map((set, setIndex) => ({ ...set, position: setIndex })),
    })),
  };
}

const catalog = new Map<string, Exercise>([
  [
    'carry',
    {
      id: 'carry',
      ownerId: 'user',
      slug: null,
      name: 'Sled Hold',
      muscleGroup: 'full_body',
      equipment: 'other',
      aliases: [],
      track: 'weighted-time',
    },
  ],
  [
    'assist',
    {
      id: 'assist',
      ownerId: null,
      slug: 'assisted-pull-up',
      name: 'Assisted Pull-Up',
      muscleGroup: 'back',
      equipment: 'machine',
      aliases: [],
      track: null,
    },
  ],
]);

describe('history records', () => {
  test('marks a heavier later set and not a match', () => {
    const older = workout('old', '2026-10-01T12:00:00.000Z', [
      { exerciseId: 'bench', sets: [{ id: 'a', reps: 5, weightKg: 100 }] },
    ]);
    const newer = workout('new', '2026-10-08T12:00:00.000Z', [
      {
        exerciseId: 'bench',
        sets: [
          { id: 'b', reps: 5, weightKg: 100 },
          { id: 'c', reps: 3, weightKg: 110 },
        ],
      },
    ]);
    const keys = personalRecordKeys([newer, older], catalog);
    expect(keys).toContain(recordKey('old', 'a'));
    expect(keys).not.toContain(recordKey('new', 'b'));
    expect(keys).toContain(recordKey('new', 'c'));
    expect(prLabel(1)).toBe('1 PR');
    expect(prLabel(2)).toBe('2 PRs');
    expect(prLabel(0)).toBeNull();
  });

  test('sums volume and sets', () => {
    const session = workout('w', '2026-10-08T12:00:00.000Z', [
      {
        exerciseId: 'bench',
        sets: [
          { id: 'a', reps: 5, weightKg: 100 },
          { id: 'b', reps: 5, weightKg: 80 },
        ],
      },
    ]);
    expect(workoutVolumeKg(session, catalog)).toBe(900);
    expect(workoutSetCount(session)).toBe(2);
  });

  test('ranks assisted sets by less help and leaves them out of volume', () => {
    const older = workout('old', '2026-10-01T12:00:00.000Z', [
      { exerciseId: 'assist', sets: [{ id: 'a', reps: 8, weightKg: 30 }] },
    ]);
    const newer = workout('new', '2026-10-08T12:00:00.000Z', [
      {
        exerciseId: 'assist',
        sets: [
          { id: 'b', reps: 8, weightKg: 40 },
          { id: 'c', reps: 8, weightKg: 20 },
        ],
      },
    ]);
    const keys = personalRecordKeys([newer, older], catalog);
    expect(keys).not.toContain(recordKey('new', 'b'));
    expect(keys).toContain(recordKey('new', 'c'));
    expect(workoutVolumeKg(newer, catalog)).toBe(0);
  });

  test('timed loaded sets rank by weight then time and add no volume', () => {
    const older = workout('old', '2026-10-01T12:00:00.000Z', [
      { exerciseId: 'carry', sets: [{ id: 'a', reps: 60, weightKg: 40 }] },
    ]);
    const newer = workout('new', '2026-10-08T12:00:00.000Z', [
      {
        exerciseId: 'carry',
        sets: [
          { id: 'b', reps: 90, weightKg: 32 },
          { id: 'c', reps: 75, weightKg: 40 },
        ],
      },
    ]);
    const keys = personalRecordKeys([newer, older], catalog);
    expect(keys).not.toContain(recordKey('new', 'b'));
    expect(keys).toContain(recordKey('new', 'c'));
    expect(workoutVolumeKg(newer, catalog)).toBe(0);
  });

  test('all-time reminder: PB and est. 1RM in user units', () => {
    const older = workout('old', '2026-10-01T12:00:00.000Z', [
      { exerciseId: 'bench', sets: [{ id: 'a', reps: 6, weightKg: lbToKg(230) }] },
    ]);
    const newer = workout('new', '2026-10-08T12:00:00.000Z', [
      { exerciseId: 'bench', sets: [{ id: 'b', reps: 5, weightKg: lbToKg(225) }] },
    ]);
    expect(allTimeReminderLabel('bench', 'weight', [newer, older], 'imperial')).toBe(
      'PB 230 lb × 6 · Est. 1RM 276 lb',
    );
    expect(allTimeReminderLabel('bench', 'weight', [newer, older], 'metric')).toMatch(
      /^PB .+ kg × 6 · Est\. 1RM .+ kg$/,
    );
  });

  test('all-time reminder: bodyweight and timed show PB only', () => {
    const pull = workout('p', '2026-10-08T12:00:00.000Z', [
      { exerciseId: 'assist', sets: [{ id: 'a', reps: 12, weightKg: 0 }] },
    ]);
    expect(allTimeReminderLabel('assist', 'reps', [pull], 'imperial')).toBe('PB 12 reps');
    const plank = workout('t', '2026-10-08T12:00:00.000Z', [
      { exerciseId: 'plank', sets: [{ id: 'a', reps: 90, weightKg: 0 }] },
    ]);
    expect(allTimeReminderLabel('plank', 'time', [plank], 'imperial')).toBe('PB 1:30');
  });

  test('all-time reminder: empty history returns null', () => {
    expect(allTimeReminderLabel('bench', 'weight', [], 'imperial')).toBeNull();
  });

});
