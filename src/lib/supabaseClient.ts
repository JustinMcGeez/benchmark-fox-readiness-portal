/* ============================================================================
   Supabase client — typed, configuration-gated, READ-ONLY app data.

   In the current phase this client is used ONLY to:
     - READ global reference data (control families, controls, source
       references, control/source mappings) via the service/hook/provider layer:
         referenceDataService → useReferenceData → ReferenceDataProvider
     - AUTHENTICATE (Supabase Auth) and READ the caller's own profiles row via
       the auth layer (Task 03):
         authService → AuthProvider → useAuth
   Those layers are the ONLY approved app paths to Supabase — screens and other
   components must not import or query this client directly (enforced by
   scripts/check-supabase-readonly-integration.mjs).

   Configuration-gated (see .env.example):
     VITE_SUPABASE_URL       — your Supabase project URL
     VITE_SUPABASE_ANON_KEY  — your Supabase anon (public) key
   If either var is missing the app stays in LOCAL mode: this module warns once
   and leaves the client `null`, the reference-data layer falls back to the
   local generated data, and auth is disabled (Local Prototype mode). Nothing
   throws at import time.

   NOT implemented in this phase: client-specific WRITES of any kind. Assessments,
   intake, scope, evidence metadata, POA&M, tasks, and reports remain in
   localStorage (src/data/store.ts). No CUI and no evidence/SSP/POA&M/report
   files are stored in Supabase. Client writes are a later phase.

   Auth/session security: supabase-js owns session persistence + auto-refresh
   (persistSession/autoRefreshToken below). App code never reads, writes, or
   logs tokens, and never stores them manually.
   ============================================================================ */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/* Auth types re-exported so the rest of src/ never imports the SDK directly
   (the readonly-integration check allows the SDK import only in this file). */
export type { AuthChangeEvent, AuthError, Session, User } from '@supabase/supabase-js';

export type AppSupabaseClient = SupabaseClient<Database>;

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** True when both env vars are present — backend calls are safe to attempt. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * The shared client, or `null` when env vars are missing. Prefer `getSupabase()`
 * in code paths that require the backend so the failure mode is explicit.
 */
export const supabase: AppSupabaseClient | null = isSupabaseConfigured
  ? createClient<Database>(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

if (!isSupabaseConfigured && typeof console !== 'undefined') {
  // Warn, don't crash — the MVP intentionally runs without Supabase configured.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'The app continues on localStorage; backend calls are disabled. ' +
      'See .env.example and docs/backend/supabase-architecture.md.',
  );
}

/**
 * Returns the configured client or throws a clear error. Use this in code that
 * genuinely needs the backend, so a missing configuration surfaces at the call
 * site instead of as a null-deref later.
 */
export function getSupabase(): AppSupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_ANON_KEY (see .env.example) before using backend features.',
    );
  }
  return supabase;
}
