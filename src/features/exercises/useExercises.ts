import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '../../data/keys';
import { createExerciseMutation, mutationKeys } from '../../data/queryClient';
import { getRepo } from '../../data/repo';
import { stampOwner } from '../../data/sessionUser';
import type { NewExercise } from '../../data/types';

export function useExercises() {
  return useQuery({
    queryKey: keys.exercises,
    queryFn: () => getRepo().listExercises(),
  });
}

export function useCreateExercise() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.createExercise,
    mutationFn: createExerciseMutation,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.exercises });
    },
  });
  return {
    ...mutation,
    mutateAsync: (exercise: NewExercise) => mutation.mutateAsync(stampOwner(exercise)),
  };
}

export function useRecentWorkouts() {
  return useQuery({
    queryKey: keys.workouts({ limit: 100 }),
    queryFn: () => getRepo().listWorkouts({ limit: 100 }),
  });
}
