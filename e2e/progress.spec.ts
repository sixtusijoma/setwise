import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { chartSummary } from '../src/features/progress/copy';
import { chartSeries, type Metric, type RangeId, type SessionInput } from '../src/lib/stats';
import { lbToKg } from '../src/lib/units';

const shots = path.join('artifacts', 'qa', '2026-10-08', 'progress-charts');
const media = '/cursor/stores/bc-94e7f78c-e1fb-54c8-944f-124699e783ef/media/s6';

type Seed = {
  exercise: string;
  date: string;
  sets: { reps: number; weightKg: number }[];
};

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
}

function weighted(days: number, sets: { reps: number; lb: number }[]): Seed['sets'] {
  return sets.map((set) => ({ reps: set.reps, weightKg: lbToKg(set.lb) }));
}

const benchSeed: Seed[] = [
  {
    days: 140,
    sets: [
      { reps: 8, lb: 135 },
      { reps: 5, lb: 185 },
    ],
  },
  {
    days: 110,
    sets: [
      { reps: 5, lb: 185 },
      { reps: 3, lb: 195 },
    ],
  },
  {
    days: 80,
    sets: [
      { reps: 6, lb: 185 },
      { reps: 4, lb: 205 },
    ],
  },
  {
    days: 50,
    sets: [
      { reps: 5, lb: 205 },
      { reps: 5, lb: 215 },
    ],
  },
  {
    days: 30,
    sets: [
      { reps: 5, lb: 215 },
      { reps: 3, lb: 225 },
    ],
  },
  {
    days: 14,
    sets: [
      { reps: 5, lb: 215 },
      { reps: 5, lb: 225 },
    ],
  },
  {
    days: 2,
    sets: [
      { reps: 8, lb: 185 },
      { reps: 5, lb: 225 },
      { reps: 5, lb: 235 },
    ],
  },
].map((session) => ({
  exercise: 'Bench Press',
  date: daysAgo(session.days),
  sets: weighted(session.days, session.sets),
}));

const pullSeed: Seed[] = [
  { days: 120, reps: [5, 5, 4] },
  { days: 80, reps: [6, 6, 5] },
  { days: 45, reps: [8, 7, 6] },
  { days: 20, reps: [10, 8, 8] },
  { days: 4, reps: [12, 10, 8] },
].map((session) => ({
  exercise: 'Pull-Up',
  date: daysAgo(session.days),
  sets: session.reps.map((reps) => ({ reps, weightKg: 0 })),
}));

const squatSeed: Seed[] = [
  {
    exercise: 'Back Squat',
    date: daysAgo(3),
    sets: weighted(3, [
      { reps: 5, lb: 185 },
      { reps: 5, lb: 205 },
      { reps: 3, lb: 225 },
    ]),
  },
];

const fixture: Seed[] = [...benchSeed, ...pullSeed, ...squatSeed];

function sessions(rows: Seed[]): SessionInput[] {
  return rows.map((row, index) => ({
    id: `session-${index}`,
    date: row.date,
    sets: row.sets,
  }));
}

const benchSessions = sessions(benchSeed);
const pullSessions = sessions(pullSeed);

function summary(metric: Metric, range: RangeId, rows: SessionInput[]): string {
  const series = chartSeries(rows, metric, range, new Date());
  return chartSummary(
    metric,
    'imperial',
    series.map((point) => point.value),
    range,
  );
}

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  await page.screenshot({ path: path.join(shots, `${project}-${name}.png`) });
  const visual = project.startsWith('iphone-se-') || project.startsWith('iphone-16-pro-max-');
  if (!visual) return;
  await page.screenshot({ path: path.join(media, `${project}-${name}.png`) });
}

async function expectChart(page: Page, metric: Metric, range: RangeId, rows: SessionInput[]) {
  const name = summary(metric, range, rows);
  const chart = page.getByRole('img', { name });
  await expect(chart).toBeVisible();
  const height = test.info().project.name.includes('pro-max') ? '220' : '190';
  await expect(chart.locator('svg')).toHaveAttribute('height', height);
}

/** Hold the recording project long enough for metric, range, and scrub frames. */
async function pace(page: Page) {
  if (test.info().project.name !== 'iphone-16-light') return;
  await page.waitForTimeout(450);
}

