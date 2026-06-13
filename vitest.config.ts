// ============================================================
// Vitest config — extends the app's vite.config.ts so unit tests run
// with the exact same plugins/resolution as the real build.
// Unit tests live in src/**/*.test.{ts,tsx}; Playwright specs live in
// e2e/ and are excluded here (they run via `npm run test:e2e`).
// ============================================================
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/lib/**', 'src/data/store.tsx', 'src/data/repository/**'],
        reporter: ['text', 'html'],
      },
    },
  }),
);
