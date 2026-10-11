import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { useQueryClient } from '@tanstack/react-query';

import { mutationKeys } from '../../data/queryClient';
import { leaveWhenQueued, pausedMutation } from '../../data/sync';
import type { Cardio, CardioActivity } from '../../data/types';
import { durationSeconds, parseDistance, showsPace, splitDuration } from '../../lib/pace';
import { fontFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import type { UnitSystem } from '../../lib/units';
import { distanceUnit, formatDistance } from '../../lib/units';
import { dismiss } from '../../lib/nav';
import { Button, Card, Screen, SheetHeader, Skeleton, Text } from '../../ui';
import { noBrowserOutline } from '../../ui/inputStyle';
import { ActivityGrid } from './ActivityGrid';
import { activityMeta } from './activities';
import { useCardioSession, useProfile, useSaveCardio } from './api';
import { PaceCallout } from './PaceCallout';
import { formatStarted } from './time';

function param(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : undefined;
}

function digits(value: string, max = 4): string {
  return value.replace(/\D/g, '').slice(0, max);
}

function wholeNumber(
  text: string,
  min: number,
  max: number,
): { value: number | null; valid: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null, valid: true };
  if (!/^\d{1,5}$/.test(trimmed)) return { value: null, valid: false };
  const value = Number(trimmed);
  if (value < min || value > max) return { value: null, valid: false };
  return { value, valid: true };
}

type Seed = {
  id: string;
  editing: boolean;
  activity: CardioActivity;
  hours: string;
  minutes: string;
  seconds: string;
  distance: string;
  startedAt: string;
  extrasOpen: boolean;
  caloriesText: string;
  heartText: string;
  notes: string;
};

function seedFrom(cardio: Cardio, system: UnitSystem): Seed {
  const parts = splitDuration(cardio.durationS);
  return {
    id: cardio.id,
    editing: true,
    activity: cardio.activity,
    hours: parts.hours > 0 ? String(parts.hours) : '',
    minutes: String(parts.minutes),
    seconds: String(parts.seconds),
    distance: cardio.distanceM == null ? '' : formatDistance(cardio.distanceM, system),
    startedAt: cardio.startedAt,
    extrasOpen: cardio.calories != null || cardio.avgHeartRate != null || Boolean(cardio.notes),
    caloriesText: cardio.calories == null ? '' : String(cardio.calories),
    heartText: cardio.avgHeartRate == null ? '' : String(cardio.avgHeartRate),
    notes: cardio.notes ?? '',
  };
}

export function LogCardio() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const editId = param(params.id);
  const session = useCardioSession(editId);
  const profile = useProfile();
  const { colors } = useTheme();
  const [createId] = useState(() => Crypto.randomUUID());
  const system: UnitSystem = profile.data?.unitSystem ?? 'imperial';

  if (editId) {
    if (session.isError || (session.isSuccess && !session.data)) {
      return (
        <Screen variant="sheet" style={{ backgroundColor: colors.surface }}>
          <SheetHeader title="Edit cardio" />
          <Text variant="title" style={{ marginTop: 28 }}>
            This session is not on this device.
          </Text>
        </Screen>
      );
    }
    if (!session.data || !profile.isFetched) {
      return (
        <Screen variant="sheet" scroll={false} style={{ backgroundColor: colors.surface }}>
          <SheetHeader title="Edit cardio" />
          <View style={{ gap: 12, marginTop: 20 }}>
            <Skeleton width="100%" height={72} radius={16} />
            <Skeleton width="70%" height={56} />
            <Skeleton width="100%" height={148} radius={16} />
          </View>
        </Screen>
      );
    }
    return <LogCardioForm key={editId} seed={seedFrom(session.data, system)} system={system} />;
  }

  const startedAt = new Date().toISOString();
  return (
    <LogCardioForm
      seed={{
        id: createId,
        editing: false,
        activity: 'run',
        hours: '',
        minutes: '',
        seconds: '',
        distance: '',
        startedAt,
        extrasOpen: false,
        caloriesText: '',
        heartText: '',
        notes: '',
      }}
      system={system}
    />
  );
}

