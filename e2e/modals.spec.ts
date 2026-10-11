import { expect, test, type Page } from '@playwright/test';

async function close(page: Page, heading: string, back: string) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: heading })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: back })).toBeVisible();
}

test('every modal closes from its own close control', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));

  await page.getByRole('button', { name: 'Log cardio' }).click();
  await close(page, 'Log cardio', 'This week');

  await page.getByRole('button', { name: 'Log cardio' }).click();
  await page.getByLabel('Minutes').fill('20');
  await page.getByRole('button', { name: 'Save run' }).click();
  await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await close(page, 'Edit cardio', 'Run');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();

  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await page.getByRole('button', { name: 'New exercise' }).click();
  await close(page, 'New exercise', 'Add exercise');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toHaveCount(0);
  await expect(page.getByText('Add your first exercise')).toBeVisible();

  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('bench');
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: 'Save as template' }).click();
  await expect(page.getByRole('heading', { name: 'Save as template' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Save as template' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Minimize' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await page.getByRole('button', { name: 'Templates' }).first().click();
  await close(page, 'Templates', 'This week');

  await page.getByRole('tab', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Replay tutorial' }).click();
  await expect(page.getByRole('heading', { name: 'Start a workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip tutorial' }).click();
  await expect(page.getByRole('heading', { name: 'Start a workout' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});
