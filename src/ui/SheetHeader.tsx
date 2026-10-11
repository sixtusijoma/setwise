import { X } from 'lucide-react-native';
import { View } from 'react-native';

import { dismiss } from '../lib/nav';
import { Text } from './Text';
import { IconButton } from './IconButton';

type Props = {
  title: string;
  onClose?: () => void;
};

export function SheetHeader({ title, onClose = dismiss }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
      }}
    >
      <Text variant="title" heading style={{ flex: 1, paddingRight: 12 }}>
        {title}
      </Text>
      <IconButton icon={X} label="Close" onPress={onClose} />
    </View>
  );
}
