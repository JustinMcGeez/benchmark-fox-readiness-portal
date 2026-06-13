/* ============================================================
   roles.ts — role classification + capability rules (Task 11).

   PURE module (no React, no Supabase): the single source of truth for
   "which roles are client-portal roles" and "what may a given role DO".
   Consumed by the AuthProvider, the route guard, the data store, and the
   screens (via usePermissions in auth/permissions.ts).

   Capability convention — `role === null`:
     * Supabase mode (isConfigured = true): a null role means signed-in
       WITHOUT a profile/role → NO elevated access (fail closed).
     * Local Prototype mode (isConfigured = false): a null role means the
       internal staff demo (no simulated role) → FULL access, exactly the
       behavior before this task. The Tweaks role switcher sets a simulated
       client role to preview the portal.
   That is why every capability takes `isConfigured` alongside `role`.
   ============================================================ */
import type { AppRoleEnum } from '../lib/database.types';

/** Benchmark Fox internal staff roles (full, cross-client tooling). */
export const STAFF_ROLES = ['benchmark_fox_admin', 'benchmark_fox_consultant'] as const;

/** Client-side roles — restricted to a single assigned engagement (the portal). */
export const CLIENT_ROLES = [
  'client_executive',
  'client_it_owner',
  'evidence_uploader',
  'readonly_viewer',
] as const;

/** Every app role (staff + client). */
export const APP_ROLES = [...STAFF_ROLES, ...CLIENT_ROLES] as const;

export function isAppRole(value: string | null | undefined): value is AppRoleEnum {
  return !!value && (APP_ROLES as readonly string[]).includes(value);
}

export function isStaffRole(role: AppRoleEnum | null | undefined): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

/** True for the four client-portal roles. Drives the reduced portal experience. */
export function isClientRole(role: AppRoleEnum | null | undefined): boolean {
  return !!role && (CLIENT_ROLES as readonly string[]).includes(role);
}

/**
 * A Benchmark Fox internal user — full tooling. Staff always qualify; in Local
 * Prototype mode a null role (no simulated role) is the internal staff demo.
 */
export function isInternalUser(role: AppRoleEnum | null, isConfigured: boolean): boolean {
  return isStaffRole(role) || (!isConfigured && role === null);
}

/* ---- capabilities (the single rule set the UI gates on) ---- */

/** May edit control assessments (readiness/SSP/evidence/POA&M/owner). Staff only. */
export function canEditAssessments(role: AppRoleEnum | null, isConfigured: boolean): boolean {
  return isInternalUser(role, isConfigured);
}

/** May perform evidence REVIEW transitions (In Review / Accept / etc.). Staff only. */
export function canReviewEvidence(role: AppRoleEnum | null, isConfigured: boolean): boolean {
  return isInternalUser(role, isConfigured);
}

/** May submit/advance evidence to a non-review status. Staff + evidence_uploader. */
export function canSubmitEvidence(role: AppRoleEnum | null, isConfigured: boolean): boolean {
  return isInternalUser(role, isConfigured) || role === 'evidence_uploader';
}

/** May open a new evidence REQUEST (the request brief). Staff only. */
export function canRequestEvidence(role: AppRoleEnum | null, isConfigured: boolean): boolean {
  return isInternalUser(role, isConfigured);
}

/** May create / archive client engagements. Admins only. */
export function canManageClients(role: AppRoleEnum | null, isConfigured: boolean): boolean {
  return role === 'benchmark_fox_admin' || (!isConfigured && role === null);
}
