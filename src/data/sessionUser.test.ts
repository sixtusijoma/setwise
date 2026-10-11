import { afterEach, describe, expect, test } from '@jest/globals';

import {
  accountSwitch,
  mutationBelongsToSession,
  noteSignedOut,
  resetSessionUserForTests,
  setSealingAccount,
  setSessionUserId,
  stampOwner,
} from './sessionUser';

afterEach(() => {
  resetSessionUserForTests();
});

describe('account cache owner', () => {
  test('keeps the cache for the signed-in user, including across a signed-out gap', () => {
    expect(accountSwitch(null)).toBe(false);
    expect(accountSwitch('user-a')).toBe(false);
    expect(accountSwitch(null)).toBe(false);
    expect(accountSwitch('user-a')).toBe(false);
  });

  test('drops the cache when a different account signs in', () => {
    expect(accountSwitch('user-a')).toBe(false);
    expect(accountSwitch(null)).toBe(false);
    expect(accountSwitch('user-b')).toBe(true);
    expect(accountSwitch('user-b')).toBe(false);
  });

  test('sign-out forgets the owner so the next sign-in is not a switch', () => {
    accountSwitch('user-a');
    noteSignedOut();
    expect(accountSwitch('user-b')).toBe(false);
  });

  test('a sign-in that lands during sign-out keeps that account', () => {
    accountSwitch('user-a');
    setSessionUserId('user-b');
    noteSignedOut();
    expect(accountSwitch('user-b')).toBe(true);
  });
});

describe('queued writes', () => {
  test('stamps the signed-in user onto the payload', () => {
    setSessionUserId('user-a');
    const body = stampOwner({ id: 'workout-1' });
    expect(body).toEqual({ id: 'workout-1', userId: 'user-a' });
  });

  test('runs only for the account that queued the write', () => {
    expect(mutationBelongsToSession('user-a', 'user-a')).toBe(true);
    expect(mutationBelongsToSession('user-a', 'user-b')).toBe(false);
    expect(mutationBelongsToSession('user-a', null)).toBe(false);
    expect(mutationBelongsToSession(undefined, 'user-a')).toBe(true);
    setSealingAccount(true);
    expect(mutationBelongsToSession(undefined, 'user-a')).toBe(false);
    expect(mutationBelongsToSession('user-a', 'user-a')).toBe(true);
  });
});
