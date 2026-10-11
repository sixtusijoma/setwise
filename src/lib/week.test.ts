import { describe, expect, test } from '@jest/globals';

import { formatPace } from './pace';
import {
  cardioMinutes,
  dayDots,
  exerciseHistories,
  formatVolumeDelta,
  formatWorkoutDelta,
  inWeek,
  offlineBanner,
  previousWeekBounds,
  recentSessions,
  summarizeWeek,
  weekBounds,
  weekDelta,
  weekTopSetRecords,
  type CardioSlice,
  type WorkoutSlice,
} from './week';

const now = new Date(2026, 9, 8, 15, 0, 0);

function at(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month, day, hour).toISOString();
}

const workouts: WorkoutSlice[] = [
  {
    id: 'last',
    startedAt: at(2026, 8, 29),
    exercises: [{ exerciseId: 'bench', sets: [{ reps: 5, weightKg: 100 }] }],
  },
  {
    id: 'mon',
    startedAt: at(2026, 9, 5),
    exercises: [{ exerciseId: 'bench', sets: [{ reps: 5, weightKg: 100 }] }],
  },
  {
    id: 'wed',
    startedAt: at(2026, 9, 7, 18),
    exercises: [
      {
        exerciseId: 'bench',
        sets: [
          { reps: 3, weightKg: 110 },
          { reps: 8, weightKg: 80 },
        ],
      },
    ],
  },
  {
    id: 'pull',
    startedAt: at(2026, 9, 6, 12),
    exercises: [{ exerciseId: 'pull', sets: [{ reps: 8, weightKg: 0 }] }],
  },
];

const cardio: CardioSlice[] = [
  {
    id: 'old-run',
    activity: 'run',
    startedAt: at(2026, 8, 30, 7),
    durationS: 20 * 60,
    distanceM: 3000,
  },
  {
    id: 'run',
    activity: 'run',
    startedAt: at(2026, 9, 5, 7),
    durationS: 26 * 60 + 40,
    distanceM: 5000,
  },
  {
    id: 'ride',
    activity: 'cycle',
    startedAt: at(2026, 9, 8, 8),
    durationS: 44 * 60,
    distanceM: 12000,
  },
  {
    id: 'row',
    activity: 'row',
    startedAt: at(2026, 9, 8, 12),
    durationS: 10 * 60,
    distanceM: 2000,
  },
];

describe('week bounds', () => {
  test('this week is Monday through the next Monday, and last week steps back one', () => {
    const current = weekBounds(now);
    const previous = previousWeekBounds(now);
    expect(current.start).toEqual(new Date(2026, 9, 5));
    expect(current.end).toEqual(new Date(2026, 9, 12));
    expect(previous.start).toEqual(new Date(2026, 8, 28));
    expect(previous.end).toEqual(new Date(2026, 9, 5));
    expect(inWeek(at(2026, 9, 11, 23), current)).toBe(true);
    expect(inWeek(new Date(2026, 9, 12, 0, 0).toISOString(), current)).toBe(false);
    expect(inWeek('not-a-date', current)).toBe(false);
  });

  test('a DST week stays seven local midnights, including the short and long weeks', () => {
    for (const sunday of [new Date(2026, 2, 8, 15), new Date(2026, 10, 1, 15)]) {
      const bounds = weekBounds(sunday);
      expect(bounds.start.getDay()).toBe(1);
      expect(bounds.end.getDay()).toBe(1);
      const elapsed = bounds.end.getTime() - bounds.start.getTime();
      const shifted =
        7 * 86_400_000 +
        (bounds.end.getTimezoneOffset() - bounds.start.getTimezoneOffset()) * 60_000;
      expect(elapsed).toBe(shifted);
      const dots = dayDots([], [], sunday);
      expect(dots).toHaveLength(7);
      expect(dots[0].date.getDay()).toBe(1);
      expect(dots[6].date.getDay()).toBe(0);
      expect(dots[6].today).toBe(true);
      expect(dots[6].mark).toBe('rest');
      const late = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 30);
      expect(inWeek(late.toISOString(), bounds)).toBe(true);
      expect(inWeek(bounds.end.toISOString(), bounds)).toBe(false);
    }
    const spring = weekBounds(new Date(2026, 2, 8, 15));
    expect(inWeek(new Date(2026, 2, 8, 1, 30).toISOString(), spring)).toBe(true);
    const fall = weekBounds(new Date(2026, 10, 1, 15));
    expect(inWeek(new Date(2026, 10, 1, 1, 30).toISOString(), fall)).toBe(true);
  });
});

