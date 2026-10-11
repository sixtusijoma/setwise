import * as Crypto from 'expo-crypto';

import type { Template, Workout } from '../../data/types';
import { parseReps, type Draft } from '../workout/draft';

export function templateFromDraft(draft: Draft, name: string): Template {
  return {
    id: Crypto.randomUUID(),
    name,
    exercises: draft.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets.map((set) => ({
        reps: parseReps(set.repsText) ?? 0,
        weightKg: set.weightKg ?? 0,
      })),
    })),
  };
}

export function templateFromWorkout(workout: Workout, name: string): Template {
  return {
    id: Crypto.randomUUID(),
    name,
    exercises: workout.exercises
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: exercise.sets
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
      })),
  };
}

export function templateSummary(template: Template): string {
  const exercises = template.exercises.length;
  const sets = template.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  return `${exercises} ${exercises === 1 ? 'exercise' : 'exercises'} · ${sets} ${sets === 1 ? 'set' : 'sets'}`;
}
