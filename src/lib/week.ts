import { startOfIsoWeek, weekKey } from './dates';
import { showsPace } from './pace';
import { epley, personalRecords, volumeKg, type SessionInput } from './stats';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export type WeekBounds = {
  start: Date;
  end: Date;
  key: string;
};

/** Monday 00:00 through the next Monday, in the local time zone. */
export function weekBounds(date: Date): WeekBounds {
  const start = startOfIsoWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end, key: weekKey(date) };
}

export function previousWeekBounds(date: Date): WeekBounds {
  const current = weekBounds(date);
  const prior = new Date(current.start);
  prior.setDate(prior.getDate() - 1);
  return weekBounds(prior);
}

export function inWeek(iso: string, bounds: WeekBounds): boolean {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return false;
  return time >= bounds.start.getTime() && time < bounds.end.getTime();
}

export type WorkoutSlice = {
  id: string;
  startedAt: string;
  exercises: readonly {
    exerciseId: string;
    sets: readonly { reps: number; weightKg: number }[];
  }[];
};

export type CardioSlice = {
  id: string;
  activity: string;
  startedAt: string;
  durationS: number;
  distanceM: number | null;
};

export type WeekTotals = {
  workouts: number;
  volumeKg: number;
  cardioSeconds: number;
  cardioSessions: number;
  distanceM: number;
  pacedDistanceM: number;
  pacedDurationS: number;
};

function emptyTotals(): WeekTotals {
  return {
    workouts: 0,
    volumeKg: 0,
    cardioSeconds: 0,
    cardioSessions: 0,
    distanceM: 0,
    pacedDistanceM: 0,
    pacedDurationS: 0,
  };
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

export function summarizeWeek(
  workouts: readonly WorkoutSlice[],
  cardio: readonly CardioSlice[],
  bounds: WeekBounds,
): WeekTotals {
  const totals = emptyTotals();
  for (const workout of workouts) {
    if (!inWeek(workout.startedAt, bounds)) continue;
    totals.workouts += 1;
    for (const exercise of workout.exercises) totals.volumeKg += volumeKg(exercise.sets);
  }
  for (const session of cardio) {
    if (!inWeek(session.startedAt, bounds)) continue;
    totals.cardioSessions += 1;
    if (finite(session.durationS) && session.durationS > 0) {
      totals.cardioSeconds += session.durationS;
    }
    if (session.distanceM != null && finite(session.distanceM) && session.distanceM > 0) {
      totals.distanceM += session.distanceM;
      if (showsPace(session.activity, session.distanceM) && session.durationS > 0) {
        totals.pacedDistanceM += session.distanceM;
        totals.pacedDurationS += session.durationS;
      }
    }
  }
  return totals;
}

export function cardioMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

export type WeekDelta = {
  workouts: number;
  /** Null when last week logged no volume, so a percent would divide by zero. */
  volumePercent: number | null;
};

export function weekDelta(current: WeekTotals, previous: WeekTotals): WeekDelta {
  return {
    workouts: current.workouts - previous.workouts,
    volumePercent:
      previous.volumeKg > 0
        ? Math.round(((current.volumeKg - previous.volumeKg) / previous.volumeKg) * 100)
        : null,
  };
}

export function formatWorkoutDelta(delta: number): { text: string; positive: boolean } {
  if (delta > 0) return { text: `+${delta} vs last week`, positive: true };
  if (delta < 0) return { text: `-${Math.abs(delta)} vs last week`, positive: false };
  return { text: 'Same as last week', positive: false };
}

export function formatVolumeDelta(
  percent: number | null,
  currentKg: number,
): { text: string; positive: boolean } {
  if (percent == null) {
    return currentKg > 0
      ? { text: 'New', positive: true }
      : { text: 'Same as last week', positive: false };
  }
  if (percent > 0) return { text: `+${percent}%`, positive: true };
  if (percent < 0) return { text: `-${Math.abs(percent)}%`, positive: false };
  return { text: '0%', positive: false };
}

export function offlineBanner(count: number): string | null {
  if (!(count > 0)) return null;
  const changes = count === 1 ? 'change' : 'changes';
  return `${count} ${changes} will sync when you're back online.`;
}

export type DayMark = 'rest' | 'strength' | 'cardio' | 'both' | 'future';

export type DayDot = {
  date: Date;
  letter: (typeof LETTERS)[number];
  mark: DayMark;
  today: boolean;
};

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayDots(
  workouts: readonly { startedAt: string }[],
  cardio: readonly { startedAt: string }[],
  now: Date,
): DayDot[] {
  const bounds = weekBounds(now);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = dayKey(startOfToday);
  const strength = new Set<string>();
  const cardioDays = new Set<string>();
  const markDay = (iso: string, target: Set<string>) => {
    if (!inWeek(iso, bounds)) return;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return;
    target.add(dayKey(date));
  };
  for (const workout of workouts) markDay(workout.startedAt, strength);
  for (const session of cardio) markDay(session.startedAt, cardioDays);

  return LETTERS.map((letter, index) => {
    const date = new Date(bounds.start);
    date.setDate(bounds.start.getDate() + index);
    const key = dayKey(date);
    const hasStrength = strength.has(key);
    const hasCardio = cardioDays.has(key);
    const future = date.getTime() > startOfToday.getTime();
    let mark: DayMark = 'rest';
    if (hasStrength && hasCardio) mark = 'both';
    else if (hasStrength) mark = 'strength';
    else if (hasCardio) mark = 'cardio';
    else if (future) mark = 'future';
    return { date, letter, mark, today: key === today };
  });
}

export type ExerciseHistory = {
  exerciseId: string;
  name: string;
  sessions: SessionInput[];
};

export function exerciseHistories(
  workouts: readonly WorkoutSlice[],
  names: ReadonlyMap<string, string>,
): ExerciseHistory[] {
  const byExercise = new Map<string, ExerciseHistory>();
  const ordered = workouts
    .slice()
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));
  for (const workout of ordered) {
    const seen = new Map<
      string,
      { id: string; date: string; sets: { reps: number; weightKg: number }[] }
    >();
    for (const exercise of workout.exercises) {
      let session = seen.get(exercise.exerciseId);
      if (!session) {
        session = { id: workout.id, date: workout.startedAt, sets: [] };
        seen.set(exercise.exerciseId, session);
      }
      session.sets.push(...exercise.sets);
    }
    for (const [exerciseId, session] of seen) {
      let history = byExercise.get(exerciseId);
      if (!history) {
        history = { exerciseId, name: names.get(exerciseId) ?? 'Exercise', sessions: [] };
        byExercise.set(exerciseId, history);
      }
      history.sessions.push(session);
    }
  }
  return [...byExercise.values()];
}

