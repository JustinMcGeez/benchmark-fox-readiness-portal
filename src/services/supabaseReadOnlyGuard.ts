/* ============================================================================
   supabaseReadOnlyGuard.ts — central read-only policy for this backend phase.

   MVP Phase: Supabase reference data reads only. Do not write client data,
   evidence metadata, POA&M items, tasks, reports, or CUI through Supabase yet.

   This module is the single documented place describing what the Supabase layer
   is permitted to do in this phase, plus helpers that THROW if a write is
   attempted through the integration layer. It is a guard rail, not a security
   boundary — real enforcement is Postgres Row Level Security in a later phase.
   ============================================================================ */

/** Operations the Supabase layer may perform in this phase. */
export const ALLOWED_SUPABASE_OPERATIONS = ['select', 'rpc:read', 'health'] as const;
export type AllowedSupabaseOperation = (typeof ALLOWED_SUPABASE_OPERATIONS)[number];

/** Write-style operations that are explicitly forbidden in this phase. */
export const FORBIDDEN_SUPABASE_OPERATIONS = [
  'insert',
  'update',
  'upsert',
  'delete',
] as const;

/**
 * Throws if `operation` is not a permitted read. Call this at the top of any
 * service function that talks to Supabase, so an accidental write attempt fails
 * loudly and early instead of mutating data.
 */
export function assertReadOnly(operation: string): void {
  if ((FORBIDDEN_SUPABASE_OPERATIONS as readonly string[]).includes(operation)) {
    throw new Error(
      `[supabaseReadOnlyGuard] Write operation "${operation}" is not allowed in the ` +
        'read-only reference-data phase. Client data, evidence, POA&M, tasks, ' +
        'reports, and CUI must NOT be written through Supabase yet.',
    );
  }
  if (!(ALLOWED_SUPABASE_OPERATIONS as readonly string[]).includes(operation)) {
    throw new Error(
      `[supabaseReadOnlyGuard] Operation "${operation}" is not on the allow-list ` +
        `(${ALLOWED_SUPABASE_OPERATIONS.join(', ')}).`,
    );
  }
}

/** True if the operation is a permitted read (non-throwing variant). */
export function isReadOnlyOperation(operation: string): operation is AllowedSupabaseOperation {
  return (ALLOWED_SUPABASE_OPERATIONS as readonly string[]).includes(operation);
}
