import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { lbToKg } from '../src/lib/units';

const shots = path.join('artifacts', 'qa', '2026-10-08', 'history');

type Seed = { pushId: string; pushEnded: string; runId: string; weekSessions: number };

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(shots, `${test.info().project.name}-${name}.png`),
    fullPage: false,
  });
}

async function bridgeReady(page: Page) {
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));
}

async function seed(page: Page): Promise<Seed> {
  const weights = {
    bench: lbToKg(135),
    lightBench: lbToKg(95),
    press: lbToKg(75),
    heavyPress: lbToKg(95),
    row: lbToKg(100),
  };
  return page.evaluate(async (kg) => {
    const repo = window.__setwise!.getRepo();
    const exercises = await repo.listExercises();
    const idOf = (name: string) => {
      const found = exercises.find((exercise) => exercise.name === name);
      if (!found) throw new Error(`Missing ${name}`);
      return found.id;
    };
    const benchId = idOf('Bench Press');
    const pressId = idOf('Overhead Press');
    const rowId = idOf('Barbell Row');
    const now = new Date();
    const weekOf = (iso: string) => {
      const date = new Date(iso);
      date.setHours(0, 0, 0, 0);
      const day = date.getDay();
      date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
      return date.toDateString();
    };
    const thisWeek = weekOf(now.toISOString());
    const at = (daysAgo: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(9, 15, 0, 0);
      if (date.getTime() > now.getTime()) date.setTime(now.getTime() - (daysAgo + 1) * 60_000);
      return date.toISOString();
    };
    const finish = (start: string, minutes: number) => {
      const end = new Date(Date.parse(start) + minutes * 60_000);
      if (end.getTime() >= now.getTime()) return new Date(now.getTime() - 1000).toISOString();
      return end.toISOString();
    };

    const workoutDays = [
      0, 1, 3, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 28, 30, 32, 34, 36, 38, 40, 42, 44,
    ];
    let pushId = '';
    let pushEnded = '';
    let weekSessions = 0;
    for (const daysAgo of workoutDays) {
      const startedAt = at(daysAgo);
      const endedAt = finish(startedAt, daysAgo === 0 ? 58 : 50);
      const id = crypto.randomUUID();
      const title = daysAgo === 0 ? 'Push Day' : daysAgo === 44 ? 'Archive Day' : `Day ${daysAgo}`;
      const logged =
        daysAgo === 0
          ? [
              { exerciseId: benchId, sets: [{ reps: 5, weightKg: kg.bench }] },
              { exerciseId: pressId, sets: [{ reps: 5, weightKg: kg.press }] },
              { exerciseId: rowId, sets: [{ reps: 5, weightKg: kg.row }] },
            ]
          : daysAgo === 7
            ? [
                { exerciseId: benchId, sets: [{ reps: 5, weightKg: kg.lightBench }] },
                { exerciseId: pressId, sets: [{ reps: 5, weightKg: kg.heavyPress }] },
                { exerciseId: rowId, sets: [{ reps: 5, weightKg: kg.row }] },
              ]
            : [{ exerciseId: benchId, sets: [{ reps: 5, weightKg: kg.lightBench }] }];
      await repo.saveWorkout({ id, title, startedAt, endedAt, exercises: logged });
      if (weekOf(startedAt) === thisWeek) weekSessions += 1;
      if (daysAgo === 0) {
        pushId = id;
        pushEnded = endedAt;
      }
    }

    const runId = crypto.randomUUID();
    const runStart = at(2);
    await repo.saveCardio({
      id: runId,
      activity: 'run',
      startedAt: runStart,
      durationS: 26 * 60 + 40,
      distanceM: 3.1 * 1609.344,
    });
    if (weekOf(runStart) === thisWeek) weekSessions += 1;

    const older = ['cycle', 'walk', 'hike', 'row', 'elliptical', 'swim', 'other'] as const;
    for (let index = 0; index < older.length; index += 1) {
      await repo.saveCardio({
        id: crypto.randomUUID(),
        activity: older[index],
        startedAt: at(46 + index),
        durationS: 20 * 60,
      });
    }

    return { pushId, pushEnded, runId, weekSessions };
  }, weights);
}

async function reveal(page: Page, name: RegExp) {
  const target = page.getByRole('button', { name });
  const viewport = page.viewportSize();
  await page.mouse.move((viewport?.width ?? 390) / 2, (viewport?.height ?? 700) / 2);
  for (let step = 0; step < 15; step += 1) {
    if ((await target.count()) > 0) {
      await target.first().scrollIntoViewIfNeeded();
      return;
    }
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(200);
  }
  await expect(target).toBeVisible();
}

test('history click-through', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await bridgeReady(page);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('setwise.prefs', '{"state":{"tutorialSeen":true},"version":0}');
  });
  await page.reload();
  await bridgeReady(page);
  const seeded = await seed(page);
  await page.reload();
  await bridgeReady(page);

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Push Day/ })).toBeVisible();
  await expect(page.getByText(/^1 PR/).first()).toBeVisible();
  await expect(page.getByText('8:36').first()).toBeVisible();
  const sessions = seeded.weekSessions === 1 ? '1 session' : `${seeded.weekSessions} sessions`;
  await expect(page.getByText(new RegExp(`^${sessions}`)).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Archive Day/ })).toHaveCount(0);
  await shot(page, 'list');

  await reveal(page, /Archive Day/);
  await expect(page.getByRole('button', { name: /Archive Day/ })).toBeVisible();

  await page.getByRole('tab', { name: 'Strength' }).click();
  await expect(page.getByRole('button', { name: /^Run,/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Push Day/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Cardio' }).click();
  await expect(page.getByRole('button', { name: /Push Day/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Run,/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Archive Day/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'All' }).click();

  await page.getByRole('button', { name: /Push Day/ }).click();
  await expect(page.getByRole('heading', { name: 'Push Day' })).toBeVisible();
  await expect(page.getByText('135 × 5')).toBeVisible();
  await expect(page.getByText('75 × 5')).toBeVisible();
  await shot(page, 'detail');
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Workout title' })).toHaveValue('Push Day');
  await page.getByRole('textbox', { name: 'Set 1 weight' }).first().fill('155');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Push Day' })).toBeVisible();
  await expect(page.getByText('155 × 5')).toBeVisible();

  const saved = await page.evaluate(async (id) => {
    const rows = await window.__setwise!.getRepo().listWorkouts({ limit: 100 });
    return rows
      .filter((row) => row.id === id)
      .map((row) => ({
        endedAt: row.endedAt,
        weightKg: row.exercises[0]?.sets[0]?.weightKg,
        count: rows.filter((item) => item.id === id).length,
      }));
  }, seeded.pushId);
  expect(saved).toHaveLength(1);
  expect(saved[0]?.endedAt).toBe(seeded.pushEnded);
  expect(saved[0]?.weightKg).toBe(lbToKg(155));

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await page.getByRole('button', { name: /^Run,/ }).click();
  await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete run' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Run,/ })).toHaveCount(0);

  const runGone = await page.evaluate(async (id) => {
    const rows = await window.__setwise!.getRepo().listCardio({ limit: 100 });
    return rows.some((row) => row.id === id);
  }, seeded.runId);
  expect(runGone).toBe(false);
});
