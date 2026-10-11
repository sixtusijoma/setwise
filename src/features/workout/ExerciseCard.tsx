import { Copy, Ellipsis, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Exercise } from '../../data/types';
import type { UnitSystem } from '../../lib/units';
import { weightUnit } from '../../lib/units';
import { fontFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, Field, SetRow, Text } from '../../ui';
import { isTopSetPr, previousLabel, type LoggedSet } from '../exercises/history';
import { allTimeReminderLabel } from '../history/records';
import { useLoggedWorkouts } from '../progress/useProgress';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../exercises/labels';
import { statKg, statSets, timed, trackOf } from '../exercises/tracks';
import { ConfirmDialog, MenuSheet } from './dialogs';
import { parseReps, useDraft, type DraftExercise } from './draft';

type Props = {
  exercise: DraftExercise;
  index: number;
  count: number;
  info?: Exercise;
  previous: LoggedSet[];
  system: UnitSystem;
};

export function ExerciseCard({ exercise, index, count, info, previous, system }: Props) {
  const { colors, widthClass } = useTheme();
  const compact = widthClass === 'compact';
  const updateSet = useDraft((state) => state.updateSet);
  const toggleSet = useDraft((state) => state.toggleSet);
  const copyPrevious = useDraft((state) => state.copyPrevious);
  const addSet = useDraft((state) => state.addSet);
  const duplicateSet = useDraft((state) => state.duplicateSet);
  const setNotes = useDraft((state) => state.setNotes);
  const removeExercise = useDraft((state) => state.removeExercise);
  const moveExercise = useDraft((state) => state.moveExercise);
  const removeSet = useDraft((state) => state.removeSet);
  const [menu, setMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [notesOpen, setNotesOpen] = useState(exercise.notes.length > 0);
  const logged = useLoggedWorkouts();
  const name = info?.name ?? 'Exercise';
  const meta = info
    ? `${EQUIPMENT_LABELS[info.equipment]} · ${MUSCLE_LABELS[info.muscleGroup]}`
    : '';
  const unit = weightUnit(system);
  const track = trackOf(info);
  const loaded = track !== 'reps' && track !== 'time';
  const reminder = allTimeReminderLabel(
    exercise.exerciseId,
    track,
    logged.data ?? [],
    system,
  );
  const actions = [
    ...(index > 0 ? [{ label: 'Move up', onPress: () => moveExercise(exercise.id, -1) }] : []),
    ...(index < count - 1
      ? [{ label: 'Move down', onPress: () => moveExercise(exercise.id, 1) }]
      : []),
    { label: notesOpen ? 'Hide note' : 'Add note', onPress: () => setNotesOpen((open) => !open) },
    ...(exercise.sets.length > 1
      ? [
          {
            label: 'Remove last set',
            onPress: () => {
              const last = exercise.sets[exercise.sets.length - 1];
              if (last) removeSet(exercise.id, last.id);
            },
          },
        ]
      : []),
    {
      label: 'Remove exercise',
      danger: true,
      onPress: () => setConfirmRemove(true),
    },
  ];

  return (
    <Card style={{ marginTop: 12, paddingTop: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}>
        <ExerciseThumb
          exercise={info ?? { slug: null, ownerId: 'missing', name, muscleGroup: 'full_body' }}
        />
        <View style={{ flex: 1 }}>
          <Text variant="headline">{name}</Text>
          {meta ? (
            <Text variant="footnote" color="ink2">
              {meta}
            </Text>
          ) : null}
          {reminder ? (
            <Text variant="footnote" color="ink2" style={{ marginTop: 2 }}>
              {reminder}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name} options`}
          hitSlop={8}
          onPress={() => setMenu(true)}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ellipsis color={colors.ink2} size={20} strokeWidth={2.25} />
        </Pressable>
      </View>
      {notesOpen ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
          <Field
            label="Notes"
            value={exercise.notes}
            onChangeText={(notes) => setNotes(exercise.id, notes)}
            placeholder="Note for this exercise"
          />
        </View>
      ) : null}
      {loaded ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 4,
              paddingTop: 14,
              paddingBottom: 0,
            }}
          >
            <Text variant="footnote" color="ink3" style={headerCell(36)}>
              SET
            </Text>
            <Text variant="footnote" color="ink3" style={{ flex: 1, letterSpacing: 0.4 }}>
              PREVIOUS
            </Text>
            <Text variant="footnote" color="ink3" style={headerCell(44)}>
              DONE
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingHorizontal: 4,
              paddingLeft: 40,
              paddingRight: 48,
              paddingBottom: 4,
              gap: 2,
            }}
          >
            <Text variant="footnote" color="ink3" style={headerCell(compact ? 120 : 124)}>
              {track === 'assisted' ? 'ASSIST' : unit.toUpperCase()}
            </Text>
            <View style={{ width: 6 }} />
            <Text variant="footnote" color="ink3" style={headerCell(compact ? 108 : 112)}>
              {timed(track) ? 'SEC' : 'REPS'}
            </Text>
          </View>
        </>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 4,
            paddingTop: 14,
            paddingBottom: 4,
          }}
        >
          <Text variant="footnote" color="ink3" style={headerCell(36)}>
            SET
          </Text>
          <Text variant="footnote" color="ink3" style={{ flex: 1, letterSpacing: 0.4 }}>
            PREVIOUS
          </Text>
          <Text variant="footnote" color="ink3" style={headerCell(compact ? 108 : 112)}>
            {timed(track) ? 'SEC' : 'REPS'}
          </Text>
          <Text variant="footnote" color="ink3" style={headerCell(44)}>
            DONE
          </Text>
        </View>
      )}
      {exercise.sets.map((set, setIndex) => {
        const prior = previous[setIndex];
        const reps = parseReps(set.repsText);
        const pr =
          set.completed &&
          reps != null &&
          set.weightKg != null &&
          isTopSetPr(statSets(track, previous), reps, statKg(track, set.weightKg));
        return (
          <View key={set.id} style={{ position: 'relative' }}>
            <SetRow
              index={setIndex + 1}
              previous={prior ? previousLabel(prior, system, track) : undefined}
              weight={loaded ? set.weightText : undefined}
              reps={set.repsText}
              unit={unit}
              repsUnit={timed(track) ? 'seconds' : 'reps'}
              completed={set.completed}
              pr={pr}
              onChangeWeight={(weightText) =>
                updateSet(exercise.id, set.id, { weightText }, system)
              }
              onChangeReps={(repsText) => updateSet(exercise.id, set.id, { repsText }, system)}
              onToggle={() => toggleSet(exercise.id, set.id)}
            />
            {prior ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Copy previous for set ${setIndex + 1} of ${name}`}
                onPress={() =>
                  copyPrevious(exercise.id, set.id, prior.weightKg, prior.reps, system)
                }
                style={{
                  position: 'absolute',
                  left: 40,
                  right: loaded ? 44 : 156,
                  top: 0,
                  height: loaded ? 40 : undefined,
                  bottom: loaded ? undefined : 0,
                }}
              />
            ) : null}
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add set to ${name}`}
          onPress={() => addSet(exercise.id)}
          style={setAction}
        >
          <Plus color={colors.accent} size={16} strokeWidth={2.4} />
          <Text
            variant="footnote"
            style={{ color: colors.accent, fontFamily: fontFamily.semibold }}
          >
            Add set
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Duplicate last set of ${name}`}
          onPress={() => duplicateSet(exercise.id)}
          style={setAction}
        >
          <Copy color={colors.accent} size={16} strokeWidth={2.4} />
          <Text
            variant="footnote"
            style={{ color: colors.accent, fontFamily: fontFamily.semibold }}
          >
            Duplicate set
          </Text>
        </Pressable>
      </View>
      {menu ? (
        <MenuSheet
          title={name}
          actions={actions.map((action) => ({
            ...action,
            onPress: () => {
              setMenu(false);
              action.onPress();
            },
          }))}
          onClose={() => setMenu(false)}
        />
      ) : null}
      {confirmRemove ? (
        <ConfirmDialog
          title={`Remove ${name}?`}
          confirmLabel="Remove"
          cancelLabel="Keep"
          danger
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false);
            removeExercise(exercise.id);
          }}
        />
      ) : null}
    </Card>
  );
}

const setAction = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  paddingHorizontal: 14,
  minHeight: 44,
};

function headerCell(width: number) {
  return { width, textAlign: 'center' as const, letterSpacing: 0.4 };
}
