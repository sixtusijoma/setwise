import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { fontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { noBrowserOutline } from './inputStyle';
import { Text } from './Text';

type Props = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  grouped?: boolean;
  autoFocus?: boolean;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  grouped = false,
  autoFocus,
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const input = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.ink3}
      secureTextEntry={secureTextEntry}
      autoFocus={autoFocus}
      autoCapitalize="none"
      accessibilityLabel={label ?? placeholder}
      maxFontSizeMultiplier={1.6}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        flex: grouped ? 1 : undefined,
        minHeight: grouped ? 22 : 48,
        color: colors.ink,
        fontFamily: fontFamily.regular,
        fontSize: 15,
        textAlign: grouped ? 'right' : 'left',
        ...noBrowserOutline,
      }}
    />
  );

  if (grouped) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
        }}
      >
        {label ? <Text variant="body">{label}</Text> : null}
        {input}
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors.sunken,
        borderRadius: radius.input,
        borderWidth: 2,
        borderColor: focused ? colors.accent : 'transparent',
        paddingHorizontal: 14,
        justifyContent: 'center',
      }}
    >
      {input}
    </View>
  );
}
