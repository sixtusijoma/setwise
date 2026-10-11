import type { UnitSystem } from './units';
import {
  M_IN_KM,
  M_IN_MI,
  formatDuration,
  formatPaceClock,
  kmToMeters,
  milesToMeters,
} from './units';

const PACE_ACTIVITIES = new Set(['run', 'walk', 'hike']);

export const MIN_DURATION_S = 1;
export const MAX_DURATION_S = 24 * 60 * 60;

/** Pace is a running, walking, or hiking idea. Other activities stay a duration. */
export function showsPace(activity: string, distanceM: number | null | undefined): boolean {
  return PACE_ACTIVITIES.has(activity) && distanceM != null && distanceM > 0;
}

export function splitDuration(totalSeconds: number): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const total = Math.max(0, Math.round(totalSeconds));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Whole seconds, or null when the parts aren't a saveable duration (1 s–24 h). */
export function durationSeconds(hours: number, minutes: number, seconds: number): number | null {
  if (![hours, minutes, seconds].every((part) => Number.isInteger(part) && part >= 0)) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  if (total < MIN_DURATION_S || total > MAX_DURATION_S) return null;
  return total;
}

export function formatDurationClock(totalSeconds: number): string {
  return formatDuration(totalSeconds);
}

export type Pace = {
  perMile: string;
  perKm: string;
};

/** `8:36` clocks. Null when distance or duration can't produce a pace. */
export function formatPace(distanceM: number, durationS: number): Pace | null {
  if (
    !(distanceM > 0) ||
    !(durationS > 0) ||
    !Number.isFinite(distanceM) ||
    !Number.isFinite(durationS)
  ) {
    return null;
  }
  const perMile = durationS / (distanceM / M_IN_MI);
  const perKm = durationS / (distanceM / M_IN_KM);
  return {
    perMile: formatPaceClock(perMile),
    perKm: formatPaceClock(perKm),
  };
}

/**
 * Empty is valid and means no distance. A number has to be > 0 and within 1,000 km.
 * Incomplete typing ("3.") is invalid until it becomes a real distance.
 */
export function parseDistance(
  text: string,
  system: UnitSystem,
): { meters: number | null; valid: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { meters: null, valid: true };
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(trimmed)) return { meters: null, valid: false };
  const value = Number(trimmed);
  if (!(value > 0)) return { meters: null, valid: false };
  const meters = system === 'imperial' ? milesToMeters(value) : kmToMeters(value);
  if (!(meters > 0) || meters > 1_000_000) return { meters: null, valid: false };
  return { meters, valid: true };
}
