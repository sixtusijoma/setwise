import { ChevronLeft, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { UnitSystem } from '../../lib/units';
import { formatDuration, formatVolume, formatWeight, weightUnit } from '../../lib/units';
import {
  bestEfforts,
  chartSeries,
  inRange,
  personalRecords,
  totalReps,
  usesBodyweight,
  volumeKg,
  type Metric,
  type RangeId,
  type SessionInput,
} from '../../lib/stats';
import { dismiss } from '../../lib/nav';
import { fontFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import { Banner, Card, IconButton, Pill, Screen, Segmented, Skeleton, Text } from '../../ui';
import { DetailStub } from '../../ui/DetailStub';
import { LineChart } from '../../ui/LineChart';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import type { ExerciseArtInput } from '../exercises/images';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../exercises/labels';
import { timed, trackOf } from '../exercises/tracks';
import {
  chartSummary,
  deltaLabel,
  displayMeasure,
  formatCanonical,
  formatShown,
  rangePhrase,
  RANGES,
  REPS_METRICS,
  TIME_METRICS,
  tooltipLabel,
  unitAbbrev,
  WEIGHTED_METRICS,
  WEIGHTED_TIME_METRICS,
  sessionHeading,
} from './copy';
import { sessionInputs } from './logged';
import { useExerciseCatalog, useExerciseSessions, useProfileUnits } from './useProgress';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Missing() {
  const { colors } = useTheme();
  return (
    <DetailStub
      title="Exercise"
      body="Log this lift to see a trend."
      icon={<TrendingUp color={colors.ink} size={56} strokeWidth={1.5} />}
    />
  );
}

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

function DetailSkeleton() {
  return (
    <Screen variant="stack">
      <Skeleton width={36} height={36} radius={18} />
      <Skeleton width="70%" height={40} radius={12} />
      <Skeleton width="48%" height={14} />
      <Skeleton width="100%" height={38} radius={12} />
      <Skeleton width="46%" height={56} />
      <Skeleton width="100%" height={190} radius={12} />
    </Screen>
  );
}

function RecordTile({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12 }}>
      <Text variant="footnote" color="ink2" numberOfLines={1}>
        {label}
      </Text>
      <Text
        variant="headline"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{ marginTop: 2 }}
      >
        {value}
      </Text>
    </Card>
  );
}

