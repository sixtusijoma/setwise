# Security

## Assets and actors

- **Assets:** each user's training data (workouts, sets, cardio, custom exercises, profile), their session tokens, and the integrity of the shared exercise library.
- **Actors:** an anonymous internet client holding our public anon key (it ships in the app, so treat it as known). A signed-in user trying to reach another user's data. A lost or stolen phone. A careless commit.

## Threat model

| Threat | Mitigation | Proof |
| --- | --- | --- |
| User B reads A's rows by id or enumeration | RLS on every table, `user_id = (select auth.uid())`. No `security definer` read paths. | `rls.test.sql`: B sees nothing of A's in any table |
| B updates or deletes A's rows | The same policies as `USING`. Updates and deletes silently affect 0 rows. | `rls.test.sql`: 10 write cases |
| B inserts rows owned by A, or hands a row to A | `WITH CHECK (user_id = auth.uid())` on insert and update | `rls.test.sql` |
| B attaches children to A's workout (FK checks bypass RLS) | Composite FKs `(parent_id, user_id)` | `rls.test.sql`, mutation-tested (removing the composite FK fails the test) |
| B overwrites A's workout via the RPC | `save_workout` is `security invoker`, and the upsert raises on a `USING` violation | `rls.test.sql` |
| B references A's custom exercise | The insert/update policy's `exists()` runs under the caller's RLS on `exercises` | `rls.test.sql` |
| Anyone writes to the global library | No insert policy allows `owner_id is null`. Update and delete require ownership. | `rls.test.sql` |
| B overwrites A's template by upserting A's id | `on conflict do update` must pass the update policy's `USING` on A's row, so it fails with `42501` | `rls.test.sql` |
| Anonymous access | `revoke all … from anon` on every table and the RPC, so anon gets `42501` before RLS even runs | `rls.test.sql` |
| Malformed or abusive input | Check constraints and enums at the database (lengths, ranges, trimmed names, bounded positions), plus typed RPC casts | `constraints.test.sql` |
| Leaked privileged key | The app and repo hold only the URL and anon key. The service-role/secret key is never created, stored, or used, because no code path needs it. | Review checklist below |
| Token theft from device storage | Session encrypted with AES. The key is in the iOS Keychain (`expo-secure-store`) and the ciphertext in AsyncStorage. Refresh tokens rotate (Supabase default). | Slice 4 review |
| Credential stuffing or brute force | Supabase Auth rate limits (defaults), minimum password length of 8 | Dashboard config |
| Storage abuse on the free tier (one user inserting millions of their own rows) | Accepted for the MVP. Per-row bounds limit the size of any one request. A per-user cap trigger is available if needed. | — |
| Account and data deletion (App Store 5.1.1(v)) | `delete_account()` `security definer` RPC. It deletes only `auth.uid()`'s workouts, sets, cardio, and custom exercises, then that `auth.users` row. The profile cascades. Library rows stay. | `delete_account.test.sql` |

`security definer` functions are limited to `handle_new_user` (trigger only, `execute` revoked from all client roles) and `delete_account` (`execute` granted to `authenticated` only). Both set `search_path = ''`.

## Isolation guarantees

1. Every table in `public` has RLS enabled. **New tables must ship with RLS, policies, grants, and pgTAP cases in the same PR.**
2. Every policy is scoped `to authenticated`, and ownership comes from `auth.uid()`, never from client input.
3. Child rows can only belong to the owner of their parent (composite FKs).
4. The only shared data is the read-only exercise library.
5. Validation lives in the database. Client-side checks are only for UX.

## Key handling

- `.env` is gitignored. `.env.example` lists `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, both with empty values.
- `EXPO_PUBLIC_*` values are embedded in the bundle and are public by design. Nothing else may use that prefix.
- Agent and CI secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `EXPO_TOKEN`) live only in Cursor Secrets or EAS. They're used by CLIs, never read by app code, and never echoed into logs or committed.
- Pre-commit check (slice 1): `git grep -nE "service_role|sb_secret_|eyJhbGciOi" -- ':!docs' ':!supabase/tests'` must be empty (the test stub only declares a `service_role` role name).

## Test plan: proving user A can't reach user B's data

1. **Database (every PR touching `supabase/`):** run `./scripts/test-db.sh`. It uses a fresh Postgres, applies the stub `auth` schema and all migrations, and runs pgTAP. It currently runs 29 isolation assertions and 10 validation assertions. With Docker available, `supabase test db` runs the same files against the real Supabase stack.
2. **Live API smoke (slice 4, then after each backend change):** `scripts/rls-smoke.mjs` uses the anon key only. It signs up or signs in two QA users (`sixdude602+qa-a@gmail.com` and `+qa-b`), has A save a workout, cardio, and a custom exercise, then runs every read, update, delete, and insert case from `rls.test.sql` as B through PostgREST and the RPC. It also checks that anonymous requests get nothing. It exits non-zero on any leak. This proves the deployed project matches the migrations, including dashboard settings.
3. **Click-through (slice 4 e2e):** sign in as A and log a workout, sign out, sign in as B and assert that History, Progress, and Today are empty and A's custom exercise isn't in the picker. Sign back in as A and the data is intact. Video is saved as QA evidence.
4. **Mutation check (when changing policies):** temporarily weaken the policy or FK under change and confirm the suite fails. This was done for the initial schema.

## Review checklist (each slice)

- [ ] No new table, view, or function without RLS, grants, and tests. Views use `security_invoker = true`.
- [ ] No `security definer` unless justified here, with `search_path = ''`.
- [ ] No secrets in the diff. Only `EXPO_PUBLIC_SUPABASE_*` in client env.
- [ ] No user data in logs or analytics (there are no analytics).
- [ ] Inputs that cross into the database are bounded by constraints.
