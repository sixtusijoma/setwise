import { router, useSegments } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { getRepo, isLocalMode } from '../../data/repo';
import { accountSwitch } from '../../data/sessionUser';
import type { Session } from '../../data/types';
import { useTheme } from '../../theme/ThemeProvider';
import { dropAccountCache } from './accountBoundary';

export function AuthGate({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const { colors } = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => getRepo().onSession(setSession), []);

  useEffect(() => {
    if (session === undefined || isLocalMode()) return;
    if (accountSwitch(session?.userId ?? null)) void dropAccountCache();
  }, [session]);

  useEffect(() => {
    if (session === undefined) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/sign-in');
    else if (session && inAuth && !isLocalMode()) router.replace('/');
  }, [session, segments]);

  if (session === undefined || (!session && segments[0] !== '(auth)')) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }
  return children;
}
