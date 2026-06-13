/* ============================================================
   permissions.ts — usePermissions(): the ergonomic, role-aware capability
   hook screens consume (Task 11). Wraps useAuth() + the pure rules in
   roles.ts so a screen never re-derives "what may this user do".

   These gate UI AFFORDANCES only. The hard boundary is server-side: RLS
   (migrations 004/006), the evidence transition guard (007), and the
   client-facing column view (009). The UI hides what the server already
   forbids, so a client never sees a dead/forbidden control.
   ============================================================ */
import type { AppRoleEnum } from '../lib/database.types';
import { useAuth } from './AuthProvider';
import {
  canEditAssessments,
  canManageClients,
  canRequestEvidence,
  canReviewEvidence,
  canSubmitEvidence,
  isClientRole,
  isInternalUser,
} from './roles';

export interface Permissions {
  role: AppRoleEnum | null;
  /** True for the four client-portal roles (reduced experience). */
  isPortalUser: boolean;
  /** True for Benchmark Fox staff (and the internal Local-Prototype demo). */
  isInternalUser: boolean;
  /** The single client a portal user is scoped to (null for staff/internal). */
  assignedClientId: string | null;
  canEditAssessments: boolean;
  canReviewEvidence: boolean;
  canSubmitEvidence: boolean;
  canRequestEvidence: boolean;
  canManageClients: boolean;
}

export function usePermissions(): Permissions {
  const { role, isConfigured, assignedClientId } = useAuth();
  return {
    role,
    isPortalUser: isClientRole(role),
    isInternalUser: isInternalUser(role, isConfigured),
    assignedClientId,
    canEditAssessments: canEditAssessments(role, isConfigured),
    canReviewEvidence: canReviewEvidence(role, isConfigured),
    canSubmitEvidence: canSubmitEvidence(role, isConfigured),
    canRequestEvidence: canRequestEvidence(role, isConfigured),
    canManageClients: canManageClients(role, isConfigured),
  };
}
