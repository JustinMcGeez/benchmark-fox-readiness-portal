import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works both at a domain root and under a sub-path
  // (GitHub Pages serves this project at /benchmark-fox-readiness-portal/).
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
