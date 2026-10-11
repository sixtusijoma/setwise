import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Banner, Button, Card, Field, Text } from '../../ui';

type Action = {
  label: string;
  onPress: () => void;
  danger?: boolean;
};

export function MenuSheet({
  title,
  actions,
  onClose,
}: {
  title: string;
  actions: Action[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(20, 20, 18, 0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 28,
          }}
        >
          <Text variant="headline" style={{ marginBottom: 8 }}>
            {title}
          </Text>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              style={{ minHeight: 48, justifyContent: 'center' }}
            >
              <Text variant="body" style={{ color: action.danger ? colors.danger : colors.ink }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ConfirmDialog({
  title,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(20, 20, 18, 0.4)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Card style={{ width: '100%', maxWidth: 360, padding: 20 }}>
          <Text variant="title" heading>
            {title}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <View style={{ flex: 1 }}>
              <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={confirmLabel}
                variant={danger ? 'danger' : 'primary'}
                onPress={onConfirm}
              />
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

export function NameDialog({
  title,
  initialName,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  initialName: string;
  confirmLabel: string;
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save that.');
      setBusy(false);
    }
  };
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(20, 20, 18, 0.4)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Card style={{ width: '100%', maxWidth: 360, padding: 20 }}>
          <Text variant="title" heading>
            {title}
          </Text>
          <View style={{ marginTop: 16 }}>
            <Field
              label="Template name"
              value={name}
              onChangeText={(next) => setName(next.slice(0, 60))}
              autoFocus
            />
          </View>
          {error ? (
            <View style={{ marginTop: 12 }}>
              <Banner body={error} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={confirmLabel}
                loading={busy}
                disabled={!trimmed || busy}
                onPress={() => void submit()}
              />
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
