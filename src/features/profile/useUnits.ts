import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { keys } from '../../data/keys';
import { getRepo } from '../../data/repo';
import type { Profile } from '../../data/types';
import type { UnitSystem } from '../../lib/units';
import { useDraft } from '../workout/draft';

export function useUnits() {
  const client = useQueryClient();
  const profile = useQuery({
    queryKey: keys.profile,
    queryFn: () => getRepo().getProfile(),
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const generation = useRef(0);

  function setUnitSystem(unitSystem: UnitSystem) {
    const id = ++generation.current;
    const previous = client.getQueryData<Profile>(keys.profile);
    setSaveError(null);
    if (previous) client.setQueryData<Profile>(keys.profile, { ...previous, unitSystem });
    useDraft.getState().reformat(unitSystem);
    getRepo()
      .updateProfile({ unitSystem })
      .then((next) => {
        if (generation.current === id) client.setQueryData(keys.profile, next);
      })
      .catch(() => {
        if (generation.current !== id) return;
        if (previous) {
          client.setQueryData(keys.profile, previous);
          useDraft.getState().reformat(previous.unitSystem);
        }
        setSaveError("Couldn't save your units. Try again.");
      });
  }

  const loadError = profile.isError ? "Couldn't load your units." : null;

  return {
    profile: profile.data ?? null,
    loading: profile.isPending && !profile.data,
    error: saveError ?? loadError,
    setUnitSystem,
  };
}
