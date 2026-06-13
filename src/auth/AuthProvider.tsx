/* ============================================================
   AuthProvider — app-wide auth state (Task 03, Supabase Auth).

   Wraps the app and exposes { session, profile, role, loading,
   signInWithPassword, signInWithMagicLink, signOut } via useAuth().
   All Supabase access flows through src/services/authService.ts;
   screens only ever talk to this context.

   Two modes:
     * Local Prototype (no Supabase env vars): isConfigured=false,
       loading=false, no session/profile — guards render children
       freely and the Login screen keeps its demo behavior.
     * Supabase-backed: subscribes to auth state changes, restores
       the persisted session, and fetches the caller's own profiles
       row after sign-in. The window where a session exists but the
       profile row is still loading is an explicit loading state; a
       FAILED profile read degrades to signed-in-without-role (with
       a console warning), never a crash.
   ============================================================ */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '../lib/supabaseClient';
import type { AppRoleEnum } from '../lib/database.types';
import {
  authEnabled,
  fetchOwnProfile,
  getCurrentSession,
  onAuthStateChange,
  signInWithMagicLink as requestMagicLink,
  signInWithPassword as requestPasswordSignIn,
  signOut as requestSignOut,
  type AuthProfile,
  type SignInResult,
} from '../services/authService';
import { logEvent } from '../lib/audit';

export { signInErrorMessage } from '../services/authService';
export type { AuthProfile, SignInErrorKind, SignInResult } from '../services/authService';

/** Human labels for the app_role enum (role badges etc.). */
export const ROLE_LABELS: Record<AppRoleEnum, string> = {
  benchmark_fox_admin: 'Benchmark Fox Admin',
  benchmark_fox_consultant: 'Benchmark Fox Consultant',
  client_executive: 'Client Executive',
  client_it_owner: 'Client IT Owner',
  evidence_uploader: 'Evidence Uploader',
  readonly_viewer: 'Read-only Viewer',
};

export interface AuthContextValue {
  /** True when Supabase env vars are set; false = Local Prototype mode. */
  isConfigured: boolean;
  session: Session | null;
  profile: AuthProfile | null;
  role: AppRoleEnum | null;
  /** True until the initial session is restored, or while a signed-in
      caller's profile row is still being fetched. Always false in
      Local Prototype mode. */
  loading: boolean;
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  signInWithMagicLink(email: string): Promise<SignInResult>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  // Local mode is "ready" immediately; Supabase mode waits for getSession().
  const [sessionReady, setSessionReady] = useState(!authEnabled);
  const [profilePending, setProfilePending] = useState(false);

  /* Restore the persisted session and track auth state changes. */
  useEffect(() => {
    if (!authEnabled) return;
    let active = true;
    getCurrentSession()
      .then((s) => {
        if (!active) return;
        setSession(s);
        setSessionReady(true);
      })
      .catch(() => {
        if (active) setSessionReady(true); // treat as signed out, never crash
      });
    const unsubscribe = onAuthStateChange((s) => {
      setSession(s);
      setSessionReady(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  /* Fetch the caller's own profile whenever the signed-in user changes.
     The `active` flag drops stale responses if the user changes mid-fetch. */
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!authEnabled) return;
    if (!userId) {
      setProfile(null);
      setProfilePending(false);
      return;
    }
    let active = true;
    setProfilePending(true);
    fetchOwnProfile(userId)
      .then((p) => {
        if (!active) return;
        if (!p) {
          console.warn('[auth] Signed in, but no profile row exists yet — continuing without a role.');
        }
        setProfile(p);
        setProfilePending(false);
      })
      .catch(() => {
        if (!active) return;
        console.warn('[auth] Signed in, but the profile lookup failed — continuing without a role.');
        setProfile(null);
        setProfilePending(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const { session: s, error } = await requestPasswordSignIn(email, password);
      if (error) return { ok: false, error };
      // Adopt the session immediately so post-sign-in navigation never races
      // the onAuthStateChange event.
      if (s) setSession(s);
      // Audit the sign-in (fire-and-forget; the session persists, no race).
      void logEvent('auth.signed_in');
      return { ok: true };
    },
    [],
  );

  const signInWithMagicLink = useCallback(async (email: string): Promise<SignInResult> => {
    const { error } = await requestMagicLink(email);
    return error ? { ok: false, error } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    // Audit the sign-out while the session is still valid (the RLS INSERT needs
    // it); logEvent never throws, so a slow/failed insert can't block sign-out.
    await logEvent('auth.signed_out');
    // Clears ONLY Supabase's own persisted auth state; the bf_* demo data
    // keys in localStorage are never touched.
    await requestSignOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: authEnabled,
      session,
      profile,
      role: profile?.role ?? null,
      loading: authEnabled && (!sessionReady || profilePending),
      signInWithPassword,
      signInWithMagicLink,
      signOut,
    }),
    [session, profile, sessionReady, profilePending, signInWithPassword, signInWithMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

/**
 * Like useAuth(), but returns null instead of throwing when there is no
 * <AuthProvider> above (e.g. DataProvider mounted bare in unit tests).
 * Used by the repository selection seam to default to Local Prototype mode.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
