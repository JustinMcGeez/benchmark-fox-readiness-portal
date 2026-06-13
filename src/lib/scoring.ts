/* ============================================================
   Scoring engine — isolated readiness/SPRS math. This file contains:

   a. Readiness percentage logic — a softer consultant metric that gives
      Partial half credit: (Met + 0.5·Partial) / applicable controls.
   b. Estimated SPRS scoring logic using the OFFICIAL DoD Assessment
      Methodology values (v1.2.1, Annex A): start at 110 and subtract each
      control's official -5/-3/-1 deduction when it is not implemented
      (3.12.4 is "NA" — 0). The result is an estimate, not an official
      assessment result, and can go below zero.
   c. Conservative handling for "Partial": Partial is NOT an official final
      SPRS status, so for the estimate it is counted as a full deduction
      (treated like Not Met) and surfaced in warnings; only the readiness %
      gives Partial half credit.
   ============================================================ */
import type { ClientControlAssessment, Control, ReadinessStatus } from '../data/types';

export const SPRS_MAX = 110;

export interface StatusCounts {
  met: number;
  partial: number;
  notMet: number;
  notReviewed: number;
  notApplicable: number;
  total: number;
  applicable: number;
}

const ALLOWED_DEDUCTIONS = new Set([-5, -3, -1, 0]);

/**
 * True when official scoring is fully loaded: every control has a non-placeholder
 * scoreSource, a defined sprsDeductionValue, and an allowed value (-5/-3/-1, or 0
 * for the documented NA control 3.12.4). We check provenance + the deduction
 * value, not a non-null magnitude (3.12.4 is "NA" with a null magnitude by design).
 */
export function scoringFinalized(controlsById: Record<string, Control>): boolean {
  const list = Object.values(controlsById);
  if (list.length === 0) return false;
  return list.every(
    (c) =>
      c.scoreSource !== 'placeholder' &&
      c.scoreSource !== '' &&
      c.sprsDeductionValue !== undefined &&
      c.sprsDeductionValue !== null &&
      ALLOWED_DEDUCTIONS.has(c.sprsDeductionValue),
  );
}

export function statusCounts(assessments: ClientControlAssessment[]): StatusCounts {
  const c: StatusCounts = {
    met: 0,
    partial: 0,
    notMet: 0,
    notReviewed: 0,
    notApplicable: 0,
    total: assessments.length,
    applicable: 0,
  };
  for (const a of assessments) {
    switch (a.status) {
      case 'Met':
        c.met++;
        break;
      case 'Partial':
        c.partial++;
        break;
      case 'Not Met':
        c.notMet++;
        break;
      case 'Not Reviewed':
        c.notReviewed++;
        break;
      case 'Not Applicable':
        c.notApplicable++;
        break;
    }
  }
  c.applicable = c.total - c.notApplicable;
  return c;
}

/**
 * Legacy wrapper — returns only the estimated SPRS score. Prefer `estimateSprs()`
 * for the full breakdown. Delegates so all callers share one conservative model
 * (Partial counted as a full deduction). Can go negative.
 */
export function sprsScore(
  assessments: ClientControlAssessment[],
  controlsById: Record<string, Control>,
): number {
  return estimateSprs(assessments, controlsById).estimatedSprsScore;
}

/** Formatted with an explicit sign, e.g. "−38" / "+6". */
export function formatScore(score: number): string {
  if (score > 0) return `+${score}`;
  if (score < 0) return `−${Math.abs(score)}`;
  return '0';
}

/** Readiness percentage (Partial gets half credit). */
export function readinessPct(assessments: ClientControlAssessment[]): number {
  const c = statusCounts(assessments);
  if (c.applicable === 0) return 0;
  return Math.round(((c.met + 0.5 * c.partial) / c.applicable) * 100);
}

/** Per-control display value for the matrix Score column. */
export function controlScoreDisplay(a: ClientControlAssessment, control?: Control): string {
  if (a.status === 'Not Reviewed') return 'TBD';
  if (a.status === 'Met' || a.status === 'Not Applicable') return '0';
  if (control?.scoreValue == null) return '—'; // deduction not finalized
  return `−${control.scoreValue}`;
}

export interface FamilyScore {
  code: string;
  name: string;
  deduction: number;
  readiness: number; // %
}

/* ============================================================
   Official SPRS estimate (DoD Assessment Methodology v1.2.1).

   Baseline 110. A control deducts its official point value when it is NOT
   implemented. Status handling (conservative, readiness-support estimate):
     - Met            → no deduction.
     - Not Applicable → no deduction (excluded from the assessment).
     - Not Met        → full deduction.
     - Not Reviewed   → treated as not implemented → full deduction (you only
                        earn points for implemented requirements).
     - Partial        → NOT an official SPRS status. Treated CONSERVATIVELY as
                        Not Met (full deduction), counted + surfaced in warnings.
   3.12.4 ("NA") carries no point value and never deducts.
   The estimate can go below zero. It is NOT an official assessment result.
   ============================================================ */
