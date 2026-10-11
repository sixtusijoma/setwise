import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { lbToKg } from '../src/lib/units';

const media = '/cursor/stores/bc-94e7f78c-e1fb-54c8-944f-124699e783ef/media/s7';

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  if (project !== 'iphone-16-light' && project !== 'iphone-16-dark') return;
  const scheme = project.endsWith('dark') ? 'dark' : 'light';
  await page.screenshot({
    path: path.join(media, `today-${name}-${scheme}.png`),
    fullPage: false,
  });
}

async function hold(page: Page) {
  if (test.info().project.name !== 'iphone-16-light') return;
  await page.waitForTimeout(900);
}

async function dismissRest(page: Page) {
  const skip = page.getByRole('button', { name: 'Dismiss rest timer' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test('today summary', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('setwise.prefs', '{"state":{"tutorialSeen":true},"version":0}');
  });
  await page.reload();

  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByText('Your first session starts here.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log cardio' })).toBeVisible();
  await hold(page);
  await shot(page, 'empty');

  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByText('Add your first exercise')).toBeVisible();
  await page.getByRole('textbox', { name: 'Workout title' }).fill('Thursday Push');
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('bench');
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await page.getByRole('textbox', { name: 'Set 1 weight' }).fill('135');
  await page.getByRole('textbox', { name: 'Set 1 reps' }).fill('5');
  await page.getByRole('button', { name: 'More reps, set 1' }).click();
  await expect(page.getByRole('textbox', { name: 'Set 1 reps' })).toHaveValue('6');
  await page.getByRole('button', { name: 'Fewer reps, set 1' }).click();
  await expect(page.getByRole('textbox', { name: 'Set 1 reps' })).toHaveValue('5');
  await page.getByRole('button', { name: 'Set 1, 135 pounds, 5 reps, not completed' }).click();
  await dismissRest(page);
  await page.getByRole('button', { name: 'Finish' }).click();
  const confirm = page.getByRole('button', { name: 'Finish workout' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();

  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByText('Your first session starts here.')).toHaveCount(0);
  await expect(page.getByText('Thursday Push').first()).toBeVisible();
  await expect(page.getByText('New record').first()).toBeVisible();
  await expect(page.getByText(/Bench Press/).first()).toBeVisible();
  await expect(page.getByLabel(/today, strength/)).toBeVisible();
  await hold(page);

  await page.getByRole('button', { name: 'Cardio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Log cardio' })).toBeVisible();
  await page.getByLabel('Minutes').fill('30');
  await page.getByLabel('Seconds').fill('0');
  await page.getByLabel('Distance in miles').fill('3');
  await page.getByRole('button', { name: 'Save run' }).click();
  await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByTestId('today-summary')).toBeVisible();
  await expect(page.getByText('+1 vs last week')).toBeVisible();
  await expect(page.getByText('New', { exact: true })).toBeVisible();
  await expect(page.getByText('30 min').first()).toBeVisible();
  await expect(page.getByText('1 session')).toBeVisible();
  await expect(page.getByText('3.00 mi').first()).toBeVisible();
  await expect(page.getByText('avg 10:00 /mi')).toBeVisible();
  await expect(page.getByText('Thursday Push').first()).toBeVisible();
  await expect(page.getByText('Run').first()).toBeVisible();
  await expect(page.getByText('10:00 /mi').first()).toBeVisible();
  await expect(page.getByLabel(/today, strength and cardio/)).toBeVisible();
  await expect(page.getByText('New record').first()).toBeVisible();

  const cta = page.getByTestId('today-cta');
  await expect(cta).toBeVisible();
  const box = await cta.boundingBox();
  const viewport = page.viewportSize();
  const tab = await page.getByRole('tab', { name: 'Today' }).boundingBox();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(tab).toBeTruthy();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  expect(box!.y + box!.height).toBeLessThanOrEqual(tab!.y + 1);
  const scrolled = await cta.evaluate((node) => {
    let current = node.parentElement;
    while (current) {
      if (current.scrollTop > 2) return true;
      current = current.parentElement;
    }
    return false;
  });
  expect(scrolled).toBe(false);
  await hold(page);
  await shot(page, 'populated');

  const stored = await page.evaluate(async (kg) => {
    const repo = window.__setwise!.getRepo();
    const [logged, runs] = await Promise.all([
      repo.listWorkouts({ limit: 5 }),
      repo.listCardio({ limit: 5 }),
    ]);
    return {
      title: logged[0]?.title,
      weightKg: logged[0]?.exercises[0]?.sets[0]?.weightKg,
      reps: logged[0]?.exercises[0]?.sets[0]?.reps,
      run: runs[0]?.durationS,
      expectedKg: kg,
    };
  }, lbToKg(135));
  expect(stored.title).toBe('Thursday Push');
  expect(stored.reps).toBe(5);
  expect(stored.weightKg).toBe(stored.expectedKg);
  expect(stored.run).toBe(1800);
});
