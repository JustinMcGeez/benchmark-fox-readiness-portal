/* ============================================================================
   securityHeaders — proves the CSP shape (no inline scripts, the documented
   styles-only 'unsafe-inline', the external allowlist) and, crucially, that
   vercel.json has NOT drifted from this single source of truth. If someone edits
   the policy in one place but not the other, this test fails.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SECURITY_HEADERS,
  contentSecurityPolicyHeader,
  contentSecurityPolicyMeta,
} from './securityHeaders';

/** Parse the serialized CSP back into a directive → sources map. */
function parseCsp(policy: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of policy.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/).filter(Boolean);
    if (name) out[name] = sources;
  }
  return out;
}

describe('contentSecurityPolicyMeta (build-time <meta> tag)', () => {
  const csp = parseCsp(contentSecurityPolicyMeta);

  it('keeps script-src free of inline/string-eval (only WASM is permitted)', () => {
    // 'wasm-unsafe-eval' permits WebAssembly (the @react-pdf PDF generator) but
    // NOT 'unsafe-inline' or 'unsafe-eval' — no inline scripts, no new Function.
    expect(csp['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    expect(csp['script-src']).not.toContain("'unsafe-eval'");
  });

  it('allows inline STYLES only — the one documented exception', () => {
    expect(csp['style-src']).toContain("'unsafe-inline'");
    expect(csp['style-src']).toContain('https://fonts.googleapis.com');
  });

  it('allowlists the Google Fonts file origin', () => {
    expect(csp['font-src']).toEqual(["'self'", 'https://fonts.gstatic.com']);
  });

  it('allowlists Supabase (https + wss), Sentry ingest, and data: for connect-src', () => {
    expect(csp['connect-src']).toEqual([
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://*.sentry.io',
      'data:',
    ]);
  });

  it('allows blob: web workers (docx/xlsx/pdf generators)', () => {
    expect(csp['worker-src']).toEqual(["'self'", 'blob:']);
  });

  it('locks down base-uri and object-src', () => {
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
  });

  it('OMITS frame-ancestors — browsers ignore it in a <meta> tag', () => {
    expect(contentSecurityPolicyMeta).not.toContain('frame-ancestors');
  });
});

describe('contentSecurityPolicyHeader (HTTP header form)', () => {
  it('is the meta policy plus the header-only frame-ancestors directive', () => {
    expect(contentSecurityPolicyHeader).toBe(
      `${contentSecurityPolicyMeta}; frame-ancestors 'none'`,
    );
  });
});

describe('SECURITY_HEADERS', () => {
  const byKey = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));

  it('serves the full CSP header (with frame-ancestors)', () => {
    expect(byKey['Content-Security-Policy']).toBe(contentSecurityPolicyHeader);
  });

  it('includes the expected hardening headers', () => {
    expect(byKey['X-Content-Type-Options']).toBe('nosniff');
    expect(byKey['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(byKey['X-Frame-Options']).toBe('DENY');
    expect(byKey['Strict-Transport-Security']).toContain('max-age=');
    expect(byKey['Strict-Transport-Security']).toContain('includeSubDomains');
    expect(byKey['Permissions-Policy']).toContain('camera=()');
    expect(byKey['Permissions-Policy']).toContain('microphone=()');
    expect(byKey['Permissions-Policy']).toContain('geolocation=()');
  });
});

describe('vercel.json (must mirror SECURITY_HEADERS exactly)', () => {
  // vitest runs from the repo root, so resolve vercel.json against cwd (the test
  // environment's import.meta.url is not a file: URL under jsdom).
  const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
    buildCommand: string;
    outputDirectory: string;
    rewrites: { source: string; destination: string }[];
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };

  it('applies the headers to every path', () => {
    expect(vercel.headers).toHaveLength(1);
    expect(vercel.headers[0].source).toBe('/(.*)');
  });

  it('has not drifted from the securityHeaders.ts source of truth', () => {
    expect(vercel.headers[0].headers).toEqual(
      SECURITY_HEADERS.map((h) => ({ key: h.key, value: h.value })),
    );
  });

  it('injects the build SHA and the absolute deploy base at build time', () => {
    expect(vercel.buildCommand).toContain('VITE_BUILD_SHA=$VERCEL_GIT_COMMIT_SHA');
    expect(vercel.buildCommand).toContain('VITE_DEPLOY_BASE=/');
    expect(vercel.outputDirectory).toBe('dist');
  });

  it('serves the SPA fallback so client-side routes resolve on hard refresh', () => {
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });
});
