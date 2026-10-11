import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('first-run tutorial shows once and replays from Profile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Start a workout' })).toBeVisible();
  for (const title of ['Log your sets', 'Reuse with templates', 'Watch your progress']) {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start a workout' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Replay tutorial' }).click();
  await expect(page.getByRole('heading', { name: 'Start a workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip tutorial' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});
