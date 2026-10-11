import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Exercise, Template, Workout, WorkoutInput } from '../../data/types';
import type { UnitSystem } from '../../lib/units';
import { formatVolume, formatWeight, lbToKg, roundTo, weightUnit } from '../../lib/units';
import { volumeKg } from '../../lib/stats';
import { statSets, trackOf } from '../exercises/tracks';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type DraftSet = {
  id: string;
  weightText: string;
  weightKg: number | null;
  repsText: string;
  completed: boolean;
};

export type DraftExercise = {
  id: string;
  exerciseId: string;
  notes: string;
  sets: DraftSet[];
};

export type Draft = {
  id: string;
  title: string;
  startedAt: string;
  /** Set when the draft was loaded from a finished workout, so Finish replaces that end. */
  endedAt?: string | null;
  exercises: DraftExercise[];
  restEndsAt: number | null;
};

type SetPatch = {
  weightText?: string;
  repsText?: string;
};

type DraftState = {
  draft: Draft | null;
  start: (now?: Date) => void;
  startFromTemplate: (template: Template, system: UnitSystem, now?: Date) => void;
  discard: () => void;
  setTitle: (title: string) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (id: string) => void;
  moveExercise: (id: string, direction: -1 | 1) => void;
  setNotes: (id: string, notes: string) => void;
  addSet: (exerciseId: string) => void;
  duplicateSet: (exerciseId: string) => void;
  updateSet: (exerciseId: string, setId: string, patch: SetPatch, system: UnitSystem) => void;
  toggleSet: (exerciseId: string, setId: string) => void;
  copyPrevious: (
    exerciseId: string,
    setId: string,
    weightKg: number,
    reps: number,
    system: UnitSystem,
  ) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  addRest: (seconds: number, now?: number) => void;
  clearRest: () => void;
  reformat: (system: UnitSystem) => void;
  loadForEdit: (workout: Workout, system: UnitSystem) => void;
};

