import { describe, expect, test } from '@jest/globals';

import {
  LB_IN_KG,
  M_IN_MI,
  formatDistance,
  formatDuration,
  formatPaceClock,
  formatVolume,
  formatWeight,
  kgToLb,
  lbToKg,
} from './units';

describe('units', () => {
  test('uses exact constants', () => {
    expect(LB_IN_KG).toBe(0.45359237);
    expect(M_IN_MI).toBe(1609.344);
  });

  test('stores 225 lb as 102.058 kg and displays 225 lb', () => {
    expect(lbToKg(225)).toBe(102.058);
    expect(kgToLb(102.058)).toBe(225);
    expect(formatWeight(102.058, 'imperial')).toBe('225');
    expect(formatWeight(102.058, 'metric')).toBe('102.1');
  });

  test('round-trips every 0.1 lb from 0 through 1500', () => {
    for (let step = 0; step <= 15000; step += 1) {
      const pounds = step / 10;
      expect(kgToLb(lbToKg(pounds))).toBe(pounds);
    }
  });

  test('formats volume, distance, duration, and pace', () => {
    expect(formatVolume(102.058, 'imperial')).toBe('225');
    expect(formatVolume(24860, 'metric')).toBe('24,860');
    expect(formatDistance(3.1 * 1609.344, 'imperial')).toBe('3.10');
    expect(formatDistance(5000, 'metric')).toBe('5.00');
    expect(formatDuration(26 * 60 + 40)).toBe('26:40');
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatPaceClock(8 * 60 + 36)).toBe('8:36');
  });
});
