# Phase 2 implementation plan

Implementer is Grok 4.7 xhigh (never fast mode). Each slice is one branch and one PR against `main`, named plainly (`app-foundation`, `workout-logging`, …). A slice is **done only when its Playwright click-through passes at all three viewports in light and dark, video and screenshots are saved to `artifacts/qa/<date>/<slice>/`, and `npm test` plus `./scripts/test-db.sh` are green.** Read `DECISIONS.md` and the relevant `docs/` first, and match `docs/design.md` and the mockups.

## Order and parallelism

```
Day 1   S1 app-foundation ─────────────────────────── (solo: everything builds on it)
Day 2   S2 workout-logging │ S3 cardio-logging │ S4 backend-auth*   (parallel, disjoint files)
Day 3   S5 history         │ S6 progress-charts                    (parallel)
Day 4   S7 today-summary   │ S8 profile-imagery                    (parallel; S7 after S6 merges)
Day 5   S9 offline-apple-signin
Day 6   S10 release-polish → final review (Opus)
* S4 needs Supabase credentials. Without them it ships sign-in UI and the remote repo code, and stops before live testing.
```

**How overlapping writes are avoided.** S1 pre-registers every route as a stub screen, defines all shared types and the full `Repo` interface, and builds the local repo for every method. Later slices only fill in files they own (listed per slice). Each feature's query hooks live in that feature's folder. `src/ui` primitives are frozen after S1: a slice that needs a new primitive adds a new file and leaves existing ones alone. When two parallel PRs both touch a shared file (rare: `queryClient.ts` mutation defaults), the second rebases.

---

### S1 · app-foundation (Day 1)

**Scope:** `create-expo-app` (SDK 57, `blank-typescript`) moved to the repo root, with Expo Router, TS strict, ESLint plus Prettier (Expo config), and `.env.example`.
- `src/theme`: tokens exactly as in `design.md`, ThemeProvider with system/light/dark, fonts (Instrument Serif and Geist) gating the splash screen.
- `src/ui`: every primitive from `design.md` except `LineChart`.
- `app/`: every route from `architecture.md` as a stub using the real `EmptyState` and titles, with the custom tab bar.
- `src/data`: `types.ts`, the full `Repo` interface, a `local.ts` implementation of all methods (AsyncStorage plus `data/exercise-library.json`), `queryClient.ts` (persisted), and repo selection by env. Local mode uses a fixed local user, and AuthGate passes through.
- `src/lib/units.ts` with tests.
- Jest (`jest-expo`) and Playwright (`playwright.config.ts` with 6 projects: 3 viewports × light/dark, `webServer: expo start --web --port 19417`).
- npm scripts: `start`, `web`, `test`, `test:db`, `e2e`. README run instructions.

**Owns:** everything that exists after this slice.

**Accept:**
- `npx expo start` opens in Expo Go on SDK 57 without warnings.
- Web runs on `:19417`.
- Tabs switch, and each modal route opens and closes.
- Light and dark follow the system and the Profile override (the override UI can be a stub toggle).
- Unit-conversion round-trip tests pass.
- `git grep` secret check is empty.

**QA (`e2e/foundation.spec.ts`):** visit each tab, check its title and empty-state copy, open and close each modal route, toggle the theme, and screenshot every screen in both themes.

### S2 · workout-logging (Day 2, parallel)

**Scope:**
- `useDraft` (persisted Zustand: start, add/remove/reorder exercise, add/update/remove set, toggle done, rename, discard, load-for-edit).
- Active workout screen per spec: elapsed timer, set table, previous-values prefill, rest timer pill, haptics.
- Exercise picker: search over name and aliases (`lib/search.ts` with tests), group pills, recent, and the create row.
- New-exercise sheet.
- Finish runs the `saveWorkout` mutation (local repo).
- `ActiveWorkoutBar`.

**Owns:** `app/workout/active.tsx`, `app/exercise/picker.tsx`, `app/exercise/new.tsx`, `src/features/workout/**`, `src/features/exercises/**` (except `images.ts`), `src/lib/search.ts`, and the tab layout's bar slot.

