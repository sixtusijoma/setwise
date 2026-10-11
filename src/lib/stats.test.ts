import { describe, expect, test } from '@jest/globals';

import {
  bestEfforts,
  chartSeries,
  epley,
  inRange,
  isSetPr,
  maxReps,
  personalRecords,
  rangeStart,
  seriesDelta,
  sessionE1rm,
  sessionMetric,
  topSet,
  totalReps,
  usesBodyweight,
  volumeKg,
  type SessionInput,
} from './stats';

const at = (iso: string, sets: SessionInput['sets'], id = iso): SessionInput => ({
  id,
  date: iso,
  sets,
});

describe('top set', () => {
  test('picks the heaviest weight and breaks ties with reps', () => {
    expect(
      topSet([
        { reps: 8, weightKg: 80 },
        { reps: 3, weightKg: 100 },
        { reps: 5, weightKg: 100 },
        { reps: 12, weightKg: 90 },
      ]),
    ).toEqual({ reps: 5, weightKg: 100 });
  });

  test('ignores bodyweight, empty, and non-finite sets', () => {
    expect(
      topSet([
        { reps: 10, weightKg: 0 },
        { reps: 0, weightKg: 200 },
        { reps: Number.NaN, weightKg: 50 },
        { reps: 4, weightKg: 40 },
      ]),
    ).toEqual({ reps: 4, weightKg: 40 });
    expect(topSet([{ reps: 8, weightKg: 0 }])).toBeNull();
  });
});

describe('Epley e1RM', () => {
  test('uses weight × (1 + reps / 30) on the 1 and 12 rep boundaries', () => {
    expect(epley(100, 1)).toBeCloseTo(100 * (31 / 30), 10);
    expect(epley(100, 12)).toBeCloseTo(140, 10);
    expect(epley(60, 10)).toBeCloseTo(80, 10);
    expect(epley(90, 3)).toBeCloseTo(99, 10);
  });

  test('rejects 0 reps, 13 reps, zero weight, and non-finite input', () => {
    expect(epley(100, 0)).toBeNull();
    expect(epley(100, 13)).toBeNull();
    expect(epley(0, 5)).toBeNull();
    expect(epley(-10, 5)).toBeNull();
    expect(epley(Number.NaN, 5)).toBeNull();
    expect(epley(100, Number.POSITIVE_INFINITY)).toBeNull();
  });

  test('takes the best qualifying set and skips high-rep work', () => {
    expect(
      sessionE1rm([
        { reps: 15, weightKg: 200 },
        { reps: 5, weightKg: 100 },
        { reps: 1, weightKg: 110 },
      ]),
    ).toBeCloseTo(100 * (1 + 5 / 30), 10);
    expect(sessionE1rm([{ reps: 20, weightKg: 300 }])).toBeNull();
  });
});

describe('volume and reps', () => {
  test('sums reps × kg and ignores bodyweight or empty sets', () => {
    expect(
      volumeKg([
        { reps: 8, weightKg: 100 },
        { reps: 5, weightKg: 80 },
        { reps: 12, weightKg: 0 },
        { reps: 0, weightKg: 200 },
      ]),
    ).toBe(1200);
  });

  test('counts max and total reps, including bodyweight', () => {
    const sets = [
      { reps: 8, weightKg: 0 },
      { reps: 12, weightKg: 0 },
      { reps: 0, weightKg: 0 },
    ];
    expect(maxReps(sets)).toBe(12);
    expect(totalReps(sets)).toBe(20);
  });
});

describe('bodyweight fallback', () => {
  test('is bodyweight only when every set is 0 kg and a rep exists', () => {
    expect(usesBodyweight([])).toBe(false);
    expect(usesBodyweight([{ sets: [{ reps: 0, weightKg: 0 }] }])).toBe(false);
    expect(
      usesBodyweight([{ sets: [{ reps: 8, weightKg: 0 }] }, { sets: [{ reps: 6, weightKg: 0 }] }]),
    ).toBe(true);
    expect(
      usesBodyweight([{ sets: [{ reps: 8, weightKg: 0 }] }, { sets: [{ reps: 5, weightKg: 10 }] }]),
    ).toBe(false);
  });

  test('charts reps for a bodyweight session and weight metrics otherwise', () => {
    const pullups = [
      { reps: 8, weightKg: 0 },
      { reps: 5, weightKg: 0 },
    ];
    expect(sessionMetric(pullups, 'maxReps')).toBe(8);
    expect(sessionMetric(pullups, 'totalReps')).toBe(13);
    expect(sessionMetric(pullups, 'e1rm')).toBeNull();
    expect(sessionMetric(pullups, 'topSet')).toBeNull();
    expect(sessionMetric(pullups, 'volume')).toBeNull();

    const bench = [
      { reps: 15, weightKg: 100 },
      { reps: 5, weightKg: 80 },
    ];
    expect(sessionMetric(bench, 'topSet')).toBe(100);
    expect(sessionMetric(bench, 'volume')).toBe(15 * 100 + 5 * 80);
    expect(sessionMetric(bench, 'e1rm')).toBeCloseTo(80 * (1 + 5 / 30), 10);
  });
});

