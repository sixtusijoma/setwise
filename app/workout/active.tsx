import { router } from 'expo-router';
import { ChevronDown, Ellipsis, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQueryClient } from '@tanstack/react-query';

import { mutationKeys } from '../../src/data/queryClient';
import { leaveWhenQueued, pausedMutation } from '../../src/data/sync';
import { previousSets } from '../../src/features/exercises/history';
import { useExercises, useRecentWorkouts } from '../../src/features/exercises/useExercises';
import { ConfirmDialog, MenuSheet } from '../../src/features/workout/dialogs';
import {
  displayTitle,
  finishPrompt,
  prepareFinish,
  progressLabel,
  useDraft,
  type Draft,
} from '../../src/features/workout/draft';
import { ExerciseCard } from '../../src/features/workout/ExerciseCard';
import { RestTimer } from '../../src/features/workout/RestTimer';
import { useSaveWorkout } from '../../src/features/workout/useSaveWorkout';
import { SaveTemplateDialog } from '../../src/features/templates/SaveTemplateDialog';
import { templateFromDraft } from '../../src/features/templates/templates';
import { useDraftHydrated, useNow } from '../../src/features/workout/useNow';
import { useUnitSystem } from '../../src/features/workout/useProfile';
import { formatDuration } from '../../src/lib/units';
import { dismiss } from '../../src/lib/nav';
import { fontFamily } from '../../src/theme/fonts';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Banner, IconButton, Skeleton, Text } from '../../src/ui';
import { noBrowserOutline } from '../../src/ui/inputStyle';

export default function ActiveWorkoutScreen() {
  const hydrated = useDraftHydrated();
  const draft = useDraft((state) => state.draft);
  const start = useDraft((state) => state.start);
  const system = useUnitSystem();

  useEffect(() => {
    if (!hydrated) return;
    if (!useDraft.getState().draft) start();
  }, [hydrated, start]);

  if (!hydrated || !draft || !system) return <Loading />;
  return <Editor system={system} />;
}

function Loading() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
      }}
    >
      <Skeleton height={36} width={160} />
      <View style={{ marginTop: 28 }}>
        <Skeleton height={34} width="70%" />
      </View>
      <View style={{ marginTop: 20 }}>
        <Skeleton height={160} width="100%" />
      </View>
    </View>
  );
}

