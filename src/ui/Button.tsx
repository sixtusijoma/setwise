import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'cardio' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading = false,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  const filled = {
    primary: { backgroundColor: colors.accent, color: colors.accentInk },
    cardio: { backgroundColor: colors.cardio, color: colors.cardioInk },
    secondary: { backgroundColor: colors.sunken, color: colors.ink },
    ghost: { backgroundColor: 'transparent', color: colors.ink },
    danger: { backgroundColor: colors.danger, color: colors.accentInk },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: filled.backgroundColor, opacity: inactive ? 0.4 : pressed ? 0.88 : 1 },
      ]}
    >
      <View style={styles.content}>
        {Icon && !loading ? <Icon color={filled.color} size={20} strokeWidth={2.25} /> : null}
        <Text
          variant="headline"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: filled.color, opacity: loading ? 0 : 1 }}
        >
          {label}
        </Text>
      </View>
      {loading ? <ActivityIndicator color={filled.color} style={StyleSheet.absoluteFill} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
