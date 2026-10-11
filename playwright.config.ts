import { defineConfig, devices } from '@playwright/test';

const date = '2026-10-08';
const widths = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-16', width: 393, height: 852 },
  { name: 'iphone-16-pro-max', width: 440, height: 956 },
];

export default defineConfig({
  testDir: 'e2e',
  outputDir: `artifacts/qa/${date}/app-foundation`,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:19417',
    video: 'on',
    screenshot: 'on',
    // Specs start past the first-run tutorial; tutorial.spec.ts clears this.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:19417',
          localStorage: [
            { name: 'setwise.prefs', value: '{"state":{"tutorialSeen":true},"version":0}' },
          ],
        },
      ],
    },
  },
  webServer: {
    command: 'npx expo start --web --port 19417',
    url: 'http://127.0.0.1:19417',
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
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
