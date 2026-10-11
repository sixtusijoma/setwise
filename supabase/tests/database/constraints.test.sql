-- Trust-boundary validation: malformed rows are rejected by the database, not just the app.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.dev');
insert into public.exercises (id, owner_id, slug, name, muscle_group, equipment)
values ('11111111-0000-0000-0000-000000000001', null, 'test-lift', 'Test Lift', 'chest', 'barbell');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a"}';

select save_workout('{"id": "22222222-0000-0000-0000-000000000001",
  "started_at": "2026-10-01T10:00:00Z", "ended_at": "2026-10-01T11:00:00Z",
  "exercises": [{"id": "33333333-0000-0000-0000-000000000001",
    "exercise_id": "11111111-0000-0000-0000-000000000001", "sets": []}]}');

select throws_ok($$ insert into public.workout_sets (workout_exercise_id, position, reps, weight_kg)
  values ('33333333-0000-0000-0000-000000000001', 0, -1, 50) $$, '23514', null, 'negative reps rejected');
select throws_ok($$ insert into public.workout_sets (workout_exercise_id, position, reps, weight_kg)
  values ('33333333-0000-0000-0000-000000000001', 0, 5, 1501) $$, '23514', null, 'absurd weight rejected');
select throws_ok($$ insert into public.workout_sets (workout_exercise_id, position, reps, weight_kg)
  values ('33333333-0000-0000-0000-000000000001', 50, 5, 50) $$, '23514', null, 'set count is bounded');
select throws_ok($$ insert into public.workouts (started_at, ended_at)
  values ('2026-10-01T11:00:00Z', '2026-10-01T10:00:00Z') $$, '23514', null, 'workout cannot end before it starts');
select throws_ok($$ insert into public.cardio_sessions (activity, started_at, duration_s)
  values ('run', now(), 0) $$, '23514', null, 'cardio needs a positive duration');
select throws_ok($$ insert into public.cardio_sessions (activity, started_at, duration_s)
  values ('teleport', now(), 60) $$, '22P02', null, 'unknown cardio activity rejected');
select throws_ok($$ insert into public.cardio_sessions (activity, started_at, duration_s, distance_m)
  values ('run', now(), 60, 0) $$, '23514', null, 'zero distance rejected (omit it instead)');
select throws_ok($$ insert into public.exercises (name, muscle_group, equipment)
  values ('  Padded  ', 'chest', 'barbell') $$, '23514', null, 'untrimmed exercise name rejected');
select throws_ok($$ insert into public.exercises (slug, name, muscle_group, equipment)
  values ('my-lift', 'My Lift', 'chest', 'barbell') $$, '23514', null, 'custom exercises cannot claim a library slug');
select throws_ok($$ insert into public.exercises (name, muscle_group, equipment, track)
  values ('Odd Lift', 'chest', 'barbell', 'bounce') $$, '23514', null, 'unknown exercise track rejected');
select lives_ok($$ insert into public.exercises (name, muscle_group, equipment, track)
  values ('Sled Hold', 'full_body', 'other', 'weighted-time') $$, 'custom exercise stores its track');
select throws_ok($$ insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'profiles are created only by the signup trigger');

select * from finish();
rollback;
