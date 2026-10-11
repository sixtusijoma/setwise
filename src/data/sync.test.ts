import { afterEach, describe, expect, test } from '@jest/globals';
import { dehydrate, hydrate, onlineManager, QueryClient } from '@tanstack/react-query';

import { pausedMutation, waitUntilPaused } from './sync';

describe('offline mutations', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  test('pauses while offline and replays the persisted mutation once', async () => {
    onlineManager.setOnline(false);
    let first = 0;
    let replayed = 0;
    const client = new QueryClient({
      defaultOptions: { mutations: { networkMode: 'online', retry: 0, gcTime: Infinity } },
    });
    client.mount();
    client.setMutationDefaults(['saveWorkout'], {
      mutationFn: async () => {
        first += 1;
      },
    });

    const pending = execute(client, ['saveWorkout'], { id: 'w1' });
    await Promise.resolve();
    expect(pausedMutation(client, ['saveWorkout'])).toBe(true);
    expect(first).toBe(0);

    const queued = await waitUntilPaused(pending, () => pausedMutation(client, ['saveWorkout']));
    expect(queued).toBe(true);

    const saved = dehydrate(client);
    expect(saved.mutations).toHaveLength(1);

    const restored = new QueryClient({
      defaultOptions: { mutations: { networkMode: 'online', retry: 0, gcTime: Infinity } },
    });
    restored.mount();
    restored.setMutationDefaults(['saveWorkout'], {
      mutationFn: async () => {
        replayed += 1;
      },
    });
    hydrate(restored, saved);
    expect(pausedMutation(restored, ['saveWorkout'])).toBe(true);
    expect(replayed).toBe(0);

    onlineManager.setOnline(true);
    await Promise.all([client.resumePausedMutations(), restored.resumePausedMutations()]);
    expect(first).toBe(1);
    expect(replayed).toBe(1);
    client.unmount();
    restored.unmount();
  });
});

function execute(
  client: QueryClient,
  mutationKey: readonly string[],
  variables: unknown,
): Promise<unknown> {
  const cache = client.getMutationCache() as unknown as {
    build: (
      client: QueryClient,
      options: { mutationKey: readonly string[] },
    ) => { execute: (variables: unknown) => Promise<unknown> };
  };
  return cache.build(client, { mutationKey }).execute(variables);
}
