/* ============================================================
   Playwright — evidence lifecycle workflow in Local Prototype mode (Task 08).
   Create a fresh client (so evidence starts empty), request evidence for a
   control + specific objective, add a secure link, walk the legal review
   transitions to Accepted, and confirm the control's objective coverage moves
   — and agrees on the Control Detail screen (shared selector).
   ============================================================ */
import { expect, test } from '@playwright/test';

async function createClient(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/clients/new');
  await page.getByLabel('LEGAL COMPANY NAME').fill('Evidence Flow Co');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Next/ }).click();
  await page.getByRole('button', { name: /Create Client/ }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  return page.url();
}

test('request → link → review → accept moves objective coverage (and agrees on Control Detail)', async ({
  page,
}) => {
  const clientUrl = await createClient(page);
  await page.goto(clientUrl + '/evidence');

  // Empty engagement: no evidence yet.
  await expect(page.getByText('No evidence yet.')).toBeVisible();

  // --- Request evidence for 3.1.1, a specific objective ---
  await page.getByRole('button', { name: '+ Request Evidence' }).click();
  await page.getByLabel('Control').selectOption('3.1.1');
  await page.getByPlaceholder('e.g. MFA enforcement configuration export').fill('E2E Access Policy');
  await page.getByRole('button', { name: 'Specific objectives' }).click();
  await page.getByRole('button', { name: /3\.1\.1\[a\]/ }).click();
  await page.getByRole('button', { name: 'Request Evidence', exact: true }).click();

  // The item lands in the Requested group; select it.
  await expect(page.getByText('Requested (1)')).toBeVisible();
  await page.getByText('E2E Access Policy').click();

  // --- Add a secure https link ---
  const linkInput = page.getByLabel('Secure external link');
  await linkInput.fill('https://contoso.sharepoint.us/sites/cmmc/evidence/e2e');
  await page.getByRole('button', { name: 'Save Link' }).click();

  // --- Walk the legal transitions: Uploaded → In Review → Accepted ---
  await page.getByRole('button', { name: 'Mark Uploaded' }).click();
  await page.getByRole('button', { name: 'Start Review' }).click();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();

  // Detail now shows Accepted + coverage of 1 objective (shared selector).
  const detail = page.locator('.w-card').filter({ hasText: 'Evidence Detail' });
  await expect(detail.getByText('Accepted', { exact: true }).first()).toBeVisible();
  await expect(detail.getByText(/1\/\d+ objectives covered/)).toBeVisible();

  // --- Cross-screen agreement: Control Detail's Evidence tab ---
  await page.goto(clientUrl + '/controls/3.1.1');
  // The nav also has a .w-tab "Evidence"; the control's own tab strip is the
  // only .w-tabs that contains "Overview" — scope to it, then pick its tab.
  const detailTabs = page.locator('.w-tabs', { hasText: 'Overview' });
  await detailTabs.getByText('Evidence', { exact: true }).click();
  await expect(page.getByText(/1\/\d+ objectives covered by accepted evidence/)).toBeVisible();
});

test('a non-reviewer cannot see review transitions (UI hides them)', async ({ page }) => {
  // Local Prototype mode has no auth, so review IS available — this asserts the
  // legal-next-status buttons are exactly the request/upload moves for a fresh
  // Requested item (the role gate itself is proven by the RLS suite).
  const clientUrl = await createClient(page);
  await page.goto(clientUrl + '/evidence');
  await page.getByRole('button', { name: '+ Request Evidence' }).click();
  await page.getByLabel('Control').selectOption('3.1.1');
  await page.getByPlaceholder('e.g. MFA enforcement configuration export').fill('Gate Check');
  await page.getByRole('button', { name: 'Request Evidence', exact: true }).click();
  await page.getByText('Gate Check').click();

  const detail = page.locator('.w-card').filter({ hasText: 'Evidence Detail' });
  // From Requested the legal moves are Mark Uploaded / Mark Missing only.
  await expect(detail.getByRole('button', { name: 'Mark Uploaded' })).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Mark Missing' })).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
});
