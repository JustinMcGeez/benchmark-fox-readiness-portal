/* ============================================================
   Repository selection tests — the configured × authenticated matrix.
   Supabase mode requires BOTH env configured AND an active session;
   every other combination (including no AuthProvider) is Local mode.
   ============================================================ */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const cfg = vi.hoisted(() => ({ configured: false }));
const authHolder = vi.hoisted(() => ({ session: null as unknown }));

vi.mock('../../lib/supabaseClient', () => ({
  get isSupabaseConfigured() {
    return cfg.configured;
  },
  getSupabase: () => {
    throw new Error('not used in selection tests');
  },
}));

vi.mock('../../auth/AuthProvider', () => ({
  useOptionalAuth: () => (authHolder.session ? { session: authHolder.session } : null),
}));

const { useRepository } = await import('./index');
const { localRepository } = await import('./localRepository');
const { supabaseRepository } = await import('./supabaseRepository');

function select(configured: boolean, session: unknown) {
  cfg.configured = configured;
  authHolder.session = session;
  return renderHook(() => useRepository()).result.current;
}

const A_SESSION = { user: { id: 'user-1' } };

afterEach(() => {
  cfg.configured = false;
  authHolder.session = null;
});

describe('useRepository selection', () => {
  it('picks supabase only when configured AND authenticated', () => {
    const sel = select(true, A_SESSION);
    expect(sel.mode).toBe('supabase');
    expect(sel.repository).toBe(supabaseRepository);
  });

  it('falls back to local when configured but not authenticated', () => {
    const sel = select(true, null);
    expect(sel.mode).toBe('local');
    expect(sel.repository).toBe(localRepository);
  });

  it('falls back to local when authenticated but not configured', () => {
    const sel = select(false, A_SESSION);
    expect(sel.mode).toBe('local');
    expect(sel.repository).toBe(localRepository);
  });

  it('falls back to local when neither configured nor authenticated', () => {
    const sel = select(false, null);
    expect(sel.mode).toBe('local');
    expect(sel.repository).toBe(localRepository);
  });

  it('defaults to local mode when there is no AuthProvider (session null)', () => {
    // useOptionalAuth returns null with no provider — same path as no session.
    const sel = select(true, null);
    expect(sel.mode).toBe('local');
  });
});
