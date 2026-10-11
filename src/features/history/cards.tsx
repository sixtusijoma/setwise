import { router } from 'expo-router';
import { Award } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Exercise } from '../../data/types';
import { activityMeta } from '../cardio/activities';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { defaultTitle } from '../workout/draft';
import { formatPace, showsPace } from '../../lib/pace';
import { formatDayLabel, formatSessionLength } from '../../lib/dates';
import {
  distanceUnit,
  formatDistance,
  formatDuration,
  formatVolume,
  weightUnit,
  type UnitSystem,
} from '../../lib/units';
import { fontFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, Text, Thumb } from '../../ui';
import type { CardioRow, StrengthRow } from './api';
import { prLabel, recordKey, workoutSetCount, workoutVolumeKg } from './records';

export function StrengthCard({
  row,
  exercises,
  records,
  system,
  now,
}: {
  row: StrengthRow;
  exercises: Map<string, Exercise>;
  records: Set<string>;
  system: UnitSystem;
  now: Date;
}) {
  const { colors } = useTheme();
  const workout = row.workout;
  const title = workout.title?.trim() || defaultTitle(new Date(workout.startedAt));
  const seconds = Math.max(0, (Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 1000);
  const meta = `${formatDayLabel(new Date(workout.startedAt), now)} · ${formatSessionLength(seconds)}`;
  const sets = workoutSetCount(workout);
  const volume = `${formatVolume(workoutVolumeKg(workout, exercises), system)} ${weightUnit(system)}`;
  const prs = prLabel(
    workout.exercises.reduce(
      (sum, exercise) =>
        sum + exercise.sets.filter((set) => records.has(recordKey(workout.id, set.id))).length,
      0,
    ),
  );
  const thumbs = workout.exercises
    .slice()
    .sort((a, b) => a.position - b.position)
    .slice(0, 3);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${meta}, ${sets} sets, ${volume}${prs ? `, ${prs}` : ''}`}
      onPress={() => router.push(`/workout/${workout.id}`)}
      style={{ marginTop: 10 }}
    >
      <Card style={{ padding: 14 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text variant="headline" numberOfLines={1}>
              {title}
            </Text>
            <Text variant="footnote" color="ink2" style={{ marginTop: 2 }}>
              {meta}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', marginRight: 2 }}>
            {thumbs.map((exercise, index) => {
              const info = exercises.get(exercise.exerciseId);
              const name = info?.name ?? 'Exercise';
              return (
                <View
                  key={exercise.id}
                  style={{
                    marginLeft: index === 0 ? 0 : -8,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                >
                  <ExerciseThumb
                    size={28}
                    exercise={
                      info ?? {
                        slug: null,
                        ownerId: 'missing',
                        name,
                        muscleGroup: 'full_body',
                      }
                    }
                  />
                </View>
              );
            })}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
          <Stat label="Sets" value={String(sets)} />
          <Stat label="Volume" value={volume} />
          {prs ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Award color={colors.pr} size={14} strokeWidth={2.2} />
              <Text
                variant="footnote"
                style={{ color: colors.pr, fontFamily: fontFamily.semibold }}
              >
                {prs}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function CardioCard({
  row,
  system,
  now,
}: {
  row: CardioRow;
  system: UnitSystem;
  now: Date;
}) {
  const { colors } = useTheme();
  const session = row.cardio;
  const meta = activityMeta(session.activity);
  const Icon = meta.icon;
  const started = new Date(session.startedAt);
  const bits = [formatDayLabel(started, now)];
  if (session.distanceM) {
    bits.push(`${formatDistance(session.distanceM, system)} ${distanceUnit(system)}`);
  }
  bits.push(formatDuration(session.durationS));
  const line = bits.join(' · ');
  const pace =
    session.distanceM && showsPace(session.activity, session.distanceM)
      ? formatPace(session.distanceM, session.durationS)
      : null;
  const metric = system === 'metric';
  const paceText = pace ? `${metric ? pace.perKm : pace.perMile} ${metric ? '/km' : '/mi'}` : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}, ${line}${paceText ? `, ${paceText}` : ''}`}
      onPress={() => router.push(`/cardio/${session.id}`)}
      style={{ marginTop: 10 }}
    >
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <Thumb tone="cardio" icon={<Icon color={colors.cardio} size={22} strokeWidth={1.9} />} />
        <View style={{ flex: 1 }}>
          <Text variant="headline">{meta.label}</Text>
          <Text variant="footnote" color="ink2" style={{ marginTop: 2 }}>
            {line}
          </Text>
        </View>
        {paceText ? (
          <Text variant="headline" style={{ color: colors.cardio }}>
            {metric ? pace?.perKm : pace?.perMile}
            <Text variant="footnote" style={{ color: colors.cardio }}>
              {metric ? ' /km' : ' /mi'}
            </Text>
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <Text variant="footnote" color="ink2">
      {label}{' '}
      <Text variant="footnote" style={{ color: colors.ink, fontFamily: fontFamily.semibold }}>
        {value}
      </Text>
    </Text>
  );
}
