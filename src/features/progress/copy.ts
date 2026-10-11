import type { Metric, RangeId } from '../../lib/stats';
import { seriesDelta } from '../../lib/stats';
import {
  formatThousands,
  kgToLb,
  LB_IN_KG,
  roundTo,
  weightUnit,
  type UnitSystem,
} from '../../lib/units';

export const WEIGHTED_METRICS: { value: Metric; label: string }[] = [
  { value: 'topSet', label: 'Top set' },
  { value: 'e1rm', label: 'Est. 1RM' },
  { value: 'volume', label: 'Volume' },
];

export const REPS_METRICS: { value: Metric; label: string }[] = [
  { value: 'maxReps', label: 'Max reps' },
  { value: 'totalReps', label: 'Total reps' },
];

export const TIME_METRICS: { value: Metric; label: string }[] = [
  { value: 'maxTime', label: 'Longest' },
  { value: 'totalTime', label: 'Total time' },
];

export const WEIGHTED_TIME_METRICS: { value: Metric; label: string }[] = [
  { value: 'topSet', label: 'Top set' },
  { value: 'maxTime', label: 'Longest' },
];

export const RANGES: { value: RangeId; label: string; phrase: string }[] = [
  { value: '1M', label: '1M', phrase: 'in 1 month' },
  { value: '3M', label: '3M', phrase: 'in 3 months' },
  { value: '6M', label: '6M', phrase: 'in 6 months' },
  { value: '1Y', label: '1Y', phrase: 'in 1 year' },
  { value: 'all', label: 'All', phrase: 'all time' },
];

const SUMMARY: Record<Metric, string> = {
  topSet: 'Top set',
  e1rm: 'Estimated one-rep max',
  volume: 'Volume',
  maxReps: 'Max reps',
  totalReps: 'Total reps',
  maxTime: 'Longest set',
  totalTime: 'Total time',
};

const COUNTS: readonly Metric[] = ['maxReps', 'totalReps', 'maxTime', 'totalTime'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function roundDelta(value: number, metric: Metric): number {
  if (metric === 'topSet' || metric === 'e1rm') return roundTo(value, 1);
  return Math.round(value);
}

export function displayMeasure(value: number, metric: Metric, system: UnitSystem): number {
  if (COUNTS.includes(metric)) return value;
  if (metric === 'volume') {
    const shown = system === 'imperial' ? value / LB_IN_KG : value;
    return Math.round(shown);
  }
  return system === 'imperial' ? kgToLb(value) : roundTo(value, 1);
}

export function formatShown(value: number, metric: Metric): string {
  if (metric === 'volume' || COUNTS.includes(metric)) {
    return formatThousands(Math.round(value));
  }
  const fixed = roundTo(value, 1).toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

export function formatCanonical(value: number, metric: Metric, system: UnitSystem): string {
  return formatShown(displayMeasure(value, metric, system), metric);
}

export function unitAbbrev(metric: Metric, system: UnitSystem): string {
  if (metric === 'maxTime' || metric === 'totalTime') return 's';
  if (metric === 'maxReps' || metric === 'totalReps') return 'reps';
  return weightUnit(system);
}

export function unitWord(metric: Metric, system: UnitSystem): string {
  if (metric === 'maxTime' || metric === 'totalTime') return 'seconds';
  if (metric === 'maxReps' || metric === 'totalReps') return 'reps';
  return system === 'imperial' ? 'pounds' : 'kilograms';
}

export function rangePhrase(range: RangeId): string {
  return RANGES.find((item) => item.value === range)?.phrase ?? 'all time';
}

export function metricSummary(metric: Metric): string {
  return SUMMARY[metric];
}

export function chartSummary(
  metric: Metric,
  system: UnitSystem,
  canonical: readonly number[],
  range: RangeId,
): string {
  const name = SUMMARY[metric];
  const phrase = rangePhrase(range);
  const word = unitWord(metric, system);
  if (canonical.length === 0) return `${name}, no data ${phrase}`;
  const shown = canonical.map((value) => displayMeasure(value, metric, system));
  const latest = formatShown(shown[shown.length - 1] ?? 0, metric);
  if (shown.length < 2) return `${name}, ${latest} ${word}`;
  const delta = roundDelta(seriesDelta(shown) ?? 0, metric);
  if (delta === 0) return `${name} unchanged ${phrase}`;
  const direction = delta > 0 ? 'up' : 'down';
  return `${name} ${direction} ${formatShown(Math.abs(delta), metric)} ${word} ${phrase}`;
}

export function deltaLabel(
  metric: Metric,
  system: UnitSystem,
  canonical: readonly number[],
): { text: string; tone: 'positive' | 'negative' | 'neutral' } | null {
  if (canonical.length < 2) return null;
  const shown = canonical.map((value) => displayMeasure(value, metric, system));
  const delta = roundDelta(seriesDelta(shown) ?? 0, metric);
  const tone = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '–';
  return {
    text: `${arrow} ${formatShown(Math.abs(delta), metric)} ${unitAbbrev(metric, system)}`,
    tone,
  };
}

export function shortDate(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function sessionHeading(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const heading = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  if (date.getFullYear() === now.getFullYear()) return heading;
  return `${heading}, ${date.getFullYear()}`;
}

export function tooltipLabel(
  iso: string,
  metric: Metric,
  system: UnitSystem,
  canonical: number,
): string {
  return `${shortDate(iso)} · ${formatCanonical(canonical, metric, system)} ${unitAbbrev(metric, system)}`;
}
