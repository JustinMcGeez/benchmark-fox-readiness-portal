/* ============================================================================
   securityHeaders.ts — the ONE source of truth for the app's Content-Security-
   Policy and HTTP security headers (Task 13). Consumed by:
     * vite.config.ts        — injects the CSP as a <meta> tag into the built
                               index.html (build only), so the policy is enforced
                               on ANY host, including GitHub Pages which cannot
                               set response headers, and is verifiable with
                               `npm run preview`.
     * vercel.json           — serves the SAME directives plus the header-only
                               pieces (HSTS, X-Frame-Options, frame-ancestors,
                               Permissions-Policy, …) as real HTTP response
                               headers on the Vercel staging/production targets.
     * securityHeaders.test  — asserts vercel.json has not drifted from this file
                               and that the meta CSP omits header-only directives.

   This module is PURE (no DOM, no imports) so it type-checks under both the app
   (tsconfig.app) and the Vite-config (tsconfig.node) projects.

   ── Why each non-obvious allowance exists ─────────────────────────────────────
   * script-src 'self'              — the Vite production build emits ONLY external
                                      module scripts (verified: zero inline
                                      <script> in dist/index.html), so no
                                      'unsafe-inline'/nonce is needed for scripts.
   * script-src 'wasm-unsafe-eval'  — the SPRS PDF generator (@react-pdf's
                                      yoga-layout) instantiates a WebAssembly
                                      module; without this directive the PDF
                                      export throws under CSP (verified by
                                      e2e/csp.spec.ts). This is the WASM-only
                                      CSP3 keyword — it permits WebAssembly
                                      compilation, NOT arbitrary JS eval /
                                      new Function, so script-src stays hardened
                                      against XSS string-evaluation.
   * style-src 'unsafe-inline'      — REQUIRED. The UI sets element style="" via
                                      React inline-style props throughout, and
                                      inline style ATTRIBUTES cannot be hash- or
                                      nonce-allowlisted. This is the one inline
                                      allowance and it is styles-only.
   * style-src fonts.googleapis.com — wireframe.css `@import`s the Montserrat /
     font-src  fonts.gstatic.com      Inter / Roboto Mono stylesheet from Google
                                      Fonts; the font files come from gstatic.
   * connect-src *.supabase.co       — Supabase REST + Auth (https) and Realtime
                wss://*.supabase.co     (wss) when VITE_SUPABASE_* is configured.
   * connect-src *.sentry.io         — Sentry error ingest when VITE_SENTRY_DSN is
                                      set (harmless when unset — nothing connects).
   * worker-src blob:                — the bundled document generators (docx /
                                      exceljs / @react-pdf) spawn web workers from
                                      blob: URLs.
   * img-src data:                   — small inline data: images used by the UI.
   ============================================================================ */

/** CSP fetch/navigation directives that are valid in BOTH a <meta http-equiv>
    tag and an HTTP response header. Order is cosmetic. */
const META_SAFE_DIRECTIVES: Record<string, readonly string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://*.sentry.io',
    // @react-pdf fetches its inlined font metrics / WASM via self-contained
    // data: URIs (XHR to data:) during PDF generation — see e2e/csp.spec.ts.
    // data: in connect-src cannot reach an external origin, so there is no
    // exfiltration surface.
    'data:',
  ],
  'worker-src': ["'self'", 'blob:'],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'object-src': ["'none'"],
};

/** Directives that browsers IGNORE in a <meta> tag (with a console warning) and
    therefore live only in the HTTP-header form. `frame-ancestors` is the framing
    control for modern browsers; X-Frame-Options (below) covers older ones. */
const HEADER_ONLY_DIRECTIVES: Record<string, readonly string[]> = {
  'frame-ancestors': ["'none'"],
};

function serializeCsp(directives: Record<string, readonly string[]>): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/** CSP string for the build-time <meta> tag — meta-safe directives only. */
export const contentSecurityPolicyMeta: string = serializeCsp(META_SAFE_DIRECTIVES);

/** CSP string for the HTTP `Content-Security-Policy` header — meta-safe plus the
    header-only directives (frame-ancestors). */
export const contentSecurityPolicyHeader: string = serializeCsp({
  ...META_SAFE_DIRECTIVES,
  ...HEADER_ONLY_DIRECTIVES,
});

export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
}

/** Minimal Permissions-Policy: deny the powerful features this app never uses. */
const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'display-capture=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

/** The full set of HTTP response headers the deploy host must send. vercel.json
    mirrors this exactly (enforced by securityHeaders.test). */
export const SECURITY_HEADERS: readonly SecurityHeader[] = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicyHeader },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
  // 2 years, subdomains, preload-eligible. Submit the apex domain to
  // hstspreload.org to activate the preload list (see docs/deployment.md).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
];
