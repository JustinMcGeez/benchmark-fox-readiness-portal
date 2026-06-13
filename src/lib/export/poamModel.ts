/* ============================================================================
   POA&M workbook content model — the PURE, library-free model the exceljs
   renderer (poamXlsx.ts) walks. Data in → structured rows out; no exceljs, no
   DOM, no side effects. This is the layer the unit tests target.

   Columns mirror the DoD/eMASS-style POA&M template the DIB ecosystem uses.
   Open items go on the main sheet; closed/validated items on a second sheet.
   A third "Score Impact" sheet projects, per open item, what the SPRS estimate
   would be if that control were remediated — computed by the isolated scoring
   engine (projectedScoreIfRemediated); NO scoring math lives in this exporter.
   ============================================================================ */
import type {
  ClientControlAssessment,
  Control,
  PoamItem,
  PoamStatus,
  ReadinessStatus,
} from '../../data/types';
import { openPoamItems } from '../selectors';
import { projectedScoreIfRemediated } from '../scoring';
import { formatLongDate } from './common';

/** Statuses that put an item on the "Closed" sheet (open vs closed vs `None`). */
const POAM_CLOSED = new Set<PoamStatus>(['Complete', 'Validated', 'Closed']);

export const closedPoamItems = (items: PoamItem[]): PoamItem[] =>
  items.filter((p) => POAM_CLOSED.has(p.status));

/** One POA&M row (open or closed sheet) — exactly the template's 11 columns. */
export interface PoamRowModel {
  itemId: string;
  controlId: string;
  weakness: string;
  severity: string; // risk level
  source: string; // how the weakness was identified (assessment / self)
  resources: string; // resources required
  /** Parsed scheduled completion date, or null when unset/unparseable. */
  scheduledCompletion: Date | null;
  /** Original date string (shown when it could not be parsed to a real Date). */
  scheduledCompletionRaw: string;
  milestones: string; // multi-line: "✓/○ label — date"
  milestoneChanges: string;
  status: PoamStatus;
  comments: string; // remediation plan + POC + closure evidence
}

/** One "Score Impact" row — per open item, the score gain from remediation. */
export interface ScoreImpactRowModel {
  itemId: string;
  controlId: string;
  currentStatus: ReadinessStatus;
  /** Positive magnitude this control currently deducts (0 if none). */
  deduction: number;
  currentScore: number;
  projectedScore: number;
}

export interface PoamWorkbookModel {
  meta: { clientName: string; generatedAt: Date; generatedAtLabel: string };
  open: PoamRowModel[];
  closed: PoamRowModel[];
  scoreImpact: ScoreImpactRowModel[];
  counts: { open: number; closed: number };
}

export interface PoamWorkbookInput {
  clientName: string;
  /** POA&M items already scoped to the current client. */
  poam: PoamItem[];
  /** Current client assessments — drives the Score Impact projection. */
  assessments: ClientControlAssessment[];
  controlsById: Record<string, Control>;
  generatedAt?: Date;
}

/**
 * Parse a 'MM/DD/YYYY' POA&M date into a real local Date (no timezone shift),
 * or null when empty/malformed. Used so the workbook writes true date cells.
 */
export function parsePoamDate(value: string | undefined): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

/** Render milestones as a wrapped multi-line cell value, with dates + done state. */
export function formatMilestones(item: PoamItem): string {
  if (!item.milestones || item.milestones.length === 0) return 'None recorded';
  return item.milestones
    .map((m) => `${m.done ? '✓' : '○'} ${m.label}${m.date ? ` — ${m.date}` : ''}`)
    .join('\n');
}

/** Comments cell: remediation plan + point of contact + closure evidence. */
function buildComments(item: PoamItem): string {
  const poc = item.owner
    ? `POC: ${item.owner}${item.office ? ` (${item.office})` : ''}`
    : '';
  return [
    item.remediationPlan,
    poc,
    item.evidenceForClosure ? `Closure evidence: ${item.evidenceForClosure}` : '',
  ]
    .filter((s) => s && s.trim().length > 0)
    .join('\n');
}

function rowFor(item: PoamItem): PoamRowModel {
  return {
    itemId: item.id,
    controlId: item.controlId,
    weakness: item.weakness,
    severity: item.risk,
    source: item.howIdentified?.trim() || '—',
    resources: item.resourceEstimate?.trim() || '—',
    scheduledCompletion: parsePoamDate(item.dueDate),
    scheduledCompletionRaw: item.dueDate ?? '',
    milestones: formatMilestones(item),
    milestoneChanges: item.changesToMilestones?.trim() || 'None since baseline.',
    status: item.status,
    comments: buildComments(item) || '—',
  };
}

/** Build the full POA&M workbook content model. Pure + deterministic. */
export function buildPoamWorkbookModel(input: PoamWorkbookInput): PoamWorkbookModel {
  const generatedAt = input.generatedAt ?? new Date();
  const openItems = openPoamItems(input.poam);
  const closedItems = closedPoamItems(input.poam);

  const scoreImpact: ScoreImpactRowModel[] = openItems.map((item) => {
    const projection = projectedScoreIfRemediated(
      input.assessments,
      input.controlsById,
      item.controlId,
    );
    return {
      itemId: item.id,
      controlId: item.controlId,
      currentStatus: projection.status,
      deduction: projection.deduction,
      currentScore: projection.currentScore,
      projectedScore: projection.projectedScore,
    };
  });

  return {
    meta: {
      clientName: input.clientName,
      generatedAt,
      generatedAtLabel: formatLongDate(generatedAt),
    },
    open: openItems.map(rowFor),
    closed: closedItems.map(rowFor),
    scoreImpact,
    counts: { open: openItems.length, closed: closedItems.length },
  };
}
