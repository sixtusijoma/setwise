import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { lbToKg } from '../src/lib/units';

const shots = path.join('artifacts', 'qa', '2026-10-08', 'workout-logging');

type System = 'imperial' | 'metric';

type LoggedWorkout = {
  title: string | null;
  exercises: { name: string | undefined; sets: { reps: number; weightKg: number }[] }[];
};

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(shots, `${test.info().project.name}-${name}.png`),
    fullPage: false,
  });
}

async function bridgeReady(page: Page) {
  await page.waitForFunction(() => Boolean(window.__setwise?.getRepo));
}

async function dismissRest(page: Page) {
  const skip = page.getByRole('button', { name: 'Dismiss rest timer' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function fillSet(
  page: Page,
  index: number,
  weight: string,
  reps: string,
  unit: string,
  restShot?: string,
) {
  await page
    .getByRole('textbox', { name: `Set ${index} weight` })
    .last()
    .fill(weight);
  await page
    .getByRole('textbox', { name: `Set ${index} reps` })
    .last()
    .fill(reps);
  const check = page
    .getByRole('button', {
      name: new RegExp(`^Set ${index}, ${weight} ${unit}, ${reps} reps, not completed$`),
    })
    .last();
  await expect(check).toBeVisible();
  await check.click();
  if (restShot) await shot(page, restShot);
  await dismissRest(page);
}

async function logExercise(
  page: Page,
  weights: string[],
  reps: string[],
  unitWord: string,
  addSetName: string,
  restShot?: string,
) {
  for (let index = 0; index < weights.length; index += 1) {
    if (index > 0) await page.getByRole('button', { name: `Add set to ${addSetName}` }).click();
    await fillSet(
      page,
      index + 1,
      weights[index],
      reps[index],
      unitWord,
      index === 0 ? restShot : undefined,
    );
  }
}

async function storedWorkouts(page: Page): Promise<LoggedWorkout[]> {
  return page.evaluate(async () => {
    const repo = window.__setwise!.getRepo();
    const [workouts, exercises] = await Promise.all([
      repo.listWorkouts({ limit: 10 }),
      repo.listExercises(),
    ]);
    const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
    return workouts.map((workout) => ({
      title: workout.title,
      exercises: workout.exercises.map((exercise) => ({
        name: names.get(exercise.exerciseId),
        sets: exercise.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
      })),
    }));
  });
}

async function logSession(page: Page, system: System) {
  const imperial = system === 'imperial';
  const unit = imperial ? 'LB' : 'KG';
  const unitWord = imperial ? 'pounds' : 'kilograms';
  const bench = imperial ? ['135', '185', '205'] : ['60', '80', '100'];
  const custom = imperial ? ['95', '115', '135'] : ['40', '50', '60'];
  const press = imperial ? ['75', '95', '105'] : ['30', '40', '45'];
  const reps = ['8', '5', '5'];

  await page.goto('/');
  await bridgeReady(page);
  if (!imperial) {
    await page.evaluate(async () => {
      await window.__setwise!.getRepo().updateProfile({ unitSystem: 'metric' });
    });
    await page.reload();
    await bridgeReady(page);
  }

  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByText('Add your first exercise')).toBeVisible();
  await shot(page, `${system}-empty`);

  await page.getByRole('button', { name: 'Add your first exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('bench');
  await expect(page.getByRole('button', { name: 'Bench Press', exact: true })).toBeVisible();
  await shot(page, `${system}-picker`);
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await expect(page.getByText(unit, { exact: true }).first()).toBeVisible();
  await logExercise(page, bench, reps, unitWord, 'Bench Press', `${system}-rest`);

  await page.getByRole('button', { name: 'Add exercise' }).last().click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('Landmine Row');
  await page.getByRole('button', { name: 'Create “Landmine Row”' }).click();
  await expect(page.getByRole('heading', { name: 'New exercise' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Exercise name' })).toHaveValue('Landmine Row');
  await shot(page, `${system}-new-exercise`);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Barbell', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Landmine Row').first()).toBeVisible();
  await logExercise(page, custom, reps, unitWord, 'Landmine Row');

  await page.getByRole('button', { name: 'Add exercise' }).last().click();
  await page.getByPlaceholder(/Search \d+ exercises/).fill('ohp');
  await expect(page.getByRole('button', { name: 'Overhead Press', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Overhead Press', exact: true }).click();
  await logExercise(page, press, reps, unitWord, 'Overhead Press');
  await page.getByRole('button', { name: 'Add set to Overhead Press' }).click();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Workout title' })).toBeVisible();
  await expect(page.getByText('Bench Press').first()).toBeVisible();
  await expect(page.getByText('Landmine Row').first()).toBeVisible();
  await expect(page.getByText('Overhead Press').first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Set 1 weight' }).first()).toHaveValue(bench[0]);
  await expect(
    page
      .getByRole('button', {
        name: new RegExp(`Set 3, ${bench[2]} ${unitWord}, 5 reps, completed`),
      })
      .first(),
  ).toBeVisible();
  await shot(page, `${system}-active`);

  const title = await page.getByRole('textbox', { name: 'Workout title' }).inputValue();
  await page.getByRole('button', { name: 'Minimize' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume workout' })).toBeVisible();
  await expect(page.getByText(title).first()).toBeVisible();
  await shot(page, `${system}-bar`);

  await page.getByRole('button', { name: 'Resume workout' }).click();
  await expect(page.getByRole('textbox', { name: 'Workout title' })).toHaveValue(title);
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Finish and drop 1 empty set?')).toBeVisible();
  await shot(page, `${system}-finish`);
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume workout' })).toHaveCount(0);

  const workouts = await storedWorkouts(page);
  const session = workouts.find((workout) => workout.title === title);
  expect(session?.exercises.map((exercise) => exercise.name)).toEqual([
    'Bench Press',
    'Landmine Row',
    'Overhead Press',
  ]);
  const expected = imperial
    ? [
        bench.map((value) => lbToKg(Number(value))),
        custom.map((value) => lbToKg(Number(value))),
        press.map((value) => lbToKg(Number(value))),
      ]
    : [bench.map(Number), custom.map(Number), press.map(Number)];
  session?.exercises.forEach((exercise, index) => {
    expect(exercise.sets.map((set) => set.reps)).toEqual([8, 5, 5]);
    expect(exercise.sets.map((set) => set.weightKg)).toEqual(expected[index]);
  });
}

test('logs a workout in pounds', async ({ page }) => {
  await logSession(page, 'imperial');
});

test('logs a workout in kilograms', async ({ page }) => {
  await logSession(page, 'metric');
});
