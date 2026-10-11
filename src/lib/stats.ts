/** `timed` sets hold seconds in `reps`. */
export type SetInput = { reps: number; weightKg: number; timed?: boolean };

export type SessionInput = {
  id?: string;
  date: string;
  sets: readonly SetInput[];
};

export type Metric =
  'topSet' | 'e1rm' | 'volume' | 'maxReps' | 'totalReps' | 'maxTime' | 'totalTime';

export type RangeId = '1M' | '3M' | '6M' | '1Y' | 'all';

export type PrKind = 'topSet' | 'e1rm' | 'volume';

export type SessionPr = {
  id?: string;
  date: string;
  kind: PrKind;
  /** Set that beat the running best. Present for `topSet` records. */
  setIndex?: number;
  value: number;
};

export type ChartPoint = {
  id?: string;
  date: string;
  value: number;
};

const RANGE_MONTHS: Record<Exclude<RangeId, 'all'>, number> = {
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '1Y': 12,
};

function finiteSet(set: SetInput): boolean {
  return Number.isFinite(set.reps) && Number.isFinite(set.weightKg);
}

/** Heaviest weight, ties broken by reps. Sets without a positive weight or at least one rep are ignored. */
export function topSet(sets: readonly SetInput[]): { reps: number; weightKg: number } | null {
  let best: { reps: number; weightKg: number } | null = null;
  for (const set of sets) {
    if (!finiteSet(set) || set.reps < 1 || set.weightKg <= 0) continue;
    if (
      !best ||
      set.weightKg > best.weightKg ||
      (set.weightKg === best.weightKg && set.reps > best.reps)
    ) {
      best = { reps: set.reps, weightKg: set.weightKg };
    }
  }
  return best;
}

/** Epley `weight × (1 + reps / 30)` for sets of 1–12 reps. Heavier estimates above 12 reps are too unreliable to chart. */
export function epley(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (weightKg <= 0 || reps < 1 || reps > 12) return null;
  return weightKg * (1 + reps / 30);
}

export function sessionE1rm(sets: readonly SetInput[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    const estimate = set.timed ? null : epley(set.weightKg, set.reps);
    if (estimate == null) continue;
    if (best == null || estimate > best) best = estimate;
  }
  return best;
}

export function volumeKg(sets: readonly SetInput[]): number {
  let total = 0;
  for (const set of sets) {
    if (set.timed || !finiteSet(set) || set.reps <= 0 || set.weightKg <= 0) continue;
    total += set.reps * set.weightKg;
  }
  return total;
}

export function maxReps(sets: readonly SetInput[]): number {
  let best = 0;
  for (const set of sets) {
    if (finiteSet(set) && set.reps > best) best = set.reps;
  }
  return best;
}

export function totalReps(sets: readonly SetInput[]): number {
  let total = 0;
  for (const set of sets) {
    if (finiteSet(set) && set.reps > 0) total += set.reps;
  }
  return total;
}

/** True when every logged set is bodyweight (0 kg) and at least one rep was recorded. */
export function usesBodyweight(sessions: readonly { sets: readonly SetInput[] }[]): boolean {
  let sawReps = false;
  for (const session of sessions) {
    for (const set of session.sets) {
      if (!finiteSet(set)) continue;
      if (set.weightKg > 0) return false;
      if (set.reps > 0) sawReps = true;
    }
  }
  return sawReps;
}

export function sessionMetric(sets: readonly SetInput[], metric: Metric): number | null {
  if (metric === 'topSet') return topSet(sets)?.weightKg ?? null;
  if (metric === 'e1rm') return sessionE1rm(sets);
  if (metric === 'volume') {
    const volume = volumeKg(sets);
    return volume > 0 ? volume : null;
  }
  if (metric === 'maxReps' || metric === 'maxTime') {
    const reps = maxReps(sets);
    return reps > 0 ? reps : null;
  }
  const reps = totalReps(sets);
  return reps > 0 ? reps : null;
}

/** Inclusive local calendar start. Month length is clamped, so Mar 31 minus one month is the last day of February. */
export function rangeStart(range: RangeId, now: Date): Date | null {
  if (range === 'all') return null;
  const day = now.getDate();
  const anchor = new Date(now.getFullYear(), now.getMonth() - RANGE_MONTHS[range], 1);
  const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  anchor.setDate(Math.min(day, lastDay));
  return anchor;
}

/** Bounded ranges include the start day through today. `all` keeps every parseable date. */
export function inRange(iso: string, range: RangeId, now: Date): boolean {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return false;
  if (range === 'all') return true;
  const start = rangeStart(range, now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return start != null && time >= start.getTime() && time < end.getTime();
}

export function chartSeries(
  sessions: readonly SessionInput[],
  metric: Metric,
  range: RangeId,
  now: Date,
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const session of sessions) {
    if (!inRange(session.date, range, now)) continue;
    const value = sessionMetric(session.sets, metric);
    if (value == null) continue;
    points.push({ id: session.id, date: session.date, value });
  }
  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return points;
}

