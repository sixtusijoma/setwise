import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const shots = path.join('artifacts', 'qa', '2026-10-08', 'cardio-logging', 'screens');

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(shots, `${test.info().project.name}-${name}.png`),
    fullPage: true,
  });
}

async function openCardio(page: Page) {
  await page.getByRole('button', { name: /^(Log cardio|Cardio)$/ }).click();
  await expect(page.getByRole('heading', { name: 'Log cardio' })).toBeVisible();
}

test('cardio click-through', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('setwise.prefs', '{"state":{"tutorialSeen":true},"version":0}');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();

  await openCardio(page);
  await expect(page.getByRole('button', { name: 'Save run' })).toBeDisabled();
  await page.getByLabel('Minutes').fill('26');
  await page.getByLabel('Seconds').fill('40');
  await page.getByLabel('Distance in miles').fill('3.10');
  const pace = page.getByText('8:36');
  await pace.scrollIntoViewIfNeeded();
  await expect(pace).toBeVisible();
  await expect(page.getByText('/mi').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('/km').filter({ visible: true }).first()).toBeVisible();
  await shot(page, 'log-run');
  await page.getByRole('button', { name: 'Save run' }).click();

  await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
  await expect(page.getByText('26:40', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/Pace 8:36 per mile/)).toBeVisible();
  await shot(page, 'run-detail');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('setwise.local.v1');
        const cardio = raw
          ? (JSON.parse(raw).cardio as { activity: string; durationS: number }[])
          : [];
        return cardio.map((item) => `${item.activity}:${item.durationS}`);
      }),
    )
    .toEqual(['run:1600']);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await openCardio(page);
  await page.getByRole('button', { name: 'Cycle' }).click();
  await page.getByLabel('Minutes').fill('30');
  await page.getByLabel('Seconds').fill('0');
  await expect(page.getByText('Pace')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save cycle' })).toBeEnabled();
  await shot(page, 'log-cycle');
  await page.getByRole('button', { name: 'Save cycle' }).click();
  await expect(page.getByRole('heading', { name: 'Cycle' })).toBeVisible();
  await expect(page.getByText('Pace')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back' }).click();

  await page.evaluate(() => {
    const key = 'setwise.local.v1';
    const db = JSON.parse(localStorage.getItem(key) || '{}');
    db.profile = { ...(db.profile ?? {}), unitSystem: 'metric' };
    localStorage.setItem(key, JSON.stringify(db));
    localStorage.removeItem('setwise.query');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await openCardio(page);
  await page.getByRole('button', { name: 'Walk' }).click();
  await expect(page.getByLabel('Distance in kilometers')).toBeVisible();
  await page.getByLabel('Minutes').fill('40');
  await page.getByLabel('Distance in kilometers').fill('3');
  const kmPace = page.getByText('13:20');
  await kmPace.scrollIntoViewIfNeeded();
  await expect(kmPace).toBeVisible();
  await expect(page.getByText('/km').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('/mi').filter({ visible: true }).first()).toBeVisible();
  await shot(page, 'log-walk-metric');
  await page.getByRole('button', { name: 'Save walk' }).click();

  await expect(page.getByRole('heading', { name: 'Walk' })).toBeVisible();
  await expect(page.getByText('40:00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit cardio' })).toBeVisible();
  await page.getByLabel('Minutes').fill('45');
  await page.getByRole('button', { name: 'Save walk' }).click();
  await expect(page.getByRole('heading', { name: 'Walk' })).toBeVisible();
  await expect(page.getByText('45:00', { exact: true })).toBeVisible();
  await shot(page, 'walk-edited');

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete walk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('setwise.local.v1');
        const cardio = raw ? (JSON.parse(raw).cardio as { activity: string }[]) : [];
        return cardio.map((item) => item.activity).sort();
      }),
    )
    .toEqual(['cycle', 'run']);
});
