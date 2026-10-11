import { router } from 'expo-router';
import { Award, ChevronRight, Dumbbell, Footprints, LayoutList, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Cardio, Exercise, Workout } from '../../data/types';
import {
  dayDots,
  exerciseHistories,
  previousWeekBounds,
  recentSessions,
  summarizeWeek,
  weekBounds,
  weekDelta,
  weekTopSetRecords,
  type DayDot,
  type RecentRef,
  type WeekRecord,
} from '../../lib/week';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Screen,
  Skeleton,
  StatTile,
  Text,
  Thumb,
} from '../../ui';
import { activityMeta } from '../cardio/activities';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { trackOf, type Track } from '../exercises/tracks';
import { useExercises } from '../exercises/useExercises';
import { useDraft } from '../workout/draft';
import { useUnitSystem } from '../workout/useProfile';
import { useOfflineNotice, useTodayCardio, useTodayWorkouts, workoutSlices } from './api';
import {
  cardioMeta,
  cardioTitle,
  dayA11y,
  formatTodayOverline,
  recordCopy,
  strengthMeta,
  strengthTitle,
  summaryTiles,
} from './copy';

export function TodayScreen() {
  const workouts = useTodayWorkouts();
  const cardio = useTodayCardio();
  const exercises = useExercises();
  const system = useUnitSystem() ?? 'imperial';
  const offline = useOfflineNotice();
  const now = new Date();
  const retry = () => {
    void workouts.refetch();
    void cardio.refetch();
  };

  const blocked = (!workouts.data && workouts.isError) || (!cardio.data && cardio.isError);
  const pending = !blocked && (!workouts.data || !cardio.data);
  const staleError = Boolean(workouts.data && cardio.data && (workouts.isError || cardio.isError));

  return (
    <Screen>
      <Text variant="overline" color="ink2">
        {formatTodayOverline(now)}
      </Text>
      <Text variant="display" heading style={{ marginTop: 4 }}>
        This week
      </Text>
      {offline ? (
        <View style={{ marginTop: 16 }}>
          <Banner body={offline} />
        </View>
      ) : null}
      {staleError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry"
          onPress={retry}
          style={{ marginTop: 16 }}
        >
          <Banner body="Couldn't load — Retry" />
        </Pressable>
      ) : null}
      {blocked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry"
          onPress={retry}
          style={{ marginTop: 28 }}
        >
          <Banner body="Couldn't load — Retry" />
        </Pressable>
      ) : null}
      {pending ? <TodaySkeleton /> : null}
      {!pending && !blocked && workouts.data && cardio.data ? (
        <Week
          workouts={workouts.data}
          cardio={cardio.data}
          exercises={exercises.data ?? []}
          system={system}
          now={now}
        />
      ) : null}
    </Screen>
  );
}

function TodaySkeleton() {
  return (
    <View style={{ marginTop: 20, gap: 16 }}>
      <Skeleton width="100%" height={44} />
      <Skeleton width="100%" height={168} radius={20} />
      <Skeleton width="100%" height={52} radius={16} />
    </View>
  );
}

