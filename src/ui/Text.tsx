import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { fontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

export type TextVariant =
  'display' | 'title' | 'statXL' | 'stat' | 'headline' | 'body' | 'footnote' | 'overline';

type Props = RNTextProps & {
  variant?: TextVariant;
  color?: keyof ThemeColors;
  heading?: boolean;
};

const dense = new Set<TextVariant>(['statXL', 'stat']);

export function Text({
  variant = 'body',
  color = 'ink',
  heading = false,
  style,
  maxFontSizeMultiplier,
  ...rest
}: Props) {
  const { colors, widthClass } = useTheme();
  const compact = widthClass === 'compact';
  const cap = dense.has(variant) ? 1.3 : 1.6;
  const requested = typeof maxFontSizeMultiplier === 'number' ? maxFontSizeMultiplier : cap;
  const styles: Record<TextVariant, TextStyle> = {
    display: {
      fontFamily: fontFamily.serif,
      fontSize: compact ? 38 : 44,
      lineHeight: compact ? 40 : 46,
    },
    title: { fontFamily: fontFamily.serif, fontSize: 30, lineHeight: 34 },
    statXL: {
      fontFamily: fontFamily.semibold,
      fontSize: 56,
      lineHeight: 58,
      letterSpacing: -1.7,
    },
    stat: {
      fontFamily: fontFamily.semibold,
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: -0.6,
    },
    headline: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22 },
    body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 20 },
    footnote: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
    overline: {
      fontFamily: fontFamily.medium,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.96,
      textTransform: 'uppercase',
    },
  };

  return (
    <RNText
      accessibilityRole={heading ? 'header' : undefined}
      style={[{ color: colors[color], fontVariant: ['tabular-nums'] }, styles[variant], style]}
      {...rest}
      maxFontSizeMultiplier={Math.min(cap, requested)}
    />
  );
}