export function defaultTitle(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} Workout`;
}

export function displayTitle(draft: Pick<Draft, 'title' | 'startedAt'>): string {
  const trimmed = draft.title.trim();
  if (trimmed) return trimmed;
  const started = new Date(draft.startedAt);
  if (Number.isNaN(started.getTime())) return 'Workout';
  return defaultTitle(started);
}

export function sanitizeWeight(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned.slice(0, 4);
  const whole = cleaned.slice(0, dot).slice(0, 4);
  const fraction = cleaned
    .slice(dot + 1)
    .replace(/\./g, '')
    .slice(0, 1);
  return `${whole}.${fraction}`;
}

export function sanitizeReps(text: string): string {
  return text.replace(/\D/g, '').slice(0, 3);
}

export function parseWeightText(text: string, system: UnitSystem): number | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === '.') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return system === 'imperial' ? lbToKg(value) : roundTo(value, 3);
}

export function parseReps(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function isEmptySet(set: DraftSet): boolean {
  return set.weightText.trim() === '' && set.repsText.trim() === '';
}

export function emptySetCount(draft: Draft): number {
  return draft.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter(isEmptySet).length,
    0,
  );
}

export function finishPrompt(dropped: number): string | null {
  if (dropped <= 0) return null;
  return `Finish and drop ${dropped} empty ${dropped === 1 ? 'set' : 'sets'}?`;
}

export function progressLabel(
  draft: Draft,
  catalog: Map<string, Exercise>,
  system: UnitSystem,
): string {
  let done = 0;
  let total = 0;
  let volume = 0;
  for (const exercise of draft.exercises) {
    const sets = exercise.sets
      .filter((set) => set.completed)
      .map((set) => ({ reps: parseReps(set.repsText) ?? 0, weightKg: set.weightKg ?? 0 }));
    total += exercise.sets.length;
    done += sets.length;
    volume += volumeKg(statSets(trackOf(catalog.get(exercise.exerciseId)), sets));
  }
  if (total === 0) return 'No sets yet';
  return `${done} of ${total} sets · ${formatVolume(volume, system)} ${weightUnit(system)}`;
}

export type FinishResult =
  { ok: true; input: WorkoutInput; dropped: number } | { ok: false; message: string };

export function prepareFinish(draft: Draft, endedAt: string): FinishResult {
  const exercises: WorkoutInput['exercises'] = [];
  for (const exercise of draft.exercises) {
    const sets: WorkoutInput['exercises'][number]['sets'] = [];
    for (const set of exercise.sets) {
      if (isEmptySet(set)) continue;
      const reps = parseReps(set.repsText);
      if (reps == null || (set.weightText.trim() !== '' && set.weightKg == null)) {
        return { ok: false, message: 'Check the weight and reps on each set you started.' };
      }
      const weightKg = set.weightKg ?? 0;
      if (weightKg > 1500) {
        return { ok: false, message: 'Weight must be between 0 and 1500 kg.' };
      }
      sets.push({ id: set.id, reps, weightKg });
    }
    if (sets.length === 0) continue;
    exercises.push({
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      notes: exercise.notes.trim() || null,
      sets,
    });
  }
  if (exercises.length === 0) {
    return { ok: false, message: 'Log at least one set before finishing.' };
  }
  return {
    ok: true,
    dropped: emptySetCount(draft),
    input: {
      id: draft.id,
      title: draft.title.trim() || null,
      startedAt: draft.startedAt,
      endedAt: draft.endedAt || endedAt,
      notes: null,
      exercises,
    },
  };
}

export function draftFromWorkout(workout: Workout, system: UnitSystem): Draft {
  return {
    id: workout.id,
    title: workout.title ?? defaultTitle(new Date(workout.startedAt)),
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    restEndsAt: null,
    exercises: workout.exercises
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        notes: exercise.notes ?? '',
        sets: exercise.sets
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((set) => ({
            id: set.id,
            weightKg: set.weightKg,
            weightText: formatWeight(set.weightKg, system),
            repsText: String(set.reps),
            completed: true,
          })),
      })),
  };
}

export function draftFromTemplate(template: Template, system: UnitSystem, now: Date): Draft {
  return {
    id: Crypto.randomUUID(),
    title: template.name,
    startedAt: now.toISOString(),
    endedAt: null,
    restEndsAt: null,
    exercises: template.exercises.map((exercise) => ({
      id: Crypto.randomUUID(),
      exerciseId: exercise.exerciseId,
      notes: '',
      sets: (exercise.sets.length ? exercise.sets : [{ reps: 0, weightKg: 0 }]).map((set) => ({
        id: Crypto.randomUUID(),
        weightKg: set.weightKg || null,
        weightText: set.weightKg ? formatWeight(set.weightKg, system) : '',
        repsText: set.reps ? String(set.reps) : '',
        completed: false,
      })),
    })),
  };
}

function blankSet(): DraftSet {
  return {
    id: Crypto.randomUUID(),
    weightText: '',
    weightKg: null,
    repsText: '',
    completed: false,
  };
}

function mapDraft(draft: Draft | null, recipe: (draft: Draft) => Draft): { draft: Draft | null } {
  if (!draft) return { draft };
  return { draft: recipe(draft) };
}

function mapExercise(
  draft: Draft,
  exerciseId: string,
  recipe: (exercise: DraftExercise) => DraftExercise,
): Draft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) =>
      exercise.id === exerciseId ? recipe(exercise) : exercise,
    ),
  };
}

export const useDraft = create<DraftState>()(
  persist(
    (set, get) => ({
      draft: null,
      start: (now = new Date()) => {
        if (get().draft) return;
        set({
          draft: {
            id: Crypto.randomUUID(),
            title: defaultTitle(now),
            startedAt: now.toISOString(),
            endedAt: null,
            exercises: [],
            restEndsAt: null,
          },
        });
      },
      startFromTemplate: (template, system, now = new Date()) => {
        if (get().draft) return;
        set({ draft: draftFromTemplate(template, system, now) });
      },
      discard: () => set({ draft: null }),
      setTitle: (title) =>
        set((state) => mapDraft(state.draft, (draft) => ({ ...draft, title: title.slice(0, 60) }))),
      addExercise: (exerciseId) =>
        set((state) =>
          mapDraft(state.draft, (draft) => ({
            ...draft,
            exercises: [
              ...draft.exercises,
              {
                id: Crypto.randomUUID(),
                exerciseId,
                notes: '',
                sets: [blankSet()],
              },
            ],
          })),
        ),
      removeExercise: (id) =>
        set((state) =>
          mapDraft(state.draft, (draft) => ({
            ...draft,
            exercises: draft.exercises.filter((exercise) => exercise.id !== id),
          })),
        ),
      moveExercise: (id, direction) =>
        set((state) =>
          mapDraft(state.draft, (draft) => {
            const index = draft.exercises.findIndex((exercise) => exercise.id === id);
            const next = index + direction;
            if (index < 0 || next < 0 || next >= draft.exercises.length) return draft;
            const exercises = draft.exercises.slice();
            const [moved] = exercises.splice(index, 1);
            exercises.splice(next, 0, moved);
            return { ...draft, exercises };
          }),
        ),
      setNotes: (id, notes) =>
        set((state) =>
          mapDraft(state.draft, (draft) =>
            mapExercise(draft, id, (exercise) => ({ ...exercise, notes: notes.slice(0, 500) })),
          ),
        ),
      addSet: (exerciseId) =>
        set((state) =>
          mapDraft(state.draft, (draft) =>
            mapExercise(draft, exerciseId, (exercise) => ({
              ...exercise,
              sets: [...exercise.sets, blankSet()],
            })),
          ),
        ),
      duplicateSet: (exerciseId) =>
        set((state) =>
          mapDraft(state.draft, (draft) =>
            mapExercise(draft, exerciseId, (exercise) => ({
              ...exercise,
              sets: [
                ...exercise.sets,
                {
                  ...exercise.sets[exercise.sets.length - 1],
                  id: Crypto.randomUUID(),
                  completed: false,
                },
              ],
            })),
          ),
        ),
      updateSet: (exerciseId, setId, patch, system) =>
        set((state) =>
          mapDraft(state.draft, (draft) =>
            mapExercise(draft, exerciseId, (exercise) => ({
              ...exercise,
              sets: exercise.sets.map((row) => {
                if (row.id !== setId) return row;
                const next = { ...row };
                if (patch.weightText !== undefined) {
                  next.weightText = sanitizeWeight(patch.weightText);
                  next.weightKg = parseWeightText(next.weightText, system);
                }
                if (patch.repsText !== undefined) next.repsText = sanitizeReps(patch.repsText);
                return next;
              }),
            })),
          ),
        ),
      toggleSet: (exerciseId, setId) =>
        set((state) =>
          mapDraft(state.draft, (draft) =>
            mapExercise(draft, exerciseId, (exercise) => ({
              ...exercise,
              sets: exercise.sets.map((row) =>
                row.id === setId ? { ...row, completed: !row.completed } : row,
              ),
            })),
          ),
        ),
      copyPrevious: (exerciseId, setId, weightKg, reps, system) =>
        set((state) =>
          mapDraft(state.draft, (draft) =>
            mapExercise(draft, exerciseId, (exercise) => ({
              ...exercise,
              sets: exercise.sets.map((row) =>
                row.id === setId
                  ? {
                      ...row,
                      weightKg,
                      weightText: formatWeight(weightKg, system),
                      repsText: String(reps),
                    }
                  : row,
              ),
            })),
          ),
        ),
      removeSet: (exerciseId, setId) =>
        set((state) =>
          mapDraft(state.draft, (draft) =>
            mapExercise(draft, exerciseId, (exercise) => ({
              ...exercise,
              sets:
                exercise.sets.length === 1
                  ? exercise.sets
                  : exercise.sets.filter((row) => row.id !== setId),
            })),
          ),
        ),
      addRest: (seconds, now = Date.now()) =>
        set((state) =>
          mapDraft(state.draft, (draft) => {
            if (draft.restEndsAt == null) return draft;
            return { ...draft, restEndsAt: Math.max(draft.restEndsAt, now) + seconds * 1000 };
          }),
        ),
      clearRest: () =>
        set((state) => mapDraft(state.draft, (draft) => ({ ...draft, restEndsAt: null }))),
      reformat: (system) =>
        set((state) =>
          mapDraft(state.draft, (draft) => ({
            ...draft,
            exercises: draft.exercises.map((exercise) => ({
              ...exercise,
              sets: exercise.sets.map((row) => ({
                ...row,
                weightText:
                  row.weightKg == null ? row.weightText : formatWeight(row.weightKg, system),
              })),
            })),
          })),
        ),
      loadForEdit: (workout, system) => set({ draft: draftFromWorkout(workout, system) }),
    }),
    {
      name: 'setwise.draft',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ draft: state.draft }),
    },
  ),
);
