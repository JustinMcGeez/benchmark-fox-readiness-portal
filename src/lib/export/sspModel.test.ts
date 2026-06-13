/* ============================================================================
   sspModel tests — target the pure document model (not rendered bytes):
   110 control sections in numeric order, OFFICIAL requirement text verbatim for
   a sample, visible placeholders for missing statements, and POA&M references
   that resolve. Plus pre-flight counts and the system-name placeholder.
   ============================================================================ */
import { describe, it, expect } from 'vitest';
import {
  buildSspModel,
  compareControlNumbers,
  formatLongDate,
  SSP_SYSTEM_NAME_PLACEHOLDER,
  type SspInput,
} from './sspModel';
import { CONTROL_LIBRARY, CONTROLS_BY_ID, SEED_ASSESSMENTS, EXPECTED_CONTROL_COUNT } from '../../data/controls';
import { POAM_ITEMS } from '../../data/poam';
import { DEFAULT_INTAKE } from '../../data/intake';
import { DEFAULT_SCOPE } from '../../data/scope';
import type { ClientControlAssessment } from '../../data/types';

const baseInput = (overrides: Partial<SspInput> = {}): SspInput => ({
  clientName: 'Acme Defense Systems',
  systemName: 'Acme CUI Enclave',
  cmmcTarget: 'Level 2',
  intake: DEFAULT_INTAKE,
  scope: DEFAULT_SCOPE,
  assessments: SEED_ASSESSMENTS,
  controls: CONTROL_LIBRARY,
  evidence: [],
  poam: POAM_ITEMS,
  version: '1.0',
  generatedAt: new Date('2026-06-13T12:00:00Z'),
  ...overrides,
});

describe('compareControlNumbers', () => {
  it('orders requirement numbers numerically, not lexically', () => {
    const sorted = ['3.1.10', '3.1.2', '3.10.1', '3.1.1', '3.2.1'].sort(compareControlNumbers);
    expect(sorted).toEqual(['3.1.1', '3.1.2', '3.1.10', '3.2.1', '3.10.1']);
  });
});

describe('buildSspModel — structure', () => {
  const model = buildSspModel(baseInput());

  it('contains exactly 110 control sections across 14 families', () => {
    expect(model.controlEntries).toHaveLength(EXPECTED_CONTROL_COUNT);
    expect(model.families).toHaveLength(14);
    const summed = model.families.reduce((n, f) => n + f.controls.length, 0);
    expect(summed).toBe(EXPECTED_CONTROL_COUNT);
  });

  it('orders controls numerically within each family', () => {
    const ac = model.families.find((f) => f.family.code === 'AC')!;
    const nums = ac.controls.map((c) => c.controlId);
    const expected = [...nums].sort(compareControlNumbers);
    expect(nums).toEqual(expected);
    // 3.1.10 must come after 3.1.9, not after 3.1.1
    expect(nums.indexOf('3.1.10')).toBeGreaterThan(nums.indexOf('3.1.9'));
  });

  it('numbers families with their official section + code', () => {
    const ca = model.families.find((f) => f.family.code === 'CA')!;
    expect(ca.family.section).toBe('3.12');
    expect(ca.family.name).toBe('Security Assessment');
  });
});

describe('buildSspModel — official text is verbatim', () => {
  const model = buildSspModel(baseInput());
  const byId = Object.fromEntries(model.controlEntries.map((e) => [e.controlId, e]));

  for (const id of ['3.1.1', '3.12.4', '3.13.11']) {
    it(`reproduces ${id} requirement text exactly from the library`, () => {
      expect(byId[id].requirement).toBe(CONTROLS_BY_ID[id].requirement);
      expect(byId[id].requirement.length).toBeGreaterThan(0);
    });
  }
});

describe('buildSspModel — implementation statements', () => {
  const model = buildSspModel(baseInput());
  const byId = Object.fromEntries(model.controlEntries.map((e) => [e.controlId, e]));

  it('keeps an authored statement (3.1.1 has one in the seed)', () => {
    expect(byId['3.1.1'].hasStatement).toBe(true);
    expect(byId['3.1.1'].statement).toBeTruthy();
  });

  it('flags a control with no authored statement (placeholder path)', () => {
    // 3.1.3 is worked (Not Met) but has no sspStatement in the seed.
    expect(byId['3.1.3'].hasStatement).toBe(false);
    expect(byId['3.1.3'].statement).toBeNull();
  });

  it('treats a whitespace-only statement as missing', () => {
    const assessments: ClientControlAssessment[] = SEED_ASSESSMENTS.map((a) =>
      a.controlId === '3.4.1' ? { ...a, sspStatement: '   ' } : a,
    );
    const m = buildSspModel(baseInput({ assessments }));
    const entry = m.controlEntries.find((e) => e.controlId === '3.4.1')!;
    expect(entry.hasStatement).toBe(false);
  });
});

