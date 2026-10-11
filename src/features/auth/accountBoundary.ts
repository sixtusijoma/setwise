import { onlineManager } from '@tanstack/react-query';

import { queryClient } from '../../data/queryClient';
import { discardPersistedQueryCache } from '../../data/queryPersist';
import { getRepo, isLocalMode } from '../../data/repo';
import {
  getSessionUserId,
  noteSignedOut,
  setSealingAccount,
} from '../../data/sessionUser';
import { useDraft } from '../workout/draft';

export async function dropAccountCache(): Promise<void> {
  useDraft.getState().discard();
  await discardPersistedQueryCache(queryClient);
}

async function seal<T>(fn: () => Promise<T>): Promise<T> {
  const online = onlineManager.isOnline();
  setSealingAccount(true);
  onlineManager.setOnline(false);
  try {
    return await fn();
  } finally {
    setSealingAccount(false);
    onlineManager.setOnline(online);
  }
}

/** Sign-out removes the session even when the server call fails, so drop local copies either way. */
export async function signOutAndForget(): Promise<void> {
  if (isLocalMode()) {
    await getRepo().signOut();
    return;
  }
  await seal(async () => {
    try {
      await getRepo().signOut();
    } catch (error) {
      if (getSessionUserId()) throw error;
    }
    if (getSessionUserId()) return;
    await dropAccountCache();
    noteSignedOut();
  });
}
