/* ============================================================
   Derived selectors over the seed data — single source of truth for
   the counts and lists shown on the dashboards, so every screen agrees.
   ============================================================ */
import type {
  ClientControlAssessment,
  Control,
  EvidenceItem,
  EvidenceStatus,
  PoamItem,
  RiskLevel,
  TaskItem,
} from '../data/types';
import { EVIDENCE_OPTIONS } from '../data/types';
import { effectiveStatus } from './evidenceWorkflow';
import {
  controlObjectiveCoverage,
  coveredObjectiveIdsForControl,
  objectiveCoverageSummary,
  type ControlObjectiveCoverage,
  type ObjectiveCoverageSummary,
} from './objectives';

const POAM_OPEN = new Set<PoamItem['status']>(['Not Started', 'Ongoing', 'Blocked']);

export const priorityRank = (p: RiskLevel | string): number =>
  ({ Critical: 3, High: 2, Medium: 1, Low: 0 })[p as RiskLevel] ?? 0;

export const openPoamItems = (items: PoamItem[]): PoamItem[] =>
  items.filter((p) => POAM_OPEN.has(p.status));

export const blockerItems = (items: PoamItem[]): PoamItem[] =>
  items.filter((p) => p.classification === 'Blocker');

export const missingEvidenceCount = (items: EvidenceItem[]): number =>
  items.filter((e) => e.status === 'Missing' || e.status === 'Requested').length;

export const weakEvidenceCount = (items: EvidenceItem[]): number =>
  items.filter((e) => e.quality === 'Weak' || e.quality === 'Missing' || e.quality === 'Outdated').length;

/* ============================================================
   Evidence selectors — the SINGLE source of truth for evidence coverage and
   counts shared by the Evidence Hub, Control Detail, SSP Workspace, and Reports
   (Task 08). Screens never filter the evidence list inline; they call these.
   "Covered" means an objective is referenced by ACCEPTED evidence (expiry-aware
   via effectiveStatus — Accepted-but-expired no longer counts).
   ============================================================ */

/** All evidence items mapped to one control. */
export const evidenceForControl = (items: EvidenceItem[], controlId: string): EvidenceItem[] =>
  items.filter((e) => e.controlId === controlId);

/** Evidence whose effective (expiry-aware) status is Accepted. */
export const acceptedEvidence = (items: EvidenceItem[], now: Date = new Date()): EvidenceItem[] =>
  items.filter((e) => effectiveStatus(e, now) === 'Accepted');

/** Objective coverage of one control by ACCEPTED evidence. */
export function controlEvidenceCoverage(
  control: Control | undefined,
  items: EvidenceItem[],
  now: Date = new Date(),
): ControlObjectiveCoverage {
  return controlObjectiveCoverage(
    control,
    coveredObjectiveIdsForControl(control?.id ?? '', acceptedEvidence(items, now)),
  );
}

/** Aggregate objective coverage across controls, by ACCEPTED evidence (Reports). */
export function evidenceObjectiveSummary(
  controls: Control[],
  items: EvidenceItem[],
  topN = 5,
  now: Date = new Date(),
): ObjectiveCoverageSummary {
  return objectiveCoverageSummary(controls, acceptedEvidence(items, now), topN);
}

/** Count of evidence items grouped by EFFECTIVE status (Evidence Hub board). */
export function evidenceCountsByStatus(
  items: EvidenceItem[],
  now: Date = new Date(),
): Record<EvidenceStatus, number> {
  const counts = Object.fromEntries(EVIDENCE_OPTIONS.map((s) => [s, 0])) as Record<
    EvidenceStatus,
    number
  >;
  for (const e of items) counts[effectiveStatus(e, now)]++;
  return counts;
}

/**
 * Control ids that appear in the evidence list but have ZERO accepted evidence
 * — drives the Evidence Hub "controls with zero accepted evidence" filter.
 */
export function controlIdsWithoutAcceptedEvidence(
  items: EvidenceItem[],
  now: Date = new Date(),
): Set<string> {
  const accepted = new Set(acceptedEvidence(items, now).map((e) => e.controlId).filter(Boolean));
  const out = new Set<string>();
  for (const e of items) {
    if (e.controlId && !accepted.has(e.controlId)) out.add(e.controlId);
  }
  return out;
}

export const openTaskCount = (tasks: TaskItem[]): number =>
  tasks.filter((t) => t.status !== 'Done').length;

export const topBlockers = (items: PoamItem[], n = 4): PoamItem[] =>
  [...items]
    .sort(
      (a, b) =>
        Number(b.classification === 'Blocker') - Number(a.classification === 'Blocker') ||
        priorityRank(b.risk) - priorityRank(a.risk),
    )
    .slice(0, n);

export const nextActions = (tasks: TaskItem[], n = 3): TaskItem[] =>
  [...tasks]
    .filter((t) => t.status !== 'Done')
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, n);

export interface Finding {
  id: string;
  text: string;
  severity: number;
}

/**
 * Computed top findings for the executive report, aggregated from:
 *  - blocker POA&M items
 *  - not-met / high-risk controls
 *  - SSP missing / needs-fix items
 *  - missing / weak evidence
 */
export function topFindings(
  assessments: ClientControlAssessment[],
  poam: PoamItem[],
  evidence: EvidenceItem[],
  controlsById: Record<string, Control>,
  n = 5,
): Finding[] {
  const out: Finding[] = [];

  for (const p of poam) {
    if (p.classification === 'Blocker') {
      out.push({ id: 'poam-' + p.id, text: `POA&M blocker (${p.controlId}): ${p.weakness}`, severity: 6 });
    }
  }
  for (const a of assessments) {
    if (a.status === 'Not Met' && (a.risk === 'High' || a.risk === 'Critical')) {
      const title = controlsById[a.controlId]?.title ?? '';
      out.push({
        id: 'ctl-' + a.controlId,
        text: `Not met (${a.risk} risk): ${a.controlId} — ${title}`,
        severity: a.risk === 'Critical' ? 5 : 4,
      });
    }
  }
  for (const a of assessments) {
    if (a.sspStatus === 'Missing' || a.sspStatus === 'Needs Fix') {
      out.push({
        id: 'ssp-' + a.controlId,
        text: `SSP ${a.sspStatus.toLowerCase()} for ${a.controlId}`,
        severity: a.sspStatus === 'Missing' ? 3 : 2,
      });
    }
  }
  for (const e of evidence) {
    if (e.status === 'Missing' || e.quality === 'Weak' || e.quality === 'Missing') {
      out.push({ id: 'ev-' + e.id, text: `Evidence gap: ${e.title} (${e.controlId})`, severity: 2 });
    }
  }

  const seen = new Set<string>();
  return out
    .sort((a, b) => b.severity - a.severity)
    .filter((f) => (seen.has(f.text) ? false : (seen.add(f.text), true)))
    .slice(0, n);
}
