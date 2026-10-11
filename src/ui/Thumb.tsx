import { View } from 'react-native';
import type { ReactNode } from 'react';

import { fontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  size?: 48 | 36 | 28;
  initials?: string;
  icon?: ReactNode;
  tone?: 'default' | 'cardio';
};

const radiusFor = { 48: 14, 36: 10, 28: 8 } as const;

export function Thumb({ size = 48, initials, icon, tone = 'default' }: Props) {
  const { colors } = useTheme();
  const cardio = tone === 'cardio';
  const backgroundColor = initials ? colors.accentSoft : cardio ? colors.cardioSoft : colors.tile;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radiusFor[size],
        backgroundColor,
        borderWidth: initials || cardio ? 0 : 1,
        borderColor: colors.hairline,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {icon}
      {initials ? (
        <Text
          variant="headline"
          style={{
            color: colors.accent,
            fontFamily: fontFamily.semibold,
            fontSize: size < 36 ? 11 : 15,
          }}
        >
          {initials.slice(0, 2).toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}
