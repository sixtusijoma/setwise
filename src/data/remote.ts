import * as Crypto from 'expo-crypto';

import type { UnitSystem } from '../lib/units';
import type { Repo } from './repo';
import { setSessionUserId } from './sessionUser';
import { getSupabase } from './supabase';
import {
  CARDIO_ACTIVITIES,
  EQUIPMENT,
  MUSCLE_GROUPS,
  TRACKS,
  type Cardio,
  type CardioActivity,
  type CardioInput,
  type Equipment,
  type Exercise,
  type ExerciseSession,
  type ListRange,
  type MuscleGroup,
  type NewExercise,
  type Profile,
  type Session,
  type Template,
  type Track,
  type Workout,
  type WorkoutInput,
} from './types';

type AuthSession = { user: { id: string; email?: string | null } };

type ExerciseRow = {
  id: string;
  owner_id: string | null;
  slug: string | null;
  name: string;
  muscle_group: string;
  equipment: string;
  aliases: string[] | null;
  track: string | null;
};

type SetRow = {
  id?: string;
  position: number;
  reps: number;
  weight_kg: number | string;
};

type WorkoutExerciseRow = {
  id: string;
  exercise_id: string;
  position: number;
  notes: string | null;
  workout_sets: SetRow[] | null;
};

type WorkoutRow = {
  id: string;
  title: string | null;
  started_at: string;
  ended_at: string;
  notes: string | null;
  workout_exercises: WorkoutExerciseRow[] | null;
};

type CardioRow = {
  id: string;
  activity: string;
  started_at: string;
  duration_s: number;
  distance_m: number | string | null;
  calories: number | null;
  avg_heart_rate: number | null;
  notes: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  unit_system: string;
};

type TemplateRow = {
  id: string;
  name: string;
  exercises: { exercise_id: string; sets: { reps: number; weight_kg: number }[] }[];
};

const WORKOUT_SELECT =
  'id, title, started_at, ended_at, notes, workout_exercises(id, exercise_id, position, notes, workout_sets(id, position, reps, weight_kg))';

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function exerciseWriteError(error: { message: string; code?: string }, name: string): Error {
  if (error.code === '23505' && error.message.includes('exercises_owner_name_key')) {
    return new Error(`You already have an exercise called ${name}`);
  }
  return new Error(error.message);
}

function assertLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Limit must be a whole number from 1 to 100');
  }
  return limit;
}

function num(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Unexpected number from the server');
  return parsed;
}

