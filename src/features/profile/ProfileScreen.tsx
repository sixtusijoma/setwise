import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, View } from 'react-native';

import { getRepo, isLocalMode } from '../../data/repo';
import { getSessionUserId, noteSignedOut } from '../../data/sessionUser';
import { dropAccountCache, signOutAndForget } from '../auth/accountBoundary';
import type { Exercise } from '../../data/types';
import type { UnitSystem } from '../../lib/units';
import { fontFamily } from '../../theme/fonts';
import { usePrefs, type Appearance } from '../../theme/prefs';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Field, IconButton, Screen, Segmented, Skeleton, Text } from '../../ui';
import { useSession } from '../auth/useProfile';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../exercises/labels';
import { useCustomExercises } from './useCustomExercises';
import { useSyncStatus } from './useSyncStatus';
import { useUnits } from './useUnits';

const units: { value: UnitSystem; label: string }[] = [
  { value: 'imperial', label: 'lb · mi' },
  { value: 'metric', label: 'kg · km' },
];

const appearances: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const rests = [
  { value: '60', label: '1:00' },
  { value: '90', label: '1:30' },
  { value: '120', label: '2:00' },
  { value: '180', label: '3:00' },
];

const alerts = [
  { value: 'off', label: 'In app' },
  { value: 'on', label: 'Notify' },
];

