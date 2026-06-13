/* ============================================================
   AuthProvider unit tests — mocked Supabase client (Task 03).

   The supabaseClient module is mocked as CONFIGURED, so the provider
   runs in real-auth mode against a fake client. Covers: sign-in
   success (session + profile/role exposed), sign-in failure (generic
   error, stays signed out), sign-out (clears auth state but never the
   bf_* demo keys), profile fetch failure (degrades to signed-in
   without a role, with a warning, not a crash), and magic-link
   anti-enumeration behavior.
   ============================================================ */
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, signInErrorMessage, useAuth, type AuthContextValue } from './AuthProvider';

/* ---------- fake supabase client (hoisted for the module mock) ---------- */
const fake = vi.hoisted(() => {
  const session = {
    access_token: 'redacted',
    user: { id: 'user-1', email: 'consultant@benchmarkfox.com' },
  };
  const profileRow = {
    id: 'profile-1',
    user_id: 'user-1',
    full_name: 'Casey Consultant',
    email: 'consultant@benchmarkfox.com',
    role: 'benchmark_fox_consultant',
    organization_id: 'org-1',
    status: 'Active',
  };
  const getSession = vi.fn();
  const onAuthStateChange = vi.fn();
  const signInWithPassword = vi.fn();
  const signInWithOtp = vi.fn();
  const signOut = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    session,
    profileRow,
    getSession,
    onAuthStateChange,
    signInWithPassword,
    signInWithOtp,
    signOut,
    maybeSingle,
    eq,
    select,
    from,
  };
});

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: fake.getSession,
      onAuthStateChange: fake.onAuthStateChange,
      signInWithPassword: fake.signInWithPassword,
      signInWithOtp: fake.signInWithOtp,
      signOut: fake.signOut,
    },
    from: fake.from,
  },
  getSupabase: () => {
    throw new Error('not used in these tests');
  },
}));

/* ---------- probe: exposes the context value + a few rendered fields ---------- */
let auth!: AuthContextValue;

function Probe() {
  auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="email">{auth.session?.user?.email ?? 'none'}</span>
      <span data-testid="role">{auth.role ?? 'none'}</span>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const authError = (code: string, status: number) => ({
  name: 'AuthApiError',
  message: 'redacted-by-test',
  code,
  status,
});

beforeEach(() => {
  vi.clearAllMocks();
  fake.getSession.mockResolvedValue({ data: { session: null }, error: null });
  fake.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  fake.signInWithPassword.mockResolvedValue({
    data: { session: fake.session, user: fake.session.user },
    error: null,
  });
  fake.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  fake.signOut.mockResolvedValue({ error: null });
  fake.maybeSingle.mockResolvedValue({ data: fake.profileRow, error: null });
});

describe('AuthProvider (mocked supabase client)', () => {
  it('signs in with password: exposes the session, then the fetched profile/role', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    let result: Awaited<ReturnType<AuthContextValue['signInWithPassword']>> | undefined;
    await act(async () => {
      result = await auth.signInWithPassword('consultant@benchmarkfox.com', 'pw');
    });

    expect(result).toEqual({ ok: true });
    expect(fake.signInWithPassword).toHaveBeenCalledWith({
      email: 'consultant@benchmarkfox.com',
      password: 'pw',
    });
    expect(screen.getByTestId('email')).toHaveTextContent('consultant@benchmarkfox.com');
    await waitFor(() =>
      expect(screen.getByTestId('role')).toHaveTextContent('benchmark_fox_consultant'),
    );
    // own-profile read, scoped by user_id
    expect(fake.from).toHaveBeenCalledWith('profiles');
    expect(fake.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('sign-in failure returns a generic error kind and stays signed out', async () => {
    fake.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: authError('invalid_credentials', 400),
    });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    let result: Awaited<ReturnType<AuthContextValue['signInWithPassword']>> | undefined;
    await act(async () => {
      result = await auth.signInWithPassword('whoever@example.com', 'wrong');
    });

    expect(result).toEqual({ ok: false, error: 'invalid-credentials' });
    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(screen.getByTestId('role')).toHaveTextContent('none');
    // The user-facing message is generic: it never confirms whether the email
    // is registered (wrong-password and unknown-email read identically).
    expect(signInErrorMessage('invalid-credentials')).toBe('Incorrect email or password.');
  });

  it('rate-limited sign-in maps to the rate-limited error kind', async () => {
    fake.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: authError('over_request_rate_limit', 429),
    });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    let result: Awaited<ReturnType<AuthContextValue['signInWithPassword']>> | undefined;
    await act(async () => {
      result = await auth.signInWithPassword('a@b.com', 'pw');
    });
    expect(result).toEqual({ ok: false, error: 'rate-limited' });
  });

  it('sign-out clears auth state but never touches bf_* demo data keys', async () => {
    localStorage.setItem('bf_assessments_v1', '{"acme:3.1.1":{"status":"Not Met"}}');
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      await auth.signInWithPassword('consultant@benchmarkfox.com', 'pw');
    });
    await waitFor(() =>
      expect(screen.getByTestId('role')).toHaveTextContent('benchmark_fox_consultant'),
    );

    await act(async () => {
      await auth.signOut();
    });

    expect(fake.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(screen.getByTestId('role')).toHaveTextContent('none');
    expect(localStorage.getItem('bf_assessments_v1')).toBe('{"acme:3.1.1":{"status":"Not Met"}}');
  });

  it('profile fetch failure degrades to signed-in-without-role with a warning, not a crash', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fake.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    let result: Awaited<ReturnType<AuthContextValue['signInWithPassword']>> | undefined;
    await act(async () => {
      result = await auth.signInWithPassword('consultant@benchmarkfox.com', 'pw');
    });

    expect(result).toEqual({ ok: true });
    // Still signed in, no role, loading settled — and a warning was logged.
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('email')).toHaveTextContent('consultant@benchmarkfox.com');
    expect(screen.getByTestId('role')).toHaveTextContent('none');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[auth]'));
    warn.mockRestore();
  });

  it('restores a persisted session on mount and fetches its profile', async () => {
    fake.getSession.mockResolvedValue({ data: { session: fake.session }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('email')).toHaveTextContent('consultant@benchmarkfox.com');
    await waitFor(() =>
      expect(screen.getByTestId('role')).toHaveTextContent('benchmark_fox_consultant'),
    );
  });

  it('magic link: "no such user" reports neutral success (no account enumeration); rate limit surfaces', async () => {
    // Supabase rejects unknown users when shouldCreateUser=false — that must
    // NOT be distinguishable from success by the caller.
    fake.signInWithOtp.mockResolvedValue({
      data: {},
      error: authError('otp_disabled', 422),
    });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    let result: Awaited<ReturnType<AuthContextValue['signInWithMagicLink']>> | undefined;
    await act(async () => {
      result = await auth.signInWithMagicLink('not-a-user@example.com');
    });
    expect(result).toEqual({ ok: true });
    expect(fake.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'not-a-user@example.com',
        options: expect.objectContaining({ shouldCreateUser: false }),
      }),
    );

    fake.signInWithOtp.mockResolvedValue({
      data: {},
      error: authError('over_email_send_rate_limit', 429),
    });
    await act(async () => {
      result = await auth.signInWithMagicLink('not-a-user@example.com');
    });
    expect(result).toEqual({ ok: false, error: 'rate-limited' });
  });
});
