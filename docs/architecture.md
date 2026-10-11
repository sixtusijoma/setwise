# Architecture

## Shape

```
app/                          Expo Router routes (thin: compose features, no data logic)
  _layout.tsx                 fonts, ThemeProvider, QueryProvider, AuthGate, Stack (all routes pre-registered)
  (auth)/sign-in.tsx
  (tabs)/_layout.tsx          tab bar + <ActiveWorkoutBar/>
  (tabs)/index.tsx            Today (weekly summary)
  (tabs)/history.tsx
  (tabs)/progress.tsx
  (tabs)/profile.tsx
  workout/active.tsx          presentation: fullScreenModal
  workout/[id].tsx            detail
  cardio/new.tsx              presentation: formSheet (?id= to edit)
  cardio/[id].tsx             detail
  exercise/picker.tsx         modal (page sheet)
  exercise/new.tsx            modal (custom exercise)
  exercise/[id].tsx           progress detail + chart
src/
  theme/      tokens.ts, ThemeProvider (system | light | dark), useTheme()
  ui/         primitives: Text, Button, IconButton, Card, Pill, Segmented, Field, NumberField,
              ListRow, Thumb, EmptyState, Skeleton, Banner, SheetHeader, LineChart
  features/   workout/ cardio/ history/ progress/ today/ profile/ exercises/
              (screen bodies + feature components + that feature's query hooks)
  data/       types.ts, repo.ts (interface + selection), local.ts, remote.ts, supabase.ts,
              queryClient.ts (persisted cache, mutation defaults), keys.ts
  lib/        units.ts, stats.ts, week.ts, pace.ts, search.ts, dates.ts (pure, unit-tested)
assets/exercises/             bundled illustrations (webp) + index.ts slug/group → require()
data/exercise-library.json    library source of truth (app + seed generator)
supabase/                     migrations, pgTAP tests, local stub
e2e/                          Playwright specs (one per slice) + fixtures
```

Rule: routes stay thin, features own their own query hooks, and `lib/` is pure. Each slice owns a disjoint set of files (see `implementation-plan.md`).

## Navigation

- Root `Stack`. `AuthGate` redirects to `(auth)/sign-in` when there's no session. In local mode it skips straight to the tabs with a fixed local user.
- Four tabs: **Today · History · Progress · Profile**. The tab bar is custom: surface color, hairline top border, Lucide icons.
- Modals: the active workout is a `fullScreenModal` (swipe down minimizes it, and the draft keeps running). Cardio is a `formSheet`; the picker and new exercise are `modal` page sheets, because a formSheet stacked on the workout modal lost taps on its close button on iOS. Both render as centered modals on web.
- `ActiveWorkoutBar` floats above the tab bar whenever a draft exists. Tapping it reopens `workout/active`.
- Deep links use the `setwise://` scheme. None are required for the MVP.

## State and data

| Kind | Tool | Persisted |
| --- | --- | --- |
| Server data (workouts, cardio, exercises, profile) | TanStack Query v5 | Yes, via `@tanstack/query-async-storage-persister` (cache busted on app version) |
| Active workout draft | Zustand store `useDraft` | Yes, via `persist` + AsyncStorage |
| UI prefs (appearance override) | Zustand `usePrefs` | Yes |
| Units | `profiles.unit_system` (server), mirrored in the query cache | Yes |

`Repo` is the only boundary to storage. Both implementations satisfy it, and hooks never import Supabase directly:

```ts
interface Repo {
  session(): Promise<Session | null>; signIn(email, pw); signUp(email, pw); signOut();
  getProfile(): Promise<Profile>; updateProfile(p: Partial<Profile>);
  listExercises(): Promise<Exercise[]>;                // library + own custom
  createExercise(e: NewExercise): Promise<Exercise>; deleteExercise(id);
  saveWorkout(w: WorkoutInput): Promise<void>;         // rpc save_workout (replace semantics)
  deleteWorkout(id); getWorkout(id): Promise<Workout>;
  listWorkouts(range: { before?: string; limit: number }): Promise<Workout[]>; // nested exercises + sets
  saveCardio(c: CardioInput): Promise<void>;           // upsert by client id
  deleteCardio(id); listCardio(range): Promise<Cardio[]>;
  exerciseHistory(exerciseId): Promise<ExerciseSession[]>; // date + sets, oldest→newest
}
```

Remote queries use PostgREST embedding, e.g. `workouts.select('*, workout_exercises(*, workout_sets(*))').order('started_at', { ascending: false }).lt('started_at', before).limit(20)`. Supabase caps responses at 1000 rows, so history is cursor-paginated by `started_at`. Stats (top set, e1RM, volume, PRs, weekly totals) are computed client-side by pure functions in `lib/stats.ts` and `lib/week.ts`. The data per user is small, and keeping this logic in one place makes it easy to test.