describe('week totals', () => {
  test('matches a hand-computed fixture, with pace only for run, walk, and hike', () => {
    const current = summarizeWeek(workouts, cardio, weekBounds(now));
    const previous = summarizeWeek(workouts, cardio, previousWeekBounds(now));

    expect(current.workouts).toBe(3);
    expect(current.volumeKg).toBe(500 + 110 * 3 + 80 * 8);
    expect(current.cardioSessions).toBe(3);
    expect(current.cardioSeconds).toBe(1600 + 44 * 60 + 10 * 60);
    expect(cardioMinutes(current.cardioSeconds)).toBe(81);
    expect(current.distanceM).toBe(5000 + 12000 + 2000);
    expect(current.pacedDistanceM).toBe(5000);
    expect(current.pacedDurationS).toBe(1600);
    expect(formatPace(current.pacedDistanceM, current.pacedDurationS)?.perMile).toBe('8:35');

    expect(previous.workouts).toBe(1);
    expect(previous.volumeKg).toBe(500);
    expect(previous.cardioSessions).toBe(1);
    expect(previous.cardioSeconds).toBe(20 * 60);
    expect(previous.distanceM).toBe(3000);
    expect(previous.pacedDistanceM).toBe(3000);

    const delta = weekDelta(current, previous);
    expect(delta.workouts).toBe(2);
    expect(delta.volumePercent).toBe(194);
    expect(formatWorkoutDelta(delta.workouts)).toEqual({ text: '+2 vs last week', positive: true });
    expect(formatVolumeDelta(delta.volumePercent, current.volumeKg)).toEqual({
      text: '+194%',
      positive: true,
    });
  });

  test('names a first week of volume and a quiet week', () => {
    expect(formatVolumeDelta(null, 120)).toEqual({ text: 'New', positive: true });
    expect(formatVolumeDelta(null, 0)).toEqual({ text: 'Same as last week', positive: false });
    expect(formatVolumeDelta(0, 10)).toEqual({ text: '0%', positive: false });
    expect(formatVolumeDelta(-12, 10)).toEqual({ text: '-12%', positive: false });
    expect(formatWorkoutDelta(0)).toEqual({ text: 'Same as last week', positive: false });
    expect(formatWorkoutDelta(-1)).toEqual({ text: '-1 vs last week', positive: false });
    expect(
      weekDelta(
        { ...summarizeWeek([], [], weekBounds(now)) },
        summarizeWeek([], [], weekBounds(now)),
      ),
    ).toEqual({
      workouts: 0,
      volumePercent: null,
    });
  });
});

describe('day dots', () => {
  test('splits a day with both, dashes the future, and rings today', () => {
    const dots = dayDots(workouts, cardio, now);
    expect(dots.map((dot) => dot.letter)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(dots.map((dot) => dot.mark)).toEqual([
      'both',
      'strength',
      'strength',
      'cardio',
      'future',
      'future',
      'future',
    ]);
    expect(dots.map((dot) => dot.today)).toEqual([false, false, false, true, false, false, false]);
    expect(dots[3].date.getDate()).toBe(8);
  });
});

describe('records this week', () => {
  test('keeps only top-set records from the full history', () => {
    const names = new Map([
      ['bench', 'Bench Press'],
      ['pull', 'Pull-Up'],
    ]);
    const histories = exerciseHistories(workouts, names);
    const records = weekTopSetRecords(histories, weekBounds(now));
    expect(records.map((record) => [record.name, record.weightKg, record.reps])).toEqual([
      ['Bench Press', 110, 3],
      ['Pull-Up', 0, 8],
    ]);
    expect(records.find((record) => record.weightKg === 100)).toBeUndefined();
    expect(records.every((record) => record.e1rmKg == null || record.weightKg > 0)).toBe(true);
    expect(records.find((record) => record.name === 'Bench Press')?.e1rmKg).toBeCloseTo(
      110 * (1 + 3 / 30),
    );
  });

  test('a repeated set is not a record when an earlier week already logged it', () => {
    const onlyThisWeek = workouts.filter((workout) => inWeek(workout.startedAt, weekBounds(now)));
    const records = weekTopSetRecords(
      exerciseHistories(onlyThisWeek, new Map([['bench', 'Bench Press']])),
      weekBounds(now),
    );
    expect(records.some((record) => record.weightKg === 100 && record.reps === 5)).toBe(true);

    const full = weekTopSetRecords(
      exerciseHistories(workouts, new Map([['bench', 'Bench Press']])),
      weekBounds(now),
    );
    expect(full.some((record) => record.weightKg === 100 && record.reps === 5)).toBe(false);
  });
});

describe('recent and offline copy', () => {
  test('recent sessions are the newest three across strength and cardio', () => {
    expect(recentSessions(workouts, cardio).map((item) => item.id)).toEqual(['row', 'ride', 'wed']);
  });

  test('the offline banner counts pending changes', () => {
    expect(offlineBanner(0)).toBeNull();
    expect(offlineBanner(1)).toBe("1 change will sync when you're back online.");
    expect(offlineBanner(3)).toBe("3 changes will sync when you're back online.");
  });
});
