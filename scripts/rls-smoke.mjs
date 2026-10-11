#!/usr/bin/env node
// Proves the hosted project matches supabase/tests/database/rls.test.sql.
// Uses only the public publishable/anon key. Never prints secrets.
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY
//   RLS_SMOKE_PASSWORD   (8+ characters, for sixdude602+qa-a/b@gmail.com)

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const password = process.env.RLS_SMOKE_PASSWORD ?? '';

if (!url || !key || password.length < 8) {
  console.error(
    'Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, and RLS_SMOKE_PASSWORD (8+ characters).',
  );
  process.exit(1);
}

const EMAIL = {
  a: 'sixdude602+qa-a@gmail.com',
  b: 'sixdude602+qa-b@gmail.com',
};

const ID = {
  exercise: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  workout: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  workoutExercise: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  cardio: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  bWorkout: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
};

const auth = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`ok - ${name}`);
    return;
  }
  failed += 1;
  console.error(`not ok - ${name}${detail ? `: ${detail}` : ''}`);
}

function sqlState(error) {
  return error?.code ?? '';
}

function expectError(name, error, code) {
  const actual = sqlState(error);
  const message = error?.message ?? '';
  check(
    name,
    actual === code || message.includes(code),
    `expected ${code}, got ${actual || 'no error'} (${message})`,
  );
}

function expectEmpty(name, result) {
  if (result.error) {
    check(name, false, result.error.message);
    return;
  }
  const rows = result.data ?? [];
  check(name, rows.length === 0, `saw ${rows.length} row(s)`);
}

function client() {
  return createClient(url, key, { auth });
}

async function signIn(email) {
  const supabase = client();
  const existing = await supabase.auth.signInWithPassword({ email, password });
  if (!existing.error && existing.data.session) return supabase;
  const created = await supabase.auth.signUp({ email, password });
  if (created.error || !created.data.session) {
    const reason = created.error?.message ?? 'no session';
    throw new Error(
      `Could not open a session for ${email} (${reason}). Email confirmations must be off, and the password must meet the project minimum of 8.`,
    );
  }
  return supabase;
}