function Week({
  workouts,
  cardio,
  exercises,
  system,
  now,
}: {
  workouts: Workout[];
  cardio: Cardio[];
  exercises: Exercise[];
  system: 'imperial' | 'metric';
  now: Date;
}) {
  const { colors } = useTheme();
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  const catalog = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const slices = workoutSlices(workouts, catalog);
  const currentBounds = weekBounds(now);
  const priorBounds = previousWeekBounds(now);
  const current = summarizeWeek(slices, cardio, currentBounds);
  const prior = summarizeWeek(slices, cardio, priorBounds);
  const tiles = summaryTiles(current, weekDelta(current, prior), system);
  const dots = dayDots(workouts, cardio, now);
  const histories = exerciseHistories(slices, names);
  const records = weekTopSetRecords(histories, currentBounds);
  const headline = records[0];
  const recent = recentSessions(workouts, cardio);
  const empty = workouts.length === 0 && cardio.length === 0;

  return (
    <>
      <WeekStrip dots={dots} />
      {empty ? (
        <EmptyState
          icon={<Dumbbell color={colors.ink} size={64} strokeWidth={1.5} />}
          title="Your first session starts here."
          body="Log a lift or a run and your week fills in — volume, minutes, and new records."
          action={
            <>
              <StartWorkout />
              <TemplatesButton />
              <Button
                label="Log cardio"
                icon={Footprints}
                variant="secondary"
                onPress={() => router.push('/cardio/new')}
              />
            </>
          }
        />
      ) : (
        <>
          <Card testID="today-summary" style={{ marginTop: 20, padding: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Tile tile={tiles[0]} />
              <Tile tile={tiles[1]} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Tile tile={tiles[2]} />
              <Tile tile={tiles[3]} />
            </View>
          </Card>
          <View
            testID="today-cta"
            style={{ flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'stretch' }}
          >
            <View style={{ flex: 1.4 }}>
              <StartWorkout />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Cardio"
                icon={Footprints}
                variant="secondary"
                onPress={() => router.push('/cardio/new')}
              />
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <TemplatesButton />
          </View>
          {headline ? (
            <RecordBanner
              record={headline}
              extra={records.length - 1}
              system={system}
              track={trackOf(catalog.get(headline.exerciseId))}
            />
          ) : null}
          <Recent
            workouts={workouts}
            cardio={cardio}
            catalog={catalog}
            recent={recent}
            system={system}
            now={now}
          />
        </>
      )}
    </>
  );
}

function StartWorkout() {
  const active = useDraft((state) => Boolean(state.draft));
  return (
    <Button
      label={active ? 'Workout in progress' : 'Start workout'}
      icon={active ? undefined : Plus}
      disabled={active}
      onPress={() => router.push('/workout/active')}
    />
  );
}

function TemplatesButton() {
  return (
    <Button
      label="Templates"
      icon={LayoutList}
      variant="secondary"
      onPress={() => router.push('/templates')}
    />
  );
}

function RecordBanner({
  record,
  extra,
  system,
  track,
}: {
  record: WeekRecord;
  extra: number;
  system: 'imperial' | 'metric';
  track: Track;
}) {
  const copy = recordCopy(record, extra, system, track);
  const banner = <Banner tone="pr" icon={Award} title={copy.title} body={copy.body} />;
  if (!record.workoutId) return <View style={{ marginTop: 14 }}>{banner}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}. ${record.name}`}
      onPress={() => router.push(`/workout/${record.workoutId}`)}
      style={{ marginTop: 14 }}
    >
      {banner}
    </Pressable>
  );
}

function Tile({ tile }: { tile: ReturnType<typeof summaryTiles>[number] | undefined }) {
  if (!tile) return null;
  return (
    <View style={{ flex: 1 }}>
      <StatTile
        label={tile.label}
        value={tile.value}
        unit={tile.unit}
        delta={tile.delta}
        deltaTone={tile.deltaTone}
      />
    </View>
  );
}

function WeekStrip({ dots }: { dots: DayDot[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
      {dots.map((dot) => (
        <View
          key={dot.date.toISOString()}
          accessible
          accessibilityLabel={dayA11y(dot.date, dot.mark, dot.today)}
          style={{ width: 36, alignItems: 'center' }}
        >
          <Text variant="footnote" color={dot.today ? 'ink' : 'ink3'}>
            {dot.letter}
          </Text>
          <View
            style={{
              marginTop: 8,
              width: 18,
              height: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Dot mark={dot.mark} />
            {dot.today ? (
              <View
                style={{
                  position: 'absolute',
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: colors.ink,
                }}
              />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function Dot({ mark }: { mark: DayDot['mark'] }) {
  const { colors } = useTheme();
  if (mark === 'future') {
    return (
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.hairline,
        }}
      />
    );
  }
  if (mark === 'both') {
    return (
      <View
        style={{ width: 10, height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' }}
      >
        <View style={{ flex: 1, backgroundColor: colors.accent }} />
        <View style={{ flex: 1, backgroundColor: colors.cardio }} />
      </View>
    );
  }
  const background =
    mark === 'strength' ? colors.accent : mark === 'cardio' ? colors.cardio : colors.hairline;
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: background }} />;
}

function Recent({
  workouts,
  cardio,
  catalog,
  recent,
  system,
  now,
}: {
  workouts: Workout[];
  cardio: Cardio[];
  catalog: Map<string, Exercise>;
  recent: RecentRef[];
  system: 'imperial' | 'metric';
  now: Date;
}) {
  const { colors } = useTheme();
  const byWorkout = new Map(workouts.map((workout) => [workout.id, workout]));
  const byCardio = new Map(cardio.map((session) => [session.id, session]));
  return (
    <View style={{ marginTop: 22 }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Text variant="headline">Recent</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all sessions"
          onPress={() => router.push('/history')}
        >
          <Text variant="footnote" color="ink2">
            See all
          </Text>
        </Pressable>
      </View>
      <Card style={{ marginTop: 10 }}>
        {recent.map((item, index) => {
          const workout = item.kind === 'strength' ? byWorkout.get(item.id) : undefined;
          const session = item.kind === 'cardio' ? byCardio.get(item.id) : undefined;
          return (
            <View key={`${item.kind}-${item.id}`}>
              {index > 0 ? (
                <View style={{ height: 1, backgroundColor: colors.hairline, marginLeft: 74 }} />
              ) : null}
              {workout ? (
                <RecentStrength workout={workout} catalog={catalog} system={system} now={now} />
              ) : null}
              {session ? <RecentCardio session={session} system={system} now={now} /> : null}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function Chevron({ color }: { color: string }) {
  return <ChevronRight color={color} size={18} strokeWidth={1.9} />;
}

function RecentStrength({
  workout,
  catalog,
  system,
  now,
}: {
  workout: Workout;
  catalog: Map<string, Exercise>;
  system: 'imperial' | 'metric';
  now: Date;
}) {
  const { colors } = useTheme();
  const title = strengthTitle(workout);
  const meta = strengthMeta(workout, catalog, system, now);
  const first = workout.exercises.slice().sort((a, b) => a.position - b.position)[0];
  const known = first ? catalog.get(first.exerciseId) : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${meta}`}
      onPress={() => router.push(`/workout/${workout.id}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
    >
      <ExerciseThumb
        exercise={
          known ?? {
            slug: null,
            ownerId: 'missing',
            name: 'Exercise',
            muscleGroup: 'full_body',
          }
        }
      />
      <View style={{ flex: 1 }}>
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="footnote" color="ink2" style={{ marginTop: 2 }}>
          {meta}
        </Text>
      </View>
      <Chevron color={colors.ink3} />
    </Pressable>
  );
}

function RecentCardio({
  session,
  system,
  now,
}: {
  session: Cardio;
  system: 'imperial' | 'metric';
  now: Date;
}) {
  const { colors } = useTheme();
  const meta = activityMeta(session.activity);
  const Icon = meta.icon;
  const title = cardioTitle(session);
  const detail = cardioMeta(session, system, now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail.line}${detail.pace ? `, ${detail.pace}` : ''}`}
      onPress={() => router.push(`/cardio/${session.id}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
    >
      <Thumb tone="cardio" icon={<Icon color={colors.cardio} size={22} strokeWidth={1.9} />} />
      <View style={{ flex: 1 }}>
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="footnote" color="ink2" style={{ marginTop: 2 }}>
          {detail.line}
          {detail.pace ? ' · ' : ''}
          {detail.pace ? (
            <Text variant="footnote" style={{ color: colors.cardio }}>
              {detail.pace}
            </Text>
          ) : null}
        </Text>
      </View>
      <Chevron color={colors.ink3} />
    </Pressable>
  );
}
