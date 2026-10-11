import { describe, expect, test } from '@jest/globals';

import { startOfIsoWeek, weekKey } from '../../lib/dates';
import {
  formatWeekSummary,
  groupByWeek,
  HISTORY_PAGE,
  mergeHistory,
  type HistoryItem,
  type Loaded,
} from './merge';

function item(kind: HistoryItem['kind'], id: string, day: number): HistoryItem {
  return { kind, id, startedAt: new Date(Date.UTC(2026, 0, day)).toISOString() };
}

function pageOf(rows: HistoryItem[], before?: string): HistoryItem[] {
  return rows
    .filter((row) => !before || row.startedAt < before)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, HISTORY_PAGE);
}

describe('history merge', () => {
  const strength = Array.from({ length: 22 }, (_, index) =>
    item('strength', `s${index}`, 100 - index),
  );
  const cardio = [
    item('cardio', 'recent', 90),
    ...Array.from({ length: 7 }, (_, index) => item('cardio', `c${index}`, 40 - index)),
  ];

  test('the first page hides sessions older than the loaded boundary', () => {
    const merged = mergeHistory({
      strength: { items: pageOf(strength), done: false },
      cardio: { items: pageOf(cardio), done: true },
      filter: 'all',
    });
    expect(merged.items.map((row) => row.id)).not.toContain('s20');
    expect(merged.items.map((row) => row.id)).not.toContain('c0');
    expect(merged.items.map((row) => row.id)).toContain('recent');
    expect(merged.items).toHaveLength(21);
    expect(merged.next).toBe('strength');
  });

  test('paging both sources reaches all 30 sessions, newest first', () => {
    let strengthLoaded: Loaded<HistoryItem> = { items: [], done: false };
    let cardioLoaded: Loaded<HistoryItem> = { items: [], done: false };
    let guard = 0;
    let merged = mergeHistory({ strength: strengthLoaded, cardio: cardioLoaded, filter: 'all' });
    while (merged.next && guard < 8) {
      guard += 1;
      if (merged.next === 'strength') {
        const before = strengthLoaded.items.at(-1)?.startedAt;
        const next = pageOf(strength, before);
        strengthLoaded = {
          items: [...strengthLoaded.items, ...next],
          done: next.length < HISTORY_PAGE,
        };
      } else {
        const before = cardioLoaded.items.at(-1)?.startedAt;
        const next = pageOf(cardio, before);
        cardioLoaded = {
          items: [...cardioLoaded.items, ...next],
          done: next.length < HISTORY_PAGE,
        };
      }
      merged = mergeHistory({ strength: strengthLoaded, cardio: cardioLoaded, filter: 'all' });
    }
    expect(merged.next).toBeNull();
    expect(merged.items).toHaveLength(30);
    const days = merged.items.map((row) => row.startedAt);
    expect([...days].sort((a, b) => (a < b ? 1 : -1))).toEqual(days);
    expect(merged.items.at(-1)?.id).toBe('c6');
  });

  test('filters keep a single source and summarize the week', () => {
    const merged = mergeHistory({
      strength: { items: pageOf(strength), done: false },
      cardio: { items: pageOf(cardio), done: true },
      filter: 'cardio',
    });
    expect(merged.items.every((row) => row.kind === 'cardio')).toBe(true);
    expect(merged.items).toHaveLength(8);
    expect(merged.next).toBeNull();
    expect(formatWeekSummary(1, null)).toBe('1 session');
    expect(formatWeekSummary(4, '24,860 lb')).toBe('4 sessions · 24,860 lb');
  });

  test('groups a local week around Monday', () => {
    const monday = startOfIsoWeek(new Date(2026, 9, 8));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(18, 0, 0, 0);
    const groups = groupByWeek([
      { kind: 'strength', id: 'later', startedAt: sunday.toISOString() },
      { kind: 'cardio', id: 'earlier', startedAt: monday.toISOString() },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((row) => row.id)).toEqual(['later', 'earlier']);
    expect(weekKey(sunday)).toBe(weekKey(monday));
  });
});
