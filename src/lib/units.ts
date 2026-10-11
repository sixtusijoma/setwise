export const LB_IN_KG = 0.45359237;
export const M_IN_MI = 1609.344;
export const M_IN_KM = 1000;

export type UnitSystem = 'imperial' | 'metric';

/** Round half away from zero. Values are shifted as decimals to avoid binary drift. */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) throw new Error('Expected a finite number');
  const sign = value < 0 ? '-' : '';
  const [whole, frac = ''] = Math.abs(value)
    .toFixed(decimals + 6)
    .split('.');
  const digits = (frac + '0'.repeat(decimals + 1)).slice(0, decimals + 1);
  const keep = digits.slice(0, decimals);
  const next = digits[decimals] ?? '0';
  let rounded = BigInt(whole + (keep || '0'));
  if (next >= '5') rounded += 1n;
  const text = rounded.toString().padStart(decimals + 1, '0');
  const cut = text.length - decimals;
  const head = text.slice(0, cut);
  const tail = text.slice(cut);
  const body = decimals === 0 ? head : `${head}.${tail}`;
  return Number(sign + body);
}

export function lbToKg(lb: number): number {
  return roundTo(lb * LB_IN_KG, 3);
}

export function kgToLb(kg: number): number {
  return roundTo(kg / LB_IN_KG, 1);
}

export function milesToMeters(miles: number): number {
  return roundTo(miles * M_IN_MI, 1);
}

export function metersToMiles(meters: number): number {
  return roundTo(meters / M_IN_MI, 2);
}

export function kmToMeters(km: number): number {
  return roundTo(km * M_IN_KM, 1);
}

export function metersToKm(meters: number): number {
  return roundTo(meters / M_IN_KM, 2);
}

export function weightUnit(system: UnitSystem): 'lb' | 'kg' {
  return system === 'imperial' ? 'lb' : 'kg';
}

export function distanceUnit(system: UnitSystem): 'mi' | 'km' {
  return system === 'imperial' ? 'mi' : 'km';
}

function trimTenths(value: number): string {
  const fixed = roundTo(value, 1).toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

export function formatWeight(kg: number, system: UnitSystem): string {
  const shown = system === 'imperial' ? kgToLb(kg) : roundTo(kg, 1);
  return trimTenths(shown);
}

export function formatThousands(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatVolume(kg: number, system: UnitSystem): string {
  const shown = system === 'imperial' ? kg / LB_IN_KG : kg;
  return formatThousands(shown);
}

export function formatDistance(meters: number, system: UnitSystem): string {
  const shown = system === 'imperial' ? meters / M_IN_MI : meters / M_IN_KM;
  return roundTo(shown, 2).toFixed(2);
}

export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/** Pace clock, minutes can exceed 59: `8:36`. */
export function formatPaceClock(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
