import { router, useFocusEffect } from 'expo-router';
import { Award, ChevronLeft, Dumbbell, Ellipsis } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import type { Workout, WorkoutSet } from '../../data/types';
import { formatDateTime, formatSessionLength } from '../../lib/dates';
import { dismiss } from '../../lib/nav';
import { formatVolume, weightUnit, type UnitSystem } from '../../lib/units';
import { fontFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import { Banner, Button, Card, IconButton, Screen, Skeleton, StatTile, Text } from '../../ui';
import { DetailStub } from '../../ui/DetailStub';
import { previousLabel } from '../exercises/history';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../exercises/labels';
import { trackOf, type Track } from '../exercises/tracks';
import { useExercises } from '../exercises/useExercises';
import { SaveTemplateDialog } from '../templates/SaveTemplateDialog';
import { templateFromWorkout } from '../templates/templates';
import { ConfirmDialog, MenuSheet } from '../workout/dialogs';
import { defaultTitle, useDraft } from '../workout/draft';
import { useDraftHydrated } from '../workout/useNow';
import { useUnitSystem } from '../workout/useProfile';
import { useLoggedWorkouts } from '../progress/useProgress';
import { useDeleteWorkout, useRecordKeys, useWorkout } from './api';
import { allTimeReminderLabel, recordKey, workoutSetCount, workoutVolumeKg } from './records';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function WorkoutDetail({ id }: { id: string }) {
  const realId = UUID.test(id);
  const workout = useWorkout(realId ? id : undefined);
  const refetch = workout.refetch;
  useFocusEffect(
    useCallback(() => {
      if (!realId) return undefined;
      void refetch();
      return undefined;
    }, [realId, refetch]),
  );

  if (!realId) return <Missing />;
  if (workout.isPending) return <Loading />;
  if (!workout.data) return <Missing />;
  return <Detail workout={workout.data} />;
}

function Detail({ workout }: { workout: Workout }) {
  const unitsReady = useUnitSystem();
  const system = unitsReady ?? 'imperial';
  const hydrated = useDraftHydrated();
  const exercises = useExercises();
  const records = useRecordKeys();
  const logged = useLoggedWorkouts();
  const remove = useDeleteWorkout();
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [replace, setReplace] = useState(false);
  const [naming, setNaming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prs = useMemo(() => new Set(records.data ?? []), [records.data]);
  const catalog = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );
  const title = workout.title?.trim() || defaultTitle(new Date(workout.startedAt));
  const seconds = Math.max(0, (Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 1000);
  const ordered = workout.exercises.slice().sort((a, b) => a.position - b.position);

  const openEditor = () => {
    if (!unitsReady || !hydrated) return;
    const draft = useDraft.getState().draft;
    if (draft && draft.id !== workout.id) {
      setMenu(false);
      setReplace(true);
      return;
    }
    if (!draft) useDraft.getState().loadForEdit(workout, unitsReady);
    setMenu(false);
    router.push('/workout/active');
  };

  const onDelete = async () => {
    setError(null);
    try {
      await remove.mutateAsync(workout.id);
      dismiss();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't delete this workout.");
    }
  };

  return (
    <Screen variant="stack">
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
        <IconButton icon={ChevronLeft} label="Back" onPress={dismiss} />
        <View style={{ flex: 1 }} />
        <IconButton icon={Ellipsis} label="Workout options" onPress={() => setMenu(true)} />
      </View>

      {confirming ? (
        <Card style={{ marginTop: 12, padding: 16 }}>
          <Text variant="headline">Delete this workout?</Text>
          <Text variant="footnote" color="ink2" style={{ marginTop: 4 }}>
            Removed from this device.
          </Text>
          {error ? (
            <Text variant="footnote" color="danger" style={{ marginTop: 8 }}>
              {error}
            </Text>
          ) : null}
          <View style={{ gap: 8, marginTop: 14 }}>
            <Button
              label="Delete workout"
              variant="danger"
              loading={remove.isPending}
              onPress={() => void onDelete()}
            />
            <Button label="Keep" variant="secondary" onPress={() => setConfirming(false)} />
          </View>
        </Card>
      ) : null}

      {notice ? (
        <View style={{ marginTop: 12 }}>
          <Banner tone="pr" body={notice} />
        </View>
      ) : null}

      <Text variant="title" heading style={{ marginTop: 18 }}>
        {title}
      </Text>
      <Text variant="footnote" color="ink2" style={{ marginTop: 4 }}>
        {formatDateTime(workout.startedAt)}
      </Text>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
        <View style={{ flex: 1 }}>
          <StatTile label="Duration" value={formatSessionLength(seconds)} />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile label="Sets" value={String(workoutSetCount(workout))} />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Volume"
            value={formatVolume(workoutVolumeKg(workout, catalog), system)}
            unit={weightUnit(system)}
          />
        </View>
      </View>

      {ordered.map((exercise) => {
        const info = catalog.get(exercise.exerciseId);
        const name = info?.name ?? 'Exercise';
        const meta = info
          ? `${EQUIPMENT_LABELS[info.equipment]} · ${MUSCLE_LABELS[info.muscleGroup]}`
          : null;
        const track = trackOf(info);
        const reminder = allTimeReminderLabel(
          exercise.exerciseId,
          track,
          logged.data ?? [],
          system,
        );
        return (
          <Card key={exercise.id} style={{ marginTop: 16, padding: 16 }}>
            <Text variant="headline">{name}</Text>
            {meta ? (
              <Text variant="footnote" color="ink2" style={{ marginTop: 2 }}>
                {meta}
              </Text>
            ) : null}
            {reminder ? (
              <Text variant="footnote" color="ink2" style={{ marginTop: 2 }}>
                {reminder}
              </Text>
            ) : null}
            <View style={{ gap: 8, marginTop: 12 }}>
              {exercise.sets
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((set) => (
                  <SetLine
                    key={set.id}
                    set={set}
                    system={system}
                    track={track}
                    pr={prs.has(recordKey(workout.id, set.id))}
                  />
                ))}
            </View>
            {exercise.notes ? (
              <Text variant="footnote" color="ink2" style={{ marginTop: 12 }}>
                {exercise.notes}
              </Text>
            ) : null}
          </Card>
        );
      })}

      {menu ? (
        <MenuSheet
          title={title}
          actions={[
            { label: 'Edit', onPress: openEditor },
            {
              label: 'Save as template',
              onPress: () => {
                setMenu(false);
                setNaming(true);
              },
            },
            {
              label: 'Delete',
              danger: true,
              onPress: () => {
                setMenu(false);
                setConfirming(true);
              },
            },
          ]}
          onClose={() => setMenu(false)}
        />
      ) : null}
      {naming ? (
        <SaveTemplateDialog
          initialName={title}
          build={(name) => templateFromWorkout(workout, name)}
          onClose={(name) => {
            setNaming(false);
            if (name) setNotice(`Saved as template “${name}”.`);
          }}
        />
      ) : null}
      {replace ? (
        <ConfirmDialog
          title="Discard the workout in progress?"
          confirmLabel="Discard"
          cancelLabel="Keep it"
          danger
          onCancel={() => setReplace(false)}
          onConfirm={() => {
            if (!unitsReady) return;
            useDraft.getState().loadForEdit(workout, unitsReady);
            setReplace(false);
            router.push('/workout/active');
          }}
        />
      ) : null}
    </Screen>
  );
}

function SetLine({
  set,
  system,
  track,
  pr,
}: {
  set: WorkoutSet;
  system: UnitSystem;
  track: Track;
  pr: boolean;
}) {
  const { colors } = useTheme();
  const label = previousLabel(set, system, track);
  return (
    <View
      accessibilityLabel={`${label}${pr ? ', personal record' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <Text
        variant="body"
        style={{
          color: pr ? colors.pr : colors.ink,
          fontFamily: pr ? fontFamily.semibold : fontFamily.regular,
        }}
      >
        {label}
      </Text>
      {pr ? <Award color={colors.pr} size={14} strokeWidth={2.2} /> : null}
    </View>
  );
}

function Loading() {
  return (
    <Screen variant="stack">
      <BackRow />
      <View style={{ gap: 12, marginTop: 20 }}>
        <Skeleton width="48%" height={34} />
        <Skeleton width="55%" height={18} />
        <Skeleton width="100%" height={72} radius={16} />
        <Skeleton width="100%" height={120} radius={20} />
      </View>
    </Screen>
  );
}

function Missing() {
  const { colors } = useTheme();
  return (
    <DetailStub
      title="Workout"
      icon={<Dumbbell color={colors.ink} size={56} strokeWidth={1.5} />}
      body="This session isn't on this device."
    />
  );
}

function BackRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
      <IconButton icon={ChevronLeft} label="Back" onPress={dismiss} />
    </View>
  );
}
