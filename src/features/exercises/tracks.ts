import library from '../../../data/exercise-library.json';
import type { Track } from '../../data/types';

export type { Track };

const tracks = new Map(
  (library as { slug: string; track?: Track }[]).map((row) => [row.slug, row.track ?? 'weight']),
);

export function trackOf(exercise?: { slug: string | null; track?: Track | null }): Track {
  return exercise?.track ?? tracks.get(exercise?.slug ?? '') ?? 'weight';
}

/** `reps` holds seconds. */
export function timed(track: Track): boolean {
  return track === 'time' || track === 'weighted-time';
}

/**
 * Stats read assistance as negative load, so less help ranks higher and e1RM and volume skip it.
 * Timed sets keep their load for ranking (heaviest, then longest) but are left out of e1RM and volume.
 */
export function statKg(track: Track, weightKg: number): number {
  return track === 'assisted' ? -weightKg : weightKg;
}

export function statSets<Set extends { weightKg: number }>(
  track: Track,
  sets: readonly Set[],
): (Set & { timed: boolean })[] {
  return sets.map((set) => ({
    ...set,
    weightKg: statKg(track, set.weightKg),
    timed: timed(track),
  }));
}
