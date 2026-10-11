import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '../../data/keys';
import { mutationKeys, saveCardioMutation } from '../../data/queryClient';
import { getRepo } from '../../data/repo';
import { getSessionUserId, stampOwner } from '../../data/sessionUser';
import type { Cardio, CardioInput } from '../../data/types';

export function cardioSessionKey(id: string) {
  return ['cardio', 'session', id] as const;
}

async function findCardio(id: string): Promise<Cardio | null> {
  let before: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 20; page += 1) {
    const rows = await getRepo().listCardio({ before, limit: 100 });
    const hit = rows.find((row) => row.id === id);
    if (hit) return hit;
    const last = rows[rows.length - 1];
    if (rows.length < 100 || !last || seen.has(last.startedAt)) return null;
    seen.add(last.startedAt);
    before = last.startedAt;
  }
  return null;
}

function storedCardio(input: CardioInput): Cardio {
  const distance = input.distanceM ?? null;
  return {
    id: input.id,
    activity: input.activity,
    startedAt: new Date(input.startedAt).toISOString(),
    durationS: input.durationS,
    distanceM: distance == null ? null : Math.round(distance * 10) / 10,
    calories: input.calories ?? null,
    avgHeartRate: input.avgHeartRate ?? null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
}

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: () => getRepo().getProfile(),
  });
}

export function useCardioSession(id: string | undefined) {
  return useQuery({
    queryKey: cardioSessionKey(id ?? 'none'),
    queryFn: () => findCardio(id!),
    enabled: Boolean(id),
  });
}

export function useSaveCardio() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.saveCardio,
    mutationFn: saveCardioMutation,
    onSuccess: (_result, input) => {
      if (input.userId && input.userId !== getSessionUserId()) return;
      client.setQueryData(cardioSessionKey(input.id), storedCardio(input));
      void client.invalidateQueries({ queryKey: ['cardio'] });
    },
  });
  return {
    ...mutation,
    mutateAsync: (cardio: CardioInput) => mutation.mutateAsync(stampOwner(cardio)),
  };
}

export function useDeleteCardio() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.deleteCardio,
    mutationFn: (id: string) => getRepo().deleteCardio(id),
    onSuccess: (_result, id) => {
      client.removeQueries({ queryKey: cardioSessionKey(id) });
      void client.invalidateQueries({ queryKey: ['cardio'] });
    },
  });
}
