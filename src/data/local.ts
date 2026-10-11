import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import libraryJson from '../../data/exercise-library.json';
import type { Repo } from './repo';
import { setSessionUserId } from './sessionUser';
import type {
  Cardio,
  CardioActivity,
  CardioInput,
  Equipment,
  Exercise,
  ExerciseSession,
  ListRange,
  MuscleGroup,
  NewExercise,
  Profile,
  Session,
  Template,
  Track,
  Workout,
  WorkoutExercise,
  WorkoutInput,
  WorkoutSet,
} from './types';
import { CARDIO_ACTIVITIES, EQUIPMENT, MUSCLE_GROUPS, TRACKS } from './types';

export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001';
const LOCAL_EMAIL = 'local@setwise.app';
const STORAGE_KEY = 'setwise.local.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LibraryRow = {
  slug: string;
  name: string;
  muscle_group: string;
  equipment: string;
  aliases?: string[];
};

type LocalDb = {
  profile: Profile;
  exercises: Exercise[];
  workouts: Workout[];
  cardio: Cardio[];
  templates: Template[];
};

const session: Session = { userId: LOCAL_USER_ID, email: LOCAL_EMAIL };

function defaultDb(): LocalDb {
  return {
    profile: { id: LOCAL_USER_ID, displayName: null, unitSystem: 'imperial' },
    exercises: [],
    workouts: [],
    cardio: [],
    templates: [],
  };
}

async function load(): Promise<LocalDb> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultDb();
  const parsed = JSON.parse(raw) as LocalDb;
  return {
    ...defaultDb(),
    ...parsed,
    profile: { ...defaultDb().profile, ...parsed.profile },
  };
}

async function save(db: LocalDb): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

let queue: Promise<unknown> = Promise.resolve();

function mutate<T>(fn: (db: LocalDb) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function fail(message: string): never {
  throw new Error(message);
}

function assertUuid(value: string, label: string): string {
  if (!UUID.test(value)) fail(`${label} must be a uuid`);
  return value.toLowerCase();
}

function parseTime(value: string, label: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) fail(`${label} is not a valid time`);
  return new Date(time).toISOString();
}

function member<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!(allowed as readonly string[]).includes(value)) fail(`${label} is not valid`);
  return value as T;
}

