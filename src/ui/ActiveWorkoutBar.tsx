import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { fontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  title: string;
  elapsed: string;
  onResume: () => void;
};

export function ActiveWorkoutBar({ title, elapsed, onResume }: Props) {
  const { colors, mode } = useTheme();
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Resume workout, ${title}, ${elapsed}`}
      onPress={onResume}
      style={{
        height: 56,
        borderRadius: 18,
        backgroundColor: colors.ink,
        paddingLeft: 16,
        paddingRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: mode === 'dark' ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.10)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        <Animated.View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.accent,
            opacity: pulse,
          }}
        />
        <Text variant="headline" style={{ color: colors.bg }} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="body" style={{ color: colors.bg, opacity: 0.6 }}>
          {elapsed}
        </Text>
      </View>
      <View
        style={{
          height: 32,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          variant="footnote"
          style={{ color: colors.accentInk, fontFamily: fontFamily.semibold }}
        >
          Resume
        </Text>
      </View>
    </Pressable>
  );
}
