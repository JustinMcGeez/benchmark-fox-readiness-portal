/* ============================================================================
   poamModel tests — target the pure workbook model (not rendered bytes):
   open/closed row counts, column mapping, date parsing, milestone formatting,
   and the Score Impact math, which must EQUAL the isolated scoring engine
   (no scoring math is re-implemented in the exporter).
   ============================================================================ */
import { describe, it, expect } from 'vitest';
import {
  buildPoamWorkbookModel,
  closedPoamItems,
  formatMilestones,
  parsePoamDate,
  type PoamWorkbookInput,
} from './poamModel';
import { CONTROLS_BY_ID, SEED_ASSESSMENTS } from '../../data/controls';
import { POAM_ITEMS } from '../../data/poam';
import { openPoamItems } from '../selectors';
import { estimateSprs, projectedScoreIfRemediated } from '../scoring';
import type { PoamItem } from '../../data/types';

const baseInput = (overrides: Partial<PoamWorkbookInput> = {}): PoamWorkbookInput => ({
  clientName: 'Acme Defense Systems',
  poam: POAM_ITEMS,
  assessments: SEED_ASSESSMENTS,
  controlsById: CONTROLS_BY_ID,
  generatedAt: new Date('2026-06-13T12:00:00Z'),
  ...overrides,
});

describe('parsePoamDate', () => {
  it('parses MM/DD/YYYY into a real local Date', () => {
    const d = parsePoamDate('08/01/2026');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(7); // August (0-indexed)
    expect(d!.getDate()).toBe(1);
  });

  it('returns null for empty or malformed input', () => {
    expect(parsePoamDate('')).toBeNull();
    expect(parsePoamDate(undefined)).toBeNull();
    expect(parsePoamDate('not a date')).toBeNull();
    expect(parsePoamDate('13/40/2026')).toBeNull();
  });
});

describe('formatMilestones', () => {
  it('renders each milestone with done state and date', () => {
    const item = POAM_ITEMS.find((p) => p.id === 'PM-014')!;
    const text = formatMilestones(item);
    expect(text.split('\n')).toHaveLength(4);
    expect(text).toContain('✓ Map current CUI data flows — 07/05/2026');
    expect(text).toContain('○ Design enclave segmentation — 07/18/2026');
  });

  it('renders a placeholder when there are no milestones', () => {
    const item = POAM_ITEMS.find((p) => p.id === 'PM-021')!;
    expect(formatMilestones(item)).toBe('None recorded');
  });
});

describe('closedPoamItems', () => {
  it('selects only Complete / Validated / Closed statuses', () => {
    const items: PoamItem[] = [
      { ...POAM_ITEMS[0], id: 'a', status: 'Complete' },
      { ...POAM_ITEMS[0], id: 'b', status: 'Validated' },
      { ...POAM_ITEMS[0], id: 'c', status: 'Closed' },
      { ...POAM_ITEMS[0], id: 'd', status: 'Ongoing' },
      { ...POAM_ITEMS[0], id: 'e', status: 'None' },
    ];
    expect(closedPoamItems(items).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('buildPoamWorkbookModel — row split', () => {
  const model = buildPoamWorkbookModel(baseInput());

  it('puts every open item on the open sheet (demo: all 5 are open)', () => {
    expect(model.open).toHaveLength(openPoamItems(POAM_ITEMS).length);
    expect(model.counts.open).toBe(model.open.length);
    expect(model.counts.open).toBe(5);
  });

  it('has no closed items for the demo client', () => {
    expect(model.closed).toHaveLength(0);
    expect(model.counts.closed).toBe(0);
  });

  it('maps the template columns from the source item (PM-014)', () => {
    const row = model.open.find((r) => r.itemId === 'PM-014')!;
    expect(row.controlId).toBe('3.1.3');
    expect(row.severity).toBe('High');
    expect(row.source).toBe('Scoping workshop — CUI boundary review');
    expect(row.resources).toBe('40 hrs + segmentation license');
    expect(row.scheduledCompletion).toBeInstanceOf(Date);
    expect(row.comments).toContain('POC: CIO');
  });
});

describe('buildPoamWorkbookModel — Score Impact equals scoring.ts', () => {
  const input = baseInput();
  const model = buildPoamWorkbookModel(input);
  const currentScore = estimateSprs(input.assessments, input.controlsById).estimatedSprsScore;

  it('has one score-impact row per open item', () => {
    expect(model.scoreImpact).toHaveLength(model.open.length);
  });

  it('matches projectedScoreIfRemediated exactly for every row', () => {
    for (const row of model.scoreImpact) {
      const expected = projectedScoreIfRemediated(
        input.assessments,
        input.controlsById,
        row.controlId,
      );
      expect(row.currentStatus).toBe(expected.status);
      expect(row.deduction).toBe(expected.deduction);
      expect(row.currentScore).toBe(expected.currentScore);
      expect(row.projectedScore).toBe(expected.projectedScore);
    }
  });

  it('keeps projected = current + deduction (no exporter-side math)', () => {
    for (const row of model.scoreImpact) {
      expect(row.currentScore).toBe(currentScore);
      expect(row.projectedScore).toBe(row.currentScore + row.deduction);
    }
  });
});