function member<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Unexpected ${label}`);
}

function byPosition<T extends { position: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

export function toSession(session: AuthSession | null): Session | null {
  if (!session?.user) return null;
  return { userId: session.user.id, email: session.user.email ?? null };
}

export function toProfile(row: ProfileRow): Profile {
  const unitSystem = row.unit_system;
  if (unitSystem !== 'imperial' && unitSystem !== 'metric') {
    throw new Error('Unexpected unit system');
  }
  return { id: row.id, displayName: row.display_name, unitSystem };
}

export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    muscleGroup: member<MuscleGroup>(row.muscle_group, MUSCLE_GROUPS, 'muscle group'),
    equipment: member<Equipment>(row.equipment, EQUIPMENT, 'equipment'),
    aliases: row.aliases ?? [],
    track: row.track == null ? null : member<Track>(row.track, TRACKS, 'track'),
  };
}

export function toWorkout(row: WorkoutRow): Workout {
  const exercises = byPosition(row.workout_exercises ?? []).map((exercise) => ({
    id: exercise.id,
    exerciseId: exercise.exercise_id,
    position: exercise.position,
    notes: exercise.notes,
    sets: byPosition(exercise.workout_sets ?? []).map((set) => ({
      id: set.id ?? '',
      position: set.position,
      reps: set.reps,
      weightKg: num(set.weight_kg),
    })),
  }));
  return {
    id: row.id,
    title: row.title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    notes: row.notes,
    exercises,
  };
}

export function toWorkoutPayload(workout: WorkoutInput) {
  return {
    id: workout.id,
    title: workout.title ?? null,
    started_at: workout.startedAt,
    ended_at: workout.endedAt,
    notes: workout.notes ?? null,
    exercises: workout.exercises.map((exercise) => ({
      id: exercise.id ?? Crypto.randomUUID(),
      exercise_id: exercise.exerciseId,
      notes: exercise.notes ?? null,
      sets: exercise.sets.map((set) => ({
        reps: set.reps,
        weight_kg: set.weightKg,
      })),
    })),
  };
}

export function toCardio(row: CardioRow): Cardio {
  return {
    id: row.id,
    activity: member<CardioActivity>(row.activity, CARDIO_ACTIVITIES, 'activity'),
    startedAt: row.started_at,
    durationS: row.duration_s,
    distanceM: row.distance_m == null ? null : num(row.distance_m),
    calories: row.calories,
    avgHeartRate: row.avg_heart_rate,
    notes: row.notes,
  };
}

export function toTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    exercises: row.exercises.map((exercise) => ({
      exerciseId: exercise.exercise_id,
      sets: exercise.sets.map((set) => ({ reps: set.reps, weightKg: num(set.weight_kg) })),
    })),
  };
}

export function toTemplateRow(template: Template): TemplateRow {
  return {
    id: template.id,
    name: template.name.trim(),
    exercises: template.exercises.map((exercise) => ({
      exercise_id: exercise.exerciseId,
      sets: exercise.sets.map((set) => ({ reps: set.reps, weight_kg: set.weightKg })),
    })),
  };
}

function toCardioRow(input: CardioInput) {
  return {
    id: input.id,
    activity: input.activity,
    started_at: input.startedAt,
    duration_s: input.durationS,
    distance_m: input.distanceM ?? null,
    calories: input.calories ?? null,
    avg_heart_rate: input.avgHeartRate ?? null,
    notes: input.notes ?? null,
  };
}

function startedAtOf(value: { started_at: string } | { started_at: string }[] | null): string {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row?.started_at) throw new Error('Missing workout date');
  return row.started_at;
}

export const remoteRepo: Repo = {
  async session() {
    const { data, error } = await getSupabase().auth.getSession();
    fail(error);
    return toSession(data.session);
  },
  onSession(listener) {
    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setSessionUserId(null);
      listener(null);
      return () => undefined;
    }
    let active = true;
    const emit = (next: AuthSession | null) => {
      const session = toSession(next);
      setSessionUserId(session?.userId ?? null);
      listener(session);
    };
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      emit(error ? null : data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      emit(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  },
  async signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Could not start a session');
    return toSession(data.session) as Session;
  },
  async signUp(email, password) {
    const { data, error } = await getSupabase().auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) {
      const identities = data.user?.identities ?? [];
      if (identities.length === 0) throw new Error('User already registered');
      throw new Error('Email confirmation is required');
    }
    return toSession(data.session) as Session;
  },
  async signOut() {
    const { error } = await getSupabase().auth.signOut();
    const { data } = await getSupabase().auth.getSession();
    setSessionUserId(toSession(data.session)?.userId ?? null);
    fail(error);
  },
  async deleteAccount() {
    const { error } = await getSupabase().rpc('delete_account');
    fail(error);
    const signedOut = await getSupabase().auth.signOut({ scope: 'local' });
    const { data } = await getSupabase().auth.getSession();
    setSessionUserId(toSession(data.session)?.userId ?? null);
    fail(signedOut.error);
  },
  async getProfile() {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('id, display_name, unit_system')
      .single();
    fail(error);
    return toProfile(data as ProfileRow);
  },
  async updateProfile(patch) {
    const row: { display_name?: string | null; unit_system?: UnitSystem } = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.unitSystem !== undefined) row.unit_system = patch.unitSystem;
    if (Object.keys(row).length === 0) return this.getProfile();
    const { data, error } = await getSupabase()
      .from('profiles')
      .update(row)
      .select('id, display_name, unit_system')
      .single();
    fail(error);
    return toProfile(data as ProfileRow);
  },
  async listExercises() {
    const { data, error } = await getSupabase()
      .from('exercises')
      .select('id, owner_id, slug, name, muscle_group, equipment, aliases, track')
      .order('name', { ascending: true });
    fail(error);
    return ((data ?? []) as ExerciseRow[]).map(toExercise);
  },
  async createExercise(exercise: NewExercise) {
    const row = {
      name: exercise.name,
      muscle_group: exercise.muscleGroup,
      equipment: exercise.equipment,
      track: exercise.track,
      ...(exercise.id ? { id: exercise.id } : {}),
    };
    const table = getSupabase().from('exercises');
    const write = exercise.id ? table.upsert(row, { onConflict: 'id' }) : table.insert(row);
    const { data, error } = await write
      .select('id, owner_id, slug, name, muscle_group, equipment, aliases, track')
      .single();
    if (error) throw exerciseWriteError(error, exercise.name);
    return toExercise(data as ExerciseRow);
  },
  async deleteExercise(id) {
    const { error } = await getSupabase().from('exercises').delete().eq('id', id);
    fail(error);
  },
  async saveWorkout(workout) {
    const { error } = await getSupabase().rpc('save_workout', {
      workout: toWorkoutPayload(workout),
    });
    fail(error);
  },
  async deleteWorkout(id) {
    const { error } = await getSupabase().from('workouts').delete().eq('id', id);
    fail(error);
  },
  async getWorkout(id) {
    const { data, error } = await getSupabase()
      .from('workouts')
      .select(WORKOUT_SELECT)
      .eq('id', id)
      .maybeSingle();
    fail(error);
    if (!data) throw new Error('Workout not found');
    return toWorkout(data as WorkoutRow);
  },
  async listWorkouts(range: ListRange) {
    const limit = assertLimit(range.limit);
    let query = getSupabase()
      .from('workouts')
      .select(WORKOUT_SELECT)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (range.before) query = query.lt('started_at', range.before);
    const { data, error } = await query;
    fail(error);
    return ((data ?? []) as WorkoutRow[]).map(toWorkout);
  },
  async saveCardio(cardio) {
    const { error } = await getSupabase()
      .from('cardio_sessions')
      .upsert(toCardioRow(cardio), { onConflict: 'id' });
    fail(error);
  },
  async deleteCardio(id) {
    const { error } = await getSupabase().from('cardio_sessions').delete().eq('id', id);
    fail(error);
  },
  async listCardio(range) {
    const limit = assertLimit(range.limit);
    let query = getSupabase()
      .from('cardio_sessions')
      .select('id, activity, started_at, duration_s, distance_m, calories, avg_heart_rate, notes')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (range.before) query = query.lt('started_at', range.before);
    const { data, error } = await query;
    fail(error);
    return ((data ?? []) as CardioRow[]).map(toCardio);
  },
  async exerciseHistory(exerciseId) {
    const { data, error } = await getSupabase()
      .from('workout_exercises')
      .select('workout_id, workouts!inner(started_at), workout_sets(reps, weight_kg, position)')
      .eq('exercise_id', exerciseId);
    fail(error);
    const sessions: ExerciseSession[] = (
      (data ?? []) as {
        workout_id: string;
        workouts: { started_at: string } | { started_at: string }[] | null;
        workout_sets: SetRow[] | null;
      }[]
    ).map((row) => ({
      workoutId: row.workout_id,
      date: startedAtOf(row.workouts),
      sets: byPosition(row.workout_sets ?? []).map((set) => ({
        reps: set.reps,
        weightKg: num(set.weight_kg),
      })),
    }));
    sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return sessions;
  },
  async listTemplates() {
    const { data, error } = await getSupabase()
      .from('workout_templates')
      .select('id, name, exercises')
      .order('name', { ascending: true });
    fail(error);
    return ((data ?? []) as TemplateRow[]).map(toTemplate);
  },
  async saveTemplate(template) {
    const { error } = await getSupabase()
      .from('workout_templates')
      .upsert(toTemplateRow(template), { onConflict: 'id' });
    fail(error);
  },
  async deleteTemplate(id) {
    const { error } = await getSupabase().from('workout_templates').delete().eq('id', id);
    fail(error);
  },
};
