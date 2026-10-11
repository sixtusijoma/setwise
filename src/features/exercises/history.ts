import type { Workout } from '../../data/types';
import { isSetPr } from '../../lib/stats';
import type { UnitSystem } from '../../lib/units';
import { formatDuration, formatWeight } from '../../lib/units';
import { statSets, timed, type Track } from './tracks';

export type LoggedSet = { reps: number; weightKg: number };

export function recentExerciseIds(workouts: readonly Workout[], limit = 8): string[] {
  const ids: string[] = [];
  for (const workout of workouts) {
    const exercises = workout.exercises.slice().sort((a, b) => a.position - b.position);
    for (const exercise of exercises) {
      if (ids.includes(exercise.exerciseId)) continue;
      ids.push(exercise.exerciseId);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

export function previousSets(
  workouts: readonly Workout[],
  exerciseId: string,
  excludeWorkoutId?: string,
): LoggedSet[] {
  for (const workout of workouts) {
    if (workout.id === excludeWorkoutId) continue;
    const match = workout.exercises.find((exercise) => exercise.exerciseId === exerciseId);
    if (!match) continue;
    return match.sets
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((set) => ({ reps: set.reps, weightKg: set.weightKg }));
  }
  return [];
}

export function lastSetLabel(
  sets: readonly LoggedSet[],
  system: UnitSystem,
  track: Track = 'weight',
): string | null {
  if (sets.length === 0) return null;
  const loads = statSets(track, sets);
  const top = loads.reduce((best, set) => {
    if (set.weightKg > best.weightKg) return set;
    if (set.weightKg === best.weightKg && set.reps > best.reps) return set;
    return best;
  });
  return `Last: ${previousLabel(sets[loads.indexOf(top)], system, track)}`;
}

export function previousLabel(set: LoggedSet, system: UnitSystem, track: Track = 'weight'): string {
  if (track === 'time') return formatDuration(set.reps);
  if (track === 'reps') return `${set.reps} reps`;
  const reps = timed(track) ? formatDuration(set.reps) : set.reps;
  return `${track === 'assisted' ? '−' : ''}${formatWeight(set.weightKg, system)} × ${reps}`;
}

export function isTopSetPr(history: readonly LoggedSet[], reps: number, weightKg: number): boolean {
  return isSetPr(history, reps, weightKg);
}
