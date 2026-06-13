/* ============================================================
   Playwright auth tests (Task 03 — Supabase Auth).

   The e2e suite runs in Local Prototype mode (no Supabase env vars),
   so these tests cover that path: the app loads with auth disabled,
   every protected screen renders, and the dismissible banner behaves.
   Real-auth e2e (redirect to /login, password + magic-link sign-in)
   is stubbed below and skipped until a test project exists.
   ============================================================ */
import { expect, test } from '@playwright/test';

const BANNER_TEXT = 'Local Prototype mode — auth disabled';

test('Local Prototype mode: app loads without auth and shows the banner', async ({ page }) => {
  await page.goto('/dashboard');
  // No redirect to /login — auth is disabled, the screen renders.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const banner = page.getByText(BANNER_TEXT).first();
  await expect(banner).toBeVisible();

  // The shell user menu shows the demo identity instead of a signed-in user.
  await page.getByRole('button', { name: 'User menu' }).click();
  await expect(page.getByText('Demo user').first()).toBeVisible();
});

test('the Local Prototype banner is dismissible and stays dismissed for the session', async ({
  page,
}) => {
  await page.goto('/clients');
  await expect(page.getByText(BANNER_TEXT)).toBeVisible();

  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText(BANNER_TEXT)).toHaveCount(0);

  // Navigating to another protected screen keeps it dismissed (sessionStorage).
  await page.goto('/clients/acme/controls');
  await expect(page.locator('table.w-table tbody tr')).toHaveCount(110);
  await expect(page.getByText(BANNER_TEXT)).toHaveCount(0);
});

/* TODO(Task 03 follow-up): enable once a dedicated Supabase TEST project
   exists. Needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY pointing at a
   disposable project plus a seeded, confirmed test user. Should assert:
     1. unauthenticated /dashboard redirects to /login;
     2. wrong password shows the generic inline error (no email enumeration);
     3. valid sign-in returns to the originally requested URL;
     4. sign-out from the user menu lands on /login and leaves bf_* keys alone. */
test.skip('real Supabase auth: unauthenticated users cannot reach any route but /login', async () => {
  // Intentionally empty — see TODO above.
});