function LogCardioForm({ seed, system }: { seed: Seed; system: UnitSystem }) {
  const save = useSaveCardio();
  const client = useQueryClient();
  const { colors, mode: scheme, widthClass } = useTheme();
  const clock = useRef({ hours: seed.hours, minutes: seed.minutes, seconds: seed.seconds });
  const [activity, setActivity] = useState(seed.activity);
  const [hours, setHours] = useState(seed.hours);
  const [minutes, setMinutes] = useState(seed.minutes);
  const [seconds, setSeconds] = useState(seed.seconds);
  const [distance, setDistance] = useState(seed.distance);
  const [distanceTouched, setDistanceTouched] = useState(false);
  const [startedAt, setStartedAt] = useState(seed.startedAt);
  const [extrasOpen, setExtrasOpen] = useState(seed.extrasOpen);
  const [caloriesText, setCaloriesText] = useState(seed.caloriesText);
  const [heartText, setHeartText] = useState(seed.heartText);
  const [notes, setNotes] = useState(seed.notes);
  const [error, setError] = useState<string | null>(null);

  const clockSize = widthClass === 'compact' ? (hours || Number(minutes) >= 60 ? 40 : 48) : 56;
  const durationS = durationSeconds(Number(hours) || 0, Number(minutes) || 0, Number(seconds) || 0);
  const distanceParsed = useMemo(() => parseDistance(distance, system), [distance, system]);
  const calories = wholeNumber(caloriesText, 0, 20000);
  const heart = wholeNumber(heartText, 30, 250);
  const notesOk = notes.trim().length <= 2000;
  const canSave = Boolean(
    durationS && distanceParsed.valid && calories.valid && heart.valid && notesOk,
  );
  const paceDistance = distanceParsed.meters;
  const showPace = Boolean(paceDistance && durationS && showsPace(activity, paceDistance));
  const label = activityMeta(activity).label;
  const durationTooLong =
    (Number(hours) || 0) + (Number(minutes) || 0) + (Number(seconds) || 0) > 0 && durationS == null;

  function updateClock(part: 'hours' | 'minutes' | 'seconds', value: string) {
    clock.current = { ...clock.current, [part]: value };
    if (part === 'hours') setHours(value);
    else if (part === 'minutes') setMinutes(value);
    else setSeconds(value);
  }

  function carryTime() {
    let nextHours = Number(clock.current.hours) || 0;
    let nextMinutes = Number(clock.current.minutes) || 0;
    let nextSeconds = Number(clock.current.seconds) || 0;
    nextMinutes += Math.floor(nextSeconds / 60);
    nextSeconds %= 60;
    nextHours += Math.floor(nextMinutes / 60);
    nextMinutes %= 60;
    const any = nextHours > 0 || nextMinutes > 0 || nextSeconds > 0;
    const next = {
      hours: nextHours > 0 ? String(nextHours) : '',
      minutes: any ? String(nextMinutes) : '',
      seconds: any ? String(nextSeconds) : '',
    };
    clock.current = next;
    setHours(next.hours);
    setMinutes(next.minutes);
    setSeconds(next.seconds);
  }

  function nudgeDuration(sign: 1 | -1) {
    const total =
      (Number(clock.current.hours) || 0) * 3600 +
      (Number(clock.current.minutes) || 0) * 60 +
      (Number(clock.current.seconds) || 0);
    const nextTotal = Math.max(0, Math.min(24 * 3600 - 1, total + sign * 60));
    const nextHours = Math.floor(nextTotal / 3600);
    const nextMinutes = Math.floor((nextTotal % 3600) / 60);
    const nextSeconds = nextTotal % 60;
    const any = nextTotal > 0;
    const next = {
      hours: nextHours > 0 ? String(nextHours) : '',
      minutes: any ? String(nextMinutes) : '',
      seconds: any ? String(nextSeconds) : '',
    };
    clock.current = next;
    setHours(next.hours);
    setMinutes(next.minutes);
    setSeconds(next.seconds);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  }

  function pickStart(date: Date | undefined) {
    if (date) setStartedAt(new Date(Math.min(date.getTime(), Date.now())).toISOString());
  }

  function openAndroidPicker(pickMode: 'date' | 'time', value: Date) {
    DateTimePickerAndroid.open({
      value,
      mode: pickMode,
      is24Hour: false,
      maximumDate: new Date(),
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        pickStart(date);
        if (pickMode === 'date') openAndroidPicker('time', date);
      },
    });
  }

  async function onSave() {
    if (!durationS || !distanceParsed.valid || !calories.valid || !heart.valid) return;
    setError(null);
    try {
      const outcome = await leaveWhenQueued(
        save.mutateAsync({
          id: seed.id,
          activity,
          startedAt,
          durationS,
          distanceM: distanceParsed.meters,
          calories: calories.value,
          avgHeartRate: heart.value,
          notes: notes.trim() || null,
        }),
        () => pausedMutation(client, mutationKeys.saveCardio),
      );
      if (outcome === 'queued') {
        dismiss();
        return;
      }
      if (seed.editing) dismiss();
      else router.replace(`/cardio/${seed.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save this session.");
    }
  }

  return (
    <Screen variant="sheet" scroll={false} style={{ backgroundColor: colors.surface }}>
      <SheetHeader title={seed.editing ? 'Edit cardio' : 'Log cardio'} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <ActivityGrid value={activity} onChange={setActivity} />
        <Text variant="overline" color="ink2" style={{ marginTop: 22 }}>
          Duration · required
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease duration by 1 minute"
            onPress={() => nudgeDuration(-1)}
            style={({ pressed }) => ({
              width: 40,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Minus color={colors.cardio} size={18} strokeWidth={2.4} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14, flex: 1 }}>
            {hours || Number(minutes) >= 60 ? (
              <ClockPart
                label="Hours"
                unit="hr"
                value={hours}
                onChange={(value) => updateClock('hours', value)}
                onBlur={carryTime}
                size={clockSize}
              />
            ) : null}
            <ClockPart
              label="Minutes"
              unit="min"
              value={minutes}
              onChange={(value) => updateClock('minutes', value)}
              onBlur={carryTime}
              size={clockSize}
            />
            <ClockPart
              label="Seconds"
              unit="sec"
              value={seconds}
              onChange={(value) => updateClock('seconds', value)}
              onBlur={carryTime}
              size={clockSize}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase duration by 1 minute"
            onPress={() => nudgeDuration(1)}
            style={({ pressed }) => ({
              width: 40,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Plus color={colors.cardio} size={18} strokeWidth={2.4} />
          </Pressable>
        </View>
        {durationTooLong ? (
          <Text variant="footnote" color="danger" style={{ marginTop: 6 }}>
            Keep a session under 24 hours.
          </Text>
        ) : null}

        <Card style={{ marginTop: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 16,
              paddingRight: 16,
              minHeight: 52,
              gap: 12,
            }}
          >
            <Text>Distance</Text>
            <TextInput
              accessibilityLabel={
                system === 'metric' ? 'Distance in kilometers' : 'Distance in miles'
              }
              value={distance}
              onChangeText={(next) => {
                const cleaned = next.replace(/[^0-9.]/g, '');
                const [head, ...rest] = cleaned.split('.');
                setDistance(rest.length ? `${head}.${rest.join('').slice(0, 3)}` : head);
              }}
              onBlur={() => setDistanceTouched(true)}
              placeholder="0.00"
              placeholderTextColor={colors.ink3}
              keyboardType="decimal-pad"
              inputMode="decimal"
              maxFontSizeMultiplier={1.3}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'right',
                color: colors.ink,
                fontFamily: fontFamily.semibold,
                fontSize: 17,
                fontVariant: ['tabular-nums'],
                paddingVertical: 14,
                ...noBrowserOutline,
              }}
            />
            <Text color="ink2" style={{ fontFamily: fontFamily.medium }}>
              {distanceUnit(system)}
            </Text>
          </View>
          {distanceTouched && !distanceParsed.valid ? (
            <Text
              variant="footnote"
              color="danger"
              style={{ paddingHorizontal: 16, paddingBottom: 10 }}
            >
              Distance has to be greater than 0.
            </Text>
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.hairline }} />
          {Platform.OS === 'ios' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: 16,
                paddingRight: 8,
                minHeight: 52,
                gap: 12,
              }}
            >
              <Text>Started</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {(['date', 'time'] as const).map((pickMode) => (
                  <DateTimePicker
                    key={pickMode}
                    value={new Date(startedAt)}
                    mode={pickMode}
                    display="compact"
                    maximumDate={new Date()}
                    onChange={(_, date) => pickStart(date)}
                    themeVariant={scheme}
                    accentColor={colors.cardio}
                  />
                ))}
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Started, ${formatStarted(startedAt)}`}
              onPress={() => openAndroidPicker('date', new Date(startedAt))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                minHeight: 52,
                gap: 12,
              }}
            >
              <Text>Started</Text>
              <Text color="ink2">{formatStarted(startedAt)}</Text>
            </Pressable>
          )}
          <View style={{ height: 1, backgroundColor: colors.hairline }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Calories, heart rate, notes"
            accessibilityState={{ expanded: extrasOpen }}
            onPress={() => setExtrasOpen((open) => !open)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              minHeight: 52,
            }}
          >
            <Text color="ink2">Calories, heart rate, notes</Text>
            {extrasOpen ? (
              <ChevronUp color={colors.ink3} size={18} strokeWidth={1.9} />
            ) : (
              <ChevronDown color={colors.ink3} size={18} strokeWidth={1.9} />
            )}
          </Pressable>
          {extrasOpen ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
              <StartField
                label="Calories"
                value={caloriesText}
                onChange={(next) => setCaloriesText(digits(next, 5))}
                placeholder="Optional"
                numeric
              />
              {!calories.valid ? (
                <Text variant="footnote" color="danger">
                  Calories have to be a whole number up to 20,000.
                </Text>
              ) : null}
              <StartField
                label="Heart rate"
                value={heartText}
                onChange={(next) => setHeartText(digits(next, 3))}
                placeholder="bpm"
                numeric
              />
              {!heart.valid ? (
                <Text variant="footnote" color="danger">
                  Heart rate has to be between 30 and 250.
                </Text>
              ) : null}
              <TextInput
                accessibilityLabel="Notes"
                maxFontSizeMultiplier={1.6}
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes"
                placeholderTextColor={colors.ink3}
                multiline
                style={{
                  minHeight: 72,
                  borderRadius: 12,
                  backgroundColor: colors.sunken,
                  color: colors.ink,
                  fontFamily: fontFamily.regular,
                  fontSize: 15,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  textAlignVertical: 'top',
                  ...noBrowserOutline,
                }}
              />
              {!notesOk ? (
                <Text variant="footnote" color="danger">
                  Notes have to be 2,000 characters or fewer.
                </Text>
              ) : null}
            </View>
          ) : null}
        </Card>

        {showPace && paceDistance && durationS ? (
          <PaceCallout distanceM={paceDistance} durationS={durationS} system={system} />
        ) : null}
      </ScrollView>
      {error ? (
        <Text variant="footnote" color="danger" style={{ marginBottom: 8 }}>
          {error}
        </Text>
      ) : null}
      <Button
        label={`Save ${label.toLowerCase()}`}
        variant="cardio"
        disabled={!canSave}
        loading={save.isPending}
        onPress={() => void onSave()}
      />
    </Screen>
  );
}

