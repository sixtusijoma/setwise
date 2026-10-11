import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const shots = path.join('/cursor/stores/bc-94e7f78c-e1fb-54c8-944f-124699e783ef/media/s4');
const liveShots = path.join(
  '/cursor/stores/bc-94e7f78c-e1fb-54c8-944f-124699e783ef/media/s4-live-v2',
);

const A = 'sixdude602+e2e-a@gmail.com';
const B = 'sixdude602+e2e-b@gmail.com';
const SECRET = 'E2E Secret Curl';
const TITLE = 'A Push';

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(shots, `${test.info().project.name}-${name}.png`),
  });
}

test('sign-in screen and errors', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Setwise' })).toBeVisible();
  await expect(page.getByText('Every set, accounted for.')).toBeVisible();

  const local = page.getByRole('button', { name: 'Continue in local mode' });
  if (await local.count()) {
    await shot(page, 'sign-in-local');
    await local.click();
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
    return;
  }

  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await shot(page, 'sign-in');

  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await expect(page.getByText('Enter your email and password.')).toBeVisible();
  await shot(page, 'error-empty');

  await page.getByRole('textbox', { name: 'Email' }).fill('not-an-email');
  await page.getByRole('textbox', { name: 'Password' }).fill('long-enough');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await shot(page, 'error-email');

  await page.getByRole('textbox', { name: 'Email' }).fill('ada@example.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('short');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByRole('button', { name: /^Create account$/ }).click();
  await expect(page.getByText('Use at least 8 characters.')).toBeVisible();
  await shot(page, 'error-password');

  await page.getByRole('textbox', { name: 'Password' }).fill('long-enough');
  await page.getByRole('button', { name: /^Create account$/ }).click();
  await expect(page.getByText("Couldn't reach Setwise. Check your connection.")).toBeVisible();
  await shot(page, 'error-connection');
});

test('profile units persist on this device', async ({ page }) => {
  await page.goto('/profile');
  const metric = page.getByRole('tab', { name: 'kg · km' });
  const signIn = page.getByRole('button', { name: /^Sign in$/ });
  await expect(metric.or(signIn)).toBeVisible();
  if (await signIn.count()) {
    test.skip(true, 'units persistence is covered in local mode');
    return;
  }
  await metric.click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('setwise.local.v1')))
    .toContain('"unitSystem":"metric"');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('setwise.local.v1')))
    .toContain('"unitSystem":"metric"');
  await expect
    .poll(() =>
      page.getByRole('tab', { name: 'kg · km' }).evaluate((element) => {
        return getComputedStyle(element).backgroundColor;
      }),
    )
    .not.toBe('rgba(0, 0, 0, 0)');
});

