import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as Crypto from 'expo-crypto';

import {
  appleIdToken,
  appleSignInVisible,
  hashAppleNonce,
  isAppleCancel,
  rawNonceFromBytes,
  requestAppleIdToken,
} from './apple';

const mockSignInAsync =
  jest.fn<(options: { nonce: string }) => Promise<{ identityToken: string | null }>>();
const mockSignInWithIdToken =
  jest.fn<
    (credentials: { provider: 'apple'; token: string; nonce: string }) => Promise<{ error: null }>
  >();

jest.mock('../../ui', () => ({
  Button: () => null,
  Text: () => null,
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: (options: { nonce: string }) => mockSignInAsync(options),
}));

jest.mock('../../data/supabase', () => ({
  getSupabase: () => ({
    auth: {
      signInWithIdToken: (credentials: { provider: 'apple'; token: string; nonce: string }) =>
        mockSignInWithIdToken(credentials),
    },
  }),
}));

jest.mock('../../data/repo', () => ({
  getRepo: () => ({
    updateProfile: async () => undefined,
  }),
}));

describe('Sign in with Apple', () => {
  beforeEach(() => {
    mockSignInAsync.mockReset();
    mockSignInWithIdToken.mockReset();
  });

  test('hides the button on web and when the device cannot present it', () => {
    expect(appleSignInVisible('web', true)).toBe(false);
    expect(appleSignInVisible('android', true)).toBe(false);
    expect(appleSignInVisible('ios', false)).toBe(false);
    expect(appleSignInVisible('ios', true)).toBe(true);
  });

  test('hashes the raw nonce for Apple and sends the raw nonce to Supabase', async () => {
    const raw = rawNonceFromBytes(Uint8Array.from([0, 1, 65, 255]));
    expect(raw).toHaveLength(4);
    expect(raw).not.toMatch(/\s/);

    const digest = jest.spyOn(Crypto, 'digestStringAsync').mockResolvedValue('hashed-nonce');
    await expect(hashAppleNonce(raw)).resolves.toBe('hashed-nonce');
    expect(digest).toHaveBeenCalledWith(Crypto.CryptoDigestAlgorithm.SHA256, raw);

    mockSignInAsync.mockImplementation(async (options) => {
      expect(options.nonce).toBe('hashed-nonce');
      expect(options.nonce).not.toBe(raw);
      return { identityToken: 'identity-token' };
    });
    mockSignInWithIdToken.mockResolvedValue({ error: null });
    jest.spyOn(Crypto, 'getRandomBytesAsync').mockResolvedValue(Uint8Array.from([0, 1, 65, 255]));

    const issued = await requestAppleIdToken();
    expect(issued).toEqual(appleIdToken('identity-token', raw));
    expect(issued.nonce).not.toBe('hashed-nonce');
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'identity-token',
      nonce: raw,
    });
  });

  test('treats a dismissed Apple sheet as a cancel', () => {
    expect(isAppleCancel({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isAppleCancel(new Error('network'))).toBe(false);
  });
});
