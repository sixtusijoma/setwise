import { localRepo } from './local';
import { remoteRepo } from './remote';
import type {
  Cardio,
  CardioInput,
  Exercise,
  ExerciseSession,
  ListRange,
  NewExercise,
  Profile,
  Session,
  Template,
  Workout,
  WorkoutInput,
} from './types';

export type Repo = {
  session: () => Promise<Session | null>;
  signIn: (email: string, password: string) => Promise<Session>;
  signUp: (email: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  onSession: (listener: (session: Session | null) => void) => () => void;
  getProfile: () => Promise<Profile>;
  updateProfile: (patch: Partial<Pick<Profile, 'displayName' | 'unitSystem'>>) => Promise<Profile>;
  listExercises: () => Promise<Exercise[]>;
  createExercise: (exercise: NewExercise) => Promise<Exercise>;
  deleteExercise: (id: string) => Promise<void>;
  saveWorkout: (workout: WorkoutInput) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  getWorkout: (id: string) => Promise<Workout>;
  listWorkouts: (range: ListRange) => Promise<Workout[]>;
  saveCardio: (cardio: CardioInput) => Promise<void>;
  deleteCardio: (id: string) => Promise<void>;
  listCardio: (range: ListRange) => Promise<Cardio[]>;
  exerciseHistory: (exerciseId: string) => Promise<ExerciseSession[]>;
  listTemplates: () => Promise<Template[]>;
  saveTemplate: (template: Template) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
};

export function isLocalMode(): boolean {
  return !process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
}

export function getRepo(): Repo {
  return isLocalMode() ? localRepo : remoteRepo;
}
