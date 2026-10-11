import { describe, expect, test } from '@jest/globals';

import {
  toCardio,
  toExercise,
  toProfile,
  toTemplate,
  toTemplateRow,
  toWorkout,
  toWorkoutPayload,
} from './remote';

describe('remote mapping', () => {
  test('round-trips a template through its row shape', () => {
    const template = {
      id: '55555555-0000-4000-8000-000000000001',
      name: 'Push day',
      exercises: [
        { exerciseId: '11111111-0000-4000-8000-000000000001', sets: [{ reps: 5, weightKg: 100 }] },
      ],
    };
    const row = toTemplateRow({ ...template, name: ' Push day ' });
    expect(row.exercises[0]).toEqual({
      exercise_id: '11111111-0000-4000-8000-000000000001',
      sets: [{ reps: 5, weight_kg: 100 }],
    });
    expect(toTemplate(row)).toEqual(template);
  });

  test('sorts sets, parses numeric weights, and builds the save_workout payload', () => {
    const workout = toWorkout({
      id: '22222222-0000-4000-8000-000000000001',
      title: 'A Push',
      started_at: '2026-10-01T10:00:00Z',
      ended_at: '2026-10-01T11:00:00Z',
      notes: null,
      workout_exercises: [
        {
          id: '33333333-0000-4000-8000-000000000001',
          exercise_id: '11111111-0000-4000-8000-000000000001',
          position: 0,
          notes: null,
          workout_sets: [
            { id: 's2', position: 1, reps: 5, weight_kg: '102.058' },
            { id: 's1', position: 0, reps: 5, weight_kg: '100.000' },
          ],
        },
      ],
    });
    expect(workout.exercises[0]?.sets.map((set) => set.weightKg)).toEqual([100, 102.058]);

    const payload = toWorkoutPayload({
      id: workout.id,
      title: workout.title,
      startedAt: workout.startedAt,
      endedAt: workout.endedAt,
      notes: workout.notes,
      exercises: [
        {
          id: workout.exercises[0]?.id,
          exerciseId: '11111111-0000-4000-8000-000000000001',
          sets: [
            { reps: 5, weightKg: 100 },
            { reps: 5, weightKg: 102.058 },
          ],
        },
      ],
    });
    expect(payload).toEqual({
      id: workout.id,
      title: 'A Push',
      started_at: '2026-10-01T10:00:00Z',
      ended_at: '2026-10-01T11:00:00Z',
      notes: null,
      exercises: [
        {
          id: workout.exercises[0]?.id,
          exercise_id: '11111111-0000-4000-8000-000000000001',
          notes: null,
          sets: [
            { reps: 5, weight_kg: 100 },
            { reps: 5, weight_kg: 102.058 },
          ],
        },
      ],
    });
  });

  test('maps profile units, exercises, and cardio', () => {
    expect(toProfile({ id: 'user', display_name: null, unit_system: 'metric' }).unitSystem).toBe(
      'metric',
    );
    expect(
      toExercise({
        id: 'ex',
        owner_id: null,
        slug: 'barbell-bench-press',
        name: 'Bench Press',
        muscle_group: 'chest',
        equipment: 'barbell',
        aliases: null,
        track: null,
      }).aliases,
    ).toEqual([]);
    expect(
      toExercise({
        id: 'ex',
        owner_id: 'user',
        slug: null,
        name: 'Sled Hold',
        muscle_group: 'full_body',
        equipment: 'other',
        aliases: [],
        track: 'weighted-time',
      }).track,
    ).toBe('weighted-time');
    expect(
      toCardio({
        id: 'cardio',
        activity: 'run',
        started_at: '2026-10-02T07:00:00Z',
        duration_s: 1800,
        distance_m: '5000.0',
        calories: null,
        avg_heart_rate: null,
        notes: null,
      }).distanceM,
    ).toBe(5000);
  });
});