function ChartBody({
  name,
  meta,
  art,
  bodyweight,
  timed,
  sessions,
  system,
  onRetry,
}: {
  name: string;
  meta: string;
  art: ExerciseArtInput;
  bodyweight: boolean;
  timed: boolean;
  sessions: SessionInput[];
  system: UnitSystem;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const options = bodyweight
    ? timed
      ? TIME_METRICS
      : REPS_METRICS
    : timed
      ? WEIGHTED_TIME_METRICS
      : WEIGHTED_METRICS;
  const count = (reps: number) => (timed ? formatDuration(reps) : String(reps));
  const [metric, setMetric] = useState<Metric>(bodyweight ? 'maxReps' : 'e1rm');
  const [range, setRange] = useState<RangeId>('3M');
  const selected = options.some((option) => option.value === metric) ? metric : options[0].value;
  const now = new Date();
  const series = chartSeries(sessions, selected, range, now);
  const canonical = series.map((point) => point.value);
  const summary = chartSummary(selected, system, canonical, range);
  const delta = deltaLabel(selected, system, canonical);
  const latest = series[series.length - 1]?.value;
  const hero = latest == null ? '—' : formatCanonical(latest, selected, system);
  const unit = latest == null ? null : unitAbbrev(selected, system);
  const inWindow = sessions.filter((session) => inRange(session.date, range, now)).length;
  const caption =
    series.length === 1
      ? 'One more session to see a trend.'
      : series.length === 0 && inWindow === 0
        ? 'No sessions in this range.'
        : series.length === 0
          ? 'Nothing to chart for this metric yet.'
          : null;
  const efforts = bestEfforts(sessions);
  const records = personalRecords(sessions);
  const highlights = new Set(
    records
      .filter((record) => record.kind === 'topSet' && record.setIndex != null)
      .map((record) => `${record.id}:${record.setIndex}`),
  );
  const tone =
    delta?.tone === 'positive'
      ? colors.accent
      : delta?.tone === 'negative'
        ? colors.ink2
        : colors.ink3;

  const longest = {
    label: timed ? 'Longest' : 'Max reps',
    value: efforts.maxReps ? count(efforts.maxReps.reps) : '—',
  };
  const total = {
    label: timed ? 'Total time' : 'Total reps',
    value: count(sessions.reduce((sum, session) => sum + totalReps(session.sets), 0)),
  };
  const heaviest = {
    label: 'Heaviest',
    value: efforts.heaviest
      ? `${formatWeight(efforts.heaviest.weightKg, system)} × ${count(efforts.heaviest.reps)}`
      : '—',
  };
  const recordTiles = bodyweight
    ? [
        longest,
        {
          label: 'Best session',
          value: efforts.bestSessionReps ? count(efforts.bestSessionReps.reps) : '—',
        },
        total,
      ]
    : timed
      ? [heaviest, longest, total]
      : [
          heaviest,
          {
            label: 'Best e1RM',
            value: efforts.bestE1rm
              ? formatCanonical(efforts.bestE1rm.weightKg, 'e1rm', system)
              : '—',
          },
          {
            label: 'Best volume',
            value: efforts.bestVolume ? formatVolume(efforts.bestVolume.weightKg, system) : '—',
          },
        ];

  const history = sessions.slice().reverse();

  return (
    <Screen variant="stack">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
        }}
      >
        <IconButton icon={ChevronLeft} label="Back" onPress={dismiss} />
        <ExerciseThumb size={36} exercise={art} />
      </View>
      <Text variant="display" heading style={{ marginTop: 6 }}>
        {name}
      </Text>
      <Text variant="footnote" color="ink2" style={{ marginTop: 4 }}>
        {meta}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: 16 }}>
          <RetryBanner onPress={onRetry} />
        </View>
      ) : null}
      <View style={{ marginTop: 16 }}>
        <Segmented options={options} value={selected} onChange={setMetric} />
      </View>
      <View style={{ marginTop: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <Text
            variant="statXL"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ flexShrink: 1 }}
          >
            {hero}
          </Text>
          {unit ? (
            <Text variant="headline" color="ink2" style={{ marginBottom: 8 }}>
              {unit}
            </Text>
          ) : null}
        </View>
        {delta ? (
          <Text
            variant="footnote"
            style={{ color: tone, fontFamily: fontFamily.semibold, marginTop: 2 }}
          >
            {delta.text}{' '}
            <Text variant="footnote" color="ink2">
              {rangePhrase(range)}
            </Text>
          </Text>
        ) : null}
      </View>
      <View style={{ marginTop: 8 }}>
        <LineChart
          accessibilityLabel={summary}
          formatTick={(value) => formatShown(value, selected)}
          points={series.map((point) => ({
            date: point.date,
            value: displayMeasure(point.value, selected, system),
            label: tooltipLabel(point.date, selected, system, point.value),
          }))}
        />
      </View>
      {caption ? (
        <Text variant="footnote" color="ink2" style={{ marginTop: 4 }}>
          {caption}
        </Text>
      ) : null}
      <View style={{ marginTop: caption ? 12 : 4 }}>
        <Pill options={RANGES} value={range} onChange={setRange} />
      </View>
      <Text variant="headline" style={{ marginTop: 20 }}>
        Records
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {recordTiles.map((tile) => (
          <RecordTile key={tile.label} label={tile.label} value={tile.value} />
        ))}
      </View>
      <View style={{ marginTop: 8 }}>
        {history.map((session, index) => {
          const sets = session.sets.filter((set) => set.reps > 0);
          const countLabel = `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
          const amount = timed
            ? formatDuration(totalReps(session.sets))
            : bodyweight
              ? `${totalReps(session.sets)} reps`
              : `${formatVolume(volumeKg(session.sets), system)} ${weightUnit(system)}`;
          return (
            // The same lift can appear twice in one workout, so id and date alone repeat.
            <View key={`${session.id}-${index}`} style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text variant="headline">{sessionHeading(session.date, now)}</Text>
                <Text variant="footnote" color="ink2">
                  {countLabel} · {amount}
                </Text>
              </View>
              <Text variant="footnote" color="ink2" style={{ marginTop: 4 }}>
                {sets.map((set, index) => {
                  const marked = highlights.has(`${session.id}:${session.sets.indexOf(set)}`);
                  const label = bodyweight
                    ? count(set.reps)
                    : `${formatWeight(set.weightKg, system)} × ${count(set.reps)}`;
                  return (
                    <Text
                      key={`${label}-${index}`}
                      variant="footnote"
                      style={{
                        color: marked ? colors.pr : colors.ink2,
                        fontFamily: marked ? fontFamily.semibold : fontFamily.regular,
                      }}
                    >
                      {index > 0 ? ' · ' : ''}
                      {label}
                    </Text>
                  );
                })}
              </Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function ExerciseChart({ id }: { id: string }) {
  const history = useExerciseSessions(id, true);
  const catalog = useExerciseCatalog();
  const profile = useProfileUnits();
  const failed = history.isError || catalog.isError;
  const pending =
    (history.isPending && !history.data) ||
    (catalog.isPending && !catalog.data) ||
    (profile.isPending && !profile.data);

  const retry = () => {
    void history.refetch();
    void catalog.refetch();
    void profile.refetch();
  };

  if (pending) return <DetailSkeleton />;
  if (failed && !history.data) {
    return (
      <Screen variant="stack">
        <IconButton icon={ChevronLeft} label="Back" onPress={dismiss} />
        <View style={{ marginTop: 16 }}>
          <RetryBanner onPress={retry} />
        </View>
      </Screen>
    );
  }

  const exercise = catalog.data?.find((item) => item.id === id);
  const track = trackOf(exercise);
  const sessions = sessionInputs(history.data ?? [], track).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  if (!exercise && sessions.length === 0) return <Missing />;

  const count = sessions.length;
  const meta = exercise
    ? `${EQUIPMENT_LABELS[exercise.equipment]} · ${MUSCLE_LABELS[exercise.muscleGroup]} · ${count} ${count === 1 ? 'session' : 'sessions'}`
    : `${count} ${count === 1 ? 'session' : 'sessions'}`;

  return (
    <ChartBody
      key={`${id}:${usesBodyweight(sessions) ? 'reps' : 'weight'}`}
      name={exercise?.name ?? 'Exercise'}
      meta={meta}
      art={
        exercise ?? {
          slug: null,
          ownerId: 'missing',
          name: 'Exercise',
          muscleGroup: 'full_body',
        }
      }
      bodyweight={usesBodyweight(sessions)}
      timed={timed(track)}
      sessions={sessions}
      system={profile.data?.unitSystem ?? 'imperial'}
      onRetry={failed ? retry : undefined}
    />
  );
}

export function ExerciseProgress({ id }: { id: string }) {
  if (!UUID.test(id)) return <Missing />;
  return <ExerciseChart id={id} />;
}