async function main() {
  const a = await signIn(EMAIL.a);
  const b = await signIn(EMAIL.b);
  const {
    data: { user: userA },
  } = await a.auth.getUser();
  const {
    data: { user: userB },
  } = await b.auth.getUser();
  if (!userA || !userB) throw new Error('Missing user id');

  const library = await a
    .from('exercises')
    .select('id')
    .eq('slug', 'barbell-bench-press')
    .maybeSingle();
  if (library.error || !library.data) {
    throw new Error(library.error?.message ?? 'Bench Press is missing. Apply the exercise seed.');
  }

  const custom = await a.from('exercises').select('id').eq('id', ID.exercise).maybeSingle();
  if (custom.error) throw new Error(custom.error.message);
  if (!custom.data) {
    const inserted = await a.from('exercises').insert({
      id: ID.exercise,
      name: 'QA Secret Curl',
      muscle_group: 'biceps',
      equipment: 'cable',
    });
    if (inserted.error) throw new Error(inserted.error.message);
  }

  const saved = await a.rpc('save_workout', {
    workout: {
      id: ID.workout,
      title: 'A Push',
      started_at: '2026-10-01T10:00:00Z',
      ended_at: '2026-10-01T11:00:00Z',
      exercises: [
        {
          id: ID.workoutExercise,
          exercise_id: library.data.id,
          sets: [
            { reps: 5, weight_kg: 100 },
            { reps: 5, weight_kg: 102.058 },
          ],
        },
      ],
    },
  });
  if (saved.error) throw new Error(saved.error.message);

  const cardio = await a.from('cardio_sessions').upsert(
    {
      id: ID.cardio,
      activity: 'run',
      started_at: '2026-10-02T07:00:00Z',
      duration_s: 1800,
      distance_m: 5000,
    },
    { onConflict: 'id' },
  );
  if (cardio.error) throw new Error(cardio.error.message);

  expectEmpty('B sees no workouts of A', await b.from('workouts').select('id'));
  expectEmpty('B sees no workout exercises of A', await b.from('workout_exercises').select('id'));
  expectEmpty('B sees no sets of A', await b.from('workout_sets').select('id'));
  expectEmpty('B sees no cardio of A', await b.from('cardio_sessions').select('id'));
  expectEmpty(
    'B cannot read A workout by id',
    await b.from('workouts').select('id').eq('id', ID.workout),
  );

  const profiles = await b.from('profiles').select('id');
  check(
    'B sees only their own profile',
    !profiles.error && profiles.data?.length === 1 && profiles.data[0].id === userB.id,
    profiles.error?.message ?? `rows=${profiles.data?.length ?? 0}`,
  );

  const seenLibrary = await b.from('exercises').select('id').eq('slug', 'barbell-bench-press');
  check(
    'B sees the library',
    !seenLibrary.error && seenLibrary.data?.length === 1,
    seenLibrary.error?.message ?? '',
  );
  expectEmpty(
    "B does not see A's custom exercise",
    await b.from('exercises').select('id').eq('id', ID.exercise),
  );

  // PostgREST rejects UPDATE/DELETE with no filter. A match-all filter is the
  // hosted equivalent of the unfiltered statements in rls.test.sql: RLS still
  // hides A's rows, so the write matches nothing.
  const anyId = '00000000-0000-0000-0000-000000000000';
  expectEmpty(
    "B cannot update A's workout",
    await b.from('workouts').update({ title: 'pwned' }).neq('id', anyId).select('id'),
  );
  expectEmpty(
    "B cannot delete A's workout",
    await b.from('workouts').delete().neq('id', anyId).select('id'),
  );
  expectEmpty(
    "B cannot update A's sets",
    await b.from('workout_sets').update({ reps: 0 }).neq('id', anyId).select('id'),
  );
  expectEmpty(
    "B cannot delete A's cardio",
    await b.from('cardio_sessions').delete().neq('id', anyId).select('id'),
  );
  expectEmpty(
    "B cannot update A's profile",
    await b.from('profiles').update({ display_name: 'pwned' }).eq('id', userA.id).select('id'),
  );
  expectEmpty(
    "B cannot update A's custom exercise",
    await b.from('exercises').update({ name: 'pwned' }).eq('id', ID.exercise).select('id'),
  );
  expectEmpty(
    'B cannot update library exercises',
    await b
      .from('exercises')
      .update({ name: 'pwned' })
      .eq('slug', 'barbell-bench-press')
      .select('id'),
  );
  expectEmpty(
    'B cannot delete library exercises',
    await b.from('exercises').delete().eq('slug', 'barbell-bench-press').select('id'),
  );

  expectError(
    'B cannot create a workout owned by A',
    (
      await b.from('workouts').insert({
        user_id: userA.id,
        started_at: '2026-10-01T10:00:00Z',
        ended_at: '2026-10-01T11:00:00Z',
      })
    ).error,
    '42501',
  );
  expectError(
    "B cannot attach an exercise to A's workout",
    (
      await b.from('workout_exercises').insert({
        workout_id: ID.workout,
        exercise_id: library.data.id,
        position: 1,
      })
    ).error,
    '23503',
  );
  expectError(
    "B cannot add a set to A's workout exercise",
    (
      await b.from('workout_sets').insert({
        workout_exercise_id: ID.workoutExercise,
        position: 9,
        reps: 1,
        weight_kg: 1,
      })
    ).error,
    '23503',
  );
  expectError(
    "B cannot overwrite A's workout via save_workout",
    (
      await b.rpc('save_workout', {
        workout: {
          id: ID.workout,
          started_at: '2026-10-01T10:00:00Z',
          ended_at: '2026-10-01T10:30:00Z',
          exercises: [],
        },
      })
    ).error,
    '42501',
  );
  expectError(
    'B cannot add to the global library',
    (
      await b.from('exercises').insert({
        owner_id: null,
        slug: 'fake-lift',
        name: 'Fake Lift',
        muscle_group: 'chest',
        equipment: 'barbell',
      })
    ).error,
    '42501',
  );

  const own = await b.rpc('save_workout', {
    workout: {
      id: ID.bWorkout,
      started_at: '2026-10-03T10:00:00Z',
      ended_at: '2026-10-03T10:30:00Z',
      exercises: [],
    },
  });
  check('B can save their own workout', !own.error, own.error?.message ?? '');

  expectError(
    "B cannot reference A's custom exercise",
    (
      await b.from('workout_exercises').insert({
        workout_id: ID.bWorkout,
        exercise_id: ID.exercise,
        position: 0,
      })
    ).error,
    '42501',
  );
  expectError(
    'B cannot hand a workout to A',
    (await b.from('workouts').update({ user_id: userA.id }).eq('id', ID.bWorkout)).error,
    '42501',
  );
  await b.from('workouts').delete().eq('id', ID.bWorkout);

  const anon = client();
  expectError(
    'anon cannot read workouts',
    (await anon.from('workouts').select('id')).error,
    '42501',
  );
  expectError(
    'anon cannot read exercises',
    (await anon.from('exercises').select('id')).error,
    '42501',
  );
  expectError(
    'anon cannot call save_workout',
    (await anon.rpc('save_workout', { workout: {} })).error,
    '42501',
  );

  const intact = await a.from('workouts').select('title').eq('id', ID.workout).maybeSingle();
  check('A workout is intact', intact.data?.title === 'A Push', intact.error?.message ?? '');
  const sets = await a
    .from('workout_sets')
    .select('reps, weight_kg, position')
    .eq('workout_exercise_id', ID.workoutExercise);
  const ordered = (sets.data ?? []).slice().sort((left, right) => left.position - right.position);
  const weights = ordered.map((set) => Number(set.weight_kg));
  check(
    'A sets are intact',
    !sets.error &&
      ordered.length === 2 &&
      ordered[0].reps === 5 &&
      ordered[1].reps === 5 &&
      Math.abs(weights[0] - 100) < 0.001 &&
      Math.abs(weights[1] - 102.058) < 0.001,
    sets.error?.message ?? '',
  );

  const removedWorkout = await a.from('workouts').delete().eq('id', ID.workout).select('id');
  check(
    'A can delete their workout',
    !removedWorkout.error && removedWorkout.data?.length === 1,
    removedWorkout.error?.message ?? `rows=${removedWorkout.data?.length ?? 0}`,
  );
  const removedCardio = await a.from('cardio_sessions').delete().eq('id', ID.cardio).select('id');
  check(
    'A can delete their cardio',
    !removedCardio.error && removedCardio.data?.length === 1,
    removedCardio.error?.message ?? `rows=${removedCardio.data?.length ?? 0}`,
  );
  const removedExercise = await a.from('exercises').delete().eq('id', ID.exercise).select('id');
  check(
    'A can delete their custom exercise',
    !removedExercise.error && removedExercise.data?.length === 1,
    removedExercise.error?.message ?? `rows=${removedExercise.data?.length ?? 0}`,
  );

  if (failed) {
    console.error(`${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('all checks passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'rls smoke failed');
  process.exit(1);
});
