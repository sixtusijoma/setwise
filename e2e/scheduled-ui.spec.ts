import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { lbToKg } from '../src/lib/units';

const out = '/workspace/setwise-shots';

async function bridgeReady(page: Page) {
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));
}

async function shot(page: Page, name: string) {
  if (test.info().project.name !== 'iphone-se-dark') return;
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
}

test('scheduled steppers, add exercise, PB reminder shots', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('setwise.prefs', '{"state":{"tutorialSeen":true},"version":0}');
  });
  await page.reload();
  await bridgeReady(page);
  await page.evaluate(() => document.fonts.ready);

  const pushId = await page.evaluate(
    async ({ heavyKg, lightKg }) => {
      const repo = window.__setwise!.getRepo();
      const exercises = await repo.listExercises();
      const idOf = (name: string) => {
        const found = exercises.find((exercise) => exercise.name === name);
        if (!found) throw new Error(`Missing ${name}`);
        return found.id;
      };
      const benchId = idOf('Bench Press');
      const olderStart = new Date();
      olderStart.setDate(olderStart.getDate() - 7);
      olderStart.setHours(9, 0, 0, 0);
      const olderEnd = new Date(olderStart.getTime() + 45 * 60_000);
      await repo.saveWorkout({
        id: crypto.randomUUID(),
        title: 'Prior Bench',
        startedAt: olderStart.toISOString(),
        endedAt: olderEnd.toISOString(),
        exercises: [{ exerciseId: benchId, sets: [{ reps: 6, weightKg: heavyKg }] }],
      });
      const pushStart = new Date();
      pushStart.setHours(9, 15, 0, 0);
      if (pushStart.getTime() > Date.now()) pushStart.setTime(Date.now() - 60_000);
      const pushEnd = new Date(Math.min(pushStart.getTime() + 50 * 60_000, Date.now() - 1000));
      const id = crypto.randomUUID();
      await repo.saveWorkout({
        id,
        title: 'Push Day',
        startedAt: pushStart.toISOString(),
        endedAt: pushEnd.toISOString(),
        exercises: [{ exerciseId: benchId, sets: [{ reps: 5, weightKg: lightKg }] }],
      });
      return id;
    },
    { heavyKg: lbToKg(230), lightKg: lbToKg(225) },
  );

  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByText('Add your first exercise')).toBeVisible();
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('bench');
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add exercise' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'More pounds, set 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'More reps, set 1' })).toBeVisible();
  await expect(page.getByText(/PB 230 lb × 6 · Est\. 1RM 276 lb/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Set 1 weight' }).fill('135');
  await page.getByRole('textbox', { name: 'Set 1 reps' }).fill('5');
  await shot(page, '01-set-row-weight-time-steppers');
  await shot(page, '02-active-top-add-exercise');

  await page.getByRole('button', { name: 'More pounds, set 1' }).click();
  await expect(page.getByRole('textbox', { name: 'Set 1 weight' })).toHaveValue('140');

  // Discard in-progress draft so detail is unobstructed
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.getByRole('button', { name: 'Discard' }).click();

  await page.goto(`/workout/${pushId}`);
  await expect(page.getByRole('heading', { name: 'Push Day' })).toBeVisible();
  await expect(page.getByText(/PB 230 lb × 6 · Est\. 1RM 276 lb/)).toBeVisible();
  await shot(page, '03-workout-detail-pb-1rm');
});