export function seriesDelta(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  return values[values.length - 1] - values[0];
}

function byDate(a: SessionInput, b: SessionInput): number {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  return 0;
}

function beatsWeight(
  weightKg: number,
  reps: number,
  bestWeight: number,
  bestReps: number,
): boolean {
  return weightKg > bestWeight || (weightKg === bestWeight && reps > bestReps);
}

/**
 * Same comparison history badges use. Heavier weight wins, then more reps.
 * With no prior set, the first logged set counts when it has weight or reps.
 */
export function isSetPr(history: readonly SetInput[], reps: number, weightKg: number): boolean {
  if (weightKg <= 0 && reps <= 0) return false;
  let bestWeight = -Infinity;
  let bestReps = -Infinity;
  for (const set of history) {
    if (set.weightKg > bestWeight || (set.weightKg === bestWeight && set.reps > bestReps)) {
      bestWeight = set.weightKg;
      bestReps = set.reps;
    }
  }
  if (history.length === 0) return weightKg > 0 || reps > 0;
  return weightKg > bestWeight || (weightKg === bestWeight && reps > bestReps);
}

/**
 * Records as of each session, oldest first.
 * A weekly summary should run this on the full history, then keep records whose dates fall in the week.
 * Passing only that week would treat every session as a first record.
 * `topSet` follows `isSetPr`: every improving set counts, including the first set and a warm-up that beats the prior best.
 * e1RM and volume are session-level extras and are not history-badge counts.
 */
export function personalRecords(sessions: readonly SessionInput[]): SessionPr[] {
  const ordered = sessions.slice().sort(byDate);
  let best: SetInput | null = null;
  let bestE1rm = -1;
  let bestVolume = 0;
  const records: SessionPr[] = [];

  for (const session of ordered) {
    session.sets.forEach((set, setIndex) => {
      if (!isSetPr(best ? [best] : [], set.reps, set.weightKg)) return;
      records.push({
        id: session.id,
        date: session.date,
        kind: 'topSet',
        setIndex,
        value: set.weightKg > 0 ? set.weightKg : set.reps,
      });
      best = { reps: set.reps, weightKg: set.weightKg };
    });

    const estimate = sessionE1rm(session.sets);
    if (estimate != null && estimate > bestE1rm) {
      records.push({
        id: session.id,
        date: session.date,
        kind: 'e1rm',
        value: estimate,
      });
      bestE1rm = estimate;
    }

    const volume = volumeKg(session.sets);
    if (volume > bestVolume) {
      records.push({
        id: session.id,
        date: session.date,
        kind: 'volume',
        value: volume,
      });
      bestVolume = volume;
    }
  }

  return records;
}

export type DatedValue = { id?: string; date: string };

export type BestEfforts = {
  heaviest: (DatedValue & { weightKg: number; reps: number }) | null;
  bestE1rm: (DatedValue & { weightKg: number }) | null;
  bestVolume: (DatedValue & { weightKg: number }) | null;
  maxReps: (DatedValue & { reps: number }) | null;
  bestSessionReps: (DatedValue & { reps: number }) | null;
};

export function bestEfforts(sessions: readonly SessionInput[]): BestEfforts {
  const efforts: BestEfforts = {
    heaviest: null,
    bestE1rm: null,
    bestVolume: null,
    maxReps: null,
    bestSessionReps: null,
  };

  for (const session of sessions.slice().sort(byDate)) {
    const top = topSet(session.sets);
    if (
      top &&
      (!efforts.heaviest ||
        beatsWeight(top.weightKg, top.reps, efforts.heaviest.weightKg, efforts.heaviest.reps))
    ) {
      efforts.heaviest = {
        id: session.id,
        date: session.date,
        weightKg: top.weightKg,
        reps: top.reps,
      };
    }

    const estimate = sessionE1rm(session.sets);
    if (estimate != null && (!efforts.bestE1rm || estimate > efforts.bestE1rm.weightKg)) {
      efforts.bestE1rm = { id: session.id, date: session.date, weightKg: estimate };
    }

    const volume = volumeKg(session.sets);
    if (volume > 0 && (!efforts.bestVolume || volume > efforts.bestVolume.weightKg)) {
      efforts.bestVolume = { id: session.id, date: session.date, weightKg: volume };
    }

    const reps = maxReps(session.sets);
    if (reps > 0 && (!efforts.maxReps || reps > efforts.maxReps.reps)) {
      efforts.maxReps = { id: session.id, date: session.date, reps };
    }

    const sessionReps = totalReps(session.sets);
    if (
      sessionReps > 0 &&
      (!efforts.bestSessionReps || sessionReps > efforts.bestSessionReps.reps)
    ) {
      efforts.bestSessionReps = { id: session.id, date: session.date, reps: sessionReps };
    }
  }

  return efforts;
}
