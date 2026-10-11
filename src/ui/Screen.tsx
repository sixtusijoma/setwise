import { Platform, ScrollView, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '../theme/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  variant?: 'tab' | 'sheet' | 'stack';
  scroll?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, variant = 'tab', scroll = true, style }: Props) {
  const { colors, gutter } = useTheme();
  const insets = useSafeAreaInsets();
  // An iOS modal sheet starts below the status bar, but the root insets still report it.
  const sheetOnIos = variant === 'sheet' && Platform.OS === 'ios';
  const paddingTop = (sheetOnIos ? 0 : insets.top) + (variant === 'sheet' ? 16 : 12);
  const paddingBottom = insets.bottom + (variant === 'tab' ? 96 : 28);
  const contentStyle = {
    paddingTop,
    paddingHorizontal: gutter,
    paddingBottom,
    flexGrow: 1,
  };

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.bg }, contentStyle, style]}>{children}</View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
