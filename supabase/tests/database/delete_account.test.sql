-- delete_account() removes only the caller. A used custom exercise must not
-- block it, and the shared library stays.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');

insert into public.exercises (id, owner_id, slug, name, muscle_group, equipment)
values ('11111111-0000-0000-0000-000000000001', null, 'test-lift', 'Test Lift', 'chest', 'barbell');

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
      "exercise_id": "11111111-0000-0000-0000-0000000000a1",
      "sets": [{"reps": 8, "weight_kg": 20}]
    }, {
      "id": "33333333-0000-0000-0000-0000000000a2",
      "exercise_id": "11111111-0000-0000-0000-000000000001",
      "sets": [{"reps": 5, "weight_kg": 100}]
    }]
  }')
$$, 'A can save a workout that uses a custom exercise');

insert into public.cardio_sessions (id, activity, started_at, duration_s, distance_m)
values ('44444444-0000-0000-0000-0000000000a1', 'run', '2026-10-02T07:00:00Z', 1800, 5000);

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b"}';

insert into public.exercises (id, name, muscle_group, equipment)
values ('11111111-0000-0000-0000-0000000000b1', 'B Press', 'chest', 'dumbbell');

select lives_ok($$
  select public.save_workout('{
    "id": "22222222-0000-0000-0000-0000000000b1",
    "title": "B Day",
    "started_at": "2026-10-03T10:00:00Z",
    "ended_at": "2026-10-03T11:00:00Z",
    "exercises": [{
      "id": "33333333-0000-0000-0000-0000000000b1",
      "exercise_id": "11111111-0000-0000-0000-000000000001",
      "sets": [{"reps": 5, "weight_kg": 60}]
    }]
  }')
$$, 'B can save a workout');

select lives_ok($$ select public.delete_account() $$, 'B can delete their own account');

reset role;

select is_empty(
  $$ select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000b' $$,
  'B is removed from auth.users');
select is_empty(
  $$ select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000b' $$,
  'B profile is gone');
select is_empty(
  $$ select 1 from public.workouts where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  'B workouts are gone');
select is_empty(
  $$ select 1 from public.exercises where owner_id = '00000000-0000-0000-0000-00000000000b' $$,
  'B custom exercises are gone');
select isnt_empty(
  $$ select 1 from public.workouts where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'A workout remains after B deletes');
select isnt_empty(
  $$ select 1 from public.exercises where id = '11111111-0000-0000-0000-0000000000a1' $$,
  'A custom exercise remains after B deletes');
select isnt_empty(
  $$ select 1 from public.exercises where slug = 'test-lift' $$,
  'library remains after B deletes');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a"}';

select lives_ok(
  $$ select public.delete_account() $$,
  'A can delete an account whose custom exercise is used in a workout');

reset role;

select is_empty(
  $$ select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  'A is removed from auth.users');
select is_empty(
  $$ select 1 from public.workouts where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'A workouts are gone');
select is_empty(
  $$ select 1 from public.workout_sets where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'A sets are gone');
select is_empty(
  $$ select 1 from public.exercises where owner_id = '00000000-0000-0000-0000-00000000000a' $$,
  'A custom exercise is gone');
select is_empty(
  $$ select 1 from public.cardio_sessions where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'A cardio is gone');
select isnt_empty(
  $$ select 1 from public.exercises where slug = 'test-lift' $$,
  'library remains after A deletes');

set local role anon;
select throws_ok(
  $$ select public.delete_account() $$,
  '42501',
  null,
  'anon cannot delete an account');

set local role authenticated;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ select public.delete_account() $$,
  '42501',
  null,
  'a session without a user cannot delete an account');

select * from finish();
rollback;
