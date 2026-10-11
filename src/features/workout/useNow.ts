import { useEffect, useState, useSyncExternalStore } from 'react';

import { useDraft } from './draft';

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function subscribeHydration(onStoreChange: () => void) {
  if (useDraft.persist.hasHydrated()) return () => undefined;
  return useDraft.persist.onFinishHydration(onStoreChange);
}

export function useDraftHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    () => useDraft.persist.hasHydrated(),
    () => false,
  );
}