## Offline and sync

1. **Logging never touches the network.** Starting a workout creates a draft `{ id: uuid, startedAt, exercises[] }` in `useDraft`. Every keystroke is persisted locally, so the draft survives an app kill, an airplane-mode session, and a reload.
2. **Finish** turns the draft into a `saveWorkout` mutation, clears the draft, and optimistically inserts the workout into the history cache.
3. **Mutations are durable.** `queryClient.setMutationDefaults(['saveWorkout'], { mutationFn })` (and the same for cardio, exercises, and deletes), plus `networkMode: 'offlineFirst'`. Paused mutations are persisted with the cache and resumed by `resumePausedMutations()` on launch and on reconnect. `onlineManager` is wired to `@react-native-community/netinfo`.
4. **Idempotent.** Every entity has a client-generated UUID (`expo-crypto.randomUUID`). Replaying `save_workout` or a cardio upsert after a lost response is harmless.
5. **Conflicts.** Last write wins per record: `save_workout` atomically replaces a workout's children. Two devices editing the same workout at once is the only lossy case, which is acceptable for the MVP.
6. **Visibility.** Profile shows the sync state ("All changes saved" / "3 changes waiting to sync"). A quiet banner appears on Today while offline with pending writes.

Editing a past workout loads it into the draft with the same id, and Finish replaces it. Only one draft exists at a time. Starting another asks whether to discard the current one.

## Units

`lib/units.ts` is the only place that converts. Constants are exact: `1 lb = 0.45359237 kg`, `1 mi = 1609.344 m`.

- Input: the user types in their display unit, and it's converted to kg or m on save. A draft stores kg internally, so changing units mid-workout is safe.
- Display: weight is rounded to 0.1 with trailing zeros trimmed (`225`, `102.5`). Volume is a whole number with thousands separators. Distance shows 2 decimals. Pace is `m:ss /mi` (and `/km` in metric). Duration is `h:mm:ss` or `mm:ss`.
- Round-trip invariant (unit-tested): for any 0.1-precision lb input, `kgToLb(lbToKg(x))` rounds back to `x`.

## Testing and QA

| Layer | Tool | Where | Gate |
| --- | --- | --- | --- |
| Pure logic | Jest (`jest-expo`) | `src/lib/*.test.ts`, draft store | Every slice touching `lib/` |
| Database | pgTAP | `supabase/tests/database/*.test.sql`, run with `scripts/test-db.sh` (plain Postgres, no Docker) or `supabase test db` | Every migration |
| Remote isolation smoke | Node script with two real users and the anon key | `scripts/rls-smoke.mjs` (slice 4) | After each backend change |
| Click-through | Playwright on Expo web (`expo start --web --port 19417`), local mode | `e2e/<slice>.spec.ts` | Every slice. Required before "done". |
| Device | Owner's iPhone, Expo Go, `npx expo start --tunnel` | manual | Slices with native-only behavior (Apple sign-in, haptics, keyboard) |

Playwright config: projects `iphone-se` (375×667), `iphone-16` (393×852), `iphone-16-pro-max` (440×956), each in light and dark (`colorScheme`), `video: 'on'`, `screenshot: 'on'`. Output goes to `artifacts/qa/<yyyy-mm-dd>/<slice>/` (gitignored), and the coordinator collects it for the daily demo. Specs use `getByRole` / `getByText` with real copy. `testID`s exist only where text is ambiguous (set rows). There's no iOS simulator on this Linux VM, and Maestro on a Mac is a later option. Web-only differences: Apple sign-in is hidden, haptics are no-ops, and SecureStore falls back to `localStorage`.

## EAS plan (configured, not built)

- `app.config.ts`: name `Setwise`, slug `setwise`, scheme `setwise`, `ios.bundleIdentifier: 'com.sixtus.setwise'` (placeholder until an Apple account exists), `ios.supportsTablet: false`, `orientation: 'portrait'`, `userInterfaceStyle: 'automatic'`, `ios.usesAppleSignIn: true`. Plugins: `expo-router`, `expo-font`, `expo-secure-store`, `expo-apple-authentication`.
- `eas.json`: `cli.appVersionSource: "remote"`.
  - `development`: `developmentClient`, `ios.simulator: true`. Needs no Apple account.
  - `preview`: internal distribution. Needs Apple ad-hoc provisioning, so it's paid.
  - `production`: `autoIncrement`. `submit.production` is left empty until App Store Connect exists.
- Env: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS environment variables (plain-text visibility, since they're public by design). Locally they come from `.env` (gitignored), with `.env.example` committed.
- Needs a free Expo account plus `EXPO_TOKEN` only when we first run `eas init` / `eas build`. Not required for Expo Go testing.
