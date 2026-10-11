import { ChevronLeft } from 'lucide-react-native';
import { View } from 'react-native';
import type { ReactNode } from 'react';

import { dismiss } from '../lib/nav';
import { EmptyState, IconButton, Screen, Text } from './index';

type Props = {
  title: string;
  body: string;
  icon?: ReactNode;
};

export function DetailStub({ title, body, icon }: Props) {
  return (
    <Screen variant="stack">
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
        <IconButton icon={ChevronLeft} label="Back" onPress={dismiss} />
      </View>
      <Text variant="display" heading style={{ marginTop: 8 }}>
        {title}
      </Text>
      <EmptyState icon={icon} title={body} />
    </Screen>
  );
}
