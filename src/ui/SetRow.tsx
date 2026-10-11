import * as Haptics from 'expo-haptics';
import { Check, Minus, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, TextInput, View } from 'react-native';

import { roundTo } from '../lib/units';
import { fontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { noBrowserOutline } from './inputStyle';
import { Text } from './Text';

type Props = {
  index: number;
  previous?: string;
  /** Omitted for lifts logged without a load. */
  weight?: string;
  reps: string;
  unit?: string;
  repsUnit?: string;
  completed?: boolean;
  pr?: boolean;
  onChangeWeight?: (value: string) => void;
  onChangeReps?: (value: string) => void;
  onToggle?: () => void;
};

function formatStepped(value: number): string {
  const rounded = roundTo(Math.max(0, value), 1);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function SetRow({
  index,
  previous,
  weight,
  reps,
  unit = 'lb',
  repsUnit = 'reps',
  completed = false,
  pr = false,
  onChangeWeight,
  onChangeReps,
  onToggle,
}: Props) {
  const { colors, widthClass } = useTheme();
  const compact = widthClass === 'compact';
  const [scale] = useState(() => new Animated.Value(1));
  const loaded = weight != null;
  const stacked = loaded;

  useEffect(() => {
    if (!completed) return;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      scale.setValue(0.9);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }).start();
    });
  }, [completed, scale]);

  const tap = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  };

  const toggle = () => {
    onToggle?.();
    tap();
  };

  const repsStep = repsUnit === 'seconds' ? 5 : 1;
  const weightStepAmount = unit === 'kg' ? 2.5 : 5;

  const stepper = (
    sign: 1 | -1,
    kind: 'weight' | 'reps',
    onPress: () => void,
    disabled: boolean,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        kind === 'weight'
          ? `${sign > 0 ? 'More' : 'Less'} ${unit === 'kg' ? 'kilograms' : 'pounds'}, set ${index}`
          : `${sign > 0 ? 'More' : 'Fewer'} ${repsUnit}, set ${index}`
      }
      disabled={disabled}
      onPress={() => {
        onPress();
        tap();
      }}
      style={({ pressed }) => ({
        width: 32,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : disabled ? 0.35 : 1,
      })}
    >
      {sign > 0 ? (
        <Plus color={colors.accent} size={16} strokeWidth={2.4} />
      ) : (
        <Minus color={colors.accent} size={16} strokeWidth={2.4} />
      )}
    </Pressable>
  );

  const field = (value: string, onChange?: (next: string) => void, label?: string) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      editable={Boolean(onChange)}
      keyboardType="decimal-pad"
      selectTextOnFocus
      accessibilityLabel={label}
      maxFontSizeMultiplier={1.3}
      style={{
        color: colors.ink,
        fontFamily: fontFamily.semibold,
        fontSize: 17,
        fontVariant: ['tabular-nums'],
        textAlign: 'center',
        paddingVertical: 8,
        ...noBrowserOutline,
      }}
    />
  );

  const done = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Set ${index}, ${weight != null ? `${weight || '0'} ${unit === 'kg' ? 'kilograms' : 'pounds'}, ` : ''}${reps || '0'} ${repsUnit}, ${completed ? 'completed' : 'not completed'}`}
      accessibilityHint="Marks the set done"
      accessibilityState={{ checked: completed }}
      hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
      onPress={toggle}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: completed ? colors.accent : 'transparent',
          borderWidth: completed ? 0 : 1.5,
          borderColor: colors.ink3,
          transform: [{ scale }],
        }}
      >
        <Check color={completed ? colors.accentInk : colors.ink3} size={16} strokeWidth={2.5} />
      </Animated.View>
    </Pressable>
  );

  const setIndex = (
    <Text
      variant="headline"
      maxFontSizeMultiplier={1.3}
      style={{ width: 36, textAlign: 'center', color: pr ? colors.pr : colors.ink2 }}
    >
      {index}
    </Text>
  );

  const previousCell = (
    <Text
      variant="footnote"
      color="ink2"
      numberOfLines={1}
      maxFontSizeMultiplier={1.3}
      style={{ flex: 1, minWidth: 0 }}
    >
      {previous ?? '—'}
    </Text>
  );

  const repsControls = (
    <>
      {stepper(-1, 'reps', () => onChangeReps?.(String(Math.max(0, (Number(reps) || 0) + -1 * repsStep))), !onChangeReps)}
      <View style={{ width: compact ? 40 : 44 }}>
        {field(reps, onChangeReps, `Set ${index} ${repsUnit}`)}
      </View>
      {stepper(1, 'reps', () => onChangeReps?.(String(Math.max(0, (Number(reps) || 0) + repsStep))), !onChangeReps)}
    </>
  );

  const weightControls = loaded ? (
    <>
      {stepper(
        -1,
        'weight',
        () => onChangeWeight?.(formatStepped((Number(weight) || 0) - weightStepAmount)),
        !onChangeWeight,
      )}
      <View style={{ width: compact ? 52 : 56 }}>
        {field(weight!, onChangeWeight, `Set ${index} weight`)}
      </View>
      {stepper(
        1,
        'weight',
        () => onChangeWeight?.(formatStepped((Number(weight) || 0) + weightStepAmount)),
        !onChangeWeight,
      )}
    </>
  ) : null;

  if (stacked) {
    return (
      <View
        style={{
          backgroundColor: completed ? colors.accentSoft : 'transparent',
          borderRadius: 12,
          paddingHorizontal: 4,
          paddingVertical: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40 }}>
          {setIndex}
          {previousCell}
          {done}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingLeft: 36,
            paddingRight: 44,
            gap: 2,
            minHeight: 44,
          }}
        >
          {weightControls}
          <View style={{ width: 6 }} />
          {repsControls}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        backgroundColor: completed ? colors.accentSoft : 'transparent',
        borderRadius: 12,
        paddingHorizontal: 4,
      }}
    >
      {setIndex}
      {previousCell}
      {repsControls}
      {done}
    </View>
  );
}
