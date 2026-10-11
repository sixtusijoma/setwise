import { describe, expect, test } from '@jest/globals';

import {
  durationSeconds,
  formatDurationClock,
  formatPace,
  parseDistance,
  showsPace,
  splitDuration,
} from './pace';

describe('pace', () => {
  test('3.10 mi in 26:40 is 8:36 per mile', () => {
    const { meters } = parseDistance('3.10', 'imperial');
    expect(meters).toBeGreaterThan(0);
    expect(formatPace(meters!, 26 * 60 + 40)).toEqual({ perMile: '8:36', perKm: '5:21' });
    expect(formatDurationClock(26 * 60 + 40)).toBe('26:40');
  });

  test('metric distance still yields both paces', () => {
    const { meters } = parseDistance('5', 'metric');
    expect(meters).toBe(5000);
    expect(formatPace(5000, 25 * 60)).toEqual({ perMile: '8:03', perKm: '5:00' });
  });

  test('pace is only for run, walk, and hike with a distance', () => {
    expect(showsPace('run', 1000)).toBe(true);
    expect(showsPace('walk', 1000)).toBe(true);
    expect(showsPace('hike', 1000)).toBe(true);
    expect(showsPace('cycle', 1000)).toBe(false);
    expect(showsPace('row', 1000)).toBe(false);
    expect(showsPace('run', null)).toBe(false);
    expect(showsPace('run', 0)).toBe(false);
    expect(formatPace(0, 1600)).toBeNull();
  });

  test('splits and joins a duration clock', () => {
    expect(splitDuration(26 * 60 + 40)).toEqual({ hours: 0, minutes: 26, seconds: 40 });
    expect(splitDuration(3723)).toEqual({ hours: 1, minutes: 2, seconds: 3 });
    expect(formatDurationClock(3723)).toBe('1:02:03');
    expect(durationSeconds(1, 2, 3)).toBe(3723);
    expect(durationSeconds(0, 0, 0)).toBeNull();
    expect(durationSeconds(24, 0, 1)).toBeNull();
    expect(durationSeconds(0, 75, 0)).toBe(75 * 60);
  });

  test('rejects an empty or impossible distance', () => {
    expect(parseDistance('', 'imperial')).toEqual({ meters: null, valid: true });
    expect(parseDistance('0', 'metric').valid).toBe(false);
    expect(parseDistance('3.', 'imperial').valid).toBe(false);
    expect(parseDistance('nope', 'imperial').valid).toBe(false);
  });
});
