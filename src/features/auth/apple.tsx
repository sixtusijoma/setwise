import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { getSupabase } from '../../data/supabase';
import { getRepo } from '../../data/repo';
import { authErrorMessage } from './messages';
import { Button, Text } from '../../ui';

const NONCE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';

export function appleSignInVisible(platform: string, available: boolean): boolean {
  return platform === 'ios' && available;
}

export function rawNonceFromBytes(bytes: Uint8Array): string {
  let nonce = '';
  for (const byte of bytes) nonce += NONCE_ALPHABET[byte % NONCE_ALPHABET.length];
  return nonce;
}

export async function hashAppleNonce(raw: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
}

export function appleIdToken(token: string, rawNonce: string) {
  return { provider: 'apple' as const, token, nonce: rawNonce };
}

export function isAppleCancel(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const code = (error as { code?: string }).code;
  return code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED';
}

export async function createRawNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return rawNonceFromBytes(bytes);
}

/** Apple receives the SHA-256 nonce. Supabase receives the raw nonce with the identity token. */
export async function requestAppleIdToken(): Promise<{
  provider: 'apple';
  token: string;
  nonce: string;
}> {
  const rawNonce = await createRawNonce();
  const hashed = await hashAppleNonce(rawNonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashed,
  });
  if (!credential.identityToken) throw new Error('Apple did not return an identity token');
  const given = credential.fullName?.givenName;
  const family = credential.fullName?.familyName;
  const name = [given, family].filter(Boolean).join(' ');
  const credentials = appleIdToken(credential.identityToken, rawNonce);
  const { error } = await getSupabase().auth.signInWithIdToken(credentials);
  if (error) throw new Error(error.message);
  if (name) {
    await getRepo()
      .updateProfile({ displayName: name })
      .catch(() => undefined);
  }
  return credentials;
}

export function AppleSignIn() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    void AppleAuthentication.isAvailableAsync().then((available) => {
      if (alive) setVisible(appleSignInVisible(Platform.OS, available));
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!visible) return null;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await requestAppleIdToken();
      router.replace('/');
    } catch (caught) {
      if (!isAppleCancel(caught)) setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Button
        label="Continue with Apple"
        variant="secondary"
        loading={busy}
        onPress={() => {
          void start();
        }}
      />
      {error ? (
        <Text variant="footnote" color="danger" style={{ textAlign: 'center' }}>
          {error}
        </Text>
      ) : null}
      <Text variant="footnote" color="ink3" style={{ textAlign: 'center' }}>
        or with email
      </Text>
    </View>
  );
}
