import { Pressable, View } from 'react-native';

import { fontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.sunken,
        borderRadius: 12,
        padding: 3,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              height: 32,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.surface : 'transparent',
              boxShadow: selected ? '0 1px 3px rgba(0,0,0,0.08)' : undefined,
            }}
          >
            <Text
              variant="footnote"
              style={{
                fontFamily: fontFamily.medium,
                color: selected ? colors.ink : colors.ink2,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
