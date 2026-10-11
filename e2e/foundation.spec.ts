import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const shots = path.join('artifacts', 'qa', '2026-10-08', 'app-foundation', 'screens');

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(shots, `${test.info().project.name}-${name}.png`),
  });
}

async function ink(page: Page, heading: string) {
  return page
    .getByRole('heading', { name: heading })
    .evaluate((element) => getComputedStyle(element).color);
}

test('foundation click-through', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByText('Your first session starts here.')).toBeVisible();
  await shot(page, 'today');

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByText('Nothing logged yet')).toBeVisible();
  await shot(page, 'history');

  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(page.getByText('Log a workout to see your progress')).toBeVisible();
  await shot(page, 'progress');

  await page.getByRole('tab', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('Local mode')).toBeVisible();
  await shot(page, 'profile');

  await page.getByRole('tab', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByText('Add your first exercise')).toBeVisible();
  await shot(page, 'active-workout');

  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible();
  await shot(page, 'exercise-picker');

  await page.getByRole('button', { name: 'New exercise' }).click();
  await expect(page.getByRole('heading', { name: 'New exercise' })).toBeVisible();
  await shot(page, 'new-exercise');
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Add your first exercise')).toBeVisible();
  await page.getByRole('button', { name: 'Minimize' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();

  await page.getByRole('button', { name: 'Log cardio' }).click();
  await expect(page.getByRole('heading', { name: 'Log cardio' })).toBeVisible();
  await shot(page, 'log-cardio');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();

  await page.goto('/workout/preview');
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
  await expect(page.getByText("This session isn't on this device.")).toBeVisible();
  await shot(page, 'workout-detail');
  await page.getByRole('button', { name: 'Back' }).click();

  await page.goto('/cardio/preview');
  await expect(page.getByRole('heading', { name: 'Cardio' })).toBeVisible();
  await shot(page, 'cardio-detail');
  await page.getByRole('button', { name: 'Back' }).click();

  await page.goto('/exercise/preview');
  await expect(page.getByRole('heading', { name: 'Exercise' })).toBeVisible();
  await expect(page.getByText('Log this lift to see a trend.')).toBeVisible();
  await shot(page, 'exercise-detail');
  await page.getByRole('button', { name: 'Back' }).click();

  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Setwise' })).toBeVisible();
  await expect(page.getByText('Every set, accounted for.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue in local mode' })).toBeVisible();
  await shot(page, 'sign-in');

  await page.goto('/profile');
  const systemInk = await ink(page, 'Profile');
  const override = test.info().project.name.endsWith('dark') ? 'Light' : 'Dark';
  await page.getByRole('tab', { name: override }).click();
  await expect.poll(() => ink(page, 'Profile')).not.toBe(systemInk);
  await shot(page, 'profile-override');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect.poll(() => ink(page, 'Profile')).not.toBe(systemInk);
});
