import { Pressable, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeProvider';

type Props = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
};

export function IconButton({ icon: Icon, label, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.sunken, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Icon color={colors.ink} size={18} strokeWidth={2.25} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