test('progress charts', async ({ page }) => {
  fs.mkdirSync(shots, { recursive: true });
  fs.mkdirSync(media, { recursive: true });

  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));
  await page.evaluate(async (plan) => {
    const repo = window.__setwise!.getRepo();
    const exercises = await repo.listExercises();
    const idOf = (name: string) => {
      const exercise = exercises.find((item) => item.name === name);
      if (!exercise) throw new Error(`Missing ${name}`);
      return exercise.id;
    };
    for (const session of plan) {
      const started = new Date(session.date);
      await repo.saveWorkout({
        id: crypto.randomUUID(),
        title: session.exercise,
        startedAt: started.toISOString(),
        endedAt: new Date(started.getTime() + 60 * 60 * 1000).toISOString(),
        exercises: [{ exerciseId: idOf(session.exercise), sets: session.sets }],
      });
    }
    localStorage.removeItem('setwise.query');
  }, fixture);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));

  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bench Press, \d+(\.\d+)? lb/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pull-Up, \d+ reps/ })).toBeVisible();
  await shot(page, 'list');

  await page.getByRole('textbox', { name: 'Search exercises' }).fill('pull');
  await expect(page.getByRole('button', { name: /Pull-Up/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bench Press/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('');
  await page.getByRole('button', { name: /Bench Press, / }).click();

  await expect(page.getByRole('heading', { name: 'Bench Press' })).toBeVisible();
  await expect(page.getByText('Barbell · Chest · 7 sessions')).toBeVisible();
  await expectChart(page, 'e1rm', '3M', benchSessions);
  await expect(page.getByText('in 3 months')).toBeVisible();
  await pace(page);
  await shot(page, 'bench');

  await page.getByRole('tab', { name: 'Top set' }).click();
  await expectChart(page, 'topSet', '3M', benchSessions);
  await pace(page);
  await page.getByRole('tab', { name: 'Volume' }).click();
  await expectChart(page, 'volume', '3M', benchSessions);
  await pace(page);
  await page.getByRole('tab', { name: 'Est. 1RM' }).click();
  await expectChart(page, 'e1rm', '3M', benchSessions);
  await pace(page);

  for (const range of ['1M', '6M', '1Y', 'All', '3M'] as const) {
    await page.getByRole('button', { name: range, exact: true }).click();
    await expectChart(page, 'e1rm', range === 'All' ? 'all' : range, benchSessions);
    await pace(page);
  }

  const chart = page.getByRole('img', { name: summary('e1rm', '3M', benchSessions) });
  const box = await chart.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + 16, box!.y + box!.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.35, box!.y + box!.height * 0.62, { steps: 8 });
  await pace(page);
  await page.mouse.move(box!.x + box!.width * 0.62, box!.y + box!.height * 0.62, { steps: 8 });
  await expect(page.getByText(/[A-Z][a-z]{2} \d{1,2} · [\d,.]+ lb/)).toBeVisible();
  await pace(page);
  await shot(page, 'bench-scrub');
  await page.mouse.up();

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /Pull-Up, / }).click();
  await expect(page.getByRole('heading', { name: 'Pull-Up' })).toBeVisible();
  await expect(page.getByText('Bodyweight · Back · 5 sessions')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Est. 1RM' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Top set' })).toHaveCount(0);
  await expectChart(page, 'maxReps', '3M', pullSessions);
  await page.getByRole('tab', { name: 'Total reps' }).click();
  await expectChart(page, 'totalReps', '3M', pullSessions);
  await shot(page, 'pullup');

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /Back Squat, / }).click();
  await expect(page.getByRole('heading', { name: 'Back Squat' })).toBeVisible();
  await expect(page.getByText('One more session to see a trend.')).toBeVisible();
  await expect(page.getByText('Barbell · Quads · 1 session')).toBeVisible();
  await shot(page, 'squat');
});

test.afterEach(async ({ page }, info) => {
  if (info.project.name !== 'iphone-16-light') return;
  const video = page.video();
  await page.close();
  if (!video) throw new Error('Expected a recording of metric and range changes');
  await video.saveAs(path.join(media, 'metric-range-scrub.webm'));
});
