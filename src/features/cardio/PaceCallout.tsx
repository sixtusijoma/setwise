import { View } from 'react-native';

import { formatPace } from '../../lib/pace';
import { fontFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import type { UnitSystem } from '../../lib/units';
import { formatDistance } from '../../lib/units';
import { Text } from '../../ui';

type Props = {
  distanceM: number;
  durationS: number;
  system: UnitSystem;
};

export function PaceCallout({ distanceM, durationS, system }: Props) {
  const { colors } = useTheme();
  const pace = formatPace(distanceM, durationS);
  if (!pace) return null;

  const metric = system === 'metric';
  const primary = metric ? pace.perKm : pace.perMile;
  const primaryUnit = metric ? '/km' : '/mi';
  const altDistance = formatDistance(distanceM, metric ? 'imperial' : 'metric');
  const altUnit = metric ? 'mi' : 'km';
  const altPace = metric ? pace.perMile : pace.perKm;
  const altPaceUnit = metric ? '/mi' : '/km';

  return (
    <View
      accessibilityLabel={`Pace ${primary} per ${metric ? 'kilometer' : 'mile'}, ${altDistance} ${altUnit}, ${altPace} per ${metric ? 'mile' : 'kilometer'}`}
      style={{
        marginTop: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: colors.cardioSoft,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flexShrink: 1 }}>
        <Text variant="footnote" style={{ color: colors.cardio, fontFamily: fontFamily.medium }}>
          Pace
        </Text>
        <Text
          variant="stat"
          style={{ color: colors.cardio }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {primary}
          <Text variant="body" style={{ color: colors.cardio, fontFamily: fontFamily.medium }}>
            {` ${primaryUnit}`}
          </Text>
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="footnote" color="ink2">
          {`${altDistance} ${altUnit}`}
        </Text>
        <Text variant="footnote" color="ink2">
          {`${altPace} ${altPaceUnit}`}
        </Text>
      </View>
    </View>
  );
}