function ClockPart({
  label,
  unit,
  value,
  onChange,
  onBlur,
  size,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  size: number;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={(next) => onChange(digits(next))}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur();
        }}
        placeholder="0"
        placeholderTextColor={colors.ink3}
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        maxFontSizeMultiplier={1.3}
        style={{
          width: Math.max(value.length, 1) * size * 0.64 + 4,
          height: size + 8,
          fontFamily: fontFamily.semibold,
          fontSize: size,
          letterSpacing: size * -0.03,
          color: colors.ink,
          fontVariant: ['tabular-nums'],
          padding: 0,
          borderBottomWidth: 2,
          borderBottomColor: focused ? colors.cardio : 'transparent',
          ...noBrowserOutline,
        }}
      />
      <Text variant="headline" color="ink2">
        {unit}
      </Text>
    </View>
  );
}

function StartField({
  label,
  value,
  onChange,
  placeholder,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  numeric?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <Text color="ink2" style={{ width: 88 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        keyboardType={numeric ? 'number-pad' : 'default'}
        inputMode={numeric ? 'numeric' : 'text'}
        autoCapitalize="none"
        maxFontSizeMultiplier={numeric ? 1.3 : 1.6}
        style={{
          flex: 1,
          textAlign: 'right',
          color: colors.ink,
          fontFamily: fontFamily.semibold,
          fontSize: 17,
          fontVariant: ['tabular-nums'],
          paddingVertical: 8,
          ...noBrowserOutline,
        }}
      />
    </View>
  );
}
