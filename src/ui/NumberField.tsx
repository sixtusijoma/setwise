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
  grouped?: boolean;
  integer?: boolean;
};

export function NumberField({
  label,
  value,
  onChangeText,
  placeholder,
  grouped = false,
  integer = false,
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        backgroundColor: grouped ? 'transparent' : colors.sunken,
        borderRadius: grouped ? 0 : radius.input,
        borderWidth: 2,
        borderColor: focused ? colors.accent : 'transparent',
        paddingHorizontal: grouped ? 0 : 14,
        minHeight: grouped ? 44 : 52,
        flexDirection: grouped ? 'row' : 'column',
        alignItems: grouped ? 'center' : 'stretch',
        justifyContent: 'center',
      }}
    >
      {label ? (
        <Text
          variant={grouped ? 'body' : 'footnote'}
          color="ink2"
          style={grouped ? { marginRight: 12 } : undefined}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        inputMode={integer ? 'numeric' : 'decimal'}
        selectTextOnFocus
        accessibilityLabel={label ?? placeholder ?? 'Number'}
        maxFontSizeMultiplier={1.3}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: grouped ? 1 : undefined,
          color: colors.ink,
          fontFamily: fontFamily.semibold,
          fontSize: grouped ? 17 : 30,
          fontVariant: ['tabular-nums'],
          textAlign: grouped ? 'right' : 'left',
          paddingVertical: 8,
          ...noBrowserOutline,
        }}
      />
    </View>
  );
}
