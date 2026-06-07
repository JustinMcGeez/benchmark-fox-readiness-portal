/* ============================================================================
   Supabase client — PLACEHOLDER (not yet wired into the app).

   This exports a typed Supabase client for the FUTURE backend integration. The
   running app still uses the TypeScript seed data + localStorage via
   src/data/store.ts — importing this module does NOT change any app behavior,
   and nothing reads from Supabase yet.

   Configuration (see .env.example):
     VITE_SUPABASE_URL       — your Supabase project URL
     VITE_SUPABASE_ANON_KEY  — your Supabase anon (public) key

   If either var is missing we DO NOT throw at import time — we warn once and
   leave the client null, so the app keeps working on localStorage. Code that
   actually needs the backend should call `getSupabase()`, which fails loudly
   with a helpful message only at the point of use.
   ============================================================================ */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

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
