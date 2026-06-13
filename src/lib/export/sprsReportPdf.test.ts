/* ============================================================================
   sprsReportPdf tests — target the @react-pdf element tree (a tree of plain
   React elements), NOT rendered bytes: required sections present, the
   methodology disclaimer + DoD AM citation present, 14 native family bars, and
   the per-page footer label. Byte rendering (toBlob) runs in a real browser and
   is covered by the e2e.
   ============================================================================ */
import { describe, it, expect } from 'vitest';
import {
  SprsReportDocument,
  footerPageLabel,
  sprsReportFilename,
} from './sprsReportPdf';
import { buildSprsReportModel, type SprsReportInput } from './sprsReportModel';
import { CONTROL_LIBRARY, CONTROLS_BY_ID, SEED_ASSESSMENTS } from '../../data/controls';
import { POAM_ITEMS } from '../../data/poam';
import { DOD_AM_CITATION, READINESS_SUPPORT_DISCLAIMER } from './common';
import { estimateSprs, formatScore } from '../scoring';

const input: SprsReportInput = {
  clientName: 'Acme Defense Systems',
  cmmcTarget: 'Level 2',
  assessments: SEED_ASSESSMENTS,
  controls: CONTROL_LIBRARY,
  controlsById: CONTROLS_BY_ID,
  evidence: [],
  poam: POAM_ITEMS,
  generatedAt: new Date('2026-06-13T12:00:00Z'),
};

interface El {
  type: unknown;
  props: Record<string, unknown>;
}
function isEl(n: unknown): n is El {
  return (
    typeof n === 'object' &&
    n !== null &&
    'props' in n &&
    typeof (n as { props: unknown }).props === 'object' &&
    (n as { props: unknown }).props !== null
  );
}

/** Walk the element tree collecting every element node + every text string. */
function walk(node: unknown, els: El[], texts: string[]): void {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string') {
    texts.push(node);
    return;
  }
  if (typeof node === 'number') {
    texts.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const n of node) walk(n, els, texts);
    return;
  }
  if (isEl(node)) {
    els.push(node);
    walk(node.props.children, els, texts);
  }
}

const model = buildSprsReportModel(input);
const els: El[] = [];
const texts: string[] = [];
walk(SprsReportDocument({ model }), els, texts);
const text = texts.join('\n');

describe('SprsReportDocument — sections present', () => {
  it('cover shows the estimated SPRS score, readiness, and target', () => {
    const score = estimateSprs(SEED_ASSESSMENTS, CONTROLS_BY_ID).estimatedSprsScore;
    expect(text).toContain(formatScore(score));
    expect(text).toContain(`${model.readinessPct}%`);
    expect(text).toContain('Level 2');
  });

  it('has the methodology note with the verbatim disclaimer + DoD AM citation', () => {
    expect(text).toContain(DOD_AM_CITATION);
    expect(text).toContain(READINESS_SUPPORT_DISCLAIMER);
    expect(text).toContain('3.12.4');
  });

  it('includes Top Findings and Top Score-Recovery Opportunities', () => {
    expect(text).toContain('Top Findings');
    expect(text).toContain('Top Score-Recovery Opportunities');
  });
});

describe('SprsReportDocument — native family bar chart', () => {
  it('renders one family bar per family (14) with native Rect primitives', () => {
    // each bar draws two native Rect primitives (track + fill): 14 × 2 = 28.
    const rects = els.filter(
      (e) => e.props.fill !== undefined && typeof e.props.width === 'number',
    );
    expect(rects).toHaveLength(28);
  });

  it('every family code appears in the chart', () => {
    for (const f of model.families) expect(text).toContain(f.code);
  });
});

describe('footerPageLabel — repeated on every page', () => {
  it('renders the client, CONFIDENTIAL marking, and page numbers', () => {
    const label = footerPageLabel(model, 2, 5);
    expect(label).toContain('Acme Defense Systems');
    expect(label).toContain('CONFIDENTIAL');
    expect(label).toContain('Page 2 of 5');
  });

  it('repeats the standing disclaimer in the document footer', () => {
    expect(text).toContain(READINESS_SUPPORT_DISCLAIMER);
  });
});

describe('sprsReportFilename', () => {
  it('follows {slug}_{deliverable}_{date}.{ext}', () => {
    expect(sprsReportFilename(model)).toBe('Acme_Defense_Systems_SPRS-Readiness_2026-06-13.pdf');
  });
});
