import type { UnitSystem } from '../lib/units';

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full_body',
] as const;

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'smith',
  'ez_bar',
  'trap_bar',
  'band',
  'bodyweight',
  'other',
] as const;

/**
 * How a lift's sets are logged. `time` and `weighted-time` store seconds in `reps` (0–999 s) so they need no schema change.
 * `assisted` stores the machine's help in `weightKg`.
 */
export const TRACKS = ['weight', 'reps', 'time', 'weighted-time', 'assisted'] as const;

export const CARDIO_ACTIVITIES = [
  'run',
  'walk',
  'hike',
  'cycle',
  'row',
  'elliptical',
  'stairs',
  'swim',
  'other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type CardioActivity = (typeof CARDIO_ACTIVITIES)[number];
export type Track = (typeof TRACKS)[number];

export type Session = {
  userId: string;
  email: string | null;
};

export type Profile = {
  id: string;
  displayName: string | null;
  unitSystem: UnitSystem;
};

export type Exercise = {
  id: string;
  ownerId: string | null;
  slug: string | null;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  aliases: string[];
  /** Set on custom exercises. Library rows leave it null and use the library JSON. */
  track: Track | null;
};

export type NewExercise = {
  id?: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  track: Track;
};

export type WorkoutSet = {
  id: string;
  position: number;
  reps: number;
  weightKg: number;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  position: number;
  notes: string | null;
  sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  title: string | null;
  startedAt: string;
  endedAt: string;
  notes: string | null;
  exercises: WorkoutExercise[];
};

export type WorkoutInput = {
  id: string;
  title?: string | null;
  startedAt: string;
  endedAt: string;
  notes?: string | null;
  exercises: {
    id?: string;
    exerciseId: string;
    notes?: string | null;
    sets: { id?: string; reps: number; weightKg: number }[];
  }[];
};

export type Cardio = {
  id: string;
  activity: CardioActivity;
  startedAt: string;
  durationS: number;
  distanceM: number | null;
  calories: number | null;
  avgHeartRate: number | null;
  notes: string | null;
};

export type CardioInput = {
  id: string;
  activity: CardioActivity;
  startedAt: string;
  durationS: number;
  distanceM?: number | null;
  calories?: number | null;
  avgHeartRate?: number | null;
  notes?: string | null;
};

export type ExerciseSession = {
  workoutId: string;
  date: string;
  sets: { reps: number; weightKg: number }[];
};

export type Template = {
  id: string;
  name: string;
  exercises: { exerciseId: string; sets: { reps: number; weightKg: number }[] }[];
};

export type ListRange = {
  before?: string;
  limit: number;
};
