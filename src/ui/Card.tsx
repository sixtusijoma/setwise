import { View, type ViewProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        style,
      ]}
      {...rest}
    />
  );
}
