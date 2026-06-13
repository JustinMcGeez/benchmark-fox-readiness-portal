/* ============================================================================
   authService.ts — the auth layer's ONLY door to Supabase.

   Everything Supabase-Auth-shaped (session lookup, auth-state subscription,
   password / magic-link sign-in, sign-out) plus the single read of the
   caller's OWN profiles row lives here. AuthProvider consumes this service;
   screens consume AuthProvider via useAuth(). Screens must never touch this
   service or the Supabase client directly (enforced by
   scripts/check-supabase-readonly-integration.mjs).

   Security rules honored here:
     * Tokens are never read, stored, or logged by app code — supabase-js owns
       session persistence + refresh (see supabaseClient.ts).
     * Sign-in failures are collapsed into a small set of GENERIC error kinds;
       none of them reveals whether an email address is registered.
     * Magic-link requests are anti-enumeration: "no such user" style results
       report neutral success, and shouldCreateUser=false stops sign-in
       attempts from creating accounts.
     * No service_role anywhere; the configured client is the anon-key client.
     * READ-ONLY phase: the only table access is a SELECT of the caller's own
       profiles row (RLS-limited by policy profiles_select_own, migration 002).
   ============================================================================ */
import { supabase } from '../lib/supabaseClient';
import type { AuthError, Session } from '../lib/supabaseClient';
import { isSupabaseConfigured } from '../lib/backendConfig';
import type { AppRoleEnum } from '../lib/database.types';

/** True when real Supabase auth is active; false = Local Prototype mode. */
export const authEnabled: boolean = isSupabaseConfigured;

/** The caller's own profile row, app-shaped (camelCase). */
export interface AuthProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: AppRoleEnum;
  organizationId: string | null;
  status: string;
}

/* ---------------------------------------------------------------------------
   Sign-in error kinds + user-facing messages.
   Deliberately GENERIC: 'invalid-credentials' covers wrong password AND
   unknown email identically, so a response never confirms that an address is
   registered. (Supabase itself collapses both into invalid_credentials.)
   --------------------------------------------------------------------------- */
export type SignInErrorKind =
  | 'invalid-credentials'
  | 'email-not-confirmed'
  | 'rate-limited'
  | 'auth-disabled'
  | 'unknown';

export type SignInResult = { ok: true } | { ok: false; error: SignInErrorKind };

const SIGN_IN_ERROR_MESSAGES: Record<SignInErrorKind, string> = {
  'invalid-credentials': 'Incorrect email or password.',
  'email-not-confirmed':
    'This account has not confirmed its email address yet. Check your inbox for the confirmation link.',
  'rate-limited': 'Too many attempts. Please wait a moment and try again.',
  'auth-disabled': 'Authentication is not configured in this environment.',
  unknown: 'Sign-in failed. Please try again.',
};

/** The inline message a screen shows for a sign-in failure. */
export function signInErrorMessage(kind: SignInErrorKind): string {
  return SIGN_IN_ERROR_MESSAGES[kind];
}

/* Map a Supabase AuthError onto a generic kind. Never log the error object —
   keep auth failures out of the console entirely. */
function classifyAuthError(error: Pick<AuthError, 'code' | 'status'>): SignInErrorKind {
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalid-credentials';
    case 'email_not_confirmed':
      return 'email-not-confirmed';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'rate-limited';
    default:
      break;
  }
  if (error.status === 429) return 'rate-limited';
  if (error.status === 400) return 'invalid-credentials';
  return 'unknown';
}

/* ---------------------------------------------------------------------------
   Session lifecycle
   --------------------------------------------------------------------------- */

/** The persisted session, if supabase-js restored one. Null in local mode. */
export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Subscribe to auth state changes. Returns the unsubscribe function. */
export function onAuthStateChange(handler: (session: Session | null) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session));
  return () => data.subscription.unsubscribe();
}

/* ---------------------------------------------------------------------------
   Sign-in / sign-out
   --------------------------------------------------------------------------- */

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ session: Session | null; error: SignInErrorKind | null }> {
  if (!supabase) return { session: null, error: 'auth-disabled' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { session: null, error: classifyAuthError(error) };
  return { session: data.session, error: null };
}

export async function signInWithMagicLink(
  email: string,
): Promise<{ error: SignInErrorKind | null }> {
  if (!supabase) return { error: 'auth-disabled' };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Never create an account from a sign-in attempt; new users are
      // provisioned through Supabase Auth invites/signup, not this form.
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
  if (!error) return { error: null };
  const kind = classifyAuthError(error);
  // Surface only throttling and genuine server faults. Every 4xx (including
  // "no such user" / "signups not allowed") reports NEUTRAL SUCCESS so the
  // response never confirms whether an address is registered; the screen
  // shows "if an account exists…" either way.
  if (kind === 'rate-limited') return { error: kind };
  if ((error.status ?? 0) >= 500) return { error: 'unknown' };
  return { error: null };
}

/** Sign out. supabase-js clears ONLY its own persisted auth state (its sb-*
    storage key); the bf_* demo/localStorage data keys are never touched. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/* ---------------------------------------------------------------------------
   Profile (role) lookup — SELECT of the caller's own row only.
   --------------------------------------------------------------------------- */

/**
 * Fetch the signed-in user's own profiles row. Returns null when no row
 * exists; throws on a failed read (caller degrades to signed-in-without-role).
 * The thrown error is deliberately detail-free — no backend internals leak.
 */
export async function fetchOwnProfile(userId: string): Promise<AuthProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, email, role, organization_id, status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('profile-fetch-failed');
  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id ?? userId,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    organizationId: data.organization_id,
    status: data.status,
  };
}
