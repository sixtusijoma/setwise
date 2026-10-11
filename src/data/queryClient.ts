import { MutationCache, QueryClient, onlineManager } from '@tanstack/react-query';

import { isQueryPersistHeld, queryPersister } from './queryPersist';
import { getRepo, isLocalMode } from './repo';
import { mutationBelongsToSession } from './sessionUser';
import { installSync } from './sync';
import type { CardioInput, NewExercise, Template, WorkoutInput } from './types';

export { queryPersister };

type Owned = { userId?: string };

async function acceptsMutation(ownerId: string | undefined): Promise<boolean> {
  const session = await getRepo().session();
  return mutationBelongsToSession(ownerId, session?.userId ?? null);
}

function withoutOwner<T extends Owned>(variables: T): Omit<T, 'userId'> {
  const { userId: _userId, ...body } = variables;
  return body;
}

export const mutationKeys = {
  saveWorkout: ['saveWorkout'] as const,
  saveCardio: ['saveCardio'] as const,
  deleteWorkout: ['deleteWorkout'] as const,
  deleteCardio: ['deleteCardio'] as const,
  createExercise: ['createExercise'] as const,
  saveTemplate: ['saveTemplate'] as const,
  deleteTemplate: ['deleteTemplate'] as const,
};

// Remote writes use `online` so they pause before any request. `offlineFirst`
// would run, fail, and settle as an error, and Today's banner would stay blank.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
    },
    mutations: {
      networkMode: isLocalMode() ? 'always' : 'online',
      gcTime: 1000 * 60 * 60 * 24,
    },
    dehydrate: {
      shouldDehydrateMutation: (mutation) => !isQueryPersistHeld() && mutation.state.isPaused,
      shouldDehydrateQuery: (query) => !isQueryPersistHeld() && query.state.status === 'success',
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const name = mutation.options.mutationKey?.[0];
      if (name === 'saveWorkout' || name === 'deleteWorkout') {
        void queryClient.invalidateQueries({ queryKey: ['workouts'] });
        void queryClient.invalidateQueries({ queryKey: ['exerciseHistory'] });
      }
      if (name === 'saveCardio' || name === 'deleteCardio') {
        void queryClient.invalidateQueries({ queryKey: ['cardio'] });
      }
      if (name === 'saveTemplate' || name === 'deleteTemplate') {
        void queryClient.invalidateQueries({ queryKey: ['templates'] });
      }
      if (name === 'createExercise') {
        void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      }
    },
  }),
});

async function settleExerciseCreates(): Promise<void> {
  const pending = queryClient.getMutationCache().findAll({
    mutationKey: mutationKeys.createExercise,
    status: 'pending',
  });
  await Promise.all(
    pending.map((mutation) =>
      mutation.continue().then(
        () => undefined,
        () => undefined,
      ),
    ),
  );
}

export async function saveWorkoutMutation(workout: WorkoutInput & Owned): Promise<void> {
  if (!(await acceptsMutation(workout.userId))) return;
  await settleExerciseCreates();
  if (!(await acceptsMutation(workout.userId))) return;
  await getRepo().saveWorkout(withoutOwner(workout));
}

export async function createExerciseMutation(exercise: NewExercise & Owned) {
  if (!(await acceptsMutation(exercise.userId))) return undefined;
  return getRepo().createExercise(withoutOwner(exercise));
}

export async function saveCardioMutation(cardio: CardioInput & Owned): Promise<void> {
  if (!(await acceptsMutation(cardio.userId))) return;
  await getRepo().saveCardio(withoutOwner(cardio));
}

export async function saveTemplateMutation(template: Template & Owned): Promise<void> {
  if (!(await acceptsMutation(template.userId))) return;
  await settleExerciseCreates();
  if (!(await acceptsMutation(template.userId))) return;
  await getRepo().saveTemplate(withoutOwner(template));
}

export async function deleteTemplateMutation({ id, userId }: { id: string } & Owned) {
  if (!(await acceptsMutation(userId))) return;
  await getRepo().deleteTemplate(id);
}

queryClient.setMutationDefaults(mutationKeys.saveTemplate, {
  mutationFn: saveTemplateMutation,
});

queryClient.setMutationDefaults(mutationKeys.deleteTemplate, {
  mutationFn: deleteTemplateMutation,
});

queryClient.setMutationDefaults(mutationKeys.saveWorkout, {
  mutationFn: saveWorkoutMutation,
});

queryClient.setMutationDefaults(mutationKeys.createExercise, {
  mutationFn: createExerciseMutation,
});

queryClient.setMutationDefaults(mutationKeys.saveCardio, {
  mutationFn: saveCardioMutation,
});

queryClient.setMutationDefaults(mutationKeys.deleteWorkout, {
  mutationFn: async (id: string) => {
    await getRepo().deleteWorkout(id);
  },
});

queryClient.setMutationDefaults(mutationKeys.deleteCardio, {
  mutationFn: async (id: string) => {
    await getRepo().deleteCardio(id);
  },
});

installSync();

export async function resumeOfflineMutations(): Promise<void> {
  if (!onlineManager.isOnline()) return;
  await queryClient.resumePausedMutations();
}
