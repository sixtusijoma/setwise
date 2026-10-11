import { expect, test } from '@playwright/test';

test('save, start, rename, and delete a template', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));

  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('bench');
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await page.getByRole('textbox', { name: 'Set 1 weight' }).fill('135');
  await page.getByRole('textbox', { name: 'Set 1 reps' }).fill('8');

  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: 'Save as template' }).click();
  await page.getByRole('textbox', { name: 'Template name' }).fill('Push day');
  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.getByText('Saved as template “Push day”.')).toBeVisible();

  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();

  await page.getByRole('button', { name: 'Templates' }).first().click();
  await expect(page.getByText('1 exercise · 1 set')).toBeVisible();
  await page.getByRole('button', { name: 'Push day options' }).click();
  await page.getByRole('button', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'Template name' }).fill('Heavy push');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByRole('button', { name: 'Heavy push', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Heavy push', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Workout title' })).toHaveValue('Heavy push');
  await expect(page.getByRole('textbox', { name: 'Set 1 weight' })).toHaveValue('135');
  await expect(
    page.getByRole('button', { name: 'Set 1, 135 pounds, 8 reps, not completed' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Minimize' }).click();
  await page.getByRole('button', { name: 'Templates' }).first().click();
  await page.getByRole('button', { name: 'Heavy push', exact: true }).click();
  await expect(page.getByText('Finish or discard the workout in progress first.')).toBeVisible();

  await page.getByRole('button', { name: 'Heavy push options' }).click();
  await page.getByRole('button', { name: 'Delete template' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('No templates yet')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: /^Resume workout, Heavy push/ })).toBeVisible();
});