describe('ranges', () => {
  const now = new Date(2026, 9, 8, 15, 30, 0);

  test('uses calendar months clamped to the end of a short month', () => {
    expect(rangeStart('1M', now)).toEqual(new Date(2026, 8, 8));
    expect(rangeStart('3M', now)).toEqual(new Date(2026, 6, 8));
    expect(rangeStart('6M', now)).toEqual(new Date(2026, 3, 8));
    expect(rangeStart('1Y', now)).toEqual(new Date(2025, 9, 8));
    expect(rangeStart('all', now)).toBeNull();
    expect(rangeStart('1M', new Date(2026, 2, 31, 12))).toEqual(new Date(2026, 1, 28));
    expect(rangeStart('3M', new Date(2026, 2, 31, 12))).toEqual(new Date(2025, 11, 31));
  });

  test('includes the start day through today and lets all keep every date', () => {
    const start = new Date(2026, 8, 8, 0, 30).toISOString();
    const before = new Date(2026, 8, 7, 23, 30).toISOString();
    const today = new Date(2026, 9, 8, 23, 0).toISOString();
    const tomorrow = new Date(2026, 9, 9, 0, 30).toISOString();
    expect(inRange(start, '1M', now)).toBe(true);
    expect(inRange(before, '1M', now)).toBe(false);
    expect(inRange(today, '1M', now)).toBe(true);
    expect(inRange(tomorrow, '1M', now)).toBe(false);
    expect(inRange(before, 'all', now)).toBe(true);
    expect(inRange(tomorrow, 'all', now)).toBe(true);
    expect(inRange('not-a-date', 'all', now)).toBe(false);
  });
});

describe('chart series', () => {
  const now = new Date(2026, 9, 8, 12);
  const sessions: SessionInput[] = [
    at('2026-06-01T15:00:00.000Z', [{ reps: 5, weightKg: 80 }], 'old'),
    at('2026-09-20T15:00:00.000Z', [{ reps: 15, weightKg: 100 }], 'pump'),
    at(
      '2026-10-01T15:00:00.000Z',
      [
        { reps: 5, weightKg: 90 },
        { reps: 3, weightKg: 110 },
      ],
      'recent',
    ),
    at('2026-12-01T15:00:00.000Z', [{ reps: 5, weightKg: 140 }], 'future'),
  ];

  test('drops sessions outside the range and sessions with no value for the metric', () => {
    const e1rm = chartSeries(sessions, 'e1rm', '3M', now).map((point) => point.id);
    expect(e1rm).toEqual(['recent']);
    expect(chartSeries(sessions, 'topSet', '3M', now).map((point) => point.id)).toEqual([
      'pump',
      'recent',
    ]);
    expect(chartSeries(sessions, 'e1rm', 'all', now).map((point) => point.id)).toEqual([
      'old',
      'recent',
      'future',
    ]);
  });

  test('sorts oldest to newest even when the input is reversed', () => {
    const dates = chartSeries([...sessions].reverse(), 'topSet', 'all', now).map(
      (point) => point.date,
    );
    expect(dates).toEqual([...dates].sort());
  });

  test('delta is last minus first and is absent for a single point', () => {
    expect(seriesDelta([10, 12, 18])).toBe(8);
    expect(seriesDelta([18, 10])).toBe(-8);
    expect(seriesDelta([18])).toBeNull();
    expect(seriesDelta([])).toBeNull();
  });
});

describe('set PRs', () => {
  test('matches the history badge rule', () => {
    expect(isSetPr([{ reps: 5, weightKg: 100 }], 3, 102)).toBe(true);
    expect(isSetPr([{ reps: 5, weightKg: 100 }], 5, 100)).toBe(false);
    expect(isSetPr([{ reps: 5, weightKg: 100 }], 6, 100)).toBe(true);
    expect(isSetPr([], 5, 0)).toBe(true);
    expect(isSetPr([], 0, 0)).toBe(false);
    expect(isSetPr([{ reps: 8, weightKg: 0 }], 6, 0)).toBe(false);
    expect(isSetPr([{ reps: 8, weightKg: 0 }], 10, 0)).toBe(true);
  });

  test('ranks assisted sets, stored as negative load, by less help', () => {
    expect(isSetPr([{ reps: 8, weightKg: -30 }], 8, -20)).toBe(true);
    expect(isSetPr([{ reps: 8, weightKg: -30 }], 8, -40)).toBe(false);
    expect(isSetPr([], 8, -40)).toBe(true);
  });
});