function Editor({ system }: { system: 'imperial' | 'metric' }) {
  const { colors, gutter } = useTheme();
  const insets = useSafeAreaInsets();
  const draft = useDraft((state) => state.draft);
  const setTitle = useDraft((state) => state.setTitle);
  const discard = useDraft((state) => state.discard);
  const clearRest = useDraft((state) => state.clearRest);
  const exercises = useExercises();
  const workouts = useRecentWorkouts();
  const save = useSaveWorkout();
  const client = useQueryClient();
  const now = useNow();
  const [menu, setMenu] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [naming, setNaming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [seenUnit, setSeenUnit] = useState(system);
  if (seenUnit !== system) {
    setSeenUnit(system);
    useDraft.getState().reformat(system);
  }

  if (!draft) return <Loading />;

  const elapsed = formatDuration(Math.max(0, (now - Date.parse(draft.startedAt)) / 1000));
  const byId = new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise]));
  const ready = draft.exercises.some((exercise) =>
    exercise.sets.some((set) => set.weightText.trim() !== '' || set.repsText.trim() !== ''),
  );

  const finish = async () => {
    const result = prepareFinish(draft, new Date().toISOString());
    if (!result.ok) {
      setError(result.message);
      setConfirmFinish(null);
      return;
    }
    setError(null);
    try {
      await leaveWhenQueued(save.mutateAsync(result.input), () =>
        pausedMutation(client, mutationKeys.saveWorkout),
      );
      clearRest();
      discard();
      dismiss();
    } catch (caught) {
      setConfirmFinish(null);
      setError(caught instanceof Error ? caught.message : 'Couldn’t save this workout.');
    }
  };

  // Save keeps the workout open: it upserts what's logged so far under the same id, and Finish later replaces it.
  const saveProgress = async () => {
    const result = prepareFinish(draft, new Date().toISOString());
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    try {
      await leaveWhenQueued(save.mutateAsync(result.input), () =>
        pausedMutation(client, mutationKeys.saveWorkout),
      );
      setSaved(draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save this workout.');
    }
  };

  const requestFinish = () => {
    const result = prepareFinish(draft, new Date().toISOString());
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const prompt = finishPrompt(result.dropped);
    if (prompt) {
      setConfirmFinish(prompt);
      return;
    }
    void finish();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: gutter,
        }}
      >
        <IconButton icon={ChevronDown} label="Minimize" onPress={dismiss} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.accent,
            }}
          />
          <Text variant="headline">{elapsed}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {draft.endedAt ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save progress"
              accessibilityState={{ disabled: !ready || save.isPending || saved === draft }}
              disabled={!ready || save.isPending || saved === draft}
              onPress={() => void saveProgress()}
              style={{
                height: 36,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: colors.sunken,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !ready || save.isPending ? 0.4 : 1,
              }}
            >
              <Text variant="footnote" style={{ fontFamily: fontFamily.semibold }}>
                {saved === draft ? 'Saved' : 'Save'}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={draft.endedAt ? 'Save' : 'Finish'}
            accessibilityState={{ disabled: !ready || save.isPending }}
            disabled={!ready || save.isPending}
            onPress={requestFinish}
            style={{
              height: 36,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !ready || save.isPending ? 0.4 : 1,
            }}
          >
            <Text
              variant="footnote"
              style={{ color: colors.accentInk, fontFamily: fontFamily.semibold }}
            >
              {draft.endedAt ? 'Save' : 'Finish'}
            </Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingBottom: insets.bottom + (draft.restEndsAt ? 96 : 28),
          flexGrow: 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
          <TextInput
            value={draft.title}
            onChangeText={setTitle}
            placeholder={displayTitle(draft)}
            placeholderTextColor={colors.ink3}
            accessibilityLabel="Workout title"
            maxFontSizeMultiplier={1.6}
            style={{
              flex: 1,
              color: colors.ink,
              fontFamily: fontFamily.serif,
              fontSize: 30,
              lineHeight: 34,
              padding: 0,
              ...noBrowserOutline,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Workout options"
            hitSlop={8}
            onPress={() => setMenu(true)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ellipsis color={colors.ink3} size={20} strokeWidth={2.25} />
          </Pressable>
        </View>
        <Text variant="footnote" color="ink2" style={{ marginTop: 4 }}>
          {progressLabel(draft, byId, system)}
        </Text>
        {error ? (
          <View style={{ marginTop: 16 }}>
            <Banner body={error} />
          </View>
        ) : null}
        {notice ? (
          <View style={{ marginTop: 16 }}>
            <Banner tone="pr" body={notice} />
          </View>
        ) : null}
        {draft.exercises.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
            onPress={() => router.push('/exercise/picker')}
            style={{
              marginTop: 16,
              height: 52,
              borderRadius: 20,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.hairline,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Plus color={colors.ink2} size={18} strokeWidth={2.25} />
            <Text variant="headline" color="ink2">
              Add exercise
            </Text>
          </Pressable>
        ) : null}
        {draft.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            index={index}
            count={draft.exercises.length}
            info={byId.get(exercise.exerciseId)}
            previous={previousSets(workouts.data ?? [], exercise.exerciseId, draft.id)}
            system={system}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            draft.exercises.length === 0 ? 'Add your first exercise' : 'Add exercise'
          }
          onPress={() => router.push('/exercise/picker')}
          style={{
            marginTop: draft.exercises.length === 0 ? 28 : 12,
            height: draft.exercises.length === 0 ? 120 : 52,
            borderRadius: 20,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.hairline,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Plus
            color={colors.ink2}
            size={draft.exercises.length === 0 ? 22 : 18}
            strokeWidth={2.25}
          />
          <Text variant="headline" color="ink2">
            {draft.exercises.length === 0 ? 'Add your first exercise' : 'Add exercise'}
          </Text>
        </Pressable>
      </ScrollView>
      {draft.restEndsAt ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: gutter,
            right: gutter,
            bottom: insets.bottom + 12,
          }}
        >
          <RestTimer endsAt={draft.restEndsAt} />
        </View>
      ) : null}
      {menu ? (
        <MenuSheet
          title="Workout"
          actions={[
            {
              label: 'Save as template',
              onPress: () => {
                setMenu(false);
                setNaming(true);
              },
            },
            {
              label: 'Discard workout',
              danger: true,
              onPress: () => {
                setMenu(false);
                setConfirmDiscard(true);
              },
            },
          ]}
          onClose={() => setMenu(false)}
        />
      ) : null}
      {naming ? (
        <SaveTemplateDialog
          initialName={displayTitle(draft)}
          build={(name) => templateFromDraft(draft, name)}
          onClose={(name) => {
            setNaming(false);
            if (name) setNotice(`Saved as template “${name}”.`);
          }}
        />
      ) : null}
      {confirmDiscard ? (
        <ConfirmDialog
          title="Discard this workout?"
          confirmLabel="Discard"
          cancelLabel="Keep it"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            discard();
            dismiss();
          }}
        />
      ) : null}
      {confirmFinish ? (
        <ConfirmDialog
          title={confirmFinish}
          confirmLabel="Finish workout"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmFinish(null)}
          onConfirm={() => {
            setConfirmFinish(null);
            void finish();
          }}
        />
      ) : null}
    </View>
  );
}
