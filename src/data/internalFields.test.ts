/* ============================================================
   Unit tests for the internal-only field rules (Task 11) — the single
   source of truth that the client view (009) and audit trigger mirror.
   ============================================================ */
import { describe, expect, it } from 'vitest';
import type { ClientControlAssessment, PoamItem } from './types';
import {
  INTERNAL_ONLY_ASSESSMENT_COLUMNS,
  INTERNAL_ONLY_ASSESSMENT_FIELDS,
  INTERNAL_POAM_CLASS,
  stripInternalAssessmentFields,
  visiblePoamItems,
} from './internalFields';

const assessment = (a: Partial<ClientControlAssessment> = {}): ClientControlAssessment => ({
  clientId: 'acme',
  controlId: '3.1.1',
  status: 'Met',
  sspStatus: 'Complete',
  evidenceStatus: 'Accepted',
  poamStatus: 'None',
  risk: 'Low',
  owner: 'IT Lead',
  consultantNotes: 'Internal: verified MFA config with the MSP on 6/1.',
  sspStatement: 'MFA is enforced via the identity provider.',
  ...a,
});

const poam = (p: Partial<PoamItem> = {}): PoamItem => ({
  id: 'PM-1',
  clientId: 'acme',
  controlId: '3.1.1',
  weakness: 'weakness',
  owner: 'IT Lead',
  risk: 'Medium',
  dueDate: '08/15/2026',
  status: 'Ongoing',
  classification: 'Readiness',
  ...p,
});

describe('internal-only field definitions', () => {
  it('the domain field list and DB column list stay in lock-step (mirrored by 009)', () => {
    expect([...INTERNAL_ONLY_ASSESSMENT_FIELDS]).toEqual(['consultantNotes']);
    expect([...INTERNAL_ONLY_ASSESSMENT_COLUMNS]).toEqual(['consultant_notes']);
    expect(INTERNAL_POAM_CLASS).toBe('Internal');
  });
});

describe('stripInternalAssessmentFields', () => {
  it('clears every internal-only field, keeps client-visible ones', () => {
    const stripped = stripInternalAssessmentFields(assessment());
    expect(stripped.consultantNotes).toBeUndefined();
    // client-visible fields are untouched
    expect(stripped.status).toBe('Met');
    expect(stripped.sspStatement).toBe('MFA is enforced via the identity provider.');
    expect(stripped.owner).toBe('IT Lead');
  });

  it('clears the field even when the seed/source carried a value (no fall-back leak)', () => {
    const stripped = stripInternalAssessmentFields(
      assessment({ consultantNotes: 'SENSITIVE internal note' }),
    );
    expect(JSON.stringify(stripped)).not.toContain('SENSITIVE');
  });

  it('does not mutate the input', () => {
    const input = assessment();
    stripInternalAssessmentFields(input);
    expect(input.consultantNotes).toBeDefined();
  });
});

describe('visiblePoamItems', () => {
  const items = [
    poam({ id: 'A', classification: 'Blocker' }),
    poam({ id: 'B', classification: 'Readiness' }),
    poam({ id: 'C', classification: 'Internal' }),
  ];

  it('hides Internal-classified items from client-portal roles', () => {
    const ids = visiblePoamItems(items, 'client_executive').map((p) => p.id);
    expect(ids).toEqual(['A', 'B']);
  });

  it('also hides Internal items from evidence_uploader / readonly_viewer', () => {
    expect(visiblePoamItems(items, 'evidence_uploader').some((p) => p.id === 'C')).toBe(false);
    expect(visiblePoamItems(items, 'readonly_viewer').some((p) => p.id === 'C')).toBe(false);
  });

  it('shows everything to staff and the internal (null-role) demo', () => {
    expect(visiblePoamItems(items, 'benchmark_fox_admin')).toHaveLength(3);
    expect(visiblePoamItems(items, 'benchmark_fox_consultant')).toHaveLength(3);
    expect(visiblePoamItems(items, null)).toHaveLength(3);
  });
});
