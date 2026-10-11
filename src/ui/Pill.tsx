import { Pressable, ScrollView, View } from 'react-native';

import { fontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Pill<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              hitSlop={{ top: 6, bottom: 6 }}
              onPress={() => onChange(option.value)}
              style={{
                height: 32,
                paddingHorizontal: 14,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.ink : colors.sunken,
              }}
            >
              <Text
                variant="footnote"
                style={{
                  fontFamily: fontFamily.medium,
                  color: selected ? colors.bg : colors.ink2,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
