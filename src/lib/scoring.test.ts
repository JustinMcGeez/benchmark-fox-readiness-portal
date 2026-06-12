/* ============================================================
   Unit tests for the scoring engine (src/lib/scoring.ts).

   Uses the REAL control library as fixture input (official DoD
   Assessment Methodology v1.2.1 values) plus small hand-built
   fixtures for edge cases. These tests pin the engine's semantics:
   they must never be weakened to make a code change pass.
   ============================================================ */
import { describe, expect, it } from 'vitest';
import { CONTROLS_BY_ID, CONTROL_LIBRARY } from '../data/controls';
import type { ClientControlAssessment, Control, ReadinessStatus } from '../data/types';
import { READINESS_OPTIONS } from '../data/types';
import {
  SPRS_MAX,
  controlScoreDisplay,
  deductionImpact,
  estimateSprs,
  formatScore,
  readinessPct,
  scoreByFamily,
  scoringFinalized,
  sprsScore,
  statusCounts,
  topDeductionDrivers,
} from './scoring';

/* ---- fixtures ---- */

const assess = (controlId: string, status: ReadinessStatus): ClientControlAssessment => ({
  clientId: 'test-client',
  controlId,
  status,
  sspStatus: 'Not Reviewed',
  evidenceStatus: 'Not Requested',
  poamStatus: 'None',
  risk: 'Medium',
  owner: 'Unassigned',
});

/** One assessment per real control, all with the given status. */
const allWith = (status: ReadinessStatus): ClientControlAssessment[] =>
  CONTROL_LIBRARY.map((c) => assess(c.id, status));

/** First real control carrying the given official deduction magnitude. */
const controlWorth = (magnitude: number): Control => {
  const c = CONTROL_LIBRARY.find((x) => x.scoreValue === magnitude);
  if (!c) throw new Error(`no control with scoreValue ${magnitude}`);
  return c;
};

/** Official total of all deduction magnitudes across the library (NA = 0). */
const TOTAL_DEDUCTIONS = CONTROL_LIBRARY.reduce((s, c) => s + (c.scoreValue ?? 0), 0);

