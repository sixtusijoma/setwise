import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, describe, expect, test } from '@jest/globals';
import { hydrate, onlineManager, QueryClient } from '@tanstack/react-query';
import { persistQueryClientSubscribe, type PersistedClient } from '@tanstack/react-query-persist-client';

import {
  discardPersistedQueryCache,
  flushQueryPersist,
  QUERY_CACHE_KEY,
  queryPersister,
  resetQueryPersistForTests,
} from './queryPersist';
import { pausedMutation, waitUntilPaused } from './sync';

afterEach(async () => {
  await flushQueryPersist();
  resetQueryPersistForTests();
  await AsyncStorage.clear();
  onlineManager.setOnline(true);
});

describe('persisted query cache', () => {
  test('a cold start keeps a paused save for the same user', async () => {
    onlineManager.setOnline(false);
    const original = mountedClient();
    original.setMutationDefaults(['saveWorkout'], { mutationFn: async () => undefined });
    const unsubscribe = persistQueryClientSubscribe({
      queryClient: original,
      persister: queryPersister,
    });

    const pending = execute(original, ['saveWorkout'], { title: 'Queue Keep' });
    expect(await waitUntilPaused(pending, () => pausedMutation(original, ['saveWorkout']))).toBe(
      true,
    );
    await flushQueryPersist();
    const stored = await AsyncStorage.getItem(QUERY_CACHE_KEY);
    expect(stored).toContain('Queue Keep');
    unsubscribe();
    original.unmount();

    let replayed = 0;
    const next = mountedClient();
    next.setMutationDefaults(['saveWorkout'], {
      mutationFn: async () => {
        replayed += 1;
      },
    });
    hydrate(next, (JSON.parse(stored!) as PersistedClient).clientState);
    expect(pausedMutation(next, ['saveWorkout'])).toBe(true);

    onlineManager.setOnline(true);
    await next.resumePausedMutations();
    expect(replayed).toBe(1);
    next.unmount();
  });

  test('sign-out does not write a paused save back after the cache is removed', async () => {
    onlineManager.setOnline(false);
    const original = mountedClient();
    original.setMutationDefaults(['saveWorkout'], { mutationFn: async () => undefined });
    const unsubscribe = persistQueryClientSubscribe({
      queryClient: original,
      persister: queryPersister,
    });

    const pending = execute(original, ['saveWorkout'], { title: 'Must Not Leak' });
    expect(await waitUntilPaused(pending, () => pausedMutation(original, ['saveWorkout']))).toBe(
      true,
    );
    await flushQueryPersist();
    expect(await AsyncStorage.getItem(QUERY_CACHE_KEY)).toContain('Must Not Leak');

    await discardPersistedQueryCache(original);
    expect(pausedMutation(original, ['saveWorkout'])).toBe(false);
    expect(await AsyncStorage.getItem(QUERY_CACHE_KEY)).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await AsyncStorage.getItem(QUERY_CACHE_KEY)).toBeNull();

    const next = mountedClient();
    next.setMutationDefaults(['saveWorkout'], {
      mutationFn: async () => {
        throw new Error('replayed after sign-out');
      },
    });
    const persisted = await queryPersister.restoreClient();
    if (persisted) hydrate(next, persisted.clientState);
    onlineManager.setOnline(true);
    await next.resumePausedMutations();
    expect(pausedMutation(next, ['saveWorkout'])).toBe(false);

    unsubscribe();
    original.unmount();
    next.unmount();
  });
});

function mountedClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { mutations: { networkMode: 'online', retry: 0, gcTime: Infinity } },
  });
  client.mount();
  return client;
}

function execute(client: QueryClient, mutationKey: readonly string[], variables: unknown) {
  const cache = client.getMutationCache() as unknown as {
    build: (
      client: QueryClient,
      options: { mutationKey: readonly string[] },
    ) => { execute: (variables: unknown) => Promise<unknown> };
  };
  return cache.build(client, { mutationKey }).execute(variables);
}
