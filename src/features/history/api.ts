import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '../../data/keys';
import { mutationKeys } from '../../data/queryClient';
import { getRepo } from '../../data/repo';
import type { Cardio, Workout } from '../../data/types';
import { withoutWorkout } from './cache';
import { HISTORY_PAGE, mergeHistory, type HistoryFilter, type HistoryItem } from './merge';
import { personalRecordKeys } from './records';

export type StrengthRow = HistoryItem & { kind: 'strength'; workout: Workout };
export type CardioRow = HistoryItem & { kind: 'cardio'; cardio: Cardio };
export type SessionRow = StrengthRow | CardioRow;

const workoutHistoryKey = ['workouts', 'history'] as const;
const cardioHistoryKey = ['cardio', 'history'] as const;
const recordKey = ['workouts', 'records'] as const;

async function listAllWorkouts(): Promise<Workout[]> {
  const all: Workout[] = [];
  let before: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const rows = await getRepo().listWorkouts({ before, limit: 100 });
    all.push(...rows);
    const last = rows[rows.length - 1];
    if (rows.length < 100 || !last || last.startedAt === before) return all;
    before = last.startedAt;
  }
  return all;
}

function nextCursor<T extends { startedAt: string }>(
  lastPage: T[],
  allPages: T[][],
): string | undefined {
  if (lastPage.length < HISTORY_PAGE) return undefined;
  const cursor = lastPage[lastPage.length - 1]?.startedAt;
  if (!cursor) return undefined;
  const repeated = allPages
    .slice(0, -1)
    .some((page) => page[page.length - 1]?.startedAt === cursor);
  return repeated ? undefined : cursor;
}

export function useRecordKeys() {
  return useQuery({
    queryKey: recordKey,
    queryFn: async () => {
      const [workouts, exercises] = await Promise.all([
        listAllWorkouts(),
        getRepo().listExercises(),
      ]);
      return personalRecordKeys(workouts, new Map(exercises.map((item) => [item.id, item])));
    },
  });
}

export function useHistory(filter: HistoryFilter) {
  const workouts = useInfiniteQuery({
    queryKey: workoutHistoryKey,
    queryFn: ({ pageParam }) => getRepo().listWorkouts({ before: pageParam, limit: HISTORY_PAGE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
  const cardio = useInfiniteQuery({
    queryKey: cardioHistoryKey,
    queryFn: ({ pageParam }) => getRepo().listCardio({ before: pageParam, limit: HISTORY_PAGE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
  const records = useRecordKeys();

  const merged = useMemo(() => {
    const strength: StrengthRow[] = (workouts.data?.pages.flat() ?? []).map((workout) => ({
      kind: 'strength' as const,
      id: workout.id,
      startedAt: workout.startedAt,
      workout,
    }));
    const cardioRows: CardioRow[] = (cardio.data?.pages.flat() ?? []).map((session) => ({
      kind: 'cardio' as const,
      id: session.id,
      startedAt: session.startedAt,
      cardio: session,
    }));
    return mergeHistory<SessionRow>({
      strength: { items: strength, done: !workouts.isPending && !workouts.hasNextPage },
      cardio: { items: cardioRows, done: !cardio.isPending && !cardio.hasNextPage },
      filter,
    });
  }, [
    workouts.data,
    workouts.isPending,
    workouts.hasNextPage,
    cardio.data,
    cardio.isPending,
    cardio.hasNextPage,
    filter,
  ]);

  const pending =
    (filter !== 'cardio' && workouts.isPending) || (filter !== 'strength' && cardio.isPending);
  const failed =
    (filter !== 'cardio' && workouts.isError) || (filter !== 'strength' && cardio.isError);

  const loadStrength = workouts.fetchNextPage;
  const loadCardio = cardio.fetchNextPage;
  const strengthBusy = workouts.isFetchingNextPage;
  const cardioBusy = cardio.isFetchingNextPage;
  const strengthMore = workouts.hasNextPage;
  const cardioMore = cardio.hasNextPage;

  const loadMore = () => {
    if (merged.next === 'strength' && strengthMore && !strengthBusy) void loadStrength();
    else if (merged.next === 'cardio' && cardioMore && !cardioBusy) void loadCardio();
  };

  useEffect(() => {
    if (pending || failed || strengthBusy || cardioBusy) return;
    if (merged.items.length >= HISTORY_PAGE || !merged.next) return;
    if (merged.next === 'strength' && strengthMore) void loadStrength();
    else if (merged.next === 'cardio' && cardioMore) void loadCardio();
  }, [
    pending,
    failed,
    merged.items.length,
    merged.next,
    strengthBusy,
    cardioBusy,
    strengthMore,
    cardioMore,
    loadStrength,
    loadCardio,
  ]);

  const refresh = () => Promise.all([workouts.refetch(), cardio.refetch(), records.refetch()]);

  return {
    items: merged.items,
    records: records.data ?? [],
    pending,
    failed,
    loadingMore: workouts.isFetchingNextPage || cardio.isFetchingNextPage,
    loadMore,
    refresh,
  };
}

export function useWorkout(id: string | undefined) {
  return useQuery({
    queryKey: keys.workout(id ?? 'none'),
    queryFn: () => getRepo().getWorkout(id!),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useDeleteWorkout() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.deleteWorkout,
    mutationFn: (id: string) => getRepo().deleteWorkout(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: ['workouts'] });
      const previous = client.getQueriesData({ queryKey: ['workouts'] });
      client.setQueriesData({ queryKey: ['workouts'] }, (data) => withoutWorkout(data, id));
      client.removeQueries({ queryKey: keys.workout(id) });
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ['workouts'] });
      await client.invalidateQueries({ queryKey: ['exerciseHistory'] });
    },
  });
}
