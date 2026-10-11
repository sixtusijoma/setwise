import { useQuery } from '@tanstack/react-query';

import { getRepo } from '../../data/repo';
import { useOnline, usePausedCount } from '../../data/sync';
import type { Cardio, Exercise, Workout } from '../../data/types';
import { offlineBanner, type WorkoutSlice } from '../../lib/week';
import { statSets, trackOf } from '../exercises/tracks';

async function listAll<T extends { startedAt: string }>(
  load: (range: { before?: string; limit: number }) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = [];
  let before: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 50; page += 1) {
    const rows = await load({ before, limit: 100 });
    all.push(...rows);
    const last = rows[rows.length - 1];
    if (rows.length < 100 || !last || seen.has(last.startedAt)) return all;
    seen.add(last.startedAt);
    before = last.startedAt;
  }
  return all;
}

export function workoutSlices(
  workouts: readonly Workout[],
  catalog: Map<string, Exercise>,
): WorkoutSlice[] {
  return workouts.map((workout) => ({
    id: workout.id,
    startedAt: workout.startedAt,
    exercises: workout.exercises
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: statSets(
          trackOf(catalog.get(exercise.exerciseId)),
          exercise.sets
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
        ),
      })),
  }));
}

export function useTodayWorkouts() {
  return useQuery({
    queryKey: ['workouts', 'today'],
    queryFn: () => listAll((range) => getRepo().listWorkouts(range)),
  });
}

export function useTodayCardio() {
  return useQuery({
    queryKey: ['cardio', 'today'],
    queryFn: () => listAll((range) => getRepo().listCardio(range)),
  });
}

/** Paused mutations are the pending writes slice 9 replays. Online saves stay quiet. */
export function useOfflineNotice(): string | null {
  const online = useOnline();
  const paused = usePausedCount();
  if (online) return null;
  return offlineBanner(paused);
}

export type { Cardio, Workout };
