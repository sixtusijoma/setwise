import { describe, expect, test } from '@jest/globals';

import {
  formatDateTime,
  formatDayLabel,
  formatSessionLength,
  formatWeekTitle,
  startOfIsoWeek,
  weekKey,
} from './dates';

describe('dates', () => {
  test('weeks start on Monday, including a Sunday', () => {
    const monday = new Date(2026, 9, 5, 0, 30);
    const sunday = new Date(2026, 9, 11, 23, 30);
    const nextMonday = new Date(2026, 9, 12, 0, 30);
    expect(weekKey(sunday)).toBe(weekKey(monday));
    expect(startOfIsoWeek(sunday).getDate()).toBe(5);
    expect(weekKey(nextMonday)).not.toBe(weekKey(sunday));
  });

  test('a DST week still starts on its Monday', () => {
    const monday = new Date(2026, 9, 26, 0, 30);
    const changeover = new Date(2026, 10, 1, 1, 30);
    expect(monday.getDay()).toBe(1);
    expect(changeover.getDay()).toBe(0);
    expect(weekKey(changeover)).toBe(weekKey(monday));
    expect(formatWeekTitle(startOfIsoWeek(changeover), new Date(2026, 10, 2))).toBe(
      'Oct 26 – Nov 1',
    );
  });

  test('names the current week and ranges the others', () => {
    const now = new Date(2026, 9, 8, 9, 0);
    expect(formatWeekTitle(startOfIsoWeek(now), now)).toBe('This week');
    expect(formatWeekTitle(new Date(2026, 8, 28), now)).toBe('Sep 28 – Oct 4');
    expect(formatWeekTitle(new Date(2026, 9, 12), now)).toBe('Oct 12 – 18');
    expect(formatWeekTitle(new Date(2025, 11, 29), now)).toBe('Dec 29, 2025 – Jan 4, 2026');
  });

  test('labels today, yesterday, and a weekday', () => {
    const now = new Date(2026, 9, 8, 18, 0);
    expect(formatDayLabel(new Date(2026, 9, 8, 7, 0), now)).toBe('Today');
    expect(formatDayLabel(new Date(2026, 9, 7, 21, 0), now)).toBe('Yesterday');
    expect(formatDayLabel(new Date(2026, 9, 5, 8, 0), now)).toBe('Mon');
  });

  test('formats a session clock and a date with a time', () => {
    expect(formatSessionLength(0)).toBe('0 min');
    expect(formatSessionLength(58 * 60)).toBe('58 min');
    expect(formatSessionLength(72 * 60)).toBe('1 h 12 min');
    expect(formatSessionLength(2 * 3600)).toBe('2 h');
    expect(formatSessionLength(45)).toBe('1 min');
    const now = new Date(2026, 9, 8, 12, 0);
    expect(formatDateTime(new Date(2026, 9, 8, 15, 42).toISOString(), now)).toBe('Today, 3:42 PM');
    expect(formatDateTime(new Date(2026, 9, 6, 9, 5).toISOString(), now)).toBe(
      'Tue, Oct 6, 9:05 AM',
    );
    expect(formatDateTime('nope', now)).toBe('Unknown');
  });
});
