import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { dismiss } from '../../lib/nav';
import { formatDurationClock, showsPace } from '../../lib/pace';
import { fontFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import { distanceUnit, formatDistance } from '../../lib/units';
import { Button, Card, EmptyState, IconButton, Screen, Skeleton, Text, Thumb } from '../../ui';
import { ChevronLeft } from 'lucide-react-native';
import { activityMeta } from './activities';
import { useCardioSession, useDeleteCardio, useProfile } from './api';
import { PaceCallout } from './PaceCallout';
import { formatStarted } from './time';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function CardioDetail({ id }: { id: string }) {
  const realId = UUID.test(id);
  const session = useCardioSession(realId ? id : undefined);
  const profile = useProfile();
  const remove = useDeleteCardio();
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const system = profile.data?.unitSystem ?? 'imperial';

  if (!realId || session.data === null || (session.isSuccess && !session.data)) {
    return (
      <Screen variant="stack">
        <BackRow />
        <Text variant="display" heading style={{ marginTop: 8 }}>
          Cardio
        </Text>
        <EmptyState title="This session isn't on this device." />
      </Screen>
    );
  }

  if (!session.data) {
    return (
      <Screen variant="stack">
        <BackRow />
        <View style={{ gap: 12, marginTop: 20 }}>
          <Skeleton width="40%" height={34} />
          <Skeleton width="55%" height={58} />
          <Skeleton width="100%" height={88} radius={16} />
        </View>
      </Screen>
    );
  }

  const cardio = session.data;
  const meta = activityMeta(cardio.activity);
  const Icon = meta.icon;
  const pace = Boolean(cardio.distanceM && showsPace(cardio.activity, cardio.distanceM));

  async function onDelete() {
    setError(null);
    try {
      await remove.mutateAsync(id);
      dismiss();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't delete this session.");
    }
  }

  return (
    <Screen variant="stack">
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
        <IconButton icon={ChevronLeft} label="Back" onPress={dismiss} />
        <View style={{ flex: 1 }} />
        <HeaderAction
          label="Edit"
          color={colors.cardio}
          onPress={() => router.push(`/cardio/new?id=${id}`)}
        />
        <HeaderAction label="Delete" color={colors.danger} onPress={() => setConfirming(true)} />
      </View>

      {confirming ? (
        <Card style={{ marginTop: 12, padding: 16 }}>
          <Text variant="headline">{`Delete this ${meta.label.toLowerCase()}?`}</Text>
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
              label={`Delete ${meta.label.toLowerCase()}`}
              variant="danger"
              loading={remove.isPending}
              onPress={() => void onDelete()}
            />
            <Button label="Keep" variant="secondary" onPress={() => setConfirming(false)} />
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
        <Thumb tone="cardio" icon={<Icon color={colors.cardio} size={22} strokeWidth={1.9} />} />
        <View style={{ flex: 1 }}>
          <Text variant="title" heading>
            {meta.label}
          </Text>
          <Text variant="footnote" color="ink2">
            {formatStarted(cardio.startedAt)}
          </Text>
        </View>
      </View>

      <Text variant="overline" color="ink2" style={{ marginTop: 28 }}>
        Duration
      </Text>
      <Text
        variant="statXL"
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={{ marginTop: 2 }}
      >
        {formatDurationClock(cardio.durationS)}
      </Text>

      {cardio.distanceM ? (
        <Text variant="headline" style={{ marginTop: 8 }}>
          {formatDistance(cardio.distanceM, system)}
          <Text variant="body" color="ink2" style={{ fontFamily: fontFamily.medium }}>
            {` ${distanceUnit(system)}`}
          </Text>
        </Text>
      ) : null}

      {pace && cardio.distanceM ? (
        <PaceCallout distanceM={cardio.distanceM} durationS={cardio.durationS} system={system} />
      ) : null}

      {cardio.calories != null || cardio.avgHeartRate != null || cardio.notes ? (
        <Card style={{ marginTop: 20, paddingHorizontal: 16, paddingVertical: 4 }}>
          {cardio.calories != null ? (
            <Fact label="Calories" value={String(cardio.calories)} />
          ) : null}
          {cardio.avgHeartRate != null ? (
            <Fact label="Heart rate" value={`${cardio.avgHeartRate} bpm`} />
          ) : null}
          {cardio.notes ? (
            <View style={{ paddingVertical: 12 }}>
              <Text variant="footnote" color="ink2">
                Notes
              </Text>
              <Text style={{ marginTop: 4 }}>{cardio.notes}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

function BackRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
      <IconButton icon={ChevronLeft} label="Back" onPress={dismiss} />
    </View>
  );
}

function HeaderAction({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
    >
      <Text variant="headline" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
        gap: 12,
      }}
    >
      <Text color="ink2">{label}</Text>
      <Text variant="headline">{value}</Text>
    </View>
  );
}
