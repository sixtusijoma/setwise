# Decisions

Working name: **Setwise**. Each line is a decision plus the reason. Details live in `docs/`.

| Area | Decision | Why |
| --- | --- | --- |
| App stack | Expo SDK 57 (React Native 0.86, React 19.2), TypeScript strict, Expo Router | Expo Go on the App Store only runs the latest SDK. Router gives file-based stacks, tabs, and sheets, and the same code runs on web for QA. |
| Backend | Supabase free tier (Postgres + Auth + PostgREST) | Postgres RLS is the strongest per-user isolation we can get for free, and it's testable in SQL. Firebase rules are harder to test, and Firestore has weaker relational integrity. |
| Auth | Email + password, plus native Sign in with Apple (ID token only). No Google. | Email/password works in Expo Go, on web, and in Playwright. Magic links won't work here: Supabase's built-in SMTP only sends to project team members, and `exp://` deep links change with each dev IP. Native Google sign-in needs a dev build. |
| Session storage | Session encrypted with AES; the key lives in `expo-secure-store` and the ciphertext in AsyncStorage (Supabase's "LargeSecureStore" pattern). `localStorage` on web. | Refresh tokens stay out of plaintext storage. SecureStore alone has a 2 KB limit. |
| Client keys | Only the Supabase URL and publishable key ship in the app, via `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. supabase-js 2.117 sends `sb_publishable_…` as `apikey` only, never as a Bearer token. The service-role/secret key is never used anywhere. | Least privilege. RLS tests don't need it (see `docs/security.md`). |
| Data access | `src/data` defines one `Repo` interface with two implementations: `local` (AsyncStorage) and `remote` (Supabase). It's chosen by whether `EXPO_PUBLIC_SUPABASE_URL` is set. | Work and QA never block on accounts. Playwright runs deterministically in local mode. |
| Sync | Online-first with offline durability. The active workout is a persisted Zustand draft. Reads use a persisted TanStack Query cache. Writes are TanStack mutations with client-generated UUIDs, persisted and replayed on reconnect. Finished workouts are saved through one atomic, idempotent `save_workout` RPC. Conflicts resolve last-write-wins per record. | Gyms have bad signal, so logging must never wait on the network. A full sync engine (PowerSync, WatermelonDB) needs native modules that Expo Go doesn't have. Rows only ever have one owner, so real conflicts are rare. |
| Units | Stored canonically as kg (`numeric(7,3)`), meters, and seconds. Converted for display per profile `unit_system` (imperial = lb/mi, metric = kg/km). Pace is always shown in min/mi, plus min/km in metric. | Lossless round-trip (225 lb → 102.058 kg → 225 lb). One source of truth for stats. |
| Strength metrics | Top set = heaviest weight (ties broken by reps). Est. 1RM = Epley `w × (1 + r/30)`, using only sets of 1–12 reps. Volume = Σ reps × kg. For bodyweight lifts (weight 0), the chart falls back to reps. | Standard formulas. Epley is unreliable above about 12 reps. |
| Charts | Our own `LineChart` built on `react-native-svg` + `d3-shape` | Works in Expo Go and on web (checked on SDK 57). Full visual control. Skia/Victory XL needs CanvasKit wasm on web. |
| Exercise library | 153 curated lifts in `data/exercise-library.json`. A script turns it into a seed migration of global, read-only rows (`owner_id is null`). Users add custom exercises as their own rows. | One source of truth for the server seed and local mode. Search runs on the client over the cached list, so it works offline. |
| Imagery | AI-generated monoline illustrations: ink lines plus one ember accent, on a paper-colored tile. One per muscle group (12) plus about 40 of the most common lifts. Others fall back to their group image. Custom exercises use a monogram tile. Cardio uses Lucide icons. | Consistent, premium, offline (bundled). Samples are in `docs/mockups/img/`. |
| Visual system | Warm paper/ink neutrals, one ember accent for strength, a tide-blue accent for cardio, brass for PRs. Instrument Serif for headlines, Geist for UI with tabular numbers. Lucide icons. | Editorial and calm rather than "gym neon". See `docs/design.md`. |
| QA | Unit tests with Jest (`jest-expo`). Database tests with pgTAP (`scripts/test-db.sh`, plain Postgres, no Docker). Playwright click-throughs on Expo web at 3 iPhone viewports in light and dark, recording video. Final check on the owner's iPhone via Expo Go `--tunnel`. | This VM has no iOS simulator or Docker. Expo web plus Playwright is the most reliable automated click-through we can run here. |
| Distribution | `eas.json` with development (simulator), preview, and production profiles committed, but no builds until a free Expo account and token exist. TestFlight needs the paid Apple Developer Program, which is out of scope for now. | Brief: EAS configured, no paid accounts. |
| Remote repo wiring | `getRepo()` uses the local repo when `EXPO_PUBLIC_SUPABASE_URL` is empty, and the Supabase repo when it is set. | A configured project must not silently keep data only on the device. |
| Week | ISO week (Monday–Sunday) in the device's local time zone | Matches common training splits. |
| Offline writes | Remote mutations use TanStack `networkMode: 'online'`, so they pause before any request and replay once on reconnect. Local mode uses `always`. Custom exercise creates use the same keyed pause, with a client id so a queued workout can reference the row. Saving a workout waits for any pending create to finish first. | `offlineFirst` fires the request while offline, and with no retries that failure settles as an error. Today's banner only appears for paused mutations, and Profile counts the same queue. |
| Account deletion | `delete_account()` deletes only the signed-in user's rows, then their `auth.users` row. Profile asks them to type DELETE, then calls the RPC. Hosted deletion works once the PM applies `supabase/migrations/20261008000200_delete_account.sql`. | App Store 5.1.1(v). A custom exercise used in a workout is `ON DELETE RESTRICT`, so the function removes children before the user. |
| App icon | Ember dumbbell on paper (`#E8551E` on `#F4F2EE`) for the icon, splash, and Android adaptive icon. | Same accent and paper as the rest of the journal. No wordmark. |

## Sign in with Apple

Native ID token only: `expo-apple-authentication`, a SHA-256 nonce sent to Apple, and the raw nonce sent to `supabase.auth.signInWithIdToken`. The button is hidden unless the platform is iOS and `isAvailableAsync()` is true, so web and Playwright never show it. There is no Services ID, no `.p8` secret, and no web OAuth.

This works in Expo Go without a paid Apple Developer membership, because the token audience is Expo's App ID. A standalone or TestFlight build needs the paid program so the `com.sixtus.setwise` App ID can enable the Sign in with Apple capability. The same ID-token flow continues. Do not add a Services ID or a key until someone asks for Apple sign-in on the web.

**PM dashboard settings** (Authentication → Providers → Apple):

- Enable the Apple provider.
- Authorized Client IDs: `host.exp.Exponent` and `com.sixtus.setwise`.
- Leave Services ID, secret key, and team ID empty.

**On-device check** (owner's iPhone, after those settings are saved):

1. `npx expo start --tunnel` and open the project in Expo Go.
2. Sign out if an email session is active.
3. Tap Continue with Apple, complete the system sheet, and confirm Today opens.
4. Force-quit and reopen. The session should still be there.
5. If the sheet errors with an audience mismatch, the Client IDs above are not saved yet. Email sign-in stays available either way.
