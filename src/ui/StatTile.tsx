import { View } from 'react-native';

import { fontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'positive' | 'neutral';
};

export function StatTile({ label, value, unit, delta, deltaTone = 'neutral' }: Props) {
  const { colors } = useTheme();
  return (
    <View>
      <Text variant="footnote" color="ink2">
        {label}
      </Text>
      <Text variant="stat" maxFontSizeMultiplier={1.3} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
        {unit ? (
          <Text
            variant="body"
            color="ink2"
            maxFontSizeMultiplier={1.3}
            style={{ fontFamily: fontFamily.medium }}
          >
            {' '}
            {unit}
          </Text>
        ) : null}
      </Text>
      {delta ? (
        <Text
          variant="footnote"
          style={{ color: deltaTone === 'positive' ? colors.accent : colors.ink3 }}
        >
          {delta}
        </Text>
      ) : null}
    </View>
  );
}
