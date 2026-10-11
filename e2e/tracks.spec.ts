import { expect, test, type Page } from '@playwright/test';

async function dismissRest(page: Page) {
  const skip = page.getByRole('button', { name: 'Dismiss rest timer' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test('custom timed exercise and a weighted farmer’s carry', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));

  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('Wall Sit Hold');
  await page.getByRole('button', { name: 'Create “Wall Sit Hold”' }).click();
  await page.getByRole('button', { name: 'Quads' }).click();
  await page.getByRole('button', { name: 'Bodyweight' }).click();
  await page.getByRole('button', { name: 'Timed' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('textbox', { name: 'Set 1 seconds' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Set 1 weight' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Set 1 seconds' }).fill('60');
  await page.getByRole('button', { name: 'Set 1, 60 seconds, not completed' }).click();
  await dismissRest(page);

  await page.getByRole('button', { name: 'Add exercise' }).last().click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('farmer');
  await page.getByRole('button', { name: "Farmer's Carry", exact: true }).click();
  const carry = page.getByRole('textbox', { name: 'Set 1 seconds' }).nth(1);
  await page.getByRole('textbox', { name: 'Set 1 weight' }).fill('90');
  await carry.fill('45');
  await page.getByRole('button', { name: 'Set 1, 90 pounds, 45 seconds, not completed' }).click();
  await dismissRest(page);
  await expect(page.getByText('2 of 2 sets · 0 lb')).toBeVisible();

  const stored = await page.evaluate(async () => {
    const exercises = await window.__setwise!.getRepo().listExercises();
    return exercises.find((exercise) => exercise.name === 'Wall Sit Hold')?.track;
  });
  expect(stored).toBe('time');

  await page.getByRole('button', { name: 'Finish' }).click();
  const confirm = page.getByRole('button', { name: 'Finish workout' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();

  await page.getByRole('tab', { name: 'Progress' }).click();
  await page.getByRole('button', { name: /^Farmer's Carry, / }).click();
  await expect(page.getByRole('heading', { name: "Farmer's Carry" })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Longest' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Est. 1RM' })).toHaveCount(0);
  await expect(page.getByText('90 × 0:45').first()).toBeVisible();
  await expect(page.getByText('Best volume')).toHaveCount(0);
});