export function ProfileScreen() {
  const { colors, appearance, setAppearance } = useTheme();
  const { profile, loading, error: unitError, setUnitSystem } = useUnits();
  const session = useSession();
  const sync = useSyncStatus();
  const custom = useCustomExercises();
  const prefs = usePrefs();
  const [accountError, setAccountError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const local = isLocalMode();

  return (
    <Screen>
      <Text variant="display" heading>
        Profile
      </Text>
      <Text variant="overline" color="ink2" style={{ marginTop: 28 }}>
        Units
      </Text>
      <Card style={{ marginTop: 10, padding: 14 }}>
        {profile ? (
          <Segmented options={units} value={profile.unitSystem} onChange={setUnitSystem} />
        ) : (
          <Text variant="footnote" color="ink2">
            {loading ? 'Loading units…' : 'Units unavailable'}
          </Text>
        )}
        <Text variant="footnote" color="ink2" style={{ marginTop: 12 }}>
          Weights and distances follow this everywhere.
        </Text>
        {unitError ? (
          <Text variant="footnote" color="danger" style={{ marginTop: 8 }}>
            {unitError}
          </Text>
        ) : null}
      </Card>
      <Text variant="overline" color="ink2" style={{ marginTop: 28 }}>
        Appearance
      </Text>
      <Card style={{ marginTop: 10, padding: 14 }}>
        <Segmented options={appearances} value={appearance} onChange={setAppearance} />
        <Text variant="footnote" color="ink2" style={{ marginTop: 12 }}>
          System follows this phone. Light and Dark stay put until you change them.
        </Text>
      </Card>
      <Text variant="overline" color="ink2" style={{ marginTop: 28 }}>
        Rest timer
      </Text>
      <Card style={{ marginTop: 10, padding: 14 }}>
        <Segmented
          options={rests}
          value={String(prefs.restSeconds)}
          onChange={(value) => prefs.setRestSeconds(Number(value))}
        />
        <View style={{ marginTop: 12 }}>
          <Segmented
            options={alerts}
            value={prefs.restAlert ? 'on' : 'off'}
            onChange={async (value) => {
              if (value === 'off') return prefs.setRestAlert(false);
              const { granted } = await Notifications.requestPermissionsAsync();
              prefs.setRestAlert(granted);
            }}
          />
        </View>
        <Text variant="footnote" color="ink2" style={{ marginTop: 12 }}>
          Notify alerts you when a rest timer ends with the phone locked.
        </Text>
      </Card>
      <View style={{ marginTop: 16 }}>
        <Button
          label="Replay tutorial"
          variant="secondary"
          onPress={() => router.push('/tutorial')}
        />
      </View>
      <Text variant="overline" color="ink2" style={{ marginTop: 28 }}>
        Exercises
      </Text>
      <Card style={{ marginTop: 10, paddingHorizontal: 14 }}>
        {custom.loading ? (
          <View style={{ paddingVertical: 14 }}>
            <Skeleton width="100%" height={48} />
          </View>
        ) : custom.custom.length === 0 ? (
          <Text variant="footnote" color="ink2" style={{ paddingVertical: 16 }}>
            Custom exercises you add show up here.
          </Text>
        ) : (
          custom.custom.map((exercise, index) => (
            <CustomRow
              key={exercise.id}
              exercise={exercise}
              used={custom.used.has(exercise.id)}
              last={index === custom.custom.length - 1}
              deleting={custom.deleting === exercise.id}
              onDelete={() => custom.remove(exercise)}
            />
          ))
        )}
        {custom.error ? (
          <Text variant="footnote" color="danger" style={{ paddingBottom: 14 }}>
            {custom.error}
          </Text>
        ) : null}
      </Card>
      <Text variant="overline" color="ink2" style={{ marginTop: 28 }}>
        Sync
      </Text>
      <Card style={{ marginTop: 10, padding: 16 }}>
        <Text variant="headline">{sync.label}</Text>
        <Text variant="footnote" color="ink2" style={{ marginTop: 4 }}>
          {sync.pending === 0
            ? local
              ? 'Everything is saved on this device.'
              : 'Your account is up to date.'
            : "They'll send when you're back online."}
        </Text>
      </Card>
      <Text variant="overline" color="ink2" style={{ marginTop: 28 }}>
        Account
      </Text>
      {local ? (
        <Card style={{ marginTop: 10, padding: 16 }}>
          <Text variant="headline">Local mode</Text>
          <Text variant="footnote" color="ink2" style={{ marginTop: 4 }}>
            Workouts stay on this device. An account connects them later, and nothing here is
            shared.
          </Text>
        </Card>
      ) : (
        <Card style={{ marginTop: 10, padding: 16, gap: 12 }}>
          <Text variant="headline">{session?.email ?? 'Signed in'}</Text>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={() => {
              setAccountError(null);
              signOutAndForget().catch(() => setAccountError("Couldn't sign out. Try again."));
            }}
          />
          <Button label="Delete account" variant="danger" onPress={() => setConfirmDelete(true)} />
          {accountError ? (
            <Text variant="footnote" color="danger">
              {accountError}
            </Text>
          ) : null}
        </Card>
      )}
      {confirmDelete ? (
        <DeleteAccountDialog
          email={session?.email ?? null}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
      <View style={{ marginTop: 36, alignItems: 'center' }}>
        <Text variant="footnote" color="ink3" style={{ fontFamily: fontFamily.medium }}>
          Setwise {version}
        </Text>
        <View
          style={{
            width: 28,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.accent,
            marginTop: 10,
          }}
        />
      </View>
    </Screen>
  );
}

function DeleteAccountDialog({ email, onClose }: { email: string | null; onClose: () => void }) {
  const { widthClass } = useTheme();
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirmed = phrase.trim() === 'DELETE';

  const remove = async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      try {
        await getRepo().deleteAccount();
      } finally {
        if (!getSessionUserId()) {
          await dropAccountCache();
          noteSignedOut();
        }
      }
    } catch (caught) {
      setDeleting(false);
      setError(caught instanceof Error ? caught.message : "Couldn't delete this account.");
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={deleting ? undefined : onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(20, 20, 18, 0.4)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Card style={{ width: '100%', maxWidth: 360, padding: 20 }}>
          <Text variant="title" heading>
            Delete account
          </Text>
          <Text variant="body" color="ink2" style={{ marginTop: 8 }}>
            This permanently deletes {email ?? 'this account'}, including workouts and custom
            exercises. Type DELETE to confirm.
          </Text>
          <View style={{ marginTop: 16 }}>
            <Field
              label="Type DELETE to confirm"
              value={phrase}
              onChangeText={setPhrase}
              placeholder="DELETE"
            />
          </View>
          {error ? (
            <Text variant="footnote" color="danger" style={{ marginTop: 8 }}>
              {error}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: widthClass === 'compact' ? 'column-reverse' : 'row',
              gap: 10,
              marginTop: 20,
            }}
          >
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={onClose} disabled={deleting} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Delete account"
                variant="danger"
                onPress={() => void remove()}
                disabled={!confirmed}
                loading={deleting}
              />
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

function CustomRow({
  exercise,
  used,
  last,
  deleting,
  onDelete,
}: {
  exercise: Exercise;
  used: boolean;
  last: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <ExerciseThumb exercise={exercise} />
      <View style={{ flex: 1 }}>
        <Text variant="headline">{exercise.name}</Text>
        <Text variant="footnote" color="ink2" style={{ marginTop: 2 }}>
          {used
            ? "Used in a workout, so it can't be deleted"
            : `${EQUIPMENT_LABELS[exercise.equipment]} · ${MUSCLE_LABELS[exercise.muscleGroup]}`}
        </Text>
      </View>
      {used || deleting ? null : (
        <IconButton icon={Trash2} label={`Delete ${exercise.name}`} onPress={onDelete} />
      )}
    </View>
  );
}
