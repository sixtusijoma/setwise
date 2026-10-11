import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  distanceUnit,
  formatDistance,
  formatVolume,
  lbToKg,
  milesToMeters,
  weightUnit,
} from '../src/lib/units';

const shots = path.join('/cursor/stores/bc-94e7f78c-e1fb-54c8-944f-124699e783ef/media/s8');

const weightKg = lbToKg(225);
const volumeKg = weightKg * 13;
const distanceM = milesToMeters(3.1);

function volumeLabel(system: 'imperial' | 'metric') {
  return `${formatVolume(volumeKg, system)} ${weightUnit(system)}`;
}

function distanceLabel(system: 'imperial' | 'metric') {
  return `${formatDistance(distanceM, system)} ${distanceUnit(system)}`;
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(shots, `${test.info().project.name}-${name}.png`),
  });
}

async function bridgeReady(page: Page) {
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));
}

async function ink(page: Page) {
  return page
    .getByRole('heading', { name: 'Profile' })
    .evaluate((element) => getComputedStyle(element).color);
}

async function seed(page: Page) {
  await page.evaluate(
    async ({ kg, meters }) => {
      const repo = window.__setwise!.getRepo();
      const exercises = await repo.listExercises();
      const bench = exercises.find((exercise) => exercise.name === 'Bench Press');
      if (!bench) throw new Error('Missing Bench Press');
      const landmine = await repo.createExercise({
        name: 'Landmine Row',
        muscleGroup: 'back',
        equipment: 'barbell',
        track: 'weight',
      });
      await repo.createExercise({
        name: 'Zercher Hold',
        muscleGroup: 'core',
        equipment: 'other',
        track: 'weight',
      });
      const ended = new Date(Date.now() - 60_000);
      const started = new Date(ended.getTime() - 40 * 60_000);
      await repo.saveWorkout({
        id: crypto.randomUUID(),
        title: 'Push Day',
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
        exercises: [
          { exerciseId: bench.id, sets: [{ reps: 5, weightKg: kg }] },
          { exerciseId: landmine.id, sets: [{ reps: 8, weightKg: kg }] },
        ],
      });
      await repo.saveCardio({
        id: crypto.randomUUID(),
        activity: 'run',
        startedAt: started.toISOString(),
        durationS: 26 * 60 + 40,
        distanceM: meters,
      });
    },
    { kg: weightKg, meters: distanceM },
  );
}

test('profile units, theme, and exercise art', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await bridgeReady(page);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('setwise.prefs', '{"state":{"tutorialSeen":true},"version":0}');
  });
  await page.reload();
  await bridgeReady(page);
  await seed(page);
  await page.reload();
  await bridgeReady(page);

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByText(volumeLabel('imperial')).first()).toBeVisible();
  await expect(page.getByText(distanceLabel('imperial')).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('Local mode')).toBeVisible();
  await expect(page.getByText('All changes saved')).toBeVisible();
  await expect(page.getByText("Used in a workout, so it can't be deleted")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Zercher Hold' })).toBeVisible();
  await shot(page, 'profile');

  await page.getByRole('tab', { name: 'kg · km' }).click();
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText(volumeLabel('metric')).first()).toBeVisible();
  await expect(page.getByText(distanceLabel('metric')).first()).toBeVisible();
  await expect(page.getByText(volumeLabel('imperial'))).toHaveCount(0);

  await page.getByRole('tab', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByText(/\d[\d,]* lb/)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  const progressEmpty = page.getByText('Log a workout to see your progress');
  if (await progressEmpty.count()) {
    await expect(progressEmpty).toBeVisible();
    await expect(page.getByText(/\d[\d,]* lb/)).toHaveCount(0);
  } else {
    await expect(page.getByText(/\d[\d,.]* kg/).first()).toBeVisible();
    await expect(page.getByText(/\d[\d,]* lb/)).toHaveCount(0);
  }

  await page.getByRole('tab', { name: 'Profile' }).click();
  const before = await ink(page);
  const override = test.info().project.name.endsWith('dark') ? 'Light' : 'Dark';
  await page.getByRole('tab', { name: override }).click();
  await expect.poll(() => ink(page)).not.toBe(before);
  await shot(page, 'profile-override');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect.poll(() => ink(page)).not.toBe(before);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('setwise.local.v1')))
    .toContain('"unitSystem":"metric"');

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText(volumeLabel('metric')).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Delete Zercher Hold' }).click();
  await expect(page.getByText('Zercher Hold')).toHaveCount(0);
  await expect(page.getByText('Landmine Row')).toBeVisible();

  await page.getByRole('tab', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible();
  const bench = page.getByRole('button', { name: 'Bench Press', exact: true });
  await bench.scrollIntoViewIfNeeded();
  await expect(bench.locator('img')).toHaveCount(1);
  await shot(page, 'picker');
  await page.getByPlaceholder(/Search \d+ exercises/).fill('landmine');
  const custom = page.getByRole('button', { name: 'Landmine Row', exact: true });
  await expect(custom).toBeVisible();
  await expect(custom.locator('img')).toHaveCount(0);
  await expect(custom.getByText('LR')).toBeVisible();
});
