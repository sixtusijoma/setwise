-- Setwise core schema.
-- Every table has RLS. Clients only use the anon key + a user JWT, so policies are the
-- isolation boundary; check constraints are the validation boundary.
-- Global library exercises (owner_id is null) are seeded by migration and read-only to clients.

create type public.unit_system as enum ('imperial', 'metric');

create type public.muscle_group as enum (
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'full_body'
);

create type public.equipment as enum (
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith',
  'ez_bar', 'trap_bar', 'band', 'bodyweight', 'other'
);

create type public.cardio_activity as enum (
  'run', 'walk', 'hike', 'cycle', 'row', 'elliptical', 'stairs', 'swim', 'other'
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- profiles ---------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  unit_system public.unit_system not null default 'imperial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- exercises --------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users (id) on delete cascade,
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  muscle_group public.muscle_group not null,
  equipment public.equipment not null,
  aliases text[] not null default '{}' check (cardinality(aliases) <= 10),
  created_at timestamptz not null default now(),
  constraint library_rows_have_slug check ((owner_id is null) = (slug is not null))
);

create unique index exercises_owner_name_key on public.exercises (owner_id, lower(name))
  where owner_id is not null;

-- workouts ---------------------------------------------------------------
-- Ids are client-generated so offline replays are idempotent.
-- Children carry user_id and reference (parent id, user_id): a composite FK makes it
-- impossible to attach a row to someone else's parent, even by guessing its uuid.

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (char_length(title) between 1 and 60),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ended_at >= started_at and ended_at - started_at <= interval '24 hours')
);

create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null,
  user_id uuid not null default auth.uid(),
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position smallint not null check (position between 0 and 49),
  notes text check (char_length(notes) <= 500),
  unique (id, user_id),
  unique (workout_id, position),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);

create index workout_exercises_user_exercise_idx on public.workout_exercises (user_id, exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null,
  user_id uuid not null default auth.uid(),
  position smallint not null check (position between 0 and 49),
  reps smallint not null check (reps between 0 and 999),
  weight_kg numeric(7, 3) not null check (weight_kg between 0 and 1500),
  unique (workout_exercise_id, position),
  foreign key (workout_exercise_id, user_id)
    references public.workout_exercises (id, user_id) on delete cascade
);

-- cardio -----------------------------------------------------------------

create table public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity public.cardio_activity not null,
  started_at timestamptz not null,
  duration_s integer not null check (duration_s between 1 and 86400),
  distance_m numeric(8, 1) check (distance_m > 0 and distance_m <= 1000000),
  calories integer check (calories between 0 and 20000),
  avg_heart_rate smallint check (avg_heart_rate between 30 and 250),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cardio_sessions_user_started_idx on public.cardio_sessions (user_id, started_at desc);

create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch_workouts before update on public.workouts
  for each row execute function public.touch_updated_at();
create trigger touch_cardio_sessions before update on public.cardio_sessions
  for each row execute function public.touch_updated_at();

-- row level security -----------------------------------------------------

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.cardio_sessions enable row level security;

create policy "own profile: read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "own profile: update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "library and own exercises: read" on public.exercises
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "own exercises: insert" on public.exercises
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own exercises: update" on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "own exercises: delete" on public.exercises
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "own workouts" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The exists() runs under the caller's RLS on exercises, so only library or own exercises pass.
create policy "own workout exercises: read" on public.workout_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own workout exercises: insert" on public.workout_exercises
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id)
  );
create policy "own workout exercises: update" on public.workout_exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id)
  );
create policy "own workout exercises: delete" on public.workout_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "own sets" on public.workout_sets
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own cardio" on public.cardio_sessions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- privileges: nothing for anon; authenticated gets DML that RLS then narrows -------

revoke all on public.profiles, public.exercises, public.workouts, public.workout_exercises,
  public.workout_sets, public.cardio_sessions from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.exercises, public.workouts,
  public.workout_exercises, public.workout_sets, public.cardio_sessions to authenticated;

-- save_workout: atomic, idempotent save of a finished workout and all its children.
-- security invoker, so every statement is checked by the caller's RLS. Saving over another
-- user's workout id fails on the upsert (ON CONFLICT DO UPDATE raises on a USING violation).

create function public.save_workout(workout jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  wid uuid := (workout ->> 'id')::uuid;
begin
  insert into public.workouts (id, title, started_at, ended_at, notes)
  values (
    wid,
    workout ->> 'title',
    (workout ->> 'started_at')::timestamptz,
    (workout ->> 'ended_at')::timestamptz,
    workout ->> 'notes'
  )
  on conflict (id) do update set
    title = excluded.title,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    notes = excluded.notes;

  delete from public.workout_exercises where workout_id = wid;

  insert into public.workout_exercises (id, workout_id, exercise_id, position, notes)
  select (e ->> 'id')::uuid, wid, (e ->> 'exercise_id')::uuid, (i - 1)::smallint, e ->> 'notes'
  from jsonb_array_elements(workout -> 'exercises') with ordinality as x (e, i);

  insert into public.workout_sets (workout_exercise_id, position, reps, weight_kg)
  select (e ->> 'id')::uuid, (j - 1)::smallint, (s ->> 'reps')::smallint, (s ->> 'weight_kg')::numeric
  from jsonb_array_elements(workout -> 'exercises') as x (e),
    jsonb_array_elements(e -> 'sets') with ordinality as y (s, j);

  return wid;
end $$;

revoke all on function public.save_workout(jsonb) from public, anon;
grant execute on function public.save_workout(jsonb) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