describe('buildSspModel — POA&M references resolve', () => {
  const model = buildSspModel(baseInput());
  const byId = Object.fromEntries(model.controlEntries.map((e) => [e.controlId, e]));

  it('references the POA&M item for a Not Met control (3.1.3 → PM-014)', () => {
    expect(byId['3.1.3'].status).toBe('Not Met');
    expect(byId['3.1.3'].poamIds).toContain('PM-014');
  });

  it('references the POA&M item for a Partial control (3.5.3 → PM-021)', () => {
    expect(byId['3.5.3'].status).toBe('Partial');
    expect(byId['3.5.3'].poamIds).toContain('PM-021');
  });

  it('does not attach POA&M ids to a Met control', () => {
    expect(byId['3.1.1'].status).toBe('Met');
    expect(byId['3.1.1'].poamIds).toEqual([]);
  });

  it('every referenced POA&M id exists in the source list', () => {
    const known = new Set(POAM_ITEMS.map((p) => p.id));
    for (const e of model.controlEntries) {
      for (const id of e.poamIds) expect(known.has(id)).toBe(true);
    }
  });
});

describe('buildSspModel — pre-flight + meta', () => {
  it('counts statements, placeholders, and not-reviewed consistently', () => {
    const model = buildSspModel(baseInput());
    const { preflight, controlEntries } = model;
    expect(preflight.total).toBe(EXPECTED_CONTROL_COUNT);
    expect(preflight.withStatements + preflight.placeholders).toBe(EXPECTED_CONTROL_COUNT);
    expect(preflight.withStatements).toBe(controlEntries.filter((e) => e.hasStatement).length);
    expect(preflight.notReviewed).toBe(controlEntries.filter((e) => e.status === 'Not Reviewed').length);
  });

  it('defaults un-assessed controls to Not Reviewed (empty assessments → 110 placeholders)', () => {
    const model = buildSspModel(baseInput({ assessments: [] }));
    expect(model.preflight.placeholders).toBe(EXPECTED_CONTROL_COUNT);
    expect(model.preflight.notReviewed).toBe(EXPECTED_CONTROL_COUNT);
    expect(model.controlEntries.every((e) => e.status === 'Not Reviewed')).toBe(true);
  });

  it('resolves the system name, falling back to a visible placeholder', () => {
    expect(buildSspModel(baseInput()).meta.systemName).toBe('Acme CUI Enclave');
    const blank = buildSspModel(baseInput({ systemName: '   ' }));
    expect(blank.meta.systemNameProvided).toBe(false);
    expect(blank.meta.systemName).toBe(SSP_SYSTEM_NAME_PLACEHOLDER);
  });

  it('formats the generated date and exposes the version', () => {
    const model = buildSspModel(baseInput());
    expect(formatLongDate(new Date('2026-06-13T12:00:00Z'))).toBe('June 13, 2026');
    expect(model.meta.version).toBe('1.0');
  });
});

describe('buildSspModel — environment + evidence index', () => {
  it('maps scope assets to the environment table (in/out of scope)', () => {
    const model = buildSspModel(baseInput());
    expect(model.assets.length).toBe(DEFAULT_SCOPE.assets.length);
    const outOfScope = model.assets.filter((a) => a.inScope === 'Out of scope');
    expect(outOfScope.length).toBe(DEFAULT_SCOPE.assets.filter((a) => !a.inScope).length);
  });

  it('lists evidence as references marked whole-control vs objective-scoped', () => {
    const model = buildSspModel(
      baseInput({
        evidence: [
          {
            id: 'ev-x',
            clientId: 'acme',
            title: 'MFA config export',
            controlId: '3.5.3',
            objectiveIds: ['3.5.3[a]'],
            owner: 'IT Lead',
            status: 'Accepted',
            quality: 'Strong',
            freshness: 'Current',
            externalLink: 'https://vault.example.com/mfa',
          },
          {
            id: 'ev-y',
            clientId: 'acme',
            title: 'Access policy',
            controlId: '3.1.1',
            owner: 'IT Lead',
            status: 'Accepted',
            quality: 'Acceptable',
            freshness: 'Current',
          },
        ],
      }),
    );
    const mfa = model.evidence.find((e) => e.title === 'MFA config export')!;
    expect(mfa.objectives).toBe('3.5.3[a]');
    expect(mfa.reference).toBe('https://vault.example.com/mfa');
    const policy = model.evidence.find((e) => e.title === 'Access policy')!;
    expect(policy.objectives).toBe('Whole control');
    expect(policy.reference).toBe('—'); // no link → dash, never a stored file
  });
});