**Accept:**
- Log 3 exercises × 3 sets in lb, finish, and the workout is persisted.
- Kill and reload mid-workout, and the draft is restored.
- "ohp" finds Overhead Press.
- A custom exercise can be created and logged.
- Unchecked empty sets prompt on Finish.

**QA (`e2e/workout.spec.ts`):**
1. Start, add Bench Press via search, fill 3 sets, and check them.
2. Add a custom "Landmine Row" and log it.
3. Reload the page and confirm the draft persists.
4. Minimize, confirm the bar shows, and resume.
5. Finish, then confirm the stored data through the repo in the page context.
6. Run steps 1–5 in kg too.

### S3 · cardio-logging (Day 2, parallel)

**Scope:**
- Cardio sheet per spec (activity grid, duration, distance, started time, extras).
- `lib/pace.ts` (pace, distance conversion, duration formatting) with tests.
- `saveCardio` and `deleteCardio` mutations.
- Cardio detail with edit and delete.

**Owns:** `app/cardio/**`, `src/features/cardio/**`, `src/lib/pace.ts`.

**Accept:**
- 3.10 mi in 26:40 shows 8:36 /mi.
- Pace appears only for run/walk/hike with a distance.
- Save is disabled without a duration.
- Edit and delete work.
- Metric shows km plus /km and still shows /mi.

**QA (`e2e/cardio.spec.ts`):** log a run with distance (check the pace), a cycle without distance, and a walk in metric. Open the detail, edit the duration, and delete.

### S4 · backend-auth (Day 2–3, parallel; needs credentials)

**Scope:**
- Apply migrations to the Supabase project (`supabase link` + `db push`).
- Auth config: email provider on, confirmations off, minimum password 8.
- `supabase.ts` with the LargeSecureStore session (`expo-secure-store` + `aes-js`; `localStorage` on web).
- `remote.ts` implementing `Repo` (PostgREST embedding, `save_workout` RPC, cursor pagination).
- Sign-in screen per spec (email/password, sign-up toggle, errors) and AuthGate.
- Profile units read and written to `profiles`.
- `scripts/rls-smoke.mjs` per `security.md`.

**Owns:** `app/(auth)/**`, `src/data/remote.ts`, `src/data/supabase.ts`, `src/features/auth/**`, `scripts/rls-smoke.mjs`, `supabase/**`.

**Accept:**
- Sign up, sign in, and sign out on web and in Expo Go.
- Data from S2 and S3 round-trips to Supabase.
- `rls-smoke.mjs` passes against the live project.
- No secret except the anon key anywhere.

**QA (`e2e/auth.spec.ts`, runs with `E2E_SUPABASE=1`):** wrong password shows an error. As A, log a workout and sign out. As B, History, Progress, and the picker show none of A's data. As A again, the data is intact. Save the video as the isolation demo.

### S5 · history (Day 3, parallel)

**Scope:**
- History tab: merged strength and cardio, week sections with totals, filter, infinite scroll, pull-to-refresh, skeleton, empty, and error states.
- Workout detail with Edit (load into draft) and Delete.

**Owns:** `app/(tabs)/history.tsx`, `app/workout/[id].tsx`, `src/features/history/**`, `src/lib/dates.ts`.

**Accept:**
- 30 seeded sessions paginate correctly.
- Filters work.
- Editing a past workout replaces it (same id, no duplicate).
- Deleting removes it optimistically.

**QA (`e2e/history.spec.ts`):** seed the local repo with a fixture of 30 sessions over 6 weeks. Scroll, filter, open a workout, edit one set, save, and confirm. Delete a cardio session.

### S6 · progress-charts (Day 3, parallel)

**Scope:**
- `lib/stats.ts` (top set, Epley e1RM for 1–12 reps, volume, PR detection, bodyweight fallback) with thorough tests.
- `ui/LineChart.tsx` (react-native-svg + d3-shape, scrubbing).
- Progress tab list with sparklines.
- Exercise progress detail per spec.

**Owns:** `app/(tabs)/progress.tsx`, `app/exercise/[id].tsx`, `src/features/progress/**`, `src/lib/stats.ts`, `src/ui/LineChart.tsx`.

