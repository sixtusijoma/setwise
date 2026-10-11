import { startOfIsoWeek, weekKey } from '../../lib/dates';

export const HISTORY_PAGE = 20;

export type HistoryFilter = 'all' | 'strength' | 'cardio';

export type HistoryKind = 'strength' | 'cardio';

export type HistoryItem = {
  kind: HistoryKind;
  id: string;
  startedAt: string;
};

export type Loaded<T> = {
  items: T[];
  done: boolean;
};

export type MergeResult<T extends HistoryItem> = {
  items: T[];
  next: HistoryKind | null;
};

/**
 * Rows from a source that still has older pages can only be trusted down to the
 * oldest row already loaded. Anything earlier waits for the next page.
 */
export function mergeHistory<T extends HistoryItem>(input: {
  strength: Loaded<T>;
  cardio: Loaded<T>;
  filter: HistoryFilter;
}): MergeResult<T> {
  const strengthOn = input.filter !== 'cardio';
  const cardioOn = input.filter !== 'strength';
  const strengthBound = bound(input.strength, strengthOn);
  const cardioBound = bound(input.cardio, cardioOn);
  const floors = [strengthBound, cardioBound].filter((value): value is number => value != null);
  const floor = floors.length === 0 ? Number.NEGATIVE_INFINITY : Math.max(...floors);
  const items = [
    ...(strengthOn ? input.strength.items : []),
    ...(cardioOn ? input.cardio.items : []),
  ]
    .filter((item) => {
      const time = Date.parse(item.startedAt);
      return Number.isFinite(time) && time >= floor;
    })
    .sort(byNewest);

  return { items, next: nextSource(strengthBound, cardioBound) };
}

export function formatWeekSummary(count: number, volumeLabel: string | null): string {
  const sessions = count === 1 ? '1 session' : `${count} sessions`;
  return volumeLabel ? `${sessions} · ${volumeLabel}` : sessions;
}

export function groupByWeek<T extends HistoryItem>(
  items: readonly T[],
): { key: string; start: Date; items: T[] }[] {
  const groups: { key: string; start: Date; items: T[] }[] = [];
  for (const item of items) {
    const when = new Date(item.startedAt);
    if (Number.isNaN(when.getTime())) continue;
    const key = weekKey(when);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, start: startOfIsoWeek(when), items: [item] });
  }
  return groups;
}

function bound<T extends HistoryItem>(loaded: Loaded<T>, active: boolean): number | null {
  if (!active || loaded.done) return null;
  const last = loaded.items[loaded.items.length - 1];
  if (!last) return Number.POSITIVE_INFINITY;
  const time = Date.parse(last.startedAt);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function nextSource(strengthBound: number | null, cardioBound: number | null): HistoryKind | null {
  if (strengthBound == null && cardioBound == null) return null;
  if (cardioBound == null) return 'strength';
  if (strengthBound == null) return 'cardio';
  return strengthBound >= cardioBound ? 'strength' : 'cardio';
}

function byNewest<T extends HistoryItem>(a: T, b: T): number {
  if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? 1 : -1;
  if (a.kind !== b.kind) return a.kind === 'strength' ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
