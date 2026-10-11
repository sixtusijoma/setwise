import { useQuery } from '@tanstack/react-query';

import { keys } from '../../data/keys';
import { getRepo } from '../../data/repo';
import type { Workout } from '../../data/types';
import { useExercises } from '../exercises/useExercises';
import { useProfile } from '../workout/useProfile';

async function listAllWorkouts(): Promise<Workout[]> {
  const all: Workout[] = [];
  const seen = new Set<string>();
  let before: string | undefined;
  for (let page = 0; page < 50; page += 1) {
    const rows = await getRepo().listWorkouts({ before, limit: 100 });
    let added = 0;
    for (const workout of rows) {
      if (seen.has(workout.id)) continue;
      seen.add(workout.id);
      all.push(workout);
      added += 1;
    }
    const last = rows[rows.length - 1];
    if (rows.length < 100 || added === 0 || !last) break;
    before = last.startedAt;
  }
  return all;
}

export function useExerciseCatalog() {
  return useExercises();
}

export function useProfileUnits() {
  return useProfile();
}

export function useLoggedWorkouts() {
  return useQuery({
    queryKey: ['workouts', 'progress'],
    queryFn: listAllWorkouts,
  });
}

export function useExerciseSessions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.exerciseHistory(id),
    queryFn: () => getRepo().exerciseHistory(id),
    enabled,
  });
}
