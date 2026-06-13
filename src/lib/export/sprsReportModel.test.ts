/* ============================================================================
   sprsReportModel tests — the pure model must agree with the SAME selectors the
   dashboard uses (no drift): score, readiness, status counts, 14 family bars in
   official order, findings, and recovery opportunities.
   ============================================================================ */
import { describe, it, expect } from 'vitest';
import { buildSprsReportModel, riskBandFor, type SprsReportInput } from './sprsReportModel';
import {
  CONTROL_LIBRARY,
  CONTROLS_BY_ID,
  SEED_ASSESSMENTS,
} from '../../data/controls';
import { POAM_ITEMS } from '../../data/poam';
import {
  estimateSprs,
  readinessPct,
  topDeductionDrivers,
} from '../scoring';

const baseInput = (overrides: Partial<SprsReportInput> = {}): SprsReportInput => ({
  clientName: 'Acme Defense Systems',
  cmmcTarget: 'Level 2',
  assessments: SEED_ASSESSMENTS,
  controls: CONTROL_LIBRARY,
  controlsById: CONTROLS_BY_ID,
  evidence: [],
  poam: POAM_ITEMS,
  generatedAt: new Date('2026-06-13T12:00:00Z'),
  ...overrides,
});

describe('riskBandFor', () => {
  it('bands readiness the same way the Report Preview screen does', () => {
    expect(riskBandFor(80)).toBe('Low');
    expect(riskBandFor(60)).toBe('Medium');
    expect(riskBandFor(59)).toBe('High');
  });
});

describe('buildSprsReportModel — numbers match the selectors (no drift)', () => {
  const input = baseInput();
  const model = buildSprsReportModel(input);

  it('uses the same SPRS estimate as estimateSprs', () => {
    const expected = estimateSprs(input.assessments, input.controlsById);
    expect(model.sprs.estimatedSprsScore).toBe(expected.estimatedSprsScore);
    expect(model.sprs.totalDeductions).toBe(expected.totalDeductions);
  });

  it('uses the same readiness percentage as readinessPct', () => {
    expect(model.readinessPct).toBe(readinessPct(input.assessments));
  });

  it('carries the scoring methodology warnings', () => {
    expect(model.warnings.length).toBeGreaterThan(0);
    expect(model.warnings).toEqual(model.sprs.warnings);
  });
});

describe('buildSprsReportModel — family bars', () => {
  const model = buildSprsReportModel(baseInput());

  it('has one bar per family in official order (AC first, SI last)', () => {
    expect(model.families).toHaveLength(14);
    expect(model.families[0].code).toBe('AC');
    expect(model.families[13].code).toBe('SI');
  });

  it('clamps readiness into 0–100 with a resolved section label', () => {
    for (const f of model.families) {
      expect(f.readiness).toBeGreaterThanOrEqual(0);
      expect(f.readiness).toBeLessThanOrEqual(100);
      expect(f.section).toMatch(/^3\.\d+$/);
    }
  });
});

describe('buildSprsReportModel — findings + recovery', () => {
  const input = baseInput();
  const model = buildSprsReportModel(input);

  it('surfaces top findings for the demo client', () => {
    expect(model.findings.length).toBeGreaterThan(0);
    expect(model.findings.length).toBeLessThanOrEqual(5);
  });

  it('matches topDeductionDrivers, ordered by recoverable impact (desc)', () => {
    const drivers = topDeductionDrivers(input.assessments, input.controlsById, 5);
    expect(model.recovery.map((r) => r.controlId)).toEqual(drivers.map((d) => d.control.id));
    const impacts = model.recovery.map((r) => r.impact);
    expect([...impacts].sort((a, b) => b - a)).toEqual(impacts);
  });
});
