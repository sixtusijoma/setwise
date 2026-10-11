import { useEffect, useRef, useState } from 'react';

import { getRepo } from '../../data/repo';
import type { Profile, Session } from '../../data/types';
import type { UnitSystem } from '../../lib/units';

export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => getRepo().onSession(setSession), []);
  return session;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    let alive = true;
    getRepo()
      .getProfile()
      .then((next) => {
        if (alive) setProfile(next);
      })
      .catch(() => {
        if (alive) setError("Couldn't load your units.");
      });
    return () => {
      alive = false;
    };
  }, []);

  function setUnitSystem(unitSystem: UnitSystem) {
    const id = ++generation.current;
    setError(null);
    setProfile((current) => (current ? { ...current, unitSystem } : current));
    getRepo()
      .updateProfile({ unitSystem })
      .then((next) => {
        if (generation.current === id) setProfile(next);
      })
      .catch(() => {
        if (generation.current !== id) return;
        setError("Couldn't save your units. Try again.");
        getRepo()
          .getProfile()
          .then((fresh) => {
            if (generation.current === id) setProfile(fresh);
          })
          .catch(() => undefined);
      });
  }

  return { profile, error, setUnitSystem };
}
