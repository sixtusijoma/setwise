import { expect, test } from '@playwright/test';

test('expand a built-in program, copy a day, and start one', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));

  await page.getByRole('button', { name: 'Templates' }).first().click();
  await expect(page.getByText('No templates yet')).toBeVisible();
  await page.getByRole('button', { name: 'Push/Pull/Legs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy Push to my templates' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Push options' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Copy Pull to my templates' }).click();
  await expect(page.getByText('Copied “Push/Pull/Legs · Pull” to My templates.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Push/Pull/Legs · Pull', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Push/Pull/Legs · Pull options' })).toBeVisible();
  await expect(page.getByText('6 exercises · 18 sets')).toBeVisible();

  await page.getByRole('button', { name: 'Push', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Workout title' })).toHaveValue(
    'Push/Pull/Legs · Push',
  );
  await expect(page.getByText('Bench Press', { exact: true })).toBeVisible();
  await expect(page.getByText('Overhead Cable Triceps Extension', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Set 1 weight' }).first()).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Set 1 reps' }).first()).toHaveValue('6');
  await expect(page.getByText('0 of 19 sets · 0 lb')).toBeVisible();

  await page.getByRole('button', { name: 'Minimize' }).click();
  await page.getByRole('button', { name: 'Templates' }).first().click();
  await page.getByRole('button', { name: 'Push/Pull/Legs', exact: true }).click();
  await page.getByRole('button', { name: 'Legs', exact: true }).click();
  await expect(page.getByText('Finish or discard the workout in progress first.')).toBeVisible();
});
