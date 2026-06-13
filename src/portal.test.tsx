/* ============================================================
   Client portal — nav filtering + route guard per role (Task 11).

   Runs in Local Prototype mode (no Supabase env). The Tweaks "View as"
   switcher persists a simulated role to bf_sim_role; AuthProvider reads it
   on mount, so seeding that key reproduces a portal session. The demo
   engagement (acme) is the assigned client for any simulated client role.
   ============================================================ */
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { ReferenceDataProvider } from './data/referenceStore';
import { DataProvider } from './data/store';

function renderAppAt(url: string) {
  window.history.pushState({}, '', url);
  return render(
    <ReferenceDataProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </ReferenceDataProvider>,
  );
}

/** Seed the Local-Prototype simulated role (what the Tweaks switcher writes). */
function simulateRole(role: string) {
  localStorage.setItem('bf_sim_role', role);
}

afterEach(() => {
  localStorage.removeItem('bf_sim_role');
});

const PORTAL_LABELS = ['Dashboard', 'Controls', 'Evidence', 'Documents', 'Knowledge'];
const INTERNAL_ONLY_LABELS = ['Clients', 'POA&M', 'Tasks', 'Audit Log', 'Settings', 'Control Library'];

describe('portal navigation filtering per role', () => {
  it('a client_executive sees the reduced portal nav + the Client Portal badge', () => {
    simulateRole('client_executive');
    renderAppAt('/clients/acme');

    // The unambiguous portal identity marker.
    expect(screen.getByText('Client Portal')).toBeInTheDocument();

    const nav = screen.getByRole('navigation');
    for (const label of PORTAL_LABELS) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
    for (const label of INTERNAL_ONLY_LABELS) {
      expect(within(nav).queryByText(label)).toBeNull();
    }
    // Internal dev affordance is hidden in the portal.
    expect(document.getElementById('screen-launcher')).toBeNull();
  });

  it('the internal staff demo (no simulated role) keeps the full nav', () => {
    renderAppAt('/dashboard');
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('Clients')).toBeInTheDocument();
    expect(within(nav).getByText('Audit Log')).toBeInTheDocument();
    expect(within(nav).getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Client Portal')).toBeNull();
  });

  it('readonly_viewer gets a READ-ONLY control matrix (no editable selects)', () => {
    simulateRole('readonly_viewer');
    renderAppAt('/clients/acme/controls');
    // The editable inline selects (aria-label "Readiness status") are replaced by
    // read-only status badges for client-portal roles.
    expect(screen.queryByLabelText('Readiness status')).toBeNull();
  });

  it('staff DO get the editable control matrix', () => {
    renderAppAt('/clients/acme/controls');
    expect(screen.getAllByLabelText('Readiness status').length).toBeGreaterThan(0);
  });
});

describe('portal route guard (internal screens blocked server-/client-side)', () => {
  it('redirects a client role off an internal route to their dashboard', () => {
    simulateRole('client_executive');
    renderAppAt('/audit');
    expect(window.location.pathname).toBe('/clients/acme');
  });

  it('redirects a client role off the internal dashboard to their dashboard', () => {
    simulateRole('readonly_viewer');
    renderAppAt('/dashboard');
    expect(window.location.pathname).toBe('/clients/acme');
  });

  it('keeps a client role inside their OWN client (cross-client URL → their dashboard)', () => {
    simulateRole('client_executive');
    renderAppAt('/clients/bravo/controls');
    expect(window.location.pathname).toBe('/clients/acme');
  });

  it('allows a client role to reach an in-portal screen (their evidence)', () => {
    simulateRole('evidence_uploader');
    renderAppAt('/clients/acme/evidence');
    expect(window.location.pathname).toBe('/clients/acme/evidence');
  });
});
