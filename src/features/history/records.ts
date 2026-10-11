import type { Exercise, Workout } from '../../data/types';
import { bestEfforts, usesBodyweight, volumeKg, type SessionInput } from '../../lib/stats';
import { formatDuration, formatWeight, weightUnit, type UnitSystem } from '../../lib/units';
import { isTopSetPr } from '../exercises/history';
import { statSets, timed, trackOf, type Track } from '../exercises/tracks';

export function recordKey(workoutId: string, setId: string): string {
  return `${workoutId}:${setId}`;
}

export function workoutVolumeKg(workout: Workout, catalog: Map<string, Exercise>): number {
  return workout.exercises.reduce(
    (sum, exercise) =>
      sum + volumeKg(statSets(trackOf(catalog.get(exercise.exerciseId)), exercise.sets)),
    0,
  );
}

export function workoutSetCount(workout: Workout): number {
  return workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
}

/** Sets that beat every earlier set of that exercise. Heavier weight wins, then more reps. */
export function personalRecordKeys(
  workouts: readonly Workout[],
  catalog: Map<string, Exercise>,
): string[] {
  const ordered = workouts
    .slice()
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));
  const best = new Map<string, { weightKg: number; reps: number }>();
  const keys: string[] = [];
  for (const workout of ordered) {
    const exercises = workout.exercises.slice().sort((a, b) => a.position - b.position);
    for (const exercise of exercises) {
      const sets = statSets(
        trackOf(catalog.get(exercise.exerciseId)),
        exercise.sets.slice().sort((a, b) => a.position - b.position),
      );
      for (const set of sets) {
        const prior = best.get(exercise.exerciseId);
        if (!isTopSetPr(prior ? [prior] : [], set.reps, set.weightKg)) continue;
        keys.push(recordKey(workout.id, set.id));
        best.set(exercise.exerciseId, { weightKg: set.weightKg, reps: set.reps });
      }
    }
  }
  return keys;
}

export function prLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 PR' : `${count} PRs`;
}

/** Sessions for one exercise across history, oldest first, with track-aware loads. */
export function exerciseSessions(
  history: readonly Workout[],
  exerciseId: string,
  track: Track,
): SessionInput[] {
  const sessions: SessionInput[] = [];
  for (const workout of history) {
    const sets = workout.exercises
      .filter((entry) => entry.exerciseId === exerciseId)
      .flatMap((entry) => entry.sets)
      .slice()
      .sort((a, b) => a.position - b.position);
    if (sets.length === 0) continue;
    sessions.push({
      id: workout.id,
      date: workout.startedAt,
      sets: statSets(
        track,
        sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
      ),
    });
  }
  sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sessions;
}

/**
 * All-time reminder line: `PB 230 lb × 6 · Est. 1RM 276 lb`.
 * Bodyweight and unloaded timed sets show PB only (max reps / longest). No 1RM for those.
 */
export function allTimeReminderLabel(
  exerciseId: string,
  track: Track,
  history: readonly Workout[],
  system: UnitSystem,
): string | null {
  const sessions = exerciseSessions(history, exerciseId, track);
  if (sessions.length === 0) return null;
  const bodyweight = usesBodyweight(sessions);
  const efforts = bestEfforts(sessions);
  const unit = weightUnit(system);

  if (bodyweight) {
    if (!efforts.maxReps) return null;
    return timed(track)
      ? `PB ${formatDuration(efforts.maxReps.reps)}`
      : `PB ${efforts.maxReps.reps} reps`;
  }

  if (timed(track)) {
    if (!efforts.heaviest) return null;
    return `PB ${formatWeight(efforts.heaviest.weightKg, system)} ${unit} × ${formatDuration(efforts.heaviest.reps)}`;
  }

  if (!efforts.heaviest) return null;
  const pb = `PB ${formatWeight(efforts.heaviest.weightKg, system)} ${unit} × ${efforts.heaviest.reps}`;
  if (!efforts.bestE1rm) return pb;
  return `${pb} · Est. 1RM ${formatWeight(efforts.bestE1rm.weightKg, system)} ${unit}`;
}
