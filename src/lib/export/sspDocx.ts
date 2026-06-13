/* ============================================================================
   SSP .docx renderer — turns the pure SspModel (sspModel.ts) into a real Word
   document and, ultimately, a downloadable Blob. CLIENT-SIDE generation only:
   no server render, no Supabase storage — the artifact is the CLIENT'S document
   and is never persisted by this product.

   Output quality matters (this is a primary deliverable): Montserrat headings in
   navy, readable body, true Word heading levels so the navigation pane + TOC
   work, an auto-updating TOC field, a CONFIDENTIAL footer with page numbers, and
   tables with repeated header rows. Official requirement text is copied through
   verbatim from the model — never altered here.

   `generateSspBlob` is the pure entry point (data in → Blob out); the paragraph
   and table builders are small typed helpers so the document tree is testable
   without rendering bytes.
   ============================================================================ */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import {
  buildSspModel,
  SSP_STATEMENT_PLACEHOLDER,
  type SspControlEntry,
  type SspInput,
  type SspModel,
} from './sspModel';
import { READINESS_SUPPORT_DISCLAIMER } from '../../data/disclaimers';
import { formatScore } from '../scoring';

/* ---- palette (matches the wireframe tokens) ---- */
const NAVY = '0A2348';
const SILVER = '7E8691';
const RED = 'C0392B';
const WHITE = 'FFFFFF';
const HEADING_FONT = 'Montserrat';
const BODY_FONT = 'Calibri';

const PCT = (size: number) => ({ size, type: WidthType.PERCENTAGE });

/* ---- small typed builders ---- */

function body(text: string, opts: { italics?: boolean; bold?: boolean; color?: string; size?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        italics: opts.italics,
        bold: opts.bold,
        color: opts.color,
        size: opts.size,
      }),
    ],
  });
}

/** A "Label: value" line where the label is bold. */
function labelLine(label: string, value: string, valueColor?: string, valueBold?: boolean): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value, color: valueColor, bold: valueBold }),
    ],
  });
}

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    width: PCT(width),
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: NAVY },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({ children: [new TextRun({ text, bold: true, color: WHITE, size: 18 })] }),
    ],
  });
}

function dataCell(text: string, width: number, opts: { mono?: boolean } = {}): TableCell {
  return new TableCell({
    width: PCT(width),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 18, font: opts.mono ? 'Consolas' : undefined })],
      }),
    ],
  });
}

/** A table whose first row repeats as a header on every page. */
function table(headers: { text: string; width: number }[], rows: string[][]): Table {
  const evenWidth = Math.floor(100 / Math.max(headers.length, 1));
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => headerCell(h.text, h.width)),
  });
  const bodyRows = rows.map(
    (cells) =>
      new TableRow({
        // Column count always matches `headers` for in-repo callers; the `??`
        // keeps a stray extra cell from throwing on an out-of-bounds index.
        children: cells.map((c, i) => dataCell(c, headers[i]?.width ?? evenWidth)),
      }),
  );
  return new Table({ width: PCT(100), rows: [headerRow, ...bodyRows] });
}

/* ---- requirement subsection (one per control) ---- */

function controlBlock(entry: SspControlEntry): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text: `${entry.controlId} — ${entry.code} — ${entry.title}` })],
    }),
    // OFFICIAL requirement text — verbatim from the library.
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'Requirement (NIST SP 800-171 Rev. 2): ', bold: true }),
        new TextRun({ text: entry.requirement, italics: true }),
      ],
    }),
    labelLine('Implementation status', entry.status),
  ];

  // Implementation statement, or a VISIBLE red placeholder when unauthored.
  if (entry.hasStatement && entry.statement) {
    out.push(labelLine('Implementation statement', entry.statement));
  } else {
    out.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: 'Implementation statement: ', bold: true }),
          new TextRun({ text: SSP_STATEMENT_PLACEHOLDER, bold: true, color: RED }),
        ],
      }),
    );
  }

  // POA&M references for gaps (Not Met / Partial).
  if (entry.poamIds.length > 0) {
    out.push(labelLine('Related POA&M item(s)', entry.poamIds.join(', ')));
  } else if (entry.status === 'Not Met' || entry.status === 'Partial') {
    out.push(labelLine('Related POA&M item(s)', 'None recorded — POA&M entry required', RED, true));
  }

  return out;
}

