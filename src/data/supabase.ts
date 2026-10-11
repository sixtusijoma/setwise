import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as aesjsNs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

type Aes = typeof import('aes-js');
const aesjs: Aes = ((aesjsNs as unknown as { default?: Aes }).default ?? aesjsNs) as Aes;

// Ciphertext lives in AsyncStorage (no size cap). The AES key lives in SecureStore.
// Web has no Keychain, so the session stays in localStorage.
export class LargeSecureStore {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return webStore().getItem(key);
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return encrypted;
    const encryptionKey = await SecureStore.getItemAsync(secureKey(key));
    if (!encryptionKey) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKey),
      new aesjs.Counter(1),
    );
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(encrypted)));
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      webStore().setItem(key, value);
      return;
    }
    const encryptionKey = Crypto.getRandomBytes(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(secureKey(key), aesjs.utils.hex.fromBytes(encryptionKey));
    await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(encrypted));
  }

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      webStore().removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(secureKey(key)).catch(() => undefined);
  }
}

const memory = new Map<string, string>();

function webStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof localStorage !== 'undefined') return localStorage;
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
    removeItem: (key) => {
      memory.delete(key);
    },
  };
}

function secureKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Supabase is not configured');
  client = createClient(url, key, {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // On native the refresh ticker never stops by itself, and a tick while the phone is locked
  // reads the Keychain and fails ("User interaction is not allowed"). Web handles visibility itself.
  const { auth } = client;
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) =>
      state === 'active' ? auth.startAutoRefresh() : auth.stopAutoRefresh(),
    );
  }
  return client;
}
