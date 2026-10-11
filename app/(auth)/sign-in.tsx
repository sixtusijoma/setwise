import { router } from 'expo-router';
import { Dumbbell } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { getRepo, isLocalMode } from '../../src/data/repo';
import { AppleSignIn } from '../../src/features/auth/apple';
import { authErrorMessage, validateCredentials } from '../../src/features/auth/messages';
import { fontFamily } from '../../src/theme/fonts';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button, Card, Field, Screen, Text } from '../../src/ui';

export default function SignInScreen() {
  const { colors, widthClass } = useTheme();
  const compact = widthClass === 'compact';

  return (
    <Screen variant="stack">
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingTop: compact ? 12 : 48 }}>
          <View
            style={{
              width: compact ? 72 : 96,
              height: compact ? 72 : 96,
              borderRadius: 28,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.hairline,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Dumbbell color={colors.accent} size={compact ? 32 : 42} strokeWidth={1.75} />
          </View>
          <Text
            variant="display"
            heading
            style={{ fontSize: compact ? 52 : 64, lineHeight: compact ? 56 : 68, marginTop: 28 }}
          >
            Setwise
          </Text>
          <Text
            variant="title"
            color="ink2"
            style={{ fontFamily: fontFamily.serifItalic, fontStyle: 'italic', marginTop: 6 }}
          >
            Every set, accounted for.
          </Text>
        </View>
        {isLocalMode() ? <LocalEntry /> : <EmailEntry />}
      </View>
    </Screen>
  );
}

function LocalEntry() {
  return (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Button label="Continue in local mode" onPress={() => router.replace('/')} />
      <Text variant="footnote" color="ink2" style={{ textAlign: 'center' }}>
        Workouts stay on this device until you add an account.
      </Text>
    </View>
  );
}

function EmailEntry() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = mode === 'sign-up';

  async function submit() {
    const problem = validateCredentials(email, password);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const repo = getRepo();
      if (creating) await repo.signUp(email.trim(), password);
      else await repo.signIn(email.trim(), password);
      router.replace('/');
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <AppleSignIn />
      <Card style={{ overflow: 'hidden' }}>
        <Field
          grouped
          label="Email"
          value={email}
          placeholder="you@example.com"
          onChangeText={(value) => {
            setEmail(value);
            if (error) setError(null);
          }}
        />
        <View style={{ height: 1, backgroundColor: colors.hairline, marginHorizontal: 16 }} />
        <Field
          grouped
          label="Password"
          value={password}
          placeholder="At least 8 characters"
          secureTextEntry
          onChangeText={(value) => {
            setPassword(value);
            if (error) setError(null);
          }}
        />
      </Card>
      {error ? (
        <Text
          variant="footnote"
          color="danger"
          accessibilityLiveRegion="polite"
          style={{ textAlign: 'center' }}
        >
          {error}
        </Text>
      ) : null}
      <Button
        label={creating ? 'Create account' : 'Sign in'}
        loading={busy}
        onPress={() => {
          void submit();
        }}
      />
      <Button
        variant="ghost"
        label={creating ? 'Already have an account? Sign in' : 'Create an account'}
        onPress={() => {
          setMode(creating ? 'sign-in' : 'sign-up');
          setError(null);
        }}
      />
    </View>
  );
}
