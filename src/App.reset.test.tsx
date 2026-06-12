/* ============================================================
   App-level test for the reset-to-seed developer action: clicking
   "Reset demo data" (Tweaks panel) clears the persisted bf_* keys
   the action targets. NOTE: the current implementation does not
   clear bf_intake_v1 / bf_scope_v1 (known gap, out of scope here);
   this test pins the actual behavior.
   ============================================================ */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { ReferenceDataProvider } from './data/referenceStore';
import { DataProvider } from './data/store';

const RESET_KEYS = ['bf_assessments_v1', 'bf_selected_control', 'bf_screen', 'bf_tweaks'];

describe('reset to seed', () => {
  it('clears the persisted bf_* keys', async () => {
    localStorage.setItem('bf_assessments_v1', JSON.stringify({ 'acme:3.1.1': { status: 'Not Met' } }));
    localStorage.setItem('bf_selected_control', '3.1.1');
    localStorage.setItem('bf_screen', 'login');
    localStorage.setItem('bf_tweaks', JSON.stringify({ density: 'dense' }));

    render(
      <ReferenceDataProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </ReferenceDataProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open tweaks' }));
    // jsdom logs a "navigation not implemented" error for the reload that
    // follows — harmless; the assertions below are about storage.
    await user.click(screen.getByRole('button', { name: /Reset demo data/ }));

    for (const key of RESET_KEYS) expect(localStorage.getItem(key)).toBeNull();
  });
});
