import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { formatDuration } from '../../lib/units';
import { fontFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, Text } from '../../ui';
import { useDraft } from './draft';
import { useNow } from './useNow';

export function RestTimer({ endsAt }: { endsAt: number }) {
  const { colors, mode } = useTheme();
  const now = useNow();
  const addRest = useDraft((state) => state.addRest);
  const clearRest = useDraft((state) => state.clearRest);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    if (remaining <= 0) clearRest();
  }, [remaining, clearRest]);
  if (remaining <= 0) return null;

  return (
    <Card
      style={{
        height: 52,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: mode === 'dark' ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.10)',
      }}
    >
      <Text variant="footnote" color="ink2">
        Rest
      </Text>
      <Text variant="headline">{formatDuration(remaining)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add 30 seconds"
          onPress={() => addRest(30)}
          hitSlop={8}
        >
          <Text
            variant="footnote"
            style={{ color: colors.accent, fontFamily: fontFamily.semibold }}
          >
            +30s
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss rest timer"
          onPress={clearRest}
        >
          <Text variant="footnote" color="ink3">
            Skip
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
