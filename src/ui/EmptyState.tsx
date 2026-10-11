import { Image, View, type ImageSourcePropType } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  icon?: ReactNode;
  image?: ImageSourcePropType;
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, image, title, body, action }: Props) {
  const { colors, height } = useTheme();
  const compact = height < 720;
  const tile = compact ? 132 : 200;
  return (
    <View style={{ alignItems: 'center', paddingTop: compact ? 20 : 36 }}>
      {image || icon ? (
        <View
          style={{
            width: tile,
            height: tile,
            borderRadius: compact ? 28 : 40,
            backgroundColor: image ? colors.tile : colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {image ? (
            <Image
              accessible={false}
              source={image}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            icon
          )}
        </View>
      ) : null}
      <Text variant="title" style={{ textAlign: 'center', marginTop: compact ? 18 : 28 }}>
        {title}
      </Text>
      {body ? (
        <Text
          variant="body"
          color="ink2"
          style={{ textAlign: 'center', marginTop: 10, maxWidth: 300 }}
        >
          {body}
        </Text>
      ) : null}
      {action ? (
        <View style={{ alignSelf: 'stretch', marginTop: compact ? 20 : 28, gap: 10 }}>
          {action}
        </View>
      ) : null}
    </View>
  );
}
