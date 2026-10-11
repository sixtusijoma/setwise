import type { ListRange } from './types';

export const keys = {
  profile: ['profile'] as const,
  exercises: ['exercises'] as const,
  workouts: (range?: Partial<ListRange>) => ['workouts', range ?? {}] as const,
  workout: (id: string) => ['workout', id] as const,
  cardio: (range?: Partial<ListRange>) => ['cardio', range ?? {}] as const,
  templates: ['templates'] as const,
  exerciseHistory: (id: string) => ['exerciseHistory', id] as const,
};