describe('estimateSprs — official SPRS estimate', () => {
  it('starts at 110 with all 110 controls Met', () => {
    const r = estimateSprs(allWith('Met'), CONTROLS_BY_ID);
    expect(r.estimatedSprsScore).toBe(SPRS_MAX);
    expect(r.estimatedSprsScore).toBe(110);
    expect(r.totalDeductions).toBe(0);
    expect(r.deductionCount).toBe(0);
    expect(r.scoringComplete).toBe(true);
    expect(r.missingScoringCount).toBe(0);
  });

  it.each([5, 3, 1])('"Not Met" subtracts the full official −%i deduction', (magnitude) => {
    const target = controlWorth(magnitude);
    const assessments = CONTROL_LIBRARY.map((c) =>
      assess(c.id, c.id === target.id ? 'Not Met' : 'Met'),
    );
    const r = estimateSprs(assessments, CONTROLS_BY_ID);
    expect(r.estimatedSprsScore).toBe(110 - magnitude);
    expect(r.totalDeductions).toBe(magnitude);
    expect(r.deductionCount).toBe(1);
  });

  it('"Not Reviewed" subtracts the full deduction (points are only earned when implemented)', () => {
    const target = controlWorth(5);
    const assessments = CONTROL_LIBRARY.map((c) =>
      assess(c.id, c.id === target.id ? 'Not Reviewed' : 'Met'),
    );
    expect(estimateSprs(assessments, CONTROLS_BY_ID).estimatedSprsScore).toBe(105);
    // All Not Reviewed scores identically to all Not Met.
    expect(estimateSprs(allWith('Not Reviewed'), CONTROLS_BY_ID).estimatedSprsScore).toBe(
      estimateSprs(allWith('Not Met'), CONTROLS_BY_ID).estimatedSprsScore,
    );
  });

  it('"Partial" is counted conservatively as Not Met for the estimate (full deduction) and surfaced in warnings', () => {
    const target = controlWorth(5);
    const assessments = CONTROL_LIBRARY.map((c) =>
      assess(c.id, c.id === target.id ? 'Partial' : 'Met'),
    );
    const r = estimateSprs(assessments, CONTROLS_BY_ID);
    expect(r.estimatedSprsScore).toBe(105); // full −5, no half credit
    expect(r.partialCount).toBe(1);
    expect(r.warnings.some((w) => w.includes('Partial'))).toBe(true);
  });

  it('"Met" and "Not Applicable" subtract nothing', () => {
    const target = controlWorth(5);
    const assessments = CONTROL_LIBRARY.map((c) =>
      assess(c.id, c.id === target.id ? 'Not Applicable' : 'Met'),
    );
    const r = estimateSprs(assessments, CONTROLS_BY_ID);
    expect(r.estimatedSprsScore).toBe(110);
    expect(r.totalDeductions).toBe(0);
  });

  it('3.12.4 (Annex A "NA") never deducts points regardless of status', () => {
    const control = CONTROLS_BY_ID['3.12.4'];
    expect(control.scoreValue).toBeNull();
    expect(control.sprsDeductionValue).toBe(0);
    for (const status of READINESS_OPTIONS) {
      expect(deductionImpact(assess('3.12.4', status), control)).toBe(0);
    }
    const assessments = CONTROL_LIBRARY.map((c) =>
      assess(c.id, c.id === '3.12.4' ? 'Not Met' : 'Met'),
    );
    expect(estimateSprs(assessments, CONTROLS_BY_ID).estimatedSprsScore).toBe(110);
  });

  it('goes below zero when deductions exceed 110 — all Not Met hits the official floor of −203', () => {
    const r = estimateSprs(allWith('Not Met'), CONTROLS_BY_ID);
    expect(r.totalDeductions).toBe(TOTAL_DEDUCTIONS);
    expect(r.estimatedSprsScore).toBe(110 - TOTAL_DEDUCTIONS);
    // DoD AM v1.2.1 distribution: 44×5 + 14×3 + 51×1 = 313 ⇒ floor −203.
    expect(r.estimatedSprsScore).toBe(-203);
    expect(r.estimatedSprsScore).toBeLessThan(0);
  });

  it('counts −5 gaps as high-impact and flags unknown controls as missing scoring', () => {
    const five = controlWorth(5);
    const r = estimateSprs(
      [assess(five.id, 'Not Met'), assess('9.9.9', 'Not Met')],
      CONTROLS_BY_ID,
    );
    expect(r.highImpactGapCount).toBe(1);
    expect(r.missingScoringCount).toBe(1);
    expect(r.scoringComplete).toBe(false);
    expect(r.warnings.some((w) => w.includes('no official scoring value'))).toBe(true);
  });

  it('sprsScore legacy wrapper returns the same estimate', () => {
    const assessments = allWith('Not Met');
    expect(sprsScore(assessments, CONTROLS_BY_ID)).toBe(
      estimateSprs(assessments, CONTROLS_BY_ID).estimatedSprsScore,
    );
  });
});

describe('readinessPct — consultant readiness metric', () => {
  it('is 100 when all controls are Met', () => {
    expect(readinessPct(allWith('Met'))).toBe(100);
  });

  it('is 0 when all controls are Not Met', () => {
    expect(readinessPct(allWith('Not Met'))).toBe(0);
  });

  it('gives Partial half credit (unlike the SPRS estimate)', () => {
    expect(readinessPct([assess('3.1.1', 'Partial')])).toBe(50);
    expect(readinessPct([assess('3.1.1', 'Met'), assess('3.1.2', 'Partial')])).toBe(75);
  });

  it('excludes Not Applicable controls from the denominator', () => {
    expect(readinessPct([assess('3.1.1', 'Met'), assess('3.1.2', 'Not Applicable')])).toBe(100);
    expect(readinessPct([assess('3.1.1', 'Not Applicable')])).toBe(0); // nothing applicable
  });
});

