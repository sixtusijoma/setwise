-- Saved workout templates. Each row belongs to one user and RLS limits every
-- operation to that user. Exercises are a small jsonb list
-- ([{exercise_id, sets: [{reps, weight_kg}]}]) because a template is only
-- ever read and written whole.

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  exercises jsonb not null default '[]'
    check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) <= 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_templates_user_idx on public.workout_templates (user_id);

create trigger touch_workout_templates before update on public.workout_templates
  for each row execute function public.touch_updated_at();

alter table public.workout_templates enable row level security;

create policy "own templates" on public.workout_templates
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.workout_templates from anon, authenticated;
grant select, insert, update, delete on public.workout_templates to authenticated;
