-- Deletes the signed-in user and only their rows.
-- Custom exercises are restrict-referenced by workout_exercises, so children
-- go first. The auth.users delete then cascades the profile. Library rows
-- (owner_id is null) are not touched. security definer is required because
-- authenticated clients cannot delete auth.users directly.

create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  delete from public.workout_sets where user_id = uid;
  delete from public.workout_exercises where user_id = uid;
  delete from public.workouts where user_id = uid;
  delete from public.cardio_sessions where user_id = uid;
  delete from public.exercises where owner_id = uid;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_account() from public, anon, authenticated;
grant execute on function public.delete_account() to authenticated;
