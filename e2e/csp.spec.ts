/* ============================================================================
   Content-Security-Policy smoke (Task 13). Runs against the PRODUCTION build via
   `vite preview` (port 4173) — the only build that carries the CSP <meta> tag
   (injected at build time, see vite.config.ts). Verifies the policy is present
   and causes no violations across every screen, and that the heavy document
   generators (which use web workers / WASM) still run under it.

   Navigation note: with base './' the preview server only resolves assets when
   the DOCUMENT path is '/'. We therefore load `/?screen=<key>` (document stays
   at '/', then the app client-side-redirects to the real route) instead of
   deep-link goto()s — see SCREEN_ROUTES in src/routes.tsx.
   ============================================================================ */
import { expect, test } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:4173' });

/** All 21 legacy ?screen= keys (mirrors SCREEN_ROUTES in src/routes.tsx). */
const SCREEN_KEYS = [
  'login',
  'dashboard',
  'clients',
  'create-client',
  'client-dashboard',
  'intake',
  'path',
  'scope',
  'control-library',
  'controls',
  'control-detail',
  'ssp',
  'poam',
  'evidence',
  'tasks',
  'reports',
  'report-preview',
  'knowledge',
  'audit',
  'settings',
  'mobile',
] as const;

/** Init script: capture securitypolicyviolation events into window.__csp. Runs
    on every document load (survives the per-screen reloads below). */
const COLLECT_CSP = () => {
  (window as unknown as { __csp: string[] }).__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    (window as unknown as { __csp: string[] }).__csp.push(
      `${e.effectiveDirective || e.violatedDirective} blocked ${e.blockedURI}`,
    );
  });
};

async function readViolations(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? []);
}

test('the production build serves the CSP as a <meta http-equiv> tag', async ({ page }) => {
  await page.goto('/');
  const meta = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(meta).toHaveCount(1);
  const content = (await meta.getAttribute('content')) ?? '';
  expect(content).toContain("default-src 'self'");
  expect(content).toContain("script-src 'self'");
  // Scripts stay strict — the only inline allowance is styles-only.
  expect(content).not.toContain("script-src 'self' 'unsafe-inline'");
  // frame-ancestors is header-only; it must NOT appear in the meta tag.
  expect(content).not.toContain('frame-ancestors');
});

test('no CSP violations on any of the 21 screens', async ({ page }) => {
  await page.addInitScript(COLLECT_CSP);
  const violations: string[] = [];

  for (const key of SCREEN_KEYS) {
    await page.goto(`/?screen=${key}`);
    await page.waitForLoadState('networkidle');
    for (const v of await readViolations(page)) violations.push(`[${key}] ${v}`);
  }

  expect(violations, `CSP violations found:\n${violations.join('\n')}`).toEqual([]);
});

test('generating an SPRS report (web worker / WASM) runs under the CSP', async ({ page }) => {
  await page.addInitScript(COLLECT_CSP);

  // Demo client ('acme') Reports screen, reached client-side via the redirect.
  await page.goto('/?screen=reports');
  await expect(page).toHaveURL(/\/clients\/acme\/reports$/);

  await page.getByRole('button', { name: 'Generate SPRS Report (.pdf)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Generate SPRS Report (.pdf)' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Generate report' }).click();
  // Success = dialog closes with no error surfaced. Generous timeout for the
  // first-time lazy load + WASM init of the @react-pdf renderer chunk.
  await expect(dialog).toBeHidden({ timeout: 30000 });
  await expect(page.getByText('Could not generate the SPRS report.')).toHaveCount(0);

  expect(await readViolations(page)).toEqual([]);
});

test('generating a POA&M workbook (exceljs) runs under the CSP', async ({ page }) => {
  await page.addInitScript(COLLECT_CSP);

  await page.goto('/?screen=reports');
  await expect(page).toHaveURL(/\/clients\/acme\/reports$/);

  await page.getByRole('button', { name: 'Generate POA&M (.xlsx)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Generate POA&M (.xlsx)' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Generate workbook' }).click();
  await expect(dialog).toBeHidden({ timeout: 30000 });
  await expect(page.getByText('Could not generate the POA&M workbook.')).toHaveCount(0);

  expect(await readViolations(page)).toEqual([]);
});

test('generating the SSP (.docx) runs under the CSP', async ({ page }) => {
  await page.addInitScript(COLLECT_CSP);

  await page.goto('/?screen=reports');
  await expect(page).toHaveURL(/\/clients\/acme\/reports$/);

  await page.getByRole('button', { name: 'Generate SSP (.docx)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Generate SSP' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Generate anyway' }).click();
  await expect(dialog).toBeHidden({ timeout: 30000 });
  await expect(page.getByText('Could not generate the SSP document.')).toHaveCount(0);

  expect(await readViolations(page)).toEqual([]);
});
