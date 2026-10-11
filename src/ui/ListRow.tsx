import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  title: string;
  meta?: string;
  leading?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
};

export function ListRow({ title, meta, leading, onPress, showChevron = true }: Props) {
  const { colors } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        paddingVertical: 10,
      }}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="headline">{title}</Text>
        {meta ? (
          <Text variant="footnote" color="ink2">
            {meta}
          </Text>
        ) : null}
      </View>
      {showChevron ? <ChevronRight color={colors.ink3} size={18} strokeWidth={1.9} /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      {content}
    </Pressable>
  );
}
