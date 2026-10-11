import NetInfo from '@react-native-community/netinfo';
import { onlineManager, useMutationState, type QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

let installed = false;

/**
 * Native uses NetInfo. Web uses `online`/`offline` instead: NetInfo's browser
 * build follows `navigator.connection` and can stay connected after the
 * document goes offline.
 */
export function installSync(): void {
  if (installed) return;
  installed = true;
  onlineManager.setEventListener((setOnline) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const apply = () => setOnline(window.navigator.onLine);
      window.addEventListener('online', apply);
      window.addEventListener('offline', apply);
      apply();
      return () => {
        window.removeEventListener('online', apply);
        window.removeEventListener('offline', apply);
      };
    }
    const apply = (isConnected: boolean | null) => {
      if (typeof isConnected === 'boolean') setOnline(isConnected);
    };
    const unsubscribe = NetInfo.addEventListener((state) => {
      apply(state.isConnected);
    });
    void NetInfo.fetch().then((state) => apply(state.isConnected));
    return unsubscribe;
  });
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => onlineManager.subscribe(onStoreChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export function usePausedCount(): number {
  const paused = useMutationState({
    filters: { predicate: (mutation) => mutation.state.isPaused },
    select: () => true,
  });
  return paused.length;
}

export function pausedMutation(client: QueryClient, mutationKey: readonly unknown[]): boolean {
  return client
    .getMutationCache()
    .findAll({ mutationKey, status: 'pending' })
    .some((mutation) => mutation.state.isPaused);
}

/**
 * Resolves true when the mutation pauses, false when it settles.
 * A paused promise is caught so a later replay error is not unhandled.
 */
export async function waitUntilPaused<T>(
  pending: Promise<T>,
  isPaused: () => boolean,
): Promise<boolean> {
  if (isPaused()) {
    pending.catch(() => undefined);
    return true;
  }
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (!isPaused()) return;
      clearInterval(timer);
      pending.catch(() => undefined);
      resolve(true);
    }, 16);
    pending.then(
      () => {
        clearInterval(timer);
        resolve(false);
      },
      (error: unknown) => {
        clearInterval(timer);
        reject(error);
      },
    );
  });
}

export async function leaveWhenQueued<T>(
  pending: Promise<T>,
  isPaused: () => boolean,
): Promise<'queued' | 'synced'> {
  const queued = await waitUntilPaused(pending, isPaused);
  if (!queued) await pending;
  return queued ? 'queued' : 'synced';
}
