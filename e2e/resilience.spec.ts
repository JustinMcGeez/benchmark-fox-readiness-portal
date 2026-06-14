/* ============================================================
   Resilience — losing the network mid-session surfaces the connectivity
   banner and the app keeps working (no crash). Runs in Local Prototype mode
   (the default e2e mode), where edits persist to localStorage even offline.
   ============================================================ */
import { expect, test } from '@playwright/test';

test('going offline mid-session shows the connectivity banner and does not crash', async ({
  page,
  context,
}) => {
  await page.goto('/clients/acme/controls');
  const rows = page.locator('table.w-table tbody tr');
  await expect(rows).toHaveCount(110);

  // Kill the network mid-session.
  await context.setOffline(true);
  await expect(page.getByTestId('connectivity-banner')).toBeVisible();

  // The app is still responsive while offline — search still filters, no crash.
  await page.getByPlaceholder('Search controls…').fill('3.1.1');
  await expect(rows).toHaveCount(11);
  // The shell / page is intact (no app-level "Something went wrong" boundary).
  await expect(page.getByText('Something went wrong')).toHaveCount(0);

  // Reconnect — the banner clears.
  await context.setOffline(false);
  await expect(page.getByTestId('connectivity-banner')).toHaveCount(0);
});
