import { useQueryClient } from '@tanstack/react-query';

import { mutationKeys } from '../../data/queryClient';
import { leaveWhenQueued, pausedMutation } from '../../data/sync';
import type { Template } from '../../data/types';
import { NameDialog } from '../workout/dialogs';
import { useSaveTemplate } from './api';

export function SaveTemplateDialog({
  initialName,
  build,
  onClose,
}: {
  initialName: string;
  build: (name: string) => Template;
  onClose: (saved?: string) => void;
}) {
  const save = useSaveTemplate();
  const client = useQueryClient();
  return (
    <NameDialog
      title="Save as template"
      initialName={initialName}
      confirmLabel="Save template"
      onCancel={() => onClose()}
      onConfirm={async (name) => {
        await leaveWhenQueued(save.mutateAsync(build(name)), () =>
          pausedMutation(client, mutationKeys.saveTemplate),
        );
        onClose(name);
      }}
    />
  );
}
