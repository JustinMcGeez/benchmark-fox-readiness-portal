/* ============================================================
   Playwright — POA&M .xlsx + SPRS .pdf generation in Local Prototype mode
   (Task 10). Create a fresh client, open each pre-flight summary from the
   Reports screen, and confirm "Generate" runs the full in-browser pipeline
   (lazy exceljs / @react-pdf renderer → saveAs) with no error surfaced.

   As with the SSP e2e, file-saver clicks a detached anchor that headless
   Chromium accepts but does not surface to Playwright as a download event;
   byte-level output is covered by the xlsx unit test (exceljs in node) and the
   pdf document-definition unit test.
   ============================================================ */
import { expect, test } from '@playwright/test';

async function createClient(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/clients/new');
  await page.getByLabel('LEGAL COMPANY NAME').fill('Reports Export Co');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Next/ }).click();
  await page.getByRole('button', { name: /Create Client/ }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  return page.url();
}

test('Reports screen exposes all three live deliverable triggers', async ({ page }) => {
  const clientUrl = await createClient(page);
  await page.goto(clientUrl + '/reports');
  await expect(page.getByRole('button', { name: 'Generate SSP (.docx)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate POA&M (.xlsx)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate SPRS Report (.pdf)' })).toBeVisible();
});

test('Reports → POA&M pre-flight → Generate runs the in-browser pipeline', async ({ page }) => {
  const clientUrl = await createClient(page);
  await page.goto(clientUrl + '/reports');

  await page.getByRole('button', { name: 'Generate POA&M (.xlsx)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Generate POA&M (.xlsx)' });
  await expect(dialog).toBeVisible();
  // exact: true — getByText is a case-insensitive substring match by default, and
  // these labels also appear (lowercased) inside the descriptive note paragraph.
  await expect(dialog.getByText('OPEN ITEMS', { exact: true })).toBeVisible();
  await expect(dialog.getByText('SHEETS', { exact: true })).toBeVisible();

  // Generate → lazy exceljs renderer builds the workbook + saveAs() runs; on
  // success the dialog closes with no error. The generous timeout covers the
  // first-time lazy load of the heavy renderer chunk.
  await dialog.getByRole('button', { name: 'Generate workbook' }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
  await expect(page.getByText('Could not generate the POA&M workbook.')).toHaveCount(0);
});

test('Reports → SPRS report pre-flight → Generate runs the in-browser pipeline', async ({
  page,
}) => {
  const clientUrl = await createClient(page);
  await page.goto(clientUrl + '/reports');

  await page.getByRole('button', { name: 'Generate SPRS Report (.pdf)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Generate SPRS Report (.pdf)' });
  await expect(dialog).toBeVisible();
  // exact: true — see the POA&M test; 'READINESS' also appears in the note text.
  await expect(dialog.getByText('EST. SPRS', { exact: true })).toBeVisible();
  await expect(dialog.getByText('READINESS', { exact: true })).toBeVisible();

  // Generate → lazy @react-pdf renderer chunk builds the PDF + saveAs() runs; on
  // success the dialog closes with no error. The generous timeout covers the
  // first-time lazy load + render of the heavy renderer chunk.
  await dialog.getByRole('button', { name: 'Generate report' }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
  await expect(page.getByText('Could not generate the SPRS report.')).toHaveCount(0);
});
