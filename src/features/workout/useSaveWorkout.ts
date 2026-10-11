import { useMutation, useQueryClient } from '@tanstack/react-query';

import { mutationKeys, saveWorkoutMutation } from '../../data/queryClient';
import { stampOwner } from '../../data/sessionUser';
import type { WorkoutInput } from '../../data/types';

export function useSaveWorkout() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.saveWorkout,
    mutationFn: saveWorkoutMutation,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['workouts'] });
      await client.invalidateQueries({ queryKey: ['exerciseHistory'] });
    },
  });
  return {
    ...mutation,
    mutateAsync: (workout: WorkoutInput) => mutation.mutateAsync(stampOwner(workout)),
  };
}
