import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

type Props = {
  width: number | `${number}%`;
  height: number;
  radius?: number;
};

export function Skeleton({ width, height, radius = 12 }: Props) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let reduce = false;
    const start = () => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.45,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduce = enabled;
      loop?.stop();
      if (!enabled) start();
    });
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduce = enabled;
      start();
    });
    return () => {
      loop?.stop();
      subscription.remove();
    };
  }, [opacity]);

  return (
    <View>
      <Animated.View
        style={{ width, height, borderRadius: radius, backgroundColor: colors.sunken, opacity }}
      />
    </View>
  );
}
