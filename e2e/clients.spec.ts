/* ============================================================
   Playwright — multi-client CRUD in Local Prototype mode (Task 07).
   Create a client through the wizard, land on its empty dashboard,
   edit one control, and watch readiness move. Proves the client is a
   real, route-scoped engagement (not the old hardcoded CURRENT_CLIENT).
   ============================================================ */
import { expect, test } from '@playwright/test';

test('wizard creates a client, lands on an empty dashboard, and editing a control moves readiness', async ({
  page,
}) => {
  await page.goto('/clients');

  // Admin (Local Prototype mode) sees the create action.
  await page.getByRole('button', { name: /New Client/ }).click();
  await expect(page).toHaveURL(/\/clients\/new$/);

  // Step 1 — Organization: name is required to advance.
  await page.getByLabel('LEGAL COMPANY NAME').fill('Wizard Test Co');
  await page.getByRole('button', { name: /Next/ }).click();
  // Step 2 — CMMC Target (default Level 2)
  await page.getByRole('button', { name: /Next/ }).click();
  // Step 3 — Primary Contact (optional)
  await page.getByRole('button', { name: /Next/ }).click();
  // Step 4 — Assignment (optional)
  await page.getByRole('button', { name: /Next/ }).click();
  // Step 5 — Review → create
  await page.getByRole('button', { name: /Create Client/ }).click();

  // Lands on the new client's dashboard at a generated id.
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  const clientUrl = page.url();

  // Fresh engagement: 110 'Not Reviewed' controls → 0% readiness.
  const readinessValue = page
    .locator('.w-card.stat')
    .filter({ hasText: 'Readiness' })
    .first()
    .locator('.v');
  await expect(readinessValue).toHaveText('0%');

  // Edit one control to Met on this client's matrix.
  await page.goto(clientUrl + '/controls');
  const rows = page.locator('table.w-table tbody tr');
  await page.getByPlaceholder('Search controls…').fill('3.1.1');
  const select = rows.first().getByLabel('Readiness status');
  await expect(select).toHaveValue('Not Reviewed'); // new-client default
  await select.selectOption('Met');

  // The override is scoped to THIS client's id.
  const newId = clientUrl.split('/clients/')[1];
  const stored = await page.evaluate((id) => {
    const raw = JSON.parse(localStorage.getItem('bf_assessments_v1') ?? '{}') as Record<
      string,
      { status?: string }
    >;
    return raw[`${id}:3.1.1`]?.status;
  }, newId);
  expect(stored).toBe('Met');

  // Back on the dashboard, readiness has moved off 0% (1 of 110 → 1%).
  await page.goto(clientUrl);
  await expect(readinessValue).toHaveText('1%');
});

test('a brand-new client is isolated from the demo client (no data bleed)', async ({ page }) => {
  // Create a second client.
  await page.goto('/clients/new');
  await page.getByLabel('LEGAL COMPANY NAME').fill('Isolated Co');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Next/ }).click();
  await page.getByRole('button', { name: /Create Client/ }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  const isolatedUrl = page.url();

  // The demo client (acme) keeps its seeded readiness; the new one starts empty.
  await page.goto('/clients/acme/controls');
  await expect(page.getByPlaceholder('Search controls…')).toBeVisible();
  await page.getByPlaceholder('Search controls…').fill('3.1.1');
  // Acme's 3.1.1 is 'Met' in the seed — proves the new client did not overwrite it.
  await expect(
    page.locator('table.w-table tbody tr').first().getByLabel('Readiness status'),
  ).toHaveValue('Met');

  // The isolated client's 3.1.1 is still 'Not Reviewed'.
  await page.goto(isolatedUrl + '/controls');
  await page.getByPlaceholder('Search controls…').fill('3.1.1');
  await expect(
    page.locator('table.w-table tbody tr').first().getByLabel('Readiness status'),
  ).toHaveValue('Not Reviewed');
});
