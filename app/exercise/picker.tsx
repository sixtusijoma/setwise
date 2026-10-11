import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import library from '../../data/exercise-library.json';
import {
  lastSetLabel,
  previousSets,
  recentExerciseIds,
} from '../../src/features/exercises/history';
import { ExerciseThumb } from '../../src/features/exercises/ExerciseThumb';
import { EQUIPMENT_LABELS, PICKER_GROUPS } from '../../src/features/exercises/labels';
import { trackOf } from '../../src/features/exercises/tracks';
import { useExercises, useRecentWorkouts } from '../../src/features/exercises/useExercises';
import { useDraft } from '../../src/features/workout/draft';
import { useUnitSystem } from '../../src/features/workout/useProfile';
import { dismiss } from '../../src/lib/nav';
import { searchExercises } from '../../src/lib/search';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { Exercise } from '../../src/data/types';
import {
  Banner,
  Button,
  Field,
  ListRow,
  Pill,
  Screen,
  SheetHeader,
  Skeleton,
  Text,
  Thumb,
} from '../../src/ui';

export default function ExercisePickerScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const exercises = useExercises();
  const workouts = useRecentWorkouts();
  const system = useUnitSystem() ?? 'imperial';
  const draftId = useDraft((state) => state.draft?.id);
  const count = exercises.data?.length ?? library.length;
  const muscles = PICKER_GROUPS.find((item) => item.value === group)?.muscles ?? null;

  const filtered = useMemo(() => {
    const list = (exercises.data ?? []).filter((exercise) =>
      muscles ? muscles.includes(exercise.muscleGroup) : true,
    );
    return searchExercises(list, query);
  }, [exercises.data, muscles, query]);

  const recent = useMemo(() => {
    if (query.trim()) return [];
    const byId = new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise]));
    return recentExerciseIds(workouts.data ?? [])
      .map((id) => byId.get(id))
      .filter((exercise): exercise is Exercise => Boolean(exercise))
      .filter((exercise) => (muscles ? muscles.includes(exercise.muscleGroup) : true));
  }, [exercises.data, workouts.data, muscles, query]);

  const recentIds = new Set(recent.map((exercise) => exercise.id));
  const grouped = query.trim()
    ? []
    : sections(filtered.filter((exercise) => !recentIds.has(exercise.id)));
  const trimmed = query.trim();
  const createLabel = trimmed ? `Create “${trimmed}”` : 'New exercise';

  const add = (exerciseId: string) => {
    const state = useDraft.getState();
    if (!state.draft) state.start();
    state.addExercise(exerciseId);
    dismiss();
  };

  return (
    <Screen variant="sheet" scroll={false}>
      <SheetHeader title="Add exercise" />
      <View style={{ marginTop: 16 }}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${count} exercises`}
          autoFocus
        />
      </View>
      <View style={{ marginTop: 12 }}>
        <Pill
          options={PICKER_GROUPS.map(({ value, label }) => ({ value, label }))}
          value={group}
          onChange={setGroup}
        />
      </View>
      <ScrollView style={{ flex: 1, marginTop: 8 }} keyboardShouldPersistTaps="handled">
        {exercises.isError ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <Banner body="Couldn't load — Retry" />
            <Button label="Retry" variant="secondary" onPress={() => exercises.refetch()} />
          </View>
        ) : null}
        {!exercises.data && !exercises.isError ? (
          <View style={{ gap: 12, marginTop: 12 }}>
            <Skeleton width="100%" height={64} />
            <Skeleton width="100%" height={64} />
            <Skeleton width="100%" height={64} />
          </View>
        ) : null}
        {recent.length > 0 ? (
          <Section title="Recent">
            {recent.map((exercise) => (
              <ExerciseChoice
                key={`recent-${exercise.id}`}
                exercise={exercise}
                last={lastSetLabel(
                  previousSets(workouts.data ?? [], exercise.id, draftId),
                  system,
                  trackOf(exercise),
                )}
                onPress={() => add(exercise.id)}
              />
            ))}
          </Section>
        ) : null}
        {query.trim() && exercises.data ? (
          filtered.length > 0 ? (
            <Section title={`${filtered.length} ${filtered.length === 1 ? 'match' : 'matches'}`}>
              {filtered.map((exercise) => (
                <ExerciseChoice
                  key={exercise.id}
                  exercise={exercise}
                  last={lastSetLabel(
                    previousSets(workouts.data ?? [], exercise.id, draftId),
                    system,
                    trackOf(exercise),
                  )}
                  onPress={() => add(exercise.id)}
                />
              ))}
            </Section>
          ) : (
            <Text variant="body" color="ink2" style={{ marginTop: 28, textAlign: 'center' }}>
              No match in the library.
            </Text>
          )
        ) : null}
        {grouped.map((section) => (
          <Section key={section.letter} title={section.letter}>
            {section.items.map((exercise) => (
              <ExerciseChoice
                key={exercise.id}
                exercise={exercise}
                last={lastSetLabel(
                  previousSets(workouts.data ?? [], exercise.id, draftId),
                  system,
                  trackOf(exercise),
                )}
                onPress={() => add(exercise.id)}
              />
            ))}
          </Section>
        ))}
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, marginTop: 8 }}>
        <ListRow
          title={createLabel}
          meta="Add a custom exercise"
          leading={<Thumb initials="+" size={48} />}
          showChevron={false}
          onPress={() => router.push({ pathname: '/exercise/new', params: { name: trimmed } })}
        />
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text variant="overline" color="ink2">
        {title}
      </Text>
      {children}
    </View>
  );
}

function ExerciseChoice({
  exercise,
  last,
  onPress,
}: {
  exercise: Exercise;
  last: string | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const meta = [EQUIPMENT_LABELS[exercise.equipment], last].filter(Boolean).join(' · ');
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
      <ListRow
        title={exercise.name}
        meta={meta}
        leading={<ExerciseThumb exercise={exercise} size={48} />}
        showChevron={false}
        onPress={onPress}
      />
    </View>
  );
}

function sections(items: Exercise[]): { letter: string; items: Exercise[] }[] {
  const sorted = items.slice().sort((a, b) => a.name.localeCompare(b.name));
  const groups: { letter: string; items: Exercise[] }[] = [];
  for (const item of sorted) {
    const letter = item.name[0]?.toUpperCase() ?? '#';
    const current = groups[groups.length - 1];
    if (!current || current.letter !== letter) groups.push({ letter, items: [item] });
    else current.items.push(item);
  }
  return groups;
}
