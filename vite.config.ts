import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This file runs under Node; tsconfig.node.json has no Node type definitions,
// so declare the small slice of `process` we read.
declare const process: { env: Record<string, string | undefined> };

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works both at a domain root and under a sub-path
  // (GitHub Pages serves this project at /benchmark-fox-readiness-portal/).
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    // Don't pop a browser when Playwright (BF_E2E) or CI starts the server.
    open: !process.env.CI && !process.env.BF_E2E,
  },
});