const isNotImplemented = (status: ReadinessStatus): boolean =>
  status === 'Not Met' || status === 'Not Reviewed' || status === 'Partial';

export interface SprsEstimate {
  estimatedSprsScore: number;
  totalDeductions: number;
  deductionCount: number;
  highImpactGapCount: number; // unmet controls worth -5
  partialCount: number;
  missingScoringCount: number; // controls without an official value (should be 0)
  scoringComplete: boolean;
  warnings: string[];
}

/** Per-control deduction contribution given the current status (positive magnitude). */
export function deductionImpact(a: ClientControlAssessment, control?: Control): number {
  if (!control || control.scoreValue == null) return 0; // NA / unknown → no deduction
  return isNotImplemented(a.status) ? control.scoreValue : 0;
}

export function estimateSprs(
  assessments: ClientControlAssessment[],
  controlsById: Record<string, Control>,
): SprsEstimate {
  let totalDeductions = 0;
  let deductionCount = 0;
  let highImpactGapCount = 0;
  let partialCount = 0;
  let missingScoringCount = 0;

  for (const a of assessments) {
    const control = controlsById[a.controlId];
    if (a.status === 'Partial') partialCount++;
    if (!control || control.scoreSource === 'placeholder' || control.scoreSource === '') {
      missingScoringCount++;
      continue;
    }
    const impact = deductionImpact(a, control);
    if (impact > 0) {
      totalDeductions += impact;
      deductionCount++;
      if (impact === 5) highImpactGapCount++;
    }
  }

  const warnings: string[] = [];
  if (partialCount > 0) {
    warnings.push(
      `${partialCount} control(s) marked Partial are not an official SPRS status — counted conservatively as Not Met (full deduction).`,
    );
  }
  if (missingScoringCount > 0) {
    warnings.push(`${missingScoringCount} control(s) have no official scoring value loaded.`);
  }
  warnings.push('Estimate based on current readiness inputs; not an official assessment result.');

  return {
    estimatedSprsScore: Math.round(SPRS_MAX - totalDeductions),
    totalDeductions,
    deductionCount,
    highImpactGapCount,
    partialCount,
    missingScoringCount,
    scoringComplete: missingScoringCount === 0,
    warnings,
  };
}

/** Unmet controls sorted by deduction impact (desc) — drives "top gaps" displays. */
export function topDeductionDrivers(
  assessments: ClientControlAssessment[],
  controlsById: Record<string, Control>,
  limit = 5,
): { control: Control; impact: number; status: ReadinessStatus }[] {
  return assessments
    .map((a) => {
      const control = controlsById[a.controlId];
      return control ? { control, impact: deductionImpact(a, control), status: a.status } : null;
    })
    .filter((x): x is { control: Control; impact: number; status: ReadinessStatus } => !!x && x.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, limit);
}

export interface RemediationProjection {
  /** The control's current readiness status. */
  status: ReadinessStatus;
  /** Current estimated SPRS score across all assessments. */
  currentScore: number;
  /** Point value this control currently deducts (positive magnitude; 0 if none). */
  deduction: number;
  /** Estimated score if this single control were remediated to Met. */
  projectedScore: number;
}

/**
 * Projected SPRS estimate if ONE control were remediated to Met, reusing the
 * isolated engine (no scoring math may live in the exporters). Remediating a
 * control that currently deducts removes exactly its deduction, so the projected
 * score is the current estimate plus that control's deduction impact. A control
 * already implemented (Met / Not Applicable) deducts 0 → projected == current.
 */
export function projectedScoreIfRemediated(
  assessments: ClientControlAssessment[],
  controlsById: Record<string, Control>,
  controlId: string,
): RemediationProjection {
  const currentScore = estimateSprs(assessments, controlsById).estimatedSprsScore;
  const assessment = assessments.find((a) => a.controlId === controlId);
  const control = controlsById[controlId];
  const status: ReadinessStatus = assessment?.status ?? 'Not Reviewed';
  const deduction = assessment ? deductionImpact(assessment, control) : 0;
  return { status, currentScore, deduction, projectedScore: currentScore + deduction };
}

export function scoreByFamily(
  assessments: ClientControlAssessment[],
  controlsById: Record<string, Control>,
): FamilyScore[] {
  const byFam = new Map<string, ClientControlAssessment[]>();
  for (const a of assessments) {
    const fam = controlsById[a.controlId]?.familyCode ?? '—';
    (byFam.get(fam) ?? byFam.set(fam, []).get(fam)!).push(a);
  }
  const rows: FamilyScore[] = [];
  for (const [code, list] of byFam) {
    const name = controlsById[list[0].controlId]?.familyName ?? code;
    // Same conservative model as estimateSprs (Partial = full deduction).
    const deduction = list.reduce((s, a) => s + deductionImpact(a, controlsById[a.controlId]), 0);
    rows.push({ code, name, deduction, readiness: readinessPct(list) });
  }
  // worst (highest deduction) first
  return rows.sort((a, b) => b.deduction - a.deduction);
}
