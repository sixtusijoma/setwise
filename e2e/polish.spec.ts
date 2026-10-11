import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const media = '/cursor/stores/bc-94e7f78c-e1fb-54c8-944f-124699e783ef/media/s10';

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(media, `${test.info().project.name}-${name}.png`),
  });
}

async function dismissRest(page: Page) {
  const skip = page.getByRole('button', { name: 'Dismiss rest timer' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test('release polish click-through', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('setwise.prefs', '{"state":{"tutorialSeen":true},"version":0}');
  });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);

  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(
    page.getByText('Log a workout to see your progress').filter({ visible: true }),
  ).toBeVisible();
  await expect(page.locator('img').filter({ visible: true })).toHaveCount(1);
  await shot(page, 'progress-empty');

  await page.getByRole('tab', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('textbox', { name: 'Workout title' }).fill('Thursday Push');
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('bench');
  const bench = page.getByRole('button', { name: 'Bench Press', exact: true });
  await expect(bench.locator('img')).toHaveCount(1);
  await bench.click();

  await page.getByRole('button', { name: 'Add exercise' }).last().click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('Polish Curl');
  await page.getByRole('button', { name: 'Create “Polish Curl”' }).click();
  await expect(page.getByRole('heading', { name: 'New exercise' })).toBeVisible();
  await page.getByRole('button', { name: 'Biceps', exact: true }).click();
  await page.getByRole('button', { name: 'Dumbbell', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Polish Curl').first()).toBeVisible();

  await page.getByRole('textbox', { name: 'Set 1 weight' }).first().fill('135');
  await page.getByRole('textbox', { name: 'Set 1 reps' }).first().fill('5');
  await page.getByRole('button', { name: 'Set 1, 135 pounds, 5 reps, not completed' }).first().click();
  await dismissRest(page);
  await page.getByRole('button', { name: 'Finish' }).click();
  const confirm = page.getByRole('button', { name: 'Finish workout' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();

  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  const recent = page.getByRole('button', { name: /Thursday Push/ }).filter({ visible: true });
  await expect(recent).toBeVisible();
  await expect(recent.locator('img')).toHaveCount(1);
  await shot(page, 'today');

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByText('Thursday Push').filter({ visible: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.getByText('Bench Press').filter({ visible: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('Local mode')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete account' })).toHaveCount(0);
  await expect(page.getByText('Polish Curl').filter({ visible: true })).toBeVisible();
  await shot(page, 'profile');
});
