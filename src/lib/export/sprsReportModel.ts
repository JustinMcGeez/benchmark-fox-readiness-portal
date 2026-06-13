/* ============================================================================
   SPRS readiness report content model — the PURE, library-free model the
   PDF renderer (sprsReportPdf.tsx) walks. Data in → structured content out;
   no @react-pdf, no DOM, no side effects. This is the layer the unit tests target.

   CRITICAL: every number is produced by the SAME isolated selectors the
   dashboard / Report Preview screen use (estimateSprs, readinessPct,
   statusCounts, scoreByFamily, topFindings, topDeductionDrivers), so the PDF
   can never drift from what the app shows on screen.
   ============================================================================ */
import type {
  ClientControlAssessment,
  Control,
  EvidenceItem,
  PoamItem,
  ReadinessStatus,
} from '../../data/types';
import { CONTROL_FAMILIES } from '../../data/controlFamilies';
import {
  estimateSprs,
  readinessPct,
  scoreByFamily,
  statusCounts,
  topDeductionDrivers,
  type SprsEstimate,
  type StatusCounts,
} from '../scoring';
import { topFindings, type Finding } from '../selectors';
import { formatLongDate } from './common';

export type RiskBand = 'Low' | 'Medium' | 'High';

/** One family bar for the By-family readiness summary (official family order). */
export interface SprsFamilyBar {
  code: string; // 'AC'
  name: string; // 'Access Control'
  section: string; // '3.1'
  readiness: number; // 0–100 %
  deduction: number; // total SPRS points this family currently loses
}

/** One score-recovery opportunity (largest deductions currently unmet). */
export interface SprsRecoveryItem {
  controlId: string;
  title: string;
  impact: number; // positive magnitude recoverable
  status: ReadinessStatus;
}

export interface SprsReportModel {
  meta: {
    clientName: string;
    cmmcTarget: string;
    version: string;
    generatedAt: Date;
    generatedAtLabel: string;
  };
  sprs: SprsEstimate;
  readinessPct: number;
  riskBand: RiskBand;
  statusCounts: StatusCounts;
  families: SprsFamilyBar[];
  findings: Finding[];
  recovery: SprsRecoveryItem[];
  /** Methodology warnings from the scoring engine (Partial→Not Met, etc.). */
  warnings: string[];
}

export interface SprsReportInput {
  clientName: string;
  cmmcTarget: string;
  assessments: ClientControlAssessment[];
  controls: Control[];
  controlsById: Record<string, Control>;
  evidence: EvidenceItem[];
  /** POA&M items already scoped to the current client (drives top findings). */
  poam: PoamItem[];
  version?: string;
  generatedAt?: Date;
}

/** Same banding the Report Preview screen uses, so the cover risk matches. */
export function riskBandFor(readiness: number): RiskBand {
  if (readiness >= 80) return 'Low';
  if (readiness >= 60) return 'Medium';
  return 'High';
}

const FAMILY_ORDER = new Map(CONTROL_FAMILIES.map((f, i) => [f.code, i]));
const FAMILY_BY_CODE = new Map(CONTROL_FAMILIES.map((f) => [f.code, f]));

/** Build the full SPRS report content model from the app's data. Pure. */
export function buildSprsReportModel(input: SprsReportInput): SprsReportModel {
  const generatedAt = input.generatedAt ?? new Date();
  const readiness = readinessPct(input.assessments);

  const families: SprsFamilyBar[] = scoreByFamily(input.assessments, input.controlsById)
    .map((f) => ({
      code: f.code,
      name: f.name,
      section: FAMILY_BY_CODE.get(f.code)?.section ?? '',
      readiness: f.readiness,
      deduction: f.deduction,
    }))
    .sort((a, b) => (FAMILY_ORDER.get(a.code) ?? 99) - (FAMILY_ORDER.get(b.code) ?? 99));

  const recovery: SprsRecoveryItem[] = topDeductionDrivers(
    input.assessments,
    input.controlsById,
    5,
  ).map((d) => ({
    controlId: d.control.id,
    title: d.control.title,
    impact: d.impact,
    status: d.status,
  }));

  const sprs = estimateSprs(input.assessments, input.controlsById);

  return {
    meta: {
      clientName: input.clientName,
      cmmcTarget: input.cmmcTarget,
      version: input.version ?? '1.0',
      generatedAt,
      generatedAtLabel: formatLongDate(generatedAt),
    },
    sprs,
    readinessPct: readiness,
    riskBand: riskBandFor(readiness),
    statusCounts: statusCounts(input.assessments),
    families,
    findings: topFindings(input.assessments, input.poam, input.evidence, input.controlsById, 5),
    recovery,
    warnings: sprs.warnings,
  };
}
