/* ============================================================
   Unit tests for the role classification + capability rules (Task 11).
   These drive the reduced portal experience and every UI edit gate, so
   the per-role behavior is pinned here.
   ============================================================ */
import { describe, expect, it } from 'vitest';
import type { AppRoleEnum } from '../lib/database.types';
import {
  APP_ROLES,
  CLIENT_ROLES,
  STAFF_ROLES,
  canEditAssessments,
  canManageClients,
  canRequestEvidence,
  canReviewEvidence,
  canSubmitEvidence,
  isAppRole,
  isClientRole,
  isInternalUser,
  isStaffRole,
} from './roles';

const CLIENT: AppRoleEnum[] = [
  'client_executive',
  'client_it_owner',
  'evidence_uploader',
  'readonly_viewer',
];
const STAFF: AppRoleEnum[] = ['benchmark_fox_admin', 'benchmark_fox_consultant'];

describe('role classification', () => {
  it('splits staff and client roles, with no overlap and full coverage', () => {
    expect([...STAFF_ROLES]).toEqual(STAFF);
    expect([...CLIENT_ROLES]).toEqual(CLIENT);
    expect(APP_ROLES).toHaveLength(6);
    for (const r of STAFF) expect(isStaffRole(r)).toBe(true);
    for (const r of CLIENT) expect(isClientRole(r)).toBe(true);
    for (const r of STAFF) expect(isClientRole(r)).toBe(false);
    for (const r of CLIENT) expect(isStaffRole(r)).toBe(false);
  });

  it('isClientRole / isStaffRole reject null and non-roles', () => {
    expect(isClientRole(null)).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isAppRole('client_executive')).toBe(true);
    expect(isAppRole('nope')).toBe(false);
    expect(isAppRole(null)).toBe(false);
    expect(isAppRole(undefined)).toBe(false);
  });
});

describe('isInternalUser (null means different things per mode)', () => {
  it('staff are internal in either mode', () => {
    for (const r of STAFF) {
      expect(isInternalUser(r, true)).toBe(true);
      expect(isInternalUser(r, false)).toBe(true);
    }
  });

  it('null role: internal in Local Prototype mode (demo), NOT when configured', () => {
    expect(isInternalUser(null, false)).toBe(true); // local demo, no simulated role
    expect(isInternalUser(null, true)).toBe(false); // signed-in without a role → no access
  });

  it('client roles are never internal', () => {
    for (const r of CLIENT) {
      expect(isInternalUser(r, true)).toBe(false);
      expect(isInternalUser(r, false)).toBe(false);
    }
  });
});

describe('capabilities (configured / Supabase mode)', () => {
  it('only staff may edit assessments / review evidence / request evidence', () => {
    for (const r of STAFF) {
      expect(canEditAssessments(r, true)).toBe(true);
      expect(canReviewEvidence(r, true)).toBe(true);
      expect(canRequestEvidence(r, true)).toBe(true);
    }
    for (const r of CLIENT) {
      expect(canEditAssessments(r, true)).toBe(false);
      expect(canReviewEvidence(r, true)).toBe(false);
      expect(canRequestEvidence(r, true)).toBe(false);
    }
  });

  it('evidence_uploader may SUBMIT but never REVIEW; other client roles do neither', () => {
    expect(canSubmitEvidence('evidence_uploader', true)).toBe(true);
    expect(canReviewEvidence('evidence_uploader', true)).toBe(false);
    for (const r of ['client_executive', 'client_it_owner', 'readonly_viewer'] as AppRoleEnum[]) {
      expect(canSubmitEvidence(r, true)).toBe(false);
    }
  });

  it('only admins manage clients', () => {
    expect(canManageClients('benchmark_fox_admin', true)).toBe(true);
    expect(canManageClients('benchmark_fox_consultant', true)).toBe(false);
    for (const r of CLIENT) expect(canManageClients(r, true)).toBe(false);
  });
});

describe('capabilities (Local Prototype mode, no simulated role)', () => {
  it('a null role behaves as the internal staff demo (full access)', () => {
    expect(canEditAssessments(null, false)).toBe(true);
    expect(canReviewEvidence(null, false)).toBe(true);
    expect(canSubmitEvidence(null, false)).toBe(true);
    expect(canRequestEvidence(null, false)).toBe(true);
    expect(canManageClients(null, false)).toBe(true);
  });

  it('a simulated client role is restricted even in Local Prototype mode', () => {
    expect(canEditAssessments('readonly_viewer', false)).toBe(false);
    expect(canManageClients('client_executive', false)).toBe(false);
    expect(canSubmitEvidence('readonly_viewer', false)).toBe(false);
    expect(canSubmitEvidence('evidence_uploader', false)).toBe(true);
  });
});
