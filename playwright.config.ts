/* ============================================================
   Playwright smoke-test config — chromium only for now, against the
   vite dev server (started automatically via webServer).
   ============================================================ */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Small smoke suite against a cold vite dev server: run sequentially so
  // parallel first-loads don't contend for on-demand transforms, and give
  // the first (slowest) load headroom.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    // Explicit IPv4: `localhost` resolves to ::1 on this Node, and vite then
    // binds only the IPv6 loopback, which headless Chromium fails to reach.
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      // BF_E2E keeps vite from opening a browser tab (see vite.config.ts).
      env: { BF_E2E: '1' },
      timeout: 120_000,
    },
    // Production preview (serves the built dist/) — the ONLY build that carries
    // the CSP <meta> tag (injected at build time, see vite.config.ts). Used by
    // e2e/csp.spec.ts to verify the policy doesn't break the app. Requires a
    // prior `npm run build` (CI builds before e2e; the local gate does too).
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