test('hosted sign-in isolates two users', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(
    process.env.E2E_SUPABASE !== '1',
    'needs the hosted project after migrations are applied',
  );
  const password = process.env.E2E_PASSWORD ?? '';
  test.skip(password.length < 8, 'Set E2E_PASSWORD (8+ characters)');

  await page.goto('/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).fill(A);
  await page.getByRole('textbox', { name: 'Password' }).fill('not-the-password');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await expect(page.getByText('Wrong email or password')).toBeVisible();
  await liveShot(page, 'wrong-password');

  await openAccount(page, A, password);
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await logAWorkout(page);
  await liveShot(page, 'a-workout-saved');
  await logARun(page);
  await liveShot(page, 'a-cardio-saved');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();

  const saved = await remoteSnapshot(page);
  expect(saved.workouts.some((workout) => workout.title === TITLE)).toBe(true);
  expect(saved.workouts.some((workout) => workout.exercises.includes('Bench Press'))).toBe(true);
  expect(saved.workouts.some((workout) => workout.exercises.includes(SECRET))).toBe(true);
  expect(
    saved.cardio.some((session) => session.activity === 'run' && session.durationS === 1600),
  ).toBe(true);
  const workoutId = saved.workouts.find((workout) => workout.title === TITLE)?.id;
  const cardioId = saved.cardio.find(
    (session) => session.activity === 'run' && session.durationS === 1600,
  )?.id;
  const exerciseId = saved.exerciseIds[SECRET];
  expect(workoutId).toBeTruthy();
  expect(cardioId).toBeTruthy();
  expect(exerciseId).toBeTruthy();

  await expectOwnHistory(page);
  await liveShot(page, 'a-history');
  await expectOwnProgress(page);
  await liveShot(page, 'a-progress');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();

  await signOut(page);
  await openAccount(page, B, password);
  await expectEmptyHistory(page);
  await liveShot(page, 'b-history');
  await expectEmptyHistoryFilters(page);
  await expectEmptyProgress(page);
  await liveShot(page, 'b-progress');

  await page.getByRole('tab', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible();
  await page.getByPlaceholder(/Search \d+ exercises/).fill(SECRET);
  await expect(page.getByRole('button', { name: SECRET, exact: true })).toHaveCount(0);
  await expect(page.getByText('No match in the library.')).toBeVisible();
  await liveShot(page, 'b-picker');
  const leaked = await remoteSnapshot(page);
  expect(leaked.workouts).toEqual([]);
  expect(leaked.cardio).toEqual([]);
  expect(leaked.exerciseIds[SECRET]).toBeUndefined();
  await page.getByRole('button', { name: 'Close' }).click();
  await discardDraft(page);

  await signOut(page);
  await openAccount(page, A, password);
  const intact = await remoteSnapshot(page);
  expect(
    intact.workouts.some((workout) => workout.id === workoutId && workout.title === TITLE),
  ).toBe(true);
  expect(
    intact.cardio.some((session) => session.id === cardioId && session.durationS === 1600),
  ).toBe(true);
  expect(intact.exerciseIds[SECRET]).toBe(exerciseId);
  await expectOwnHistory(page);
  await liveShot(page, 'a-history-intact');
  await expectOwnProgress(page);
  await liveShot(page, 'a-progress-intact');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('tab', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible();
  await page.getByPlaceholder(/Search \d+ exercises/).fill(SECRET);
  await expect(page.getByRole('button', { name: SECRET, exact: true })).toBeVisible();
  await liveShot(page, 'a-picker-intact');
  await page.getByRole('button', { name: 'Close' }).click();
  await discardDraft(page);

  await page.evaluate(
    async ({ workout, cardio, exercise }) => {
      const repo = window.__setwise!.getRepo();
      await repo.deleteWorkout(workout);
      await repo.deleteCardio(cardio);
      await repo.deleteExercise(exercise);
    },
    { workout: workoutId!, cardio: cardioId!, exercise: exerciseId! },
  );
});

async function openAccount(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
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

async function signOut(page: Page) {
  await page.getByRole('tab', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Setwise' })).toBeVisible();
}

async function liveShot(page: Page, name: string) {
  fs.mkdirSync(liveShots, { recursive: true });
  await page.screenshot({ path: path.join(liveShots, `${name}.png`) });
}

async function expectOwnHistory(page: Page) {
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(TITLE) })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Run,/ })).toBeVisible();
  await expect(page.getByText('8:36').first()).toBeVisible();
}

async function expectOwnProgress(page: Page) {
  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await page.getByRole('button', { name: /Bench Press, / }).click();
  await expect(page.getByRole('heading', { name: 'Bench Press' })).toBeVisible();
  await expect(page.getByText('Barbell · Chest · 1 session')).toBeVisible();
  await expect(page.getByText('135 × 8').first()).toBeVisible();
}

async function expectEmptyHistory(page: Page) {
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByText('Nothing logged yet')).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(TITLE) })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Run,/ })).toHaveCount(0);
  await expect(page.getByText(SECRET)).toHaveCount(0);
}

