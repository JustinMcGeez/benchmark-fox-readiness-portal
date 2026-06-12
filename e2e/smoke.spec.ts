/* ============================================================
   Playwright smoke tests — app boots in Local Prototype mode (no env
   vars, localStorage persistence) and the core screens work, now on
   real react-router paths (see src/routes.tsx for the route map).
   ============================================================ */
import { expect, test } from '@playwright/test';

test('app loads and the login screen shows Benchmark Fox branding', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle('Benchmark Fox Readiness Portal');
  await expect(page.getByRole('heading', { name: 'Sign in to your portal' })).toBeVisible();
  await expect(page.getByText('Authorized Benchmark Fox users only.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Benchmark Fox' }).first()).toBeVisible();
});

test('control matrix renders all 110 controls and search filters to 3.1.1', async ({ page }) => {
  await page.goto('/clients/acme/controls');
  const rows = page.locator('table.w-table tbody tr');
  await expect(rows).toHaveCount(110);
  await expect(page.getByText(/110 CONTROLS/)).toBeVisible();

  await page.getByPlaceholder('Search controls…').fill('3.1.1');
  // Substring search: 3.1.1 plus 3.1.10–3.1.19.
  await expect(rows).toHaveCount(11);
  await expect(rows.first().locator('td').first()).toHaveText('3.1.1');
});

test('readiness status edit persists across reload via localStorage', async ({ page }) => {
  await page.goto('/clients/acme/controls');
  const rows = page.locator('table.w-table tbody tr');
  await page.getByPlaceholder('Search controls…').fill('3.1.12');
  await expect(rows).toHaveCount(1);

  const select = rows.first().getByLabel('Readiness status');
  await expect(select).toHaveValue('Met'); // seed value
  await select.selectOption('Not Met');

  // Persisted under the clientId:controlId override key.
  const stored = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bf_assessments_v1') ?? '{}') as Record<
      string,
      { status?: string }
    >;
    return raw['acme:3.1.12']?.status;
  });
  expect(stored).toBe('Not Met');

  await page.reload();
  await page.getByPlaceholder('Search controls…').fill('3.1.12');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByLabel('Readiness status')).toHaveValue('Not Met');
});

test('dashboard shows a numeric readiness % and SPRS estimate', async ({ page }) => {
  await page.goto('/dashboard');
  const summary = page.getByText(/ACTIVE CLIENT/);
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(/\d+% READY/);
  await expect(summary).toContainText(/SCORE [+−]?\d+/);
});

test('the screens index (g key) opens and lists all 21 screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#screen-launcher')).toContainText('/21');
  await page.keyboard.press('g');
  await expect(page.getByRole('heading', { name: 'Screen Index' })).toBeVisible();
  await expect(page.getByText(/^\d{2} · /)).toHaveCount(21);
});

test('legacy ?screen=controls URL redirects to the new controls path', async ({ page }) => {
  await page.goto('/?screen=controls');
  await expect(page).toHaveURL(/\/clients\/acme\/controls$/);
  await expect(page.locator('table.w-table tbody tr')).toHaveCount(110);
});

test('control detail deep-links cold and matrix row click routes to it', async ({ page }) => {
  // Cold deep-link: the URL alone selects the control.
  await page.goto('/clients/acme/controls/3.1.3');
  await expect(page.getByRole('heading', { name: /^3\.1\.3 — / })).toBeVisible();

  // Row click from the matrix navigates to the control's URL.
  await page.goto('/clients/acme/controls');
  await page.getByPlaceholder('Search controls…').fill('3.5.3');
  await page.locator('table.w-table tbody tr').first().locator('td').first().click();
  await expect(page).toHaveURL(/\/clients\/acme\/controls\/3\.5\.3$/);
  await expect(page.getByRole('heading', { name: /^3\.5\.3 — / })).toBeVisible();
});

test('unknown client redirects to /clients; unknown URL shows NotFound', async ({ page }) => {
  await page.goto('/clients/not-a-client/controls');
  await expect(page).toHaveURL(/\/clients$/);

  await page.goto('/totally/bogus');
  await expect(page.getByText('Page not found')).toBeVisible();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