describe('Partial — both behaviors verified separately', () => {
  it('full deduction in the SPRS estimate, half credit in readiness %', () => {
    const five = controlWorth(5);
    const partialOnly = [assess(five.id, 'Partial')];
    expect(estimateSprs(partialOnly, CONTROLS_BY_ID).totalDeductions).toBe(5);
    expect(readinessPct(partialOnly)).toBe(50);
  });
});

describe('scoreByFamily', () => {
  it('covers all 14 families and sums deductions to the library total', () => {
    const rows = scoreByFamily(allWith('Not Met'), CONTROLS_BY_ID);
    expect(rows).toHaveLength(14);
    expect(new Set(rows.map((r) => r.code)).size).toBe(14);
    expect(rows.reduce((s, r) => s + r.deduction, 0)).toBe(TOTAL_DEDUCTIONS);
    for (const row of rows) expect(row.readiness).toBe(0);
  });

  it('sorts worst family (highest deduction) first and matches per-family sums', () => {
    const rows = scoreByFamily(allWith('Not Met'), CONTROLS_BY_ID);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].deduction).toBeGreaterThanOrEqual(rows[i].deduction);
    }
    const ac = rows.find((r) => r.code === 'AC');
    const acExpected = CONTROL_LIBRARY.filter((c) => c.familyCode === 'AC').reduce(
      (s, c) => s + (c.scoreValue ?? 0),
      0,
    );
    expect(ac?.deduction).toBe(acExpected);
  });
});

describe('statusCounts', () => {
  it('tallies each status and derives the applicable count', () => {
    const counts = statusCounts([
      assess('3.1.1', 'Met'),
      assess('3.1.2', 'Partial'),
      assess('3.1.3', 'Not Met'),
      assess('3.1.4', 'Not Reviewed'),
      assess('3.1.5', 'Not Applicable'),
    ]);
    expect(counts).toEqual({
      met: 1,
      partial: 1,
      notMet: 1,
      notReviewed: 1,
      notApplicable: 1,
      total: 5,
      applicable: 4,
    });
  });
});

describe('display + provenance helpers', () => {
  it('formatScore renders explicit signs (DoD-style minus)', () => {
    expect(formatScore(110)).toBe('+110');
    expect(formatScore(-93)).toBe('−93');
    expect(formatScore(0)).toBe('0');
  });

  it('controlScoreDisplay: TBD when Not Reviewed, 0 when Met/NA, −value when unmet', () => {
    const five = controlWorth(5);
    expect(controlScoreDisplay(assess(five.id, 'Not Reviewed'), five)).toBe('TBD');
    expect(controlScoreDisplay(assess(five.id, 'Met'), five)).toBe('0');
    expect(controlScoreDisplay(assess(five.id, 'Not Applicable'), five)).toBe('0');
    expect(controlScoreDisplay(assess(five.id, 'Not Met'), five)).toBe('−5');
    expect(controlScoreDisplay(assess(five.id, 'Not Met'), undefined)).toBe('—');
  });

  it('scoringFinalized is true for the real library and false for placeholders/empty', () => {
    expect(scoringFinalized(CONTROLS_BY_ID)).toBe(true);
    expect(scoringFinalized({})).toBe(false);
    const placeholder: Control = { ...CONTROLS_BY_ID['3.1.1'], scoreSource: 'placeholder' };
    expect(scoringFinalized({ [placeholder.id]: placeholder })).toBe(false);
  });

  it('topDeductionDrivers returns unmet controls sorted by impact, limited', () => {
    const one = controlWorth(1);
    const three = controlWorth(3);
    const five = controlWorth(5);
    const drivers = topDeductionDrivers(
      [
        assess(one.id, 'Not Met'),
        assess(five.id, 'Not Met'),
        assess(three.id, 'Partial'),
        assess('3.12.4', 'Not Met'), // NA — never a driver
      ],
      CONTROLS_BY_ID,
      2,
    );
    expect(drivers.map((d) => d.impact)).toEqual([5, 3]);
    expect(drivers[0].control.id).toBe(five.id);
  });
});