/* ---- cover page ---- */

function coverPage(model: SspModel): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 1200, after: 200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: model.meta.clientName, bold: true, size: 36, color: NAVY, font: HEADING_FONT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: 'System Security Plan', bold: true, size: 56, color: NAVY, font: HEADING_FONT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: model.meta.systemName,
          size: 28,
          color: model.meta.systemNameProvided ? SILVER : RED,
          bold: !model.meta.systemNameProvided,
          font: HEADING_FONT,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: `CMMC Target: ${model.meta.cmmcTarget}`, size: 24, color: SILVER })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: `Version ${model.meta.version} · ${model.meta.generatedAtLabel}`, size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: 'Prepared with Benchmark Fox', size: 22, italics: true, color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: SILVER, space: 8 },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: SILVER, space: 8 },
      },
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: READINESS_SUPPORT_DISCLAIMER, size: 18, italics: true, color: SILVER })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

/* ---- table of contents ---- */

function tableOfContents(): (Paragraph | TableOfContents)[] {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Table of Contents' })] }),
    // Auto-updating field; Word fills it from the heading styles on open.
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-2',
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

/* ---- main document ---- */

/** Build the docx `Document` tree (no byte rendering). */
export function buildSspDocxDocument(model: SspModel): Document {
  const children: (Paragraph | Table | TableOfContents)[] = [];

  // Cover + TOC
  children.push(...coverPage(model));
  children.push(...tableOfContents());

  // Section 1 — System Identification
  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '1. System Identification' })] }),
  );
  for (const p of model.narrative) children.push(body(p));
  children.push(
    table(
      [
        { text: 'Field', width: 32 },
        { text: 'Value', width: 68 },
      ],
      model.identification.map((r) => [r.label, r.value]),
    ),
  );
  children.push(
    body(
      `Readiness snapshot: ${model.statusCounts.met} Met, ${model.statusCounts.partial} Partial, ` +
        `${model.statusCounts.notMet} Not Met, ${model.statusCounts.notReviewed} Not Reviewed, ` +
        `${model.statusCounts.notApplicable} Not Applicable (${model.readinessPct}% readiness).`,
    ),
  );

  // Section 2 — System Environment
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240 },
      children: [new TextRun({ text: '2. System Environment' })],
    }),
  );
  children.push(
    body('The following assets define the assessment scope boundary for this system.'),
  );
  children.push(
    table(
      [
        { text: 'Asset', width: 28 },
        { text: 'Type', width: 18 },
        { text: 'In / Out of Scope', width: 20 },
        { text: 'Notes', width: 34 },
      ],
      model.assets.length > 0
        ? model.assets.map((a) => [a.asset, a.type, a.inScope, a.notes])
        : [['No assets recorded', '—', '—', '—']],
    ),
  );

  // Section 3 — Security Requirements (all 110, grouped by family)
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240 },
      children: [new TextRun({ text: '3. Security Requirements' })],
    }),
  );
  children.push(
    body(
      'Each NIST SP 800-171 Rev. 2 security requirement is reproduced below with its official ' +
        'requirement text, current implementation status, and implementation statement. Requirements ' +
        'that are Not Met or Partial reference the related POA&M item(s).',
    ),
  );
  for (const section of model.families) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200 },
        children: [
          new TextRun({ text: `${section.family.section} ${section.family.name} (${section.family.code})` }),
        ],
      }),
    );
    for (const entry of section.controls) children.push(...controlBlock(entry));
  }

  // Appendix A — Estimated SPRS Score
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Appendix A — Estimated SPRS Score' })],
    }),
  );
  children.push(
    labelLine('Estimated SPRS score', `${formatScore(model.sprs.estimatedSprsScore)} of 110`),
  );
  children.push(
    labelLine(
      'Total deductions',
      `−${model.sprs.totalDeductions} across ${model.sprs.deductionCount} unmet requirement(s), ` +
        `incl. ${model.sprs.highImpactGapCount} high-impact (−5) gap(s)`,
    ),
  );
  children.push(
    labelLine('Methodology', 'NIST SP 800-171 DoD Assessment Methodology, Version 1.2.1 (Annex A)'),
  );
  for (const w of model.sprs.warnings) children.push(body(w, { italics: true, color: SILVER, size: 18 }));
  children.push(body(READINESS_SUPPORT_DISCLAIMER, { italics: true, color: SILVER, size: 18 }));

  // Appendix B — Evidence Index
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Appendix B — Evidence Index' })],
    }),
  );
  children.push(
    body(
      `Objective coverage: ${model.objectiveCoverage.controlsFullyCovered} of ` +
        `${model.objectiveCoverage.controlsWithObjectives} controls fully covered by accepted evidence; ` +
        `${model.objectiveCoverage.coveredObjectives}/${model.objectiveCoverage.totalObjectives} ` +
        `objectives covered.`,
    ),
  );
  children.push(
    body(
      'The references below are pointers only. All evidence artifacts are held in the client’s own ' +
        'secure repository — no files are stored in this system or in this document.',
      { italics: true, color: SILVER, size: 18 },
    ),
  );
  children.push(
    table(
      [
        { text: 'Evidence', width: 30 },
        { text: 'Control', width: 12 },
        { text: 'Status', width: 14 },
        { text: 'Quality', width: 12 },
        { text: 'Objectives', width: 14 },
        { text: 'Reference (held by client)', width: 18 },
      ],
      model.evidence.length > 0
        ? model.evidence.map((e) => [e.title, e.controlId, String(e.status), e.quality, e.objectives, e.reference])
        : [['No evidence recorded', '—', '—', '—', '—', '—']],
    ),
  );

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${model.meta.clientName}  ·  CONFIDENTIAL  ·  Page `, size: 16, color: SILVER }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: SILVER }),
          new TextRun({ text: ' of ', size: 16, color: SILVER }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: SILVER }),
        ],
      }),
    ],
  });

  return new Document({
    creator: 'Benchmark Fox Readiness Portal',
    title: `System Security Plan — ${model.meta.clientName}`,
    description: 'CMMC readiness System Security Plan (readiness support only — not a certification).',
    // Tell Word to refresh the TOC field on open.
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: BODY_FONT, size: 21 } },
        heading1: { run: { font: HEADING_FONT, size: 30, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 120 } } },
        heading2: { run: { font: HEADING_FONT, size: 26, bold: true, color: NAVY }, paragraph: { spacing: { before: 200, after: 100 } } },
        heading3: { run: { font: HEADING_FONT, size: 22, bold: true, color: NAVY }, paragraph: { spacing: { before: 160, after: 60 } } },
      },
    },
    sections: [{ children, footers: { default: footer } }],
  });
}

/** Sanitize a string into a filename-safe slug. */
function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Client';
}

/** Suggested download filename, e.g. "SSP_Acme_Defense_2026-06-13.docx". */
export function sspFilename(model: SspModel): string {
  const d = model.meta.generatedAt;
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `SSP_${slug(model.meta.clientName)}_${date}.docx`;
}

/** PURE entry point: SSP data in → Word .docx Blob out. No DOM, no storage. */
export async function generateSspBlob(input: SspInput): Promise<{ blob: Blob; filename: string }> {
  const model = buildSspModel(input);
  const doc = buildSspDocxDocument(model);
  const blob = await Packer.toBlob(doc);
  return { blob, filename: sspFilename(model) };
}
