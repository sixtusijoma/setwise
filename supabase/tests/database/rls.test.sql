-- Proves per-user isolation: user B can neither read nor write anything owned by user A,
-- anon can touch nothing, and the shared library is read-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- fixtures (as the migration owner) -------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');

insert into public.exercises (id, owner_id, slug, name, muscle_group, equipment)
values ('11111111-0000-0000-0000-000000000001', null, 'test-lift', 'Test Lift', 'chest', 'barbell');

-- user A creates data through the same paths the app uses --------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a"}';

insert into public.exercises (id, name, muscle_group, equipment)
values ('11111111-0000-0000-0000-0000000000a1', 'A Secret Curl', 'biceps', 'cable');

select lives_ok($$
  select public.save_workout('{
    "id": "22222222-0000-0000-0000-0000000000a1",
    "title": "A Push",
    "started_at": "2026-10-01T10:00:00Z",
    "ended_at": "2026-10-01T11:00:00Z",
    "exercises": [{
      "id": "33333333-0000-0000-0000-0000000000a1",
      "exercise_id": "11111111-0000-0000-0000-000000000001",
      "sets": [{"reps": 5, "weight_kg": 100}, {"reps": 5, "weight_kg": 102.058}]
    }]
  }')
$$, 'A can save a workout');

insert into public.cardio_sessions (id, activity, started_at, duration_s, distance_m)
values ('44444444-0000-0000-0000-0000000000a1', 'run', '2026-10-02T07:00:00Z', 1800, 5000);

insert into public.workout_templates (id, name, exercises)
values ('55555555-0000-0000-0000-0000000000a1', 'A Push Day',
  '[{"exercise_id": "11111111-0000-0000-0000-000000000001", "sets": [{"reps": 5, "weight_kg": 100}]}]');

-- user B: reads ---------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b"}';

select is_empty($$ select 1 from public.workouts $$, 'B sees no workouts of A');
select is_empty($$ select 1 from public.workout_exercises $$, 'B sees no workout exercises of A');
select is_empty($$ select 1 from public.workout_sets $$, 'B sees no sets of A');
select is_empty($$ select 1 from public.cardio_sessions $$, 'B sees no cardio of A');
select is_empty($$ select 1 from public.workout_templates $$, 'B sees no templates of A');
select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'B sees only their own profile');
select isnt_empty($$ select 1 from public.exercises where slug = 'test-lift' $$, 'B sees the library');
select is_empty($$ select 1 from public.exercises where owner_id is not null $$,
  'B does not see A''s custom exercise');

-- user B: writes against A's rows silently affect nothing -------------------
select is_empty($$ update public.workouts set title = 'pwned' returning 1 $$, 'B cannot update A''s workout');
select is_empty($$ delete from public.workouts returning 1 $$, 'B cannot delete A''s workout');
select is_empty($$ update public.workout_sets set reps = 0 returning 1 $$, 'B cannot update A''s sets');
select is_empty($$ delete from public.cardio_sessions returning 1 $$, 'B cannot delete A''s cardio');
select is_empty($$ update public.workout_templates set name = 'pwned' returning 1 $$,
  'B cannot rename A''s template');
select is_empty($$ delete from public.workout_templates returning 1 $$, 'B cannot delete A''s template');
select is_empty($$ update public.profiles set display_name = 'pwned'
  where id = '00000000-0000-0000-0000-00000000000a' returning 1 $$, 'B cannot update A''s profile');
select is_empty($$ update public.exercises set name = 'pwned'
  where id = '11111111-0000-0000-0000-0000000000a1' returning 1 $$, 'B cannot update A''s custom exercise');
select is_empty($$ update public.exercises set name = 'pwned' where slug = 'test-lift' returning 1 $$,
  'B cannot update library exercises');
select is_empty($$ delete from public.exercises where slug = 'test-lift' returning 1 $$,
  'B cannot delete library exercises');

-- user B: inserts that try to impersonate or attach to A are rejected ---------
select throws_ok($$
  insert into public.workouts (user_id, started_at, ended_at)
  values ('00000000-0000-0000-0000-00000000000a', now(), now())
$$, '42501', null, 'B cannot create a workout owned by A');

select throws_ok($$
  insert into public.workout_exercises (workout_id, exercise_id, position)
  values ('22222222-0000-0000-0000-0000000000a1', '11111111-0000-0000-0000-000000000001', 1)
$$, '23503', null, 'B cannot attach an exercise to A''s workout (composite FK)');

select throws_ok($$
  insert into public.workout_sets (workout_exercise_id, position, reps, weight_kg)
  values ('33333333-0000-0000-0000-0000000000a1', 9, 1, 1)
$$, '23503', null, 'B cannot add a set to A''s workout exercise (composite FK)');

select throws_ok($$
  select public.save_workout('{
    "id": "22222222-0000-0000-0000-0000000000a1",
    "started_at": "2026-10-01T10:00:00Z", "ended_at": "2026-10-01T10:30:00Z", "exercises": []
  }')
$$, '42501', null, 'B cannot overwrite A''s workout via save_workout');

select throws_ok($$
  insert into public.exercises (owner_id, slug, name, muscle_group, equipment)
  values (null, 'fake-lift', 'Fake Lift', 'chest', 'barbell')
$$, '42501', null, 'B cannot add to the global library');

select lives_ok($$
  select public.save_workout('{
    "id": "22222222-0000-0000-0000-0000000000b1",
    "started_at": "2026-10-03T10:00:00Z", "ended_at": "2026-10-03T10:30:00Z", "exercises": []
  }')
$$, 'B can save their own workout');

select throws_ok($$
  insert into public.workout_exercises (workout_id, exercise_id, position)
  values ('22222222-0000-0000-0000-0000000000b1', '11111111-0000-0000-0000-0000000000a1', 0)
$$, '42501', null, 'B cannot reference A''s custom exercise');

select throws_ok($$
  update public.workouts set user_id = '00000000-0000-0000-0000-00000000000a'
  where id = '22222222-0000-0000-0000-0000000000b1'
$$, '42501', null, 'B cannot hand a workout to A');

select throws_ok($$
  insert into public.workout_templates (user_id, name)
  values ('00000000-0000-0000-0000-00000000000a', 'Planted')
$$, '42501', null, 'B cannot create a template owned by A');

select throws_ok($$
  insert into public.workout_templates (id, name) values ('55555555-0000-0000-0000-0000000000a1', 'Mine')
  on conflict (id) do update set name = excluded.name
$$, '42501', null, 'B cannot overwrite A''s template by id');

-- anon: no privileges at all ----------------------------------------------
set local role anon;
set local request.jwt.claims to '';

select throws_ok($$ select 1 from public.workouts $$, '42501', null, 'anon cannot read workouts');
select throws_ok($$ select 1 from public.exercises $$, '42501', null, 'anon cannot read exercises');
select throws_ok($$ select public.save_workout('{}') $$, '42501', null, 'anon cannot call save_workout');
select throws_ok($$ select 1 from public.workout_templates $$, '42501', null, 'anon cannot read templates');

-- user A's data is untouched ---------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a"}';

select results_eq(
  $$ select title from public.workouts $$, $$ values ('A Push') $$, 'A''s workout is intact');
select results_eq(
  $$ select reps, weight_kg from public.workout_sets order by position $$,
  $$ values (5::smallint, 100.000::numeric), (5::smallint, 102.058::numeric) $$,
  'A''s sets are intact and weights round-trip exactly');
select results_eq(
  $$ select name from public.workout_templates $$, $$ values ('A Push Day') $$, 'A''s template is intact');

select * from finish();
rollback;
