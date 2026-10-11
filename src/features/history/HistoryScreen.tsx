import { router } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Exercise } from '../../data/types';

import { formatWeekTitle } from '../../lib/dates';
import { formatVolume, weightUnit, type UnitSystem } from '../../lib/units';
import { useTheme } from '../../theme/ThemeProvider';
import { Banner, Button, EmptyState, Segmented, Skeleton, Text } from '../../ui';
import { useExercises } from '../exercises/useExercises';
import { useUnitSystem } from '../workout/useProfile';
import { useHistory, type SessionRow } from './api';
import { CardioCard, StrengthCard } from './cards';
import { formatWeekSummary, groupByWeek, type HistoryFilter } from './merge';
import { workoutVolumeKg } from './records';

const filters = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
] as const;

const copy = {
  all: {
    title: 'Nothing logged yet',
    body: 'Finished workouts and cardio land here, newest week first.',
  },
  strength: {
    title: 'No strength yet',
    body: 'A finished workout will show its sets, volume, and any records.',
  },
  cardio: {
    title: 'No cardio yet',
    body: 'Runs, rides, and rows show up here with pace when you log a distance.',
  },
} as const;

type WeekSection = {
  key: string;
  title: string;
  meta: string;
  data: SessionRow[];
};

export function HistoryScreen() {
  const { colors, gutter } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const history = useHistory(filter);
  const system = useUnitSystem() ?? 'imperial';
  const exercises = useExercises();
  const catalog = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );
  const records = useMemo(() => new Set(history.records), [history.records]);
  const now = new Date();
  const sections = weekSections(history.items, catalog, system, now);
  const empty = copy[filter];
  const showSkeleton = history.pending && history.items.length === 0;
  const allowMore = useRef(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await history.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SectionList
        testID="history-list"
        sections={showSkeleton ? [] : sections}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        stickySectionHeadersEnabled={false}
        removeClippedSubviews={false}
        onEndReached={() => {
          if (allowMore.current) history.loadMore();
        }}
        onEndReachedThreshold={0.4}
        scrollEventThrottle={16}
        onScroll={(event) => {
          if (event.nativeEvent.contentOffset.y > 48) allowMore.current = true;
          if (allowMore.current) history.loadMore();
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.ink}
            colors={[colors.accent]}
          />
        }
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 12,
          paddingHorizontal: gutter,
          paddingBottom: insets.bottom + 96,
        }}
        ListHeaderComponent={
          <View>
            <Text variant="display" heading>
              History
            </Text>
            <View style={{ marginTop: 16 }}>
              <Segmented options={[...filters]} value={filter} onChange={setFilter} />
            </View>
            {history.failed && history.items.length > 0 ? (
              <LoadError onRetry={() => void history.refresh()} />
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 22,
            }}
          >
            <Text variant="overline" color="ink2">
              {section.title}
            </Text>
            <Text variant="footnote" color="ink2" style={{ flexShrink: 1, textAlign: 'right' }}>
              {section.meta}
            </Text>
          </View>
        )}
        renderItem={({ item }) =>
          item.kind === 'strength' ? (
            <StrengthCard
              row={item}
              exercises={catalog}
              records={records}
              system={system}
              now={now}
            />
          ) : (
            <CardioCard row={item} system={system} now={now} />
          )
        }
        ListEmptyComponent={
          showSkeleton ? (
            <HistorySkeleton />
          ) : history.failed ? (
            <LoadError onRetry={() => void history.refresh()} />
          ) : (
            <EmptyState
              icon={<CalendarDays color={colors.ink} size={56} strokeWidth={1.5} />}
              title={empty.title}
              body={empty.body}
              action={
                filter === 'cardio' ? (
                  <Button
                    label="Log cardio"
                    variant="secondary"
                    onPress={() => router.push('/cardio/new')}
                  />
                ) : (
                  <Button
                    label="Start workout"
                    icon={Plus}
                    onPress={() => router.push('/workout/active')}
                  />
                )
              }
            />
          )
        }
        ListFooterComponent={
          history.loadingMore ? (
            <View style={{ marginTop: 10 }}>
              <Skeleton width="100%" height={88} radius={20} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

function weekSections(
  items: SessionRow[],
  catalog: Map<string, Exercise>,
  system: UnitSystem,
  now: Date,
): WeekSection[] {
  return groupByWeek(items).map((group) => {
    const volume = group.items.reduce(
      (sum, item) => sum + (item.kind === 'strength' ? workoutVolumeKg(item.workout, catalog) : 0),
      0,
    );
    return {
      key: group.key,
      title: formatWeekTitle(group.start, now),
      meta: formatWeekSummary(
        group.items.length,
        volume > 0 ? `${formatVolume(volume, system)} ${weightUnit(system)}` : null,
      ),
      data: group.items,
    };
  });
}

function HistorySkeleton() {
  return (
    <View style={{ gap: 10, marginTop: 22 }}>
      <Skeleton width="42%" height={14} />
      <Skeleton width="100%" height={96} radius={20} />
      <Skeleton width="100%" height={76} radius={20} />
      <Skeleton width="100%" height={96} radius={20} />
    </View>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Couldn't load — Retry"
      onPress={onRetry}
      style={{ marginTop: 16 }}
    >
      <Banner body="Couldn't load — Retry" />
    </Pressable>
  );
}
