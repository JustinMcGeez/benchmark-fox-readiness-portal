/* ============================================================
   Data-integrity tests over the generated control library.

   These intentionally duplicate the build-time validators
   (scripts/validate-*.mjs) so the official-data guarantees are
   visible inside the test suite: 110 controls, 14 families, official
   DoD AM v1.2.1 scoring on every control, 320 official NIST SP
   800-171A objectives, and source references on every control.
   ============================================================ */
import { describe, expect, it } from 'vitest';
import { CONTROL_FAMILIES } from './controlFamilies';
import {
  CONTROLS_BY_ID,
  CONTROL_LIBRARY,
  EXPECTED_CONTROL_COUNT,
  FAMILIES,
  SEED_ASSESSMENTS,
} from './controls';
import { GENERATED_CONTROLS } from './generated/controls.generated';

const OFFICIAL_SCORE_SOURCE = 'nist-sp-800-171-dod-assessment-methodology';
const ALLOWED_DEDUCTIONS = new Set([-5, -3, -1, 0]);
const ALLOWED_METHODS = new Set(['examine', 'interview', 'test']);

describe('control library shape', () => {
  it('contains exactly 110 controls (generated and merged library)', () => {
    expect(EXPECTED_CONTROL_COUNT).toBe(110);
    expect(GENERATED_CONTROLS).toHaveLength(110);
    expect(CONTROL_LIBRARY).toHaveLength(110);
    expect(Object.keys(CONTROLS_BY_ID)).toHaveLength(110);
  });

  it('spans exactly 14 families that account for all 110 controls', () => {
    const codes = new Set(CONTROL_LIBRARY.map((c) => c.familyCode));
    expect(codes.size).toBe(14);
    expect(CONTROL_FAMILIES).toHaveLength(14);
    expect(FAMILIES).toHaveLength(14);
    expect([...codes].sort()).toEqual(CONTROL_FAMILIES.map((f) => f.code).sort());
    expect(FAMILIES.reduce((s, f) => s + f.count, 0)).toBe(110);
  });

  it('has no duplicate control ids and consistent id/number', () => {
    const ids = CONTROL_LIBRARY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CONTROL_LIBRARY) {
      expect(c.number).toBe(c.id);
      expect(c.level === 'L1' || c.level === 'L2').toBe(true);
    }
  });
});

describe('official SPRS scoring records', () => {
  it('every control carries an official −5/−3/−1 deduction (or the single documented NA)', () => {
    for (const c of CONTROL_LIBRARY) {
      expect(ALLOWED_DEDUCTIONS.has(c.sprsDeductionValue)).toBe(true);
      expect(c.scoreSource).toBe(OFFICIAL_SCORE_SOURCE);
      if (c.sprsDeductionValue === 0) {
        expect(c.scoreValue).toBeNull(); // NA — not point-scored
      } else {
        expect(c.scoreValue).toBe(Math.abs(c.sprsDeductionValue));
      }
    }
  });

  it('exactly one control is NA and it is 3.12.4 (System Security Plan)', () => {
    const na = CONTROL_LIBRARY.filter((c) => c.sprsDeductionValue === 0);
    expect(na.map((c) => c.id)).toEqual(['3.12.4']);
  });

  it('matches the official DoD AM v1.2.1 Annex A distribution (44×−5, 14×−3, 51×−1)', () => {
    const count = (v: number) => CONTROL_LIBRARY.filter((c) => c.sprsDeductionValue === v).length;
    expect(count(-5)).toBe(44);
    expect(count(-3)).toBe(14);
    expect(count(-1)).toBe(51);
  });
});

describe('official NIST SP 800-171A assessment objectives', () => {
  it('total exactly 320 across the library, with at least one per control', () => {
    let total = 0;
    for (const c of CONTROL_LIBRARY) {
      expect(c.assessmentObjectives.length).toBeGreaterThanOrEqual(1);
      total += c.assessmentObjectives.length;
    }
    expect(total).toBe(320);
  });

  it('objective ids are globally unique, belong to their control, and use official methods', () => {
    const seen = new Set<string>();
    for (const c of CONTROL_LIBRARY) {
      for (const o of c.assessmentObjectives) {
        expect(seen.has(o.objectiveId)).toBe(false);
        seen.add(o.objectiveId);
        expect(o.objectiveId.startsWith(c.id)).toBe(true);
        expect(o.objectiveText.trim().length).toBeGreaterThan(0);
        expect(o.source).toBe('nist-sp-800-171a');
        expect(o.assessmentMethods.length).toBeGreaterThan(0);
        for (const m of o.assessmentMethods) expect(ALLOWED_METHODS.has(m)).toBe(true);
      }
    }
    expect(seen.size).toBe(320);
  });
});

describe('source references and seed coverage', () => {
  it('every control has at least one source reference', () => {
    for (const c of CONTROL_LIBRARY) {
      expect(c.sourceRefs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('seed assessments cover all 110 controls exactly once for the active client', () => {
    expect(SEED_ASSESSMENTS).toHaveLength(110);
    const ids = new Set(SEED_ASSESSMENTS.map((a) => a.controlId));
    expect(ids.size).toBe(110);
    for (const c of CONTROL_LIBRARY) expect(ids.has(c.id)).toBe(true);
    expect(new Set(SEED_ASSESSMENTS.map((a) => a.clientId)).size).toBe(1);
  });
});
