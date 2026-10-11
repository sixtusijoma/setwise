import { useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

export function syncLabel(pending: number): string {
  if (pending <= 0) return 'All changes saved';
  return `${pending} waiting`;
}

export function countWaiting(mutations: readonly { status: string; isPaused?: boolean }[]): number {
  return mutations.filter((mutation) => mutation.status === 'pending' || mutation.isPaused).length;
}

function waitingCount(client: ReturnType<typeof useQueryClient>): number {
  return countWaiting(
    client.getMutationCache().getAll().map((mutation) => ({
      status: mutation.state.status,
      isPaused: mutation.state.isPaused,
    })),
  );
}

export function useSyncStatus() {
  const client = useQueryClient();
  const pending = useSyncExternalStore(
    (onStoreChange) => client.getMutationCache().subscribe(onStoreChange),
    () => waitingCount(client),
    () => 0,
  );
  return { pending, label: syncLabel(pending) };
}