**Accept:**
- Metric and range switches update the value, delta, and chart.
- The single-point state renders correctly.
- Scrubbing shows the tooltip.
- Bodyweight lifts show reps.
- Charts look right at 375 and 440 widths in both themes.

**QA (`e2e/progress.spec.ts`):** with the fixture, open Bench Press, cycle the metrics and ranges, scrub (mouse drag), and screenshot. Open Pull-Up and check the reps metrics.

### S7 · today-summary (Day 4, after S6)

**Scope:**
- `lib/week.ts` (ISO week bounds in local time zone, totals, deltas, day dots, PRs this week via `stats.ts`) with tests, including a DST week.
- Today screen per spec, including the empty and offline banner states.

**Owns:** `app/(tabs)/index.tsx`, `src/features/today/**`, `src/lib/week.ts`.

**Accept:**
- Totals match a hand-computed fixture week.
- Deltas vs last week are correct.
- The CTA row is visible without scrolling on 375×667.

**QA (`e2e/today.spec.ts`):** empty state, then log a workout and a run, and Today updates (dots, totals, recent, PR banner).

### S8 · profile-imagery (Day 4, parallel)

**Scope:**
- Profile tab per spec (units, appearance, custom exercises, sync status, account).
- Generate the illustrations with the locked prompt in `design.md` (12 groups plus about 40 top lifts), convert to 384 px webp, and build `assets/exercises/index.ts`.
- `src/features/exercises/images.ts` resolver (slug, then group, then monogram).

**Owns:** `app/(tabs)/profile.tsx`, `src/features/profile/**`, `assets/exercises/**`, `src/features/exercises/images.ts`.

**Accept:**
- Switching units updates every screen immediately.
- The appearance override persists.
- All 153 library lifts resolve to an image, and custom ones get a monogram.
- Assets total under 1.5 MB.

**QA (`e2e/profile.spec.ts`):** toggle units and check values on Today, History, and Progress. Toggle the theme. Screenshot a picker page showing the illustrations.

### S9 · offline-apple-signin (Day 5)

**Scope:**
- Offline hardening: NetInfo `onlineManager`, persisted paused mutations with `setMutationDefaults`, resume on launch and reconnect, a sync status source for Profile and the Today banner.
- Sign in with Apple: `expo-apple-authentication`, a nonce, and `signInWithIdToken`. The button is hidden on web and on unsupported devices. This needs the Apple provider in Supabase with the Client ID `host.exp.Exponent`.

**Owns:** `src/data/queryClient.ts`, `src/data/sync.ts`, `src/features/auth/apple.tsx`.

**Accept:**
- With the network offline, finish a workout and log cardio, then go back online, and both sync exactly once (no duplicates).
- Apple sign-in works on the owner's iPhone in Expo Go.

**QA:**
- `e2e/offline.spec.ts` uses `context.setOffline(true)`: log, reload while offline (the queue persists), go back online, and assert the remote has exactly one row.
- On device: a recorded Apple sign-in run via Expo Go. If this fails in Expo Go, document why, keep email, and move on.

### S10 · release-polish (Day 6)

**Scope:**
- `app.config.ts` and `eas.json` per `architecture.md`, plus app icon and splash (ember dumbbell mark on paper).
- `delete_account()` migration with a pgTAP test and the Profile flow.
- Accessibility labels and Dynamic Type caps.
- Responsive pass at SE and Pro Max.
- A full regression click-through of every flow in both themes.
- Then hand off to the Opus final review (security, bugs, elegance).

**Owns:** config files, `assets/icon*`, the new migration and test, and fixes anywhere (sequential, nothing runs in parallel).

**Accept:**
- `npx expo config` is valid, and `eas build --profile development` is ready to run once `EXPO_TOKEN` exists.
- All e2e specs pass.
- Account deletion removes all rows (tested).

**QA:** `npm run e2e` (all specs, 6 projects), a stitched demo video, and a device pass on the owner's iPhone.

## Daily report template

What shipped (PR link), the QA evidence paths, what's next, and anything needed from the PM.
