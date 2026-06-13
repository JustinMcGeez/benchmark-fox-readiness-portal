/* ============================================================================
   audit.ts — app-level audit events (sign-in / sign-out and future workflow
   actions). Data-CHANGE events are captured by database triggers (migration
   005); this module is for events that have no row mutation to hang a trigger
   on.

   The actual INSERT is delegated to the repository (appendAuditEvent) so the
   single-writer rule holds: src/data/repository/supabaseRepository.ts is the
   only app-runtime file that writes to the backend
   (scripts/check-supabase-readonly-integration.mjs enforces this). The DB
   stamps the actor (user_id + actor_name) from the session, so callers never
   pass identity.

   logEvent NEVER throws and NEVER blocks the user action: in Local Prototype
   mode it is a no-op, and a failed insert is swallowed (audit logging must not
   break sign-in / sign-out).
   ============================================================================ */
import { isSupabaseConfigured } from './backendConfig';
import { appendAuditEvent } from '../data/repository/supabaseRepository';

export interface AuditEventMeta {
  /** Domain client id or uuid; omitted/null for global events (e.g. auth). */
  clientId?: string | null;
}

/** Record an app-level audit event. Fire-and-forget; safe in any mode. */
export async function logEvent(action: string, meta: AuditEventMeta = {}): Promise<void> {
  if (!isSupabaseConfigured) return; // Local Prototype mode: nothing to write.
  try {
    await appendAuditEvent({ action, clientId: meta.clientId ?? null });
  } catch {
    // Audit logging is best-effort — never surface or rethrow.
  }
}
