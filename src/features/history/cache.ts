import type { InfiniteData } from '@tanstack/react-query';

import type { Workout } from '../../data/types';

type WithId = { id: string };

export function withoutWorkout(data: unknown, id: string): unknown {
  if (Array.isArray(data)) return data.filter((item: WithId) => item?.id !== id);
  if (!data || typeof data !== 'object' || !('pages' in data)) return data;
  const infinite = data as InfiniteData<WithId[]>;
  if (!Array.isArray(infinite.pages)) return data;
  return {
    ...infinite,
    pages: infinite.pages.map((page) => page.filter((item) => item.id !== id)),
  };
}

export function asWorkouts(data: unknown): Workout[] {
  return Array.isArray(data) ? (data as Workout[]) : [];
}
