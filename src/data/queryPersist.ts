import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

export const QUERY_CACHE_KEY = 'setwise.query';

// MutationCache.clear() notifies while paused mutations are still stored, and
// dehydrate runs in that listener. A throttled persister writes that snapshot
// after removeClient(). Hold writes for the whole drop, and run storage
// operations one at a time, so the signed-out queue cannot land back here.
let holdCount = 0;
let chain: Promise<void> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function isQueryPersistHeld(): boolean {
  return holdCount > 0;
}

export async function discardPersistedQueryCache(client: { clear: () => void }): Promise<void> {
  holdCount += 1;
  try {
    client.clear();
    await queryPersister.removeClient();
  } finally {
    holdCount -= 1;
  }
}

export function flushQueryPersist(): Promise<void> {
  return enqueue(async () => undefined);
}

export function resetQueryPersistForTests(): void {
  holdCount = 0;
  chain = Promise.resolve();
}

export const queryPersister: Persister = {
  persistClient(persisted: PersistedClient) {
    if (holdCount > 0) return Promise.resolve();
    const serialized = JSON.stringify(persisted);
    return enqueue(async () => {
      if (holdCount > 0) return;
      await AsyncStorage.setItem(QUERY_CACHE_KEY, serialized);
    });
  },
  restoreClient() {
    return enqueue(async () => {
      const raw = await AsyncStorage.getItem(QUERY_CACHE_KEY);
      if (!raw) return undefined;
      return JSON.parse(raw) as PersistedClient;
    });
  },
  removeClient() {
    return enqueue(async () => {
      await AsyncStorage.removeItem(QUERY_CACHE_KEY);
    });
  },
};
