import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const shots = path.join('/cursor/stores/bc-94e7f78c-e1fb-54c8-944f-124699e783ef/media/s9');
const TITLE = 'Offline Push';

test('apple sign-in stays hidden on web', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Setwise' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Apple' })).toHaveCount(0);
});

test('offline log replays once', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(process.env.E2E_SUPABASE !== '1', 'needs the hosted project');
  const password = process.env.E2E_PASSWORD ?? '';
  test.skip(password.length < 8, 'Set E2E_PASSWORD (8+ characters)');
  const run = process.env.E2E_RUN_ID ?? 'local';
  const email = `sixdude602+offline-${test.info().project.name}-${run}@gmail.com`;
  fs.mkdirSync(shots, { recursive: true });

  try {
    await openAccount(page, email, password);
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
    await logBench(page);
    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Finish' }).click();
    const confirm = page.getByRole('button', { name: 'Finish workout' });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
    await expect(page.getByText("1 change will sync when you're back online.")).toBeVisible();
    await shot(page, 'banner');

    await page.getByRole('button', { name: /^(Log cardio|Cardio)$/ }).click();
    await expect(page.getByRole('heading', { name: 'Log cardio' })).toBeVisible();
    await page.getByLabel('Minutes').fill('12');
    await page.getByLabel('Seconds').fill('5');
    await page.getByRole('button', { name: 'Save run' }).click();
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
    await expect(page.getByText("2 changes will sync when you're back online.")).toBeVisible();
    await shot(page, 'banner-two');

    await page.getByRole('tab', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('2 waiting')).toBeVisible();
    await shot(page, 'profile-waiting');

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('setwise.query') ?? ''))
      .toContain('saveCardio');
    await relaunchOffline(page);
    await expect(page.getByText('2 waiting')).toBeVisible();
    await page.getByRole('tab', { name: 'Today' }).click();
    await expect(page.getByText("2 changes will sync when you're back online.")).toBeVisible();

    await page
      .context()
      .unroute('**/*supabase.co/**')
      .catch(() => undefined);
    await page.evaluate(() => {
      sessionStorage.removeItem('setwise.e2e.offline');
      window.dispatchEvent(new Event('online'));
    });
    await expect(page.getByText(/will sync when you're back online/)).toHaveCount(0);
    await expect
      .poll(async () => {
        const snapshot = await remoteSnapshot(page);
        return snapshot.workouts.length === 1 && snapshot.cardio.length === 1;
      })
      .toBe(true);
    const saved = await remoteSnapshot(page);
    expect(saved.workouts.map((workout) => workout.title)).toEqual([TITLE]);
    expect(saved.cardio.map((session) => session.durationS)).toEqual([12 * 60 + 5]);

    await page.getByRole('tab', { name: 'Profile' }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();
    await shot(page, 'profile-saved');
  } finally {
    await page.context().setOffline(false);
    await removeRows(page);
  }
});

async function relaunchOffline(page: Page) {
  await page.evaluate(() => sessionStorage.setItem('setwise.e2e.offline', '1'));
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get() {
        if (sessionStorage.getItem('setwise.e2e.offline') === '1') return false;
        return original?.get?.call(this) ?? true;
      },
    });
  });
  await page.context().route('**/*supabase.co/**', (route) => route.abort('failed'));
  // `setOffline` also drops the dev server, so the document reload happens
  // after the browser is back online while the app still reads `navigator.onLine`.
  await page.goto('about:blank');
  await page.context().setOffline(false);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
}

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  if (project !== 'iphone-16-light' && project !== 'iphone-16-dark') return;
  await page.screenshot({ path: path.join(shots, `${project}-${name}.png`) });
}

async function openAccount(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: 'Continue with Apple' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  const today = page.getByRole('heading', { name: 'This week' });
  const wrong = page.getByText('Wrong email or password');
  await expect(today.or(wrong)).toBeVisible();
  if (await wrong.isVisible()) {
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByRole('button', { name: /^Create account$/ }).click();
    await expect(today).toBeVisible();
  }
}

async function logBench(page: Page) {
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByText('Add your first exercise')).toBeVisible();
  await page.getByRole('textbox', { name: 'Workout title' }).fill(TITLE);
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('bench');
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await page.getByRole('textbox', { name: 'Set 1 weight' }).fill('135');
  await page.getByRole('textbox', { name: 'Set 1 reps' }).fill('8');
}

async function remoteSnapshot(page: Page) {
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));
  return page.evaluate(async () => {
    const repo = window.__setwise!.getRepo();
    const [workouts, cardio] = await Promise.all([
      repo.listWorkouts({ limit: 20 }),
      repo.listCardio({ limit: 20 }),
    ]);
    return {
      workouts: workouts.map((workout) => ({ id: workout.id, title: workout.title })),
      cardio: cardio.map((session) => ({ id: session.id, durationS: session.durationS })),
    };
  });
}

async function removeRows(page: Page) {
  await page
    .evaluate(async () => {
      const repo = window.__setwise?.getRepo();
      if (!repo) return;
      const [workouts, cardio] = await Promise.all([
        repo.listWorkouts({ limit: 50 }),
        repo.listCardio({ limit: 50 }),
      ]);
      for (const workout of workouts) await repo.deleteWorkout(workout.id);
      for (const session of cardio) await repo.deleteCardio(session.id);
    })
    .catch(() => undefined);
}
