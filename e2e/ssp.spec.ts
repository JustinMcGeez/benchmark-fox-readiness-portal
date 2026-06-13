/* ============================================================
   Playwright — SSP .docx generation in Local Prototype mode (Task 09).
   Create a fresh client (all 110 controls Not Reviewed → 110 placeholders),
   open the pre-flight summary from the SSP Workspace, and confirm "Generate
   anyway" downloads a .docx. Also confirms the Reports screen exposes the same
   trigger.
   ============================================================ */
import { expect, test } from '@playwright/test';

async function createClient(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/clients/new');
  await page.getByLabel('LEGAL COMPANY NAME').fill('SSP Export Co');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Next/ }).click();
  await page.getByRole('button', { name: /Create Client/ }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  return page.url();
}

test('SSP Workspace pre-flight → Generate anyway runs the full in-browser pipeline', async ({
  page,
}) => {
  const clientUrl = await createClient(page);
  await page.goto(clientUrl + '/ssp');

  await page.getByRole('button', { name: 'Generate SSP (.docx)' }).click();

  // Pre-flight summary: a brand-new client has 110 placeholder controls.
  const dialog = page.getByRole('dialog', { name: 'Generate SSP' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('PLACEHOLDERS')).toBeVisible();
  await expect(dialog.getByText(/110 of 110 controls have no implementation statement/)).toBeVisible();

  // Generate anyway → the lazy docx renderer loads, builds the 110-section
  // document, and saveAs() runs. On success the dialog closes with no error.
  // (file-saver clicks a detached anchor that headless Chromium accepts but does
  // not surface to Playwright as a download event; the byte-level Blob output is
  // covered by the sspDocx unit test.)
  await dialog.getByRole('button', { name: 'Generate anyway' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Could not generate the SSP document.')).toHaveCount(0);
});

test('Reports screen exposes the same Generate SSP trigger', async ({ page }) => {
  const clientUrl = await createClient(page);
  await page.goto(clientUrl + '/reports');
  await expect(page.getByRole('button', { name: 'Generate SSP (.docx)' })).toBeVisible();
});
