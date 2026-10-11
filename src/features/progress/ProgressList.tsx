import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { liftImages } from '../../../assets/exercises';
import { searchExercises } from '../../lib/search';
import { useTheme } from '../../theme/ThemeProvider';
import { Banner, EmptyState, Field, Screen, Skeleton, Text } from '../../ui';
import { Sparkline } from '../../ui/LineChart';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { displayMeasure, formatCanonical, unitAbbrev } from './copy';
import { loggedExercises, type LoggedRow } from './logged';
import { useExerciseCatalog, useLoggedWorkouts, useProfileUnits } from './useProgress';

function RetryBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Couldn't load — Retry"
      onPress={onPress}
    >
      <Banner body="Couldn't load — Retry" />
    </Pressable>
  );
}

function LoadingRows() {
  return (
    <View style={{ marginTop: 20, gap: 16 }}>
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton width={48} height={48} radius={14} />
          <Skeleton width="46%" height={16} />
          <View style={{ flex: 1 }} />
          <Skeleton width={64} height={24} radius={8} />
        </View>
      ))}
    </View>
  );
}

function ExerciseRow({ row, valueLabel }: { row: LoggedRow; valueLabel: string }) {
  const { colors } = useTheme();
  const spark = row.series.map((point) => point.value);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.exercise.name}, ${valueLabel}`}
      onPress={() => router.push(`/exercise/${row.exercise.id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 68,
          paddingVertical: 10,
        }}
      >
        <ExerciseThumb exercise={row.exercise} size={48} />
        <Text variant="headline" numberOfLines={2} style={{ flex: 1 }}>
          {row.exercise.name}
        </Text>
        <Sparkline values={spark} />
        <Text variant="headline" style={{ minWidth: 72, textAlign: 'right' }}>
          {valueLabel}
        </Text>
      </View>
      <View style={{ height: 1, marginLeft: 60, backgroundColor: colors.hairline }} />
    </Pressable>
  );
}

export function ProgressList() {
  const [query, setQuery] = useState('');
  const exercises = useExerciseCatalog();
  const workouts = useLoggedWorkouts();
  const profile = useProfileUnits();
  const failed = exercises.isError || workouts.isError;
  const rows = useMemo(() => {
    if (!exercises.data || !workouts.data) return null;
    return loggedExercises(workouts.data, exercises.data, new Date());
  }, [exercises.data, workouts.data]);
  const system = profile.data?.unitSystem ?? 'imperial';
  const visible = useMemo(() => {
    if (!rows) return [];
    return searchExercises(
      rows.map((row) => ({
        ...row,
        name: row.exercise.name,
        aliases: row.exercise.aliases,
      })),
      query,
    );
  }, [rows, query]);

  const retry = () => {
    void exercises.refetch();
    void workouts.refetch();
    void profile.refetch();
  };

  return (
    <Screen>
      <Text variant="display" heading>
        Progress
      </Text>
      {failed ? (
        <View style={{ marginTop: 16 }}>
          <RetryBanner onPress={retry} />
        </View>
      ) : null}
      {rows == null && !failed ? <LoadingRows /> : null}
      {rows?.length === 0 ? (
        <EmptyState
          image={liftImages['back-squat']}
          title="Log a workout to see your progress"
          body="Each lift you finish gets a chart for its top set, estimated one-rep max, and volume."
        />
      ) : null}
      {rows && rows.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Field value={query} onChangeText={setQuery} placeholder="Search exercises" />
          {visible.length === 0 ? (
            <Text variant="body" color="ink2" style={{ textAlign: 'center', marginTop: 28 }}>
              No matching exercises
            </Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {visible.map((row) => {
                const latest = row.series[row.series.length - 1];
                const valueLabel = latest
                  ? `${formatCanonical(latest.value, row.metric, system)} ${unitAbbrev(row.metric, system)}`
                  : '—';
                const sparkRow: LoggedRow = {
                  ...row,
                  series: row.series.map((point) => ({
                    ...point,
                    value: displayMeasure(point.value, row.metric, system),
                  })),
                };
                return <ExerciseRow key={row.exercise.id} row={sparkRow} valueLabel={valueLabel} />;
              })}
            </View>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
