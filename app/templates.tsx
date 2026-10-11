import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CopyPlus, Ellipsis, LayoutList } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { mutationKeys } from '../src/data/queryClient';
import { leaveWhenQueued, pausedMutation } from '../src/data/sync';
import type { Template } from '../src/data/types';
import { useExercises } from '../src/features/exercises/useExercises';
import { useDeleteTemplate, useSaveTemplate, useTemplates } from '../src/features/templates/api';
import {
  PROGRAMS,
  programTemplate,
  type Program,
  type ProgramDay,
} from '../src/features/templates/programs';
import { templateSummary } from '../src/features/templates/templates';
import { ConfirmDialog, MenuSheet, NameDialog } from '../src/features/workout/dialogs';
import { useDraft } from '../src/features/workout/draft';
import { useUnitSystem } from '../src/features/workout/useProfile';
import { useTheme } from '../src/theme/ThemeProvider';
import {
  Banner,
  EmptyState,
  IconButton,
  ListRow,
  Screen,
  SheetHeader,
  Skeleton,
  Text,
} from '../src/ui';

export default function TemplatesScreen() {
  const { colors } = useTheme();
  const templates = useTemplates();
  const exercises = useExercises();
  const system = useUnitSystem();
  const active = useDraft((state) => Boolean(state.draft));
  const save = useSaveTemplate();
  const remove = useDeleteTemplate();
  const client = useQueryClient();
  const [menu, setMenu] = useState<Template | null>(null);
  const [renaming, setRenaming] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<Program | null>(null);
  const names = new Map((exercises.data ?? []).map((exercise) => [exercise.slug, exercise.name]));

  const start = (template: Template) => {
    if (!system || !exercises.data) return;
    if (active) {
      setError('Finish or discard the workout in progress first.');
      return;
    }
    // A custom exercise deleted since the template was saved is skipped.
    const known = new Set(exercises.data.map((exercise) => exercise.id));
    useDraft.getState().startFromTemplate(
      {
        ...template,
        exercises: template.exercises.filter((exercise) => known.has(exercise.exerciseId)),
      },
      system,
    );
    router.replace('/workout/active');
  };

  const copy = (program: Program, day: ProgramDay) => {
    if (!exercises.data) return;
    const template = programTemplate(program, day, exercises.data);
    setError(null);
    setNotice(null);
    leaveWhenQueued(save.mutateAsync(template), () =>
      pausedMutation(client, mutationKeys.saveTemplate),
    ).then(
      () => setNotice(`Copied “${template.name}” to My templates.`),
      (caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Couldn’t copy that day.'),
    );
  };

  return (
    <Screen variant="sheet" scroll={false}>
      <SheetHeader title="Templates" />
      <ScrollView style={{ flex: 1, marginTop: 8 }}>
        {error ? (
          <View style={{ marginTop: 8 }}>
            <Banner body={error} />
          </View>
        ) : null}
        {notice ? (
          <View style={{ marginTop: 8 }}>
            <Banner tone="pr" body={notice} />
          </View>
        ) : null}
        <Text variant="overline" color="ink2" style={{ marginTop: 12 }}>
          My templates
        </Text>
        {templates.isPending ? (
          <View style={{ gap: 12, marginTop: 12 }}>
            <Skeleton width="100%" height={64} />
            <Skeleton width="100%" height={64} />
          </View>
        ) : null}
        {templates.data?.length === 0 ? (
          <EmptyState
            icon={<LayoutList color={colors.ink} size={64} strokeWidth={1.5} />}
            title="No templates yet"
            body="Open a workout’s ⋯ menu, during it or later from History, and choose Save as template. Or copy a day from Programs below."
          />
        ) : null}
        {templates.data?.map((template) => (
          <View
            key={template.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: colors.hairline,
            }}
          >
            <View style={{ flex: 1 }}>
              <ListRow
                title={template.name}
                meta={templateSummary(template)}
                showChevron={false}
                onPress={() => start(template)}
              />
            </View>
            <IconButton
              icon={Ellipsis}
              label={`${template.name} options`}
              onPress={() => setMenu(template)}
            />
          </View>
        ))}
        <Text variant="overline" color="ink2" style={{ marginTop: 24 }}>
          Programs
        </Text>
        {PROGRAMS.map((program) => (
          <View
            key={program.id}
            style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline }}
          >
            <ListRow
              title={program.name}
              meta={`${program.description}\n${program.days.map((day) => day.name).join(' · ')}`}
              showChevron={false}
              onPress={() => setOpen(open === program ? null : program)}
            />
            {open === program
              ? program.days.map((day) => (
                  <View
                    key={day.name}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}
                  >
                    <View style={{ flex: 1 }}>
                      <ListRow
                        title={day.name}
                        meta={day.lifts.map(([slug]) => names.get(slug)).join(', ')}
                        showChevron={false}
                        onPress={() => start(programTemplate(program, day, exercises.data ?? []))}
                      />
                    </View>
                    <IconButton
                      icon={CopyPlus}
                      label={`Copy ${day.name} to my templates`}
                      onPress={() => copy(program, day)}
                    />
                  </View>
                ))
              : null}
          </View>
        ))}
      </ScrollView>
      {menu ? (
        <MenuSheet
          title={menu.name}
          actions={[
            {
              label: 'Rename',
              onPress: () => {
                setMenu(null);
                setRenaming(menu);
              },
            },
            {
              label: 'Delete template',
              danger: true,
              onPress: () => {
                setMenu(null);
                setDeleting(menu);
              },
            },
          ]}
          onClose={() => setMenu(null)}
        />
      ) : null}
      {renaming ? (
        <NameDialog
          title="Rename template"
          initialName={renaming.name}
          confirmLabel="Rename"
          onCancel={() => setRenaming(null)}
          onConfirm={async (name) => {
            await leaveWhenQueued(save.mutateAsync({ ...renaming, name }), () =>
              pausedMutation(client, mutationKeys.saveTemplate),
            );
            setRenaming(null);
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          confirmLabel="Delete"
          cancelLabel="Keep it"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            setDeleting(null);
            setError(null);
            leaveWhenQueued(remove.mutateAsync(deleting.id), () =>
              pausedMutation(client, mutationKeys.deleteTemplate),
            ).catch((caught: unknown) =>
              setError(caught instanceof Error ? caught.message : 'Couldn’t delete that template.'),
            );
          }}
        />
      ) : null}
    </Screen>
  );
}
