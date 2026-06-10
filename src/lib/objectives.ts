/* ============================================================
   Objective coverage — readiness-support helpers over the official NIST SP
   800-171A assessment objectives. METADATA ONLY: this reasons about which
   objectives a control's evidence references; it never stores evidence files.
   ============================================================ */
import type { AssessmentMethod, Control, EvidenceItem } from '../data/types';

export type CoverageStatus = 'addressed' | 'partial' | 'not-addressed' | 'no-objectives';

export interface ControlObjectiveCoverage {
  total: number;
  coveredIds: string[];
  uncoveredIds: string[];
  methodsCovered: AssessmentMethod[];
  status: CoverageStatus;
}

/** Union of objective ids referenced by evidence metadata for a control. */
export function coveredObjectiveIdsForControl(controlId: string, evidence: EvidenceItem[]): Set<string> {
  const ids = new Set<string>();
  for (const e of evidence) {
    if (e.controlId !== controlId) continue;
    for (const oid of e.objectiveIds ?? []) ids.add(oid);
  }
  return ids;
}

/** Coverage of a control's official objectives given a set of covered objective ids. */
export function controlObjectiveCoverage(
  control: Control | undefined,
  coveredIds: Set<string>,
): ControlObjectiveCoverage {
  const objs = control?.assessmentObjectives ?? [];
  if (objs.length === 0) {
    return { total: 0, coveredIds: [], uncoveredIds: [], methodsCovered: [], status: 'no-objectives' };
  }
  const covered = objs.filter((o) => coveredIds.has(o.objectiveId));
  const uncovered = objs.filter((o) => !coveredIds.has(o.objectiveId));
  const methods = new Set<AssessmentMethod>();
  for (const o of covered) for (const m of o.assessmentMethods) methods.add(m);
  const status: CoverageStatus =
    covered.length === 0 ? 'not-addressed' : uncovered.length === 0 ? 'addressed' : 'partial';
  return {
    total: objs.length,
    coveredIds: covered.map((o) => o.objectiveId),
    uncoveredIds: uncovered.map((o) => o.objectiveId),
    methodsCovered: [...methods],
    status,
  };
}

export interface ObjectiveCoverageSummary {
  controlsWithObjectives: number;
  controlsFullyCovered: number;
  controlsPartiallyCovered: number;
  controlsNotCovered: number;
  totalObjectives: number;
  coveredObjectives: number;
  /** controls with the most uncovered objectives (need evidence) */
  topNeedingEvidence: { controlId: string; uncovered: number; total: number }[];
  /** how many objectives include each assessment method (readiness scope) */
  methodCounts: Record<AssessmentMethod, number>;
}

/** Aggregate objective coverage across a set of controls (for Reports). */
export function objectiveCoverageSummary(
  controls: Control[],
  evidence: EvidenceItem[],
  topN = 5,
): ObjectiveCoverageSummary {
  let controlsWithObjectives = 0;
  let full = 0;
  let partial = 0;
  let none = 0;
  let totalObjectives = 0;
  let coveredObjectives = 0;
  const methodCounts: Record<AssessmentMethod, number> = { examine: 0, interview: 0, test: 0 };
  const needing: { controlId: string; uncovered: number; total: number }[] = [];

  for (const c of controls) {
    if (!c.assessmentObjectives?.length) continue;
    controlsWithObjectives++;
    const cov = controlObjectiveCoverage(c, coveredObjectiveIdsForControl(c.id, evidence));
    totalObjectives += cov.total;
    coveredObjectives += cov.coveredIds.length;
    if (cov.status === 'addressed') full++;
    else if (cov.status === 'partial') partial++;
    else none++;
    if (cov.uncoveredIds.length > 0) {
      needing.push({ controlId: c.id, uncovered: cov.uncoveredIds.length, total: cov.total });
    }
    for (const o of c.assessmentObjectives) for (const m of o.assessmentMethods) methodCounts[m]++;
  }

  needing.sort((a, b) => b.uncovered - a.uncovered);
  return {
    controlsWithObjectives,
    controlsFullyCovered: full,
    controlsPartiallyCovered: partial,
    controlsNotCovered: none,
    totalObjectives,
    coveredObjectives,
    topNeedingEvidence: needing.slice(0, topN),
    methodCounts,
  };
}
