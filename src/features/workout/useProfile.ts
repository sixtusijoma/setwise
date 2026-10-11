import { useQuery } from '@tanstack/react-query';

import { keys } from '../../data/keys';
import { getRepo } from '../../data/repo';
import type { UnitSystem } from '../../lib/units';

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: () => getRepo().getProfile(),
  });
}

export function useUnitSystem(): UnitSystem | null {
  const profile = useProfile();
  return profile.data?.unitSystem ?? null;
}
