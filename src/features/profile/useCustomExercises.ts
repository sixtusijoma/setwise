import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { keys } from '../../data/keys';
import { getRepo } from '../../data/repo';
import type { Exercise } from '../../data/types';
import { useExercises } from '../exercises/useExercises';

async function usedExerciseIds(): Promise<Set<string>> {
  const used = new Set<string>();
  let before: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 20; page += 1) {
    const rows = await getRepo().listWorkouts({ before, limit: 100 });
    for (const workout of rows) {
      for (const exercise of workout.exercises) used.add(exercise.exerciseId);
    }
    const last = rows[rows.length - 1];
    if (rows.length < 100 || !last || seen.has(last.startedAt)) return used;
    seen.add(last.startedAt);
    before = last.startedAt;
  }
  return used;
}

export function useCustomExercises() {
  const client = useQueryClient();
  const exercises = useExercises();
  const usage = useQuery({
    queryKey: ['workouts', 'exercise-usage'],
    queryFn: async () => [...(await usedExerciseIds())],
  });
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const custom = (exercises.data ?? [])
    .filter((exercise) => exercise.ownerId != null)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  async function remove(exercise: Exercise) {
    setError(null);
    setDeleting(exercise.id);
    try {
      await getRepo().deleteExercise(exercise.id);
      client.setQueryData<Exercise[]>(keys.exercises, (current) =>
        current?.filter((item) => item.id !== exercise.id),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't delete that exercise.");
    } finally {
      setDeleting(null);
    }
  }

  return {
    custom,
    used: new Set(usage.data ?? []),
    loading: exercises.isPending && !exercises.data,
    error,
    deleting,
    remove,
  };
}
