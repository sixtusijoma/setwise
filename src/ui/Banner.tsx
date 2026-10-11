import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Tone = 'pr' | 'cardio' | 'neutral';

type Props = {
  tone?: Tone;
  icon?: LucideIcon;
  title?: string;
  body: string;
};

export function Banner({ tone = 'neutral', icon: Icon, title, body }: Props) {
  const { colors } = useTheme();
  const palette = {
    pr: { backgroundColor: colors.prSoft, color: colors.pr },
    cardio: { backgroundColor: colors.cardioSoft, color: colors.cardio },
    neutral: { backgroundColor: colors.sunken, color: colors.ink },
  }[tone];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: palette.backgroundColor,
      }}
    >
      {Icon ? <Icon color={palette.color} size={20} strokeWidth={1.9} /> : null}
      <Text variant="footnote" style={{ flex: 1 }}>
        {title ? (
          <Text variant="footnote" style={{ fontFamily: 'Geist_600SemiBold' }}>
            {title}
          </Text>
        ) : null}
        {title ? ' · ' : ''}
        {body}
      </Text>
    </View>
  );
}
