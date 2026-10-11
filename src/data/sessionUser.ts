let currentUserId: string | null = null;
let rememberedUserId: string | undefined;
let sealing = false;

export function setSessionUserId(userId: string | null): void {
  currentUserId = userId;
}

export function getSessionUserId(): string | null {
  return currentUserId;
}

export function setSealingAccount(sealingAccount: boolean): void {
  sealing = sealingAccount;
}

export function isSealingAccount(): boolean {
  return sealing;
}

/** True when a signed-in user is replaced. A signed-out gap keeps the previous id. */
export function accountSwitch(userId: string | null): boolean {
  if (!userId) return false;
  const drop = rememberedUserId != null && rememberedUserId !== userId;
  rememberedUserId = userId;
  return drop;
}

export function noteSignedOut(): void {
  if (currentUserId) return;
  rememberedUserId = undefined;
}

export function stampOwner<T extends object>(body: T): T & { userId?: string } {
  if (!currentUserId) return body;
  return Object.assign(body, { userId: currentUserId });
}

/**
 * A queued write stores the account that created it. Missing owner means it was
 * queued before that stamp existed; sign-out still drops those with the cache.
 */
export function mutationBelongsToSession(
  ownerId: string | undefined,
  signedInUserId: string | null,
): boolean {
  if (!signedInUserId) return false;
  if (!ownerId) return !sealing;
  return ownerId === signedInUserId;
}

export function resetSessionUserForTests(): void {
  currentUserId = null;
  rememberedUserId = undefined;
  sealing = false;
}
