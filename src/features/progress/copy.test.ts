import { describe, expect, test } from '@jest/globals';

import { lbToKg } from '../../lib/units';
import { chartSummary, deltaLabel, formatCanonical, tooltipLabel } from './copy';

describe('progress copy', () => {
  test('describes an estimated one-rep max the way the chart is labeled', () => {
    const lighter = lbToKg(200);
    const heavier = lbToKg(218);
    expect(chartSummary('e1rm', 'imperial', [lighter, heavier], '3M')).toBe(
      'Estimated one-rep max up 18 pounds in 3 months',
    );
    expect(deltaLabel('e1rm', 'imperial', [lighter, heavier])?.text).toBe('▲ 18 lb');
  });

  test('uses kilograms, reps, and the empty and single-point phrasing', () => {
    expect(chartSummary('volume', 'metric', [1000, 800], '1Y')).toBe(
      'Volume down 200 kilograms in 1 year',
    );
    expect(chartSummary('maxReps', 'imperial', [8, 8], 'all')).toBe('Max reps unchanged all time');
    expect(chartSummary('maxReps', 'imperial', [12], '3M')).toBe('Max reps, 12 reps');
    expect(chartSummary('topSet', 'imperial', [], '1M')).toBe('Top set, no data in 1 month');
    expect(chartSummary('maxTime', 'metric', [45, 60], 'all')).toBe(
      'Longest set up 15 seconds all time',
    );
    expect(deltaLabel('totalTime', 'metric', [90, 120])?.text).toBe('▲ 30 s');
  });

  test('formats the scrub tooltip and trims a tenth', () => {
    expect(formatCanonical(lbToKg(225), 'topSet', 'imperial')).toBe('225');
    expect(formatCanonical(102.058, 'e1rm', 'metric')).toBe('102.1');
    expect(
      tooltipLabel(new Date(2026, 8, 24, 15).toISOString(), 'e1rm', 'imperial', lbToKg(255)),
    ).toBe('Sep 24 · 255 lb');
  });
});
