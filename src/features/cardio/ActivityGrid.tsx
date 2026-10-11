import { Pressable, View } from 'react-native';

import type { CardioActivity } from '../../data/types';
import { fontFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui';
import { ACTIVITIES } from './activities';

type Props = {
  value: CardioActivity;
  onChange: (activity: CardioActivity) => void;
};

const ROWS = [ACTIVITIES.slice(0, 4), ACTIVITIES.slice(4, 8), ACTIVITIES.slice(8)];

export function ActivityGrid({ value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8, marginTop: 16 }}>
      {ROWS.map((row) => (
        <View key={row[0]?.id ?? 'row'} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((item) => {
            const selected = item.id === value;
            const color = selected ? colors.cardioInk : colors.ink2;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                onPress={() => onChange(item.id)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 72,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  paddingHorizontal: 4,
                  backgroundColor: selected ? colors.cardio : colors.sunken,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <Icon color={color} size={22} strokeWidth={selected ? 2.25 : 1.9} />
                <Text
                  variant="footnote"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={{
                    color,
                    fontFamily: fontFamily.medium,
                    fontSize: 13,
                    lineHeight: 16,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
          {row.length < 4
            ? Array.from({ length: 4 - row.length }, (_, index) => (
                <View key={`pad-${index}`} style={{ flex: 1 }} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}
