import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const root = path.join(__dirname, '..');
const live = process.env.E2E_SUPABASE === '1';
const widths = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-16', width: 393, height: 852 },
  { name: 'iphone-16-pro-max', width: 440, height: 956 },
];

export default defineConfig({
  testDir: '.',
  testMatch: 'offline.spec.ts',
  outputDir: path.join(root, 'artifacts', 'qa', '2026-10-08', 'offline'),
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:19419',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:19419',
          localStorage: [
            { name: 'setwise.prefs', value: '{"state":{"tutorialSeen":true},"version":0}' },
          ],
        },
      ],
    },
    video: 'on',
    screenshot: 'on',
  },
  webServer: {
    command: 'npx expo start --web --port 19419',
    cwd: root,
    url: 'http://127.0.0.1:19419',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_SUPABASE_URL: live ? (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '') : '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: live ? (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '') : '',
    },
  },
  projects: widths.flatMap(({ name, width, height }) =>
    (['light', 'dark'] as const).map((scheme) => ({
      name: `${name}-${scheme}`,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width, height },
        colorScheme: scheme,
        deviceScaleFactor: 2,
      },
    })),
  ),
});
