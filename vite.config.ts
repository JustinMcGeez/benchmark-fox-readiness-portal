import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicyMeta } from './src/lib/securityHeaders';

// This file runs under Node; tsconfig.node.json has no Node type definitions,
// so declare the small slice of `process` we read.
declare const process: { env: Record<string, string | undefined> };

/* Inject the Content-Security-Policy as a <meta http-equiv> into the built
   index.html. Build-only (apply: 'build') so the Vite dev server — which serves
   its own inline HMR/react-refresh scripts that `script-src 'self'` would block —
   is untouched. This makes the CSP enforced on every host (including GitHub
   Pages, which cannot set response headers) and verifiable via `npm run preview`.
   The header-capable hosts (Vercel) additionally serve the full CSP + the
   header-only directives via vercel.json. */
function cspMetaPlugin(): Plugin {
  return {
    name: 'bf-csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicyMeta },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base by default so the build works under a sub-path (GitHub Pages
  // serves this project at /benchmark-fox-readiness-portal/). Root-domain hosts
  // that serve an SPA fallback (Vercel staging/production) set VITE_DEPLOY_BASE=/
  // so deep-link asset URLs resolve from the domain root — see docs/deployment.md.
  base: process.env.VITE_DEPLOY_BASE ?? './',
  plugins: [react(), cspMetaPlugin()],
  server: {
    port: 5173,
    // Don't pop a browser when Playwright (BF_E2E) or CI starts the server.
    open: !process.env.CI && !process.env.BF_E2E,
  },
});
