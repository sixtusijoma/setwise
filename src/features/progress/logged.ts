import type { Exercise, ExerciseSession, Workout } from '../../data/types';
import { statSets, timed, trackOf, type Track } from '../exercises/tracks';
import {
  chartSeries,
  usesBodyweight,
  type ChartPoint,
  type Metric,
  type SessionInput,
} from '../../lib/stats';

export type LoggedRow = {
  exercise: Exercise;
  sessions: SessionInput[];
  bodyweight: boolean;
  metric: Metric;
  series: ChartPoint[];
  lastDate: string;
};

function sessionsFor(workout: Workout, exerciseId: string): SessionInput[] {
  return workout.exercises
    .filter((exercise) => exercise.exerciseId === exerciseId)
    .map((exercise) => ({
      id: workout.id,
      date: workout.startedAt,
      sets: exercise.sets
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
    }));
}

export function loggedExercises(
  workouts: readonly Workout[],
  exercises: readonly Exercise[],
  now: Date,
): LoggedRow[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const grouped = new Map<string, SessionInput[]>();
  for (const workout of workouts) {
    const seen = new Set<string>();
    for (const exercise of workout.exercises) {
      if (seen.has(exercise.exerciseId)) continue;
      seen.add(exercise.exerciseId);
      const list = grouped.get(exercise.exerciseId) ?? [];
      list.push(...sessionsFor(workout, exercise.exerciseId));
      grouped.set(exercise.exerciseId, list);
    }
  }

  const rows: LoggedRow[] = [];
  for (const [id, logged] of grouped) {
    const exercise = byId.get(id);
    if (!exercise || logged.length === 0) continue;
    const track = trackOf(exercise);
    const sessions = logged.map((session) => ({ ...session, sets: statSets(track, session.sets) }));
    sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const bodyweight = usesBodyweight(sessions);
    let metric: Metric = bodyweight ? (timed(track) ? 'maxTime' : 'maxReps') : 'e1rm';
    let series = chartSeries(sessions, metric, 'all', now);
    if (series.length === 0 && !bodyweight) {
      metric = 'topSet';
      series = chartSeries(sessions, 'topSet', 'all', now);
    }
    rows.push({
      exercise,
      sessions,
      bodyweight,
      metric,
      series,
      lastDate: sessions[sessions.length - 1]?.date ?? '',
    });
  }

  rows.sort((a, b) => {
    if (a.lastDate !== b.lastDate) return a.lastDate < b.lastDate ? 1 : -1;
    return a.exercise.name.localeCompare(b.exercise.name);
  });
  return rows;
}

export function sessionInputs(
  sessions: readonly ExerciseSession[],
  track: Track = 'weight',
): SessionInput[] {
  return sessions.map((session) => ({
    id: session.workoutId,
    date: session.date,
    sets: statSets(track, session.sets),
  }));
}
