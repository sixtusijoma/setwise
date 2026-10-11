import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { LargeSecureStore } from './supabase';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    __clear: () => mem.clear(),
    getItem: async (key: string) => mem.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mem.set(key, value);
    },
    removeItem: async (key: string) => {
      mem.delete(key);
    },
  };
});

jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>();
  return {
    __clear: () => mem.clear(),
    getItemAsync: async (key: string) => mem.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      mem.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      mem.delete(key);
    },
  };
});

describe('LargeSecureStore', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __clear: () => void }).__clear();
    (SecureStore as unknown as { __clear: () => void }).__clear();
    Platform.OS = 'ios';
  });

  test('keeps the session ciphertext out of AsyncStorage and the key in SecureStore', async () => {
    const store = new LargeSecureStore();
    const session = '{"access_token":"secret-token","refresh_token":"refresh"}';
    await store.setItem('sb-test-auth-token', session);

    const ciphertext = await AsyncStorage.getItem('sb-test-auth-token');
    expect(ciphertext).toBeTruthy();
    expect(ciphertext).not.toContain('secret-token');
    const key = await SecureStore.getItemAsync('sb-test-auth-token');
    expect(key).toHaveLength(64);
    await expect(store.getItem('sb-test-auth-token')).resolves.toBe(session);

    await store.removeItem('sb-test-auth-token');
    await expect(store.getItem('sb-test-auth-token')).resolves.toBeNull();
    await expect(SecureStore.getItemAsync('sb-test-auth-token')).resolves.toBeNull();
  });
});