describe('personal records', () => {
  test('marks every set that beats the running best, including an earlier lighter set', () => {
    const records = personalRecords([
      at(
        '2026-10-02T00:00:00.000Z',
        [
          { reps: 8, weightKg: 60 },
          { reps: 5, weightKg: 100 },
          { reps: 5, weightKg: 100 },
        ],
        'a',
      ),
    ]);
    expect(records.filter((record) => record.kind === 'topSet')).toEqual([
      expect.objectContaining({ id: 'a', setIndex: 0, value: 60 }),
      expect.objectContaining({ id: 'a', setIndex: 1, value: 100 }),
    ]);
  });

  test('separates weight, e1RM, and volume records', () => {
    const sessions = [
      at('2026-10-03T00:00:00.000Z', [{ reps: 1, weightKg: 110 }], 'later'),
      at('2026-10-01T00:00:00.000Z', [{ reps: 5, weightKg: 100 }], 'first'),
      at('2026-10-02T00:00:00.000Z', [{ reps: 12, weightKg: 90 }], 'reps'),
    ];
    const original = sessions.map((session) => session.id);
    const records = personalRecords(sessions);
    expect(sessions.map((session) => session.id)).toEqual(original);

    expect(records.filter((record) => record.kind === 'topSet').map((record) => record.id)).toEqual(
      ['first', 'later'],
    );
    expect(records.find((record) => record.kind === 'e1rm' && record.id === 'reps')).toBeTruthy();
    expect(
      records.find((record) => record.kind === 'e1rm' && record.id === 'later'),
    ).toBeUndefined();
    expect(records.filter((record) => record.kind === 'volume').map((record) => record.id)).toEqual(
      ['first', 'reps'],
    );
  });

  test('does not treat an equal performance as a new record', () => {
    const records = personalRecords([
      at('2026-10-01T00:00:00.000Z', [{ reps: 5, weightKg: 100 }], 'a'),
      at('2026-10-02T00:00:00.000Z', [{ reps: 5, weightKg: 100 }], 'b'),
    ]);
    expect(records.filter((record) => record.kind === 'topSet')).toHaveLength(1);
    expect(records.filter((record) => record.kind === 'e1rm')).toHaveLength(1);
    expect(records.filter((record) => record.kind === 'volume')).toHaveLength(1);
  });

  test('counts bodyweight sets with the same heavier-then-more-reps rule', () => {
    const records = personalRecords([
      at(
        '2026-10-01T00:00:00.000Z',
        [
          { reps: 5, weightKg: 0 },
          { reps: 8, weightKg: 0 },
        ],
        'bw',
      ),
      at('2026-10-08T00:00:00.000Z', [{ reps: 6, weightKg: 0 }], 'same'),
      at('2026-10-09T00:00:00.000Z', [{ reps: 10, weightKg: 0 }], 'more'),
    ]);
    const setRecords = records.filter((record) => record.kind === 'topSet');
    expect(setRecords.map((record) => record.setIndex)).toEqual([0, 1, 0]);
    expect(setRecords.map((record) => record.value)).toEqual([5, 8, 10]);
    expect(setRecords.map((record) => record.id)).toEqual(['bw', 'bw', 'more']);
  });

  test('a high-rep set above 12 can be a weight and volume record without an e1RM', () => {
    const records = personalRecords([
      at('2026-10-01T00:00:00.000Z', [{ reps: 15, weightKg: 40 }], 'pump'),
    ]);
    expect(records.map((record) => record.kind).sort()).toEqual(['topSet', 'volume']);
  });
});

describe('best efforts', () => {
  test('keeps the first time each record was set', () => {
    const efforts = bestEfforts([
      at('2026-10-02T00:00:00.000Z', [{ reps: 5, weightKg: 100 }], 'tie'),
      at(
        '2026-10-01T00:00:00.000Z',
        [
          { reps: 5, weightKg: 100 },
          { reps: 8, weightKg: 60 },
        ],
        'first',
      ),
      at('2026-10-03T00:00:00.000Z', [{ reps: 1, weightKg: 112 }], 'heavy'),
    ]);
    expect(efforts.heaviest).toEqual(
      expect.objectContaining({ id: 'heavy', weightKg: 112, reps: 1 }),
    );
    expect(efforts.bestVolume?.id).toBe('first');
    expect(efforts.bestE1rm?.id).toBe('first');
    expect(efforts.maxReps).toEqual(expect.objectContaining({ id: 'first', reps: 8 }));
    expect(efforts.bestSessionReps).toEqual(expect.objectContaining({ id: 'first', reps: 13 }));
  });

  test('timed loaded sets rank heaviest, then longest, with no e1RM or volume', () => {
    const efforts = bestEfforts([
      at(
        '2026-10-01T00:00:00.000Z',
        [
          { reps: 60, weightKg: 32, timed: true },
          { reps: 30, weightKg: 40, timed: true },
        ],
        'first',
      ),
      at('2026-10-02T00:00:00.000Z', [{ reps: 45, weightKg: 40, timed: true }], 'longer'),
    ]);
    expect(efforts.heaviest).toEqual(
      expect.objectContaining({ id: 'longer', weightKg: 40, reps: 45 }),
    );
    expect(efforts.bestE1rm).toBeNull();
    expect(efforts.bestVolume).toBeNull();
    expect(sessionE1rm([{ reps: 10, weightKg: 40, timed: true }])).toBeNull();
    expect(volumeKg([{ reps: 45, weightKg: 40, timed: true }])).toBe(0);
  });
});