export type WeekRecord = {
  exerciseId: string;
  name: string;
  workoutId?: string;
  date: string;
  reps: number;
  weightKg: number;
  e1rmKg: number | null;
};

/**
 * Top-set records whose dates fall in the week.
 * `personalRecords` runs on the full history; filtering first would treat every session as a first record.
 * e1RM and volume records are not included.
 */
export function weekTopSetRecords(
  exercises: readonly ExerciseHistory[],
  bounds: WeekBounds,
): WeekRecord[] {
  const records: WeekRecord[] = [];
  for (const exercise of exercises) {
    const found = personalRecords(exercise.sessions).filter(
      (record) => record.kind === 'topSet' && inWeek(record.date, bounds),
    );
    for (const record of found) {
      const session =
        exercise.sessions.find((item) => item.id === record.id && item.date === record.date) ??
        exercise.sessions.find((item) => item.date === record.date);
      const set = record.setIndex == null ? undefined : session?.sets[record.setIndex];
      if (!set) continue;
      records.push({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        workoutId: session?.id,
        date: record.date,
        reps: set.reps,
        weightKg: set.weightKg,
        e1rmKg: epley(set.weightKg, set.reps),
      });
    }
  }
  return records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export type RecentRef = {
  kind: 'strength' | 'cardio';
  id: string;
  startedAt: string;
};

export function recentSessions(
  workouts: readonly { id: string; startedAt: string }[],
  cardio: readonly { id: string; startedAt: string }[],
  limit = 3,
): RecentRef[] {
  const items: RecentRef[] = [
    ...workouts.map((workout) => ({
      kind: 'strength' as const,
      id: workout.id,
      startedAt: workout.startedAt,
    })),
    ...cardio.map((session) => ({
      kind: 'cardio' as const,
      id: session.id,
      startedAt: session.startedAt,
    })),
  ];
  items.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  return items.slice(0, limit);
}