async function expectEmptyHistoryFilters(page: Page) {
  await page.getByRole('tab', { name: 'Strength' }).click();
  await expect(page.getByText('No strength yet')).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(TITLE) })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Cardio' }).click();
  await expect(page.getByText('No cardio yet')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Run,/ })).toHaveCount(0);
}

async function expectEmptyProgress(page: Page) {
  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(page.getByText('Log a workout to see your progress')).toBeVisible();
  await expect(page.getByRole('button', { name: /Bench Press/ })).toHaveCount(0);
  await expect(page.getByText(SECRET)).toHaveCount(0);
  await expect(page.getByText(TITLE)).toHaveCount(0);
}

async function bridgeReady(page: Page) {
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));
}

async function dismissRest(page: Page) {
  const skip = page.getByRole('button', { name: 'Dismiss rest timer' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function logAWorkout(page: Page) {
  await bridgeReady(page);
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByText('Add your first exercise')).toBeVisible();
  await page.getByRole('textbox', { name: 'Workout title' }).fill(TITLE);
  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('bench');
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await page.getByRole('textbox', { name: 'Set 1 weight' }).fill('135');
  await page.getByRole('textbox', { name: 'Set 1 reps' }).fill('8');
  await page.getByRole('button', { name: 'Set 1, 135 pounds, 8 reps, not completed' }).click();
  await dismissRest(page);

  await page.getByRole('button', { name: 'Add exercise' }).last().click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill(SECRET);
  await page.getByRole('button', { name: `Create “${SECRET}”` }).click();
  await expect(page.getByRole('heading', { name: 'New exercise' })).toBeVisible();
  await page.getByRole('button', { name: 'Biceps', exact: true }).click();
  await page.getByRole('button', { name: 'Cable', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(SECRET).first()).toBeVisible();
  await page.getByRole('textbox', { name: 'Set 1 weight' }).last().fill('50');
  await page.getByRole('textbox', { name: 'Set 1 reps' }).last().fill('8');
  await page.getByRole('button', { name: 'Set 1, 50 pounds, 8 reps, not completed' }).click();
  await dismissRest(page);
  await page.getByRole('button', { name: 'Finish' }).click();
  const confirm = page.getByRole('button', { name: 'Finish workout' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
}

async function logARun(page: Page) {
  await page.getByRole('button', { name: /^(Log cardio|Cardio)$/ }).click();
  await expect(page.getByRole('heading', { name: 'Log cardio' })).toBeVisible();
  await page.getByLabel('Minutes').fill('26');
  await page.getByLabel('Seconds').fill('40');
  await page.getByLabel('Distance in miles').fill('3.10');
  await page.getByRole('button', { name: 'Save run' }).click();
  await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
  await expect(page.getByText('26:40')).toBeVisible();
}

type RemoteSnapshot = {
  workouts: { id: string; title: string | null; exercises: string[] }[];
  cardio: { id: string; activity: string; durationS: number }[];
  exerciseIds: Record<string, string>;
};

async function remoteSnapshot(page: Page): Promise<RemoteSnapshot> {
  await bridgeReady(page);
  return page.evaluate(async () => {
    const repo = window.__setwise!.getRepo();
    const [workouts, cardio, exercises] = await Promise.all([
      repo.listWorkouts({ limit: 20 }),
      repo.listCardio({ limit: 20 }),
      repo.listExercises(),
    ]);
    const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
    return {
      workouts: workouts.map((workout) => ({
        id: workout.id,
        title: workout.title,
        exercises: workout.exercises.map((exercise) => names.get(exercise.exerciseId) ?? ''),
      })),
      cardio: cardio.map((session) => ({
        id: session.id,
        activity: session.activity,
        durationS: session.durationS,
      })),
      exerciseIds: Object.fromEntries(exercises.map((exercise) => [exercise.name, exercise.id])),
    };
  });
}

async function discardDraft(page: Page) {
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
}
