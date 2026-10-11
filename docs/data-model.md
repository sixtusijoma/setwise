# Data model

Source: `supabase/migrations/20261008000000_init.sql` (schema, RLS, RPC), `…000100_exercise_library.sql` (generated seed), and `…000200_delete_account.sql`. Validated on Postgres 16 with `scripts/test-db.sh`: 65 pgTAP assertions pass.

```
auth.users ─┬─< profiles (1:1, created by trigger)
            ├─< exercises (owner_id; NULL = global library)
            ├─< workouts ─< workout_exercises ─< workout_sets
            │                    └──> exercises (library or own)
            ├─< cardio_sessions
            └─< workout_templates (exercises as jsonb)
```

## Tables

| Table | Key columns | Notes |
| --- | --- | --- |
| `profiles` | `id = auth.users.id`, `display_name`, `unit_system` (`imperial`\|`metric`) | Inserted by the `on_auth_user_created` trigger. The client can only select or update its own row. |
| `exercises` | `owner_id` (nullable), `slug` (library only), `name`, `muscle_group`, `equipment`, `aliases[]`, `track?` | `library_rows_have_slug`: a row is global if and only if it has a slug. `track` (`…20261009000200_exercise_track.sql`) is one of `weight`, `reps`, `time`, `weighted-time`, `assisted` and is set on custom rows only. Library tracks come from `data/exercise-library.json`. `time` and `weighted-time` store seconds in `workout_sets.reps`. Custom names are unique per owner, case-insensitive. Delete is `restrict`ed while any workout uses the exercise, and the UI explains why. |
| `workouts` | `id` (client uuid), `user_id`, `title?`, `started_at`, `ended_at`, `notes?` | Only finished workouts reach the server (drafts are local). `ended_at ≥ started_at`, max 24 h. |
| `workout_exercises` | `workout_id`, `user_id`, `exercise_id`, `position` 0–49, `notes?` | Composite FK `(workout_id, user_id) → workouts(id, user_id)`. Unique `(workout_id, position)`. |
| `workout_sets` | `workout_exercise_id`, `user_id`, `position` 0–49, `reps` 0–999, `weight_kg numeric(7,3)` 0–1500 | Composite FK to `workout_exercises(id, user_id)`. Weight 0 means bodyweight. |
| `workout_templates` | `id` (client uuid), `user_id`, `name` 1–60, `exercises jsonb` (≤ 50: `[{exercise_id, sets: [{reps, weight_kg}]}]`) | `…20261009000100_workout_templates.sql`. Read and written whole, so no child tables. Policy `user_id = auth.uid()` for every operation. Cascades with `auth.users`. Starting from a template skips exercises that are no longer visible. |
| `cardio_sessions` | `id` (client uuid), `user_id`, `activity`, `started_at`, `duration_s` 1–86400 | Optional: `distance_m` (>0), `calories`, `avg_heart_rate` 30–250, `notes`. Standalone: cardio isn't nested in workouts, and History merges both by date. |

Enums: `muscle_group` (12), `equipment` (11), `cardio_activity` (`run walk hike cycle row elliptical stairs swim other`). Pace is shown for `run`, `walk`, and `hike` when a distance is set.

### Why these shapes

- **Denormalized `user_id` on children plus composite FKs.** Policies stay a cheap `user_id = auth.uid()` with no joins. The composite FK makes it impossible to attach a child row to another user's parent, even with a guessed uuid. FK checks bypass RLS, so a plain FK would allow exactly that. There's a test for it, and it's mutation-checked.
- **`user_id default auth.uid()`.** Clients never send `user_id`. Policies reject any attempt to set someone else's.
- **Client-generated ids.** They make offline replays idempotent (see `architecture.md`).
- **No soft deletes or `updated_at` sync cursors.** We're online-first with replayed mutations, not a sync engine, so they aren't needed.

## `save_workout(workout jsonb) → uuid`

An atomic, idempotent upsert of a finished workout. It runs as `security invoker`, so every statement goes through the caller's RLS.

```json
{ "id": "uuid", "title": "Thursday Push", "started_at": "…Z", "ended_at": "…Z", "notes": null,
  "exercises": [{ "id": "uuid", "exercise_id": "uuid", "notes": null,
                  "sets": [{ "reps": 5, "weight_kg": 102.058 }] }] }
```

It upserts the workout, deletes its `workout_exercises` (sets cascade), and re-inserts children in array order. If the workout id belongs to someone else, the call fails with `42501`. Size is bounded by the position checks: at most 50 exercises × 50 sets.

## Starter library

- **Source:** `data/exercise-library.json`, with 161 lifts across all 12 muscle groups. Each has `slug`, `name`, `muscle_group`, `equipment`, and optional `aliases` that search uses (`ohp`, `rdl`, `db row`, …).
- **Seed:** run `node scripts/gen-exercise-seed.mjs` to regenerate the seed migration. It upserts on `slug`, so adding or renaming lifts in a new migration is safe and existing references keep working.
- **Access:** library rows are readable by every authenticated user. They can't be inserted, updated, or deleted by any client (tested).
- **Custom:** inserted by the user with `owner_id = auth.uid()` (the default). They're visible only to the owner and can be referenced only by the owner's workouts. The insert policy runs an `exists()` check under the caller's RLS on `exercises`.
- **App side:** the full list (library plus own) is fetched once and cached. Search is client-side over `name` and `aliases`, with the muscle group as a filter chip. Local mode reads the same JSON.

## Indexes

`workouts (user_id, started_at desc)`, `cardio_sessions (user_id, started_at desc)`, and `workout_exercises (user_id, exercise_id)` (per-exercise progress). The unique constraints cover the child lookups by parent.

## Account deletion

`delete_account()` in `supabase/migrations/20261008000200_delete_account.sql`. It removes only `auth.uid()`'s rows, children first so a custom exercise used in a workout does not block the delete, then the `auth.users` row. The profile cascades from that. The shared library is untouched.

## Future migrations (not in MVP scope)

If they're ever needed: per-set RPE/warm-up flags and a per-user row cap to limit storage abuse on the free tier.
