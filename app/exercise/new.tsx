import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useQueryClient } from '@tanstack/react-query';

import { keys } from '../../src/data/keys';
import { mutationKeys } from '../../src/data/queryClient';
import { leaveWhenQueued, pausedMutation } from '../../src/data/sync';
import type { Equipment, Exercise, MuscleGroup, Track } from '../../src/data/types';
import { EQUIPMENT, MUSCLE_GROUPS, TRACKS } from '../../src/data/types';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, TRACK_LABELS } from '../../src/features/exercises/labels';
import { useCreateExercise } from '../../src/features/exercises/useExercises';
import { useDraft } from '../../src/features/workout/draft';
import { dismiss } from '../../src/lib/nav';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button, Field, Pill, Screen, SheetHeader, Text } from '../../src/ui';

function param(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? '';
}

export default function NewExerciseScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const { colors } = useTheme();
  const client = useQueryClient();
  const create = useCreateExercise();
  const [exerciseId] = useState(() => Crypto.randomUUID());
  const [name, setName] = useState(param(params.name));
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [equipment, setEquipment] = useState<Equipment | ''>('');
  const [track, setTrack] = useState<Track>('weight');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const valid = name.trim().length > 0 && muscle !== '' && equipment !== '';

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || muscle === '' || equipment === '') return;
    setSaving(true);
    setError(null);
    try {
      let created: Exercise | undefined;
      const pending = create
        .mutateAsync({
          id: exerciseId,
          name: trimmed,
          muscleGroup: muscle,
          equipment,
          track,
        })
        .then((exercise) => {
          created = exercise;
          return exercise;
        });
      await leaveWhenQueued(pending, () => pausedMutation(client, mutationKeys.createExercise));
      const exercise: Exercise = created ?? {
        id: exerciseId,
        ownerId: 'pending',
        slug: null,
        name: trimmed,
        muscleGroup: muscle,
        equipment,
        aliases: [],
        track,
      };
      client.setQueryData<Exercise[]>(keys.exercises, (current) => {
        if (!current) return [exercise];
        if (current.some((item) => item.id === exercise.id)) {
          return current.map((item) => (item.id === exercise.id ? exercise : item));
        }
        return [...current, exercise];
      });
      const draft = useDraft.getState();
      if (!draft.draft) draft.start();
      draft.addExercise(exercise.id);
      if (router.canDismiss()) router.dismiss(2);
      else dismiss();
    } catch (caught) {
      setSaving(false);
      setError(caught instanceof Error ? caught.message : 'Couldn’t save that exercise.');
    }
  };

  return (
    <Screen variant="sheet" scroll={false}>
      <SheetHeader title="New exercise" />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 12 }}
      >
        <Field
          label="Exercise name"
          value={name}
          onChangeText={setName}
          placeholder="Landmine Row"
        />
        <Text variant="overline" color="ink2" style={{ marginTop: 22 }}>
          Muscle group
        </Text>
        <View style={{ marginTop: 10 }}>
          <Pill
            options={MUSCLE_GROUPS.map((value) => ({ value, label: MUSCLE_LABELS[value] }))}
            value={muscle}
            onChange={setMuscle}
          />
        </View>
        <Text variant="overline" color="ink2" style={{ marginTop: 22 }}>
          Equipment
        </Text>
        <View style={{ marginTop: 10 }}>
          <Pill
            options={EQUIPMENT.map((value) => ({ value, label: EQUIPMENT_LABELS[value] }))}
            value={equipment}
            onChange={setEquipment}
          />
        </View>
        <Text variant="overline" color="ink2" style={{ marginTop: 22 }}>
          Logged as
        </Text>
        <View style={{ marginTop: 10 }}>
          <Pill
            options={TRACKS.map((value) => ({ value, label: TRACK_LABELS[value] }))}
            value={track}
            onChange={setTrack}
          />
        </View>
        {error ? (
          <Text variant="footnote" style={{ color: colors.danger, marginTop: 16 }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <Button label="Save" onPress={() => void save()} disabled={!valid} loading={saving} />
    </Screen>
  );
}
