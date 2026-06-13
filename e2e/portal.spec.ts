/* ============================================================
   Playwright — client portal, role-scoped (Task 11). Local Prototype mode.

   The Tweaks "View as" switcher (Local-Prototype only) simulates each client
   role; the demo engagement (acme) is the assigned client. Proves the reduced
   portal shell, the internal-route guard, the read-only matrix, and the
   evidence_uploader submission queue.
   ============================================================ */
import { expect, test, type Page } from '@playwright/test';

/** Open Tweaks and switch the simulated role (persists to bf_sim_role). */
async function viewAs(page: Page, role: string) {
  await page.getByRole('button', { name: 'Open tweaks' }).click();
  await page.getByLabel('View as').selectOption(role);
  // Close the panel so it never overlaps the assertions.
  await page.getByRole('button', { name: 'Close tweaks' }).click();
}

test('client_executive gets the reduced portal shell and is blocked from internal routes', async ({
  page,
}) => {
  await page.goto('/clients/acme');
  await viewAs(page, 'client_executive');

  // Unambiguous portal identity marker + the client name.
  await expect(page.getByText('Client Portal')).toBeVisible();
  await expect(page.getByText('Acme Defense Systems')).toBeVisible();

  // Reduced nav: portal items present, internal items gone.
  const nav = page.getByRole('navigation');
  await expect(nav.getByText('Documents')).toBeVisible();
  await expect(nav.getByText('Clients')).toHaveCount(0);
  await expect(nav.getByText('Audit Log')).toHaveCount(0);
  await expect(nav.getByText('Settings')).toHaveCount(0);

  // The internal screen launcher is hidden in the portal.
  await expect(page.locator('#screen-launcher')).toHaveCount(0);

  // Hitting an internal route bounces back to their dashboard.
  await page.goto('/audit');
  await expect(page).toHaveURL(/\/clients\/acme$/);

  // A different client's URL is not theirs → back to their dashboard.
  await page.goto('/clients/bravo/controls');
  await expect(page).toHaveURL(/\/clients\/acme$/);
});

test('a client role gets a read-only control matrix (no editable selects)', async ({ page }) => {
  await page.goto('/clients/acme');
  await viewAs(page, 'readonly_viewer');

  await page.goto('/clients/acme/controls');
  await expect(page.getByPlaceholder('Search controls…')).toBeVisible();
  // Editable inline status selects are replaced by read-only badges.
  await expect(page.locator('[aria-label="Readiness status"]')).toHaveCount(0);
});

test('evidence_uploader lands on a focused submission queue', async ({ page }) => {
  await page.goto('/clients/acme');
  await viewAs(page, 'evidence_uploader');

  await page.goto('/clients/acme/evidence');
  // The uploader-only queue toggle, defaulted on.
  await expect(page.getByRole('button', { name: /My queue/ })).toBeVisible();
  // Uploaders cannot open a new evidence request (a staff action).
  await expect(page.getByRole('button', { name: /Request Evidence/ })).toHaveCount(0);
});
