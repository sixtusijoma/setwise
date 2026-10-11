-- How a custom exercise's sets are logged. Library rows leave it null and the app reads the library JSON.
-- `time` and `weighted-time` store seconds in workout_sets.reps.
alter table public.exercises
  add column track text check (track in ('weight', 'reps', 'time', 'weighted-time', 'assisted'));
