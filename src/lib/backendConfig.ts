/* ============================================================================
   backendConfig.ts — which backend mode the app runs in.

   Two modes (this phase is READ-ONLY reference data; no client writes, no auth):
     * 'local'                  — default. Uses the generated TypeScript data +
                                  localStorage. Active when Supabase env vars
                                  are NOT set.
     * 'supabase-reference-read'— active when VITE_SUPABASE_URL and
                                  VITE_SUPABASE_ANON_KEY are set. The app may
                                  READ global reference data from Supabase and
                                  show connection status. Client-specific edits
                                  (intake/scope/assessments/evidence/POA&M/tasks/
                                  reports) still use localStorage.

   This module never throws and never connects — it only reports configuration.
   ============================================================================ */
import { isSupabaseConfigured as supabaseClientConfigured } from './supabaseClient';

/** True when both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present. */
export const isSupabaseConfigured: boolean = supabaseClientConfigured;

export type BackendMode = 'local' | 'supabase-reference-read';

/** The active backend mode, derived purely from configuration. */
export const backendMode: BackendMode = isSupabaseConfigured
  ? 'supabase-reference-read'
  : 'local';

export interface BackendStatus {
  mode: BackendMode;
  /** Human label for the mode. */
  modeLabel: string;
  supabaseConfigured: boolean;
  /** Short description suitable for a status card. */
  description: string;
}

const LOCAL_DESCRIPTION =
  'Running in local prototype mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
  'to enable read-only Supabase reference data.';

const SUPABASE_DESCRIPTION =
  'Supabase is configured. Global reference data may be read from Supabase, with ' +
  'automatic fallback to local generated data. Client edits still use localStorage.';

/**
 * Short build identifier for the Backend Status (/health) surface. The full git
 * SHA is injected as VITE_BUILD_SHA by CI (deploy.yml / vercel.json buildCommand);
 * when it is absent (local dev) this returns the 'dev' sentinel.
 */
export function getBuildSha(): string {
  const sha = import.meta.env.VITE_BUILD_SHA?.trim();
  return sha ? sha.slice(0, 7) : 'dev';
}

/** Snapshot of the current backend configuration. Safe to call anytime. */
export function getBackendStatus(): BackendStatus {
  return {
    mode: backendMode,
    modeLabel: backendMode === 'supabase-reference-read' ? 'Supabase Reference Read' : 'Local Prototype',
    supabaseConfigured: isSupabaseConfigured,
    description: isSupabaseConfigured ? SUPABASE_DESCRIPTION : LOCAL_DESCRIPTION,
  };
}