function optionalText(value: string | null | undefined, max: number, label: string): string | null {
  if (value == null || value === '') return null;
  if (value !== value.trim() || value.length > max) {
    fail(`${label} must be ${max} characters or fewer`);
  }
  return value;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

let libraryPromise: Promise<Exercise[]> | null = null;

async function libraryId(slug: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `setwise.library.v1:${slug}`,
  );
  const chars = hex.slice(0, 32).split('');
  chars[12] = '4';
  chars[16] = ((Number.parseInt(chars[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const h = chars.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function libraryExercises(): Promise<Exercise[]> {
  libraryPromise ??= Promise.all(
    (libraryJson as LibraryRow[]).map(async (row) => ({
      id: await libraryId(row.slug),
      ownerId: null,
      slug: row.slug,
      name: row.name,
      muscleGroup: member(row.muscle_group, MUSCLE_GROUPS, row.slug),
      equipment: member(row.equipment, EQUIPMENT, row.slug),
      aliases: row.aliases ?? [],
      track: null,
    })),
  );
  return libraryPromise;
}

async function allExercises(db: LocalDb): Promise<Exercise[]> {
  return [...(await libraryExercises()), ...db.exercises];
}

function assertLimit(range: ListRange): number {
  if (!Number.isInteger(range.limit) || range.limit < 1 || range.limit > 100) {
    fail('Limit must be a whole number from 1 to 100');
  }
  return range.limit;
}

function pageByStarted<T extends { startedAt: string }>(rows: T[], range: ListRange): T[] {
  const limit = assertLimit(range);
  const before = range.before ? Date.parse(parseTime(range.before, 'Before')) : null;
  return rows
    .filter((row) => (before == null ? true : Date.parse(row.startedAt) < before))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
    .slice(0, limit);
}

function normalizeWorkout(input: WorkoutInput, known: Set<string>): Workout {
  const id = assertUuid(input.id, 'Workout id');
  const startedAt = parseTime(input.startedAt, 'Start');
  const endedAt = parseTime(input.endedAt, 'End');
  const span = Date.parse(endedAt) - Date.parse(startedAt);
  if (span < 0 || span > DAY_MS) fail('A workout must end within 24 hours of starting');
  if (input.exercises.length > 50) fail('A workout can have at most 50 exercises');

  const exercises: WorkoutExercise[] = input.exercises.map((exercise, index) => {
    if (!known.has(exercise.exerciseId)) fail('That exercise is not in your library');
    if (exercise.sets.length > 50) fail('An exercise can have at most 50 sets');
    const sets: WorkoutSet[] = exercise.sets.map((set, setIndex) => {
      if (!Number.isInteger(set.reps) || set.reps < 0 || set.reps > 999) {
        fail('Reps must be a whole number from 0 to 999');
      }
      if (!Number.isFinite(set.weightKg) || set.weightKg < 0 || set.weightKg > 1500) {
        fail('Weight must be between 0 and 1500 kg');
      }
      return {
        id: set.id ? assertUuid(set.id, 'Set id') : Crypto.randomUUID(),
        position: setIndex,
        reps: set.reps,
        weightKg: round3(set.weightKg),
      };
    });
    return {
      id: exercise.id ? assertUuid(exercise.id, 'Workout exercise id') : Crypto.randomUUID(),
      exerciseId: exercise.exerciseId,
      position: index,
      notes: optionalText(exercise.notes, 500, 'Exercise notes'),
      sets,
    };
  });

  return {
    id,
    title: optionalText(input.title, 60, 'Title'),
    startedAt,
    endedAt,
    notes: optionalText(input.notes, 2000, 'Notes'),
    exercises,
  };
}

function normalizeTemplate(input: Template, known: Set<string>): Template {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) fail('Template name must be 1 to 60 characters');
  if (input.exercises.length > 50) fail('A template can have at most 50 exercises');
  return {
    id: assertUuid(input.id, 'Template id'),
    name,
    exercises: input.exercises.map((exercise) => {
      if (!known.has(exercise.exerciseId)) fail('That exercise is not in your library');
      if (exercise.sets.length > 50) fail('An exercise can have at most 50 sets');
      return {
        exerciseId: exercise.exerciseId,
        sets: exercise.sets.map((set) => {
          if (!Number.isInteger(set.reps) || set.reps < 0 || set.reps > 999) {
            fail('Reps must be a whole number from 0 to 999');
          }
          if (!Number.isFinite(set.weightKg) || set.weightKg < 0 || set.weightKg > 1500) {
            fail('Weight must be between 0 and 1500 kg');
          }
          return { reps: set.reps, weightKg: round3(set.weightKg) };
        }),
      };
    }),
  };
}

function normalizeCardio(input: CardioInput): Cardio {
  const distance = input.distanceM ?? null;
  if (distance != null && (!Number.isFinite(distance) || distance <= 0 || distance > 1_000_000)) {
    fail('Distance must be greater than 0 meters');
  }
  const calories = input.calories ?? null;
  if (calories != null && (!Number.isInteger(calories) || calories < 0 || calories > 20000)) {
    fail('Calories must be a whole number from 0 to 20000');
  }
  const heart = input.avgHeartRate ?? null;
  if (heart != null && (!Number.isInteger(heart) || heart < 30 || heart > 250)) {
    fail('Heart rate must be between 30 and 250');
  }
  if (!Number.isInteger(input.durationS) || input.durationS < 1 || input.durationS > 86400) {
    fail('Duration must be between 1 second and 24 hours');
  }
  return {
    id: assertUuid(input.id, 'Cardio id'),
    activity: member<CardioActivity>(input.activity, CARDIO_ACTIVITIES, 'Activity'),
    startedAt: parseTime(input.startedAt, 'Start'),
    durationS: input.durationS,
    distanceM: distance == null ? null : round1(distance),
    calories,
    avgHeartRate: heart,
    notes: optionalText(input.notes, 2000, 'Notes'),
  };
}

export const localRepo: Repo = {
  // Local mode has one fixed user. Credentials are ignored; nothing is sent anywhere.
  async session() {
    return session;
  },
  async signIn() {
    return session;
  },
  async signUp() {
    return session;
  },
  async signOut() {
    return undefined;
  },
  async deleteAccount() {
    throw new Error('Delete account is only available when signed in');
  },
  onSession(listener) {
    setSessionUserId(session.userId);
    listener(session);
    return () => undefined;
  },
  async getProfile() {
    return (await load()).profile;
  },
  updateProfile(patch) {
    return mutate((db) => {
      if (patch.displayName !== undefined) {
        db.profile.displayName = optionalText(patch.displayName, 60, 'Name');
      }
      if (patch.unitSystem !== undefined) {
        if (patch.unitSystem !== 'imperial' && patch.unitSystem !== 'metric') {
          fail('Units must be imperial or metric');
        }
        db.profile.unitSystem = patch.unitSystem;
      }
      return db.profile;
    });
  },
  async listExercises() {
    return allExercises(await load());
  },
  createExercise(input: NewExercise) {
    return mutate(async (db) => {
      const name = input.name?.trim() ?? '';
      if (name.length < 1 || name.length > 80 || input.name !== name) {
        fail('Exercise name must be 1 to 80 characters');
      }
      const muscleGroup = member<MuscleGroup>(input.muscleGroup, MUSCLE_GROUPS, 'Muscle group');
      const equipment = member<Equipment>(input.equipment, EQUIPMENT, 'Equipment');
      const track = member<Track>(input.track, TRACKS, 'Track');
      const id = input.id ? assertUuid(input.id, 'Exercise id') : Crypto.randomUUID();
      const existing = db.exercises.find((exercise) => exercise.id === id);
      if (existing) return existing;
      const duplicate = db.exercises.some(
        (exercise) => exercise.name.toLowerCase() === name.toLowerCase(),
      );
      if (duplicate) fail(`You already have an exercise called ${name}`);
      const exercise: Exercise = {
        id,
        ownerId: LOCAL_USER_ID,
        slug: null,
        name,
        muscleGroup,
        equipment,
        aliases: [],
        track,
      };
      db.exercises.push(exercise);
      return exercise;
    });
  },
  deleteExercise(id) {
    return mutate(async (db) => {
      const exerciseId = assertUuid(id, 'Exercise id');
      const library = await libraryExercises();
      if (library.some((exercise) => exercise.id === exerciseId)) {
        fail("Library exercises can't be deleted");
      }
      const used = db.workouts.some((workout) =>
        workout.exercises.some((exercise) => exercise.exerciseId === exerciseId),
      );
      if (used) fail("This exercise is used in a workout, so it can't be deleted");
      db.exercises = db.exercises.filter((exercise) => exercise.id !== exerciseId);
    });
  },
  saveWorkout(input) {
    return mutate(async (db) => {
      const known = new Set((await allExercises(db)).map((exercise) => exercise.id));
      const workout = normalizeWorkout(input, known);
      const index = db.workouts.findIndex((item) => item.id === workout.id);
      if (index >= 0) db.workouts[index] = workout;
      else db.workouts.push(workout);
    });
  },
  deleteWorkout(id) {
    return mutate((db) => {
      const workoutId = assertUuid(id, 'Workout id');
      db.workouts = db.workouts.filter((workout) => workout.id !== workoutId);
    });
  },
  async getWorkout(id) {
    const workoutId = assertUuid(id, 'Workout id');
    const workout = (await load()).workouts.find((item) => item.id === workoutId);
    if (!workout) fail('Workout not found');
    return workout;
  },
  async listWorkouts(range) {
    return pageByStarted((await load()).workouts, range);
  },
  saveCardio(input) {
    return mutate((db) => {
      const cardio = normalizeCardio(input);
      const index = db.cardio.findIndex((item) => item.id === cardio.id);
      if (index >= 0) db.cardio[index] = cardio;
      else db.cardio.push(cardio);
    });
  },
  deleteCardio(id) {
    return mutate((db) => {
      const cardioId = assertUuid(id, 'Cardio id');
      db.cardio = db.cardio.filter((item) => item.id !== cardioId);
    });
  },
  async listCardio(range) {
    return pageByStarted((await load()).cardio, range);
  },
  async exerciseHistory(exerciseId) {
    const id = assertUuid(exerciseId, 'Exercise id');
    const sessions: ExerciseSession[] = [];
    for (const workout of (await load()).workouts) {
      for (const exercise of workout.exercises) {
        if (exercise.exerciseId !== id) continue;
        sessions.push({
          workoutId: workout.id,
          date: workout.startedAt,
          sets: exercise.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
        });
      }
    }
    sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return sessions;
  },
  async listTemplates() {
    return (await load()).templates.slice().sort((a, b) => a.name.localeCompare(b.name));
  },
  saveTemplate(input) {
    return mutate(async (db) => {
      const known = new Set((await allExercises(db)).map((exercise) => exercise.id));
      const template = normalizeTemplate(input, known);
      const index = db.templates.findIndex((item) => item.id === template.id);
      if (index >= 0) db.templates[index] = template;
      else db.templates.push(template);
    });
  },
  deleteTemplate(id) {
    return mutate((db) => {
      const templateId = assertUuid(id, 'Template id');
      db.templates = db.templates.filter((item) => item.id !== templateId);
    });
  },
};
