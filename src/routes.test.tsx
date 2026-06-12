/* ============================================================
   Route-mapping tests — the ScreenKey ↔ path tables in routes.tsx:
   every legacy ?screen= key maps to a path, paths round-trip back to
   their key, and app-level redirects (legacy links, unknown client,
   unknown URL) land where they should.
   ============================================================ */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { ReferenceDataProvider } from './data/referenceStore';
import { DataProvider } from './data/store';
import { SCREEN_ROUTES, screenKeyFromPath, screenPath } from './routes';
import type { ScreenKey } from './types';

/* expected path for every legacy key (acme = CURRENT_CLIENT_ID) */
const EXPECTED: Record<ScreenKey, string> = {
  login: '/login',
  dashboard: '/dashboard',
  clients: '/clients',
  'create-client': '/clients/new',
  'client-dashboard': '/clients/acme',
  intake: '/clients/acme/intake',
  path: '/clients/acme/path',
  scope: '/clients/acme/scope',
  'control-library': '/library',
  controls: '/clients/acme/controls',
  'control-detail': '/clients/acme/controls/3.1.1',
  ssp: '/clients/acme/ssp',
  poam: '/clients/acme/poam',
  evidence: '/clients/acme/evidence',
  tasks: '/clients/acme/tasks',
  reports: '/clients/acme/reports',
  'report-preview': '/clients/acme/reports/preview',
  knowledge: '/knowledge',
  audit: '/audit',
  settings: '/settings',
  mobile: '/mobile',
};
const ALL_KEYS = Object.keys(EXPECTED) as ScreenKey[];

describe('screenPath', () => {
  it('maps all 21 legacy screen keys', () => {
    expect(Object.keys(SCREEN_ROUTES)).toHaveLength(21);
    for (const key of ALL_KEYS) expect(screenPath(key)).toBe(EXPECTED[key]);
  });

  it('scopes client screens to the given clientId', () => {
    expect(screenPath('controls', { clientId: 'bravo' })).toBe('/clients/bravo/controls');
    expect(screenPath('client-dashboard', { clientId: 'bravo' })).toBe('/clients/bravo');
  });

  it('resolves control-detail from bf_selected_control (JSON or raw legacy form)', () => {
    localStorage.setItem('bf_selected_control', JSON.stringify('3.5.3'));
    expect(screenPath('control-detail')).toBe('/clients/acme/controls/3.5.3');
    localStorage.setItem('bf_selected_control', '3.13.11');
    expect(screenPath('control-detail')).toBe('/clients/acme/controls/3.13.11');
    localStorage.removeItem('bf_selected_control');
    expect(screenPath('control-detail')).toBe('/clients/acme/controls/3.1.1');
  });
});

describe('screenKeyFromPath', () => {
  it('round-trips every screen key', () => {
    for (const key of ALL_KEYS) expect(screenKeyFromPath(screenPath(key))).toBe(key);
  });

  it('prefers the static /clients/new over /clients/:clientId', () => {
    expect(screenKeyFromPath('/clients/new')).toBe('create-client');
  });

  it('returns null for unknown paths', () => {
    expect(screenKeyFromPath('/')).toBeNull();
    expect(screenKeyFromPath('/nope')).toBeNull();
  });
});

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

describe('app-level routing', () => {
  it('redirects a legacy ?screen= URL to the new path', () => {
    renderAppAt('/?screen=controls');
    expect(window.location.pathname).toBe('/clients/acme/controls');
  });

  it('redirects / to /login when nothing is stored', () => {
    renderAppAt('/');
    expect(window.location.pathname).toBe('/login');
  });

  it('redirects an unknown clientId to /clients', () => {
    renderAppAt('/clients/not-a-client/controls');
    expect(window.location.pathname).toBe('/clients');
  });

  it('shows NotFound with a dashboard link on unknown URLs', () => {
    renderAppAt('/totally/bogus');
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('keeps bf_selected_control in sync when deep-linking a control', () => {
    renderAppAt('/clients/acme/controls/3.1.3');
    expect(screen.getByRole('heading', { name: /^3\.1\.3 — / })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('bf_selected_control') ?? '""')).toBe('3.1.3');
  });
});
