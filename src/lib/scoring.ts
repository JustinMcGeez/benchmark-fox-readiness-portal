/* ============================================================
   Scoring engine — isolated readiness/SPRS math.

   This is a prototype model, intentionally simple and kept in one
   place so it can be swapped for the official CMMC/SPRS rules later
   without touching any screen.

   Model:
   - SPRS-style score starts at 110 and deducts each control's point
     weight when the control is not implemented (binary, like SPRS:
     Met = 0 deduction, otherwise full deduction; N/A excluded).
   - Readiness % is a softer consultant metric that gives Partial
     half credit: (Met + 0.5·Partial) / applicable controls.
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

/** Whether a status counts as a full point deduction in the SPRS-style score. */
function isDeducted(status: ReadinessStatus): boolean {
  return status !== 'Met' && status !== 'Not Applicable';
}

export function deductionFor(a: ClientControlAssessment, control?: Control): number {
  if (!control) return 0;
  return isDeducted(a.status) ? control.scoreValue : 0;
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

/** SPRS-style score: 110 minus the sum of deductions. Can go negative. */
export function sprsScore(
  assessments: ClientControlAssessment[],
  controlsById: Record<string, Control>,
): number {
  const deductions = assessments.reduce((sum, a) => sum + deductionFor(a, controlsById[a.controlId]), 0);
  return Math.round(SPRS_MAX - deductions);
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
  return `−${control?.scoreValue ?? 0}`;
}

export interface FamilyScore {
  code: string;
  name: string;
  deduction: number;
  readiness: number; // %
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
    const deduction = list.reduce((s, a) => s + deductionFor(a, controlsById[a.controlId]), 0);
    rows.push({ code, name, deduction, readiness: readinessPct(list) });
  }
  // worst (highest deduction) first
  return rows.sort((a, b) => b.deduction - a.deduction);
}
