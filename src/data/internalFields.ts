/* ============================================================
   internalFields.ts — the SINGLE source of truth for the data that is
   INTERNAL to Benchmark Fox and must never reach a client-portal user
   (Task 11).

   This one module is mirrored in two other places that cannot import it:
     1. The client-facing SQL view in supabase/migrations/009 — it omits
        exactly the columns in INTERNAL_ONLY_ASSESSMENT_COLUMNS, so the
        column hiding is enforced SERVER-SIDE, not just in the UI.
     2. The 009 audit trigger — it routes changes to these columns into an
        internal-only audit action (hidden from client roles by the 005
        is_internal_audit_action predicate).
   Keep the three in sync; src/data/internalFields.test.ts asserts the shape
   so a drift fails the gate.
   ============================================================ */
import type { AppRoleEnum } from '../lib/database.types';
import { isClientRole } from '../auth/roles';
import type { ClientControlAssessment, PoamItem } from './types';

/** Domain fields (camelCase) on a ClientControlAssessment that are internal-only. */
export const INTERNAL_ONLY_ASSESSMENT_FIELDS = [
  'consultantNotes',
] as const satisfies readonly (keyof ClientControlAssessment)[];

/** The matching DB column names — mirrored by the 009 client view + audit trigger. */
export const INTERNAL_ONLY_ASSESSMENT_COLUMNS = ['consultant_notes'] as const;

/** POA&M classification that marks an item as internal-only (not client-visible). */
export const INTERNAL_POAM_CLASS: PoamItem['classification'] = 'Internal';

/**
 * Return a copy of an assessment with every internal-only field cleared. Used by
 * the client-portal read paths (store local engine + supabaseRepository view
 * path) so a client-role user never receives consultant_notes — even when the
 * seed/demo carries one.
 */
export function stripInternalAssessmentFields(
  assessment: ClientControlAssessment,
): ClientControlAssessment {
  const out = { ...assessment };
  for (const field of INTERNAL_ONLY_ASSESSMENT_FIELDS) out[field] = undefined;
  return out;
}

/**
 * POA&M items visible to a given role. Client-portal roles never see
 * Internal-classified items (e.g. internal remediation notes); staff and the
 * internal demo see everything.
 */
export function visiblePoamItems(items: PoamItem[], role: AppRoleEnum | null): PoamItem[] {
  if (!isClientRole(role)) return items;
  return items.filter((p) => p.classification !== INTERNAL_POAM_CLASS);
}
