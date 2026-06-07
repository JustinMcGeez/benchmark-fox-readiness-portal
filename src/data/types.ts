/* ============================================================
   Domain model — shared interfaces for the data-driven MVP.
   These describe the seed data and the values screens compute from.
   ============================================================ */
import type { RiskLevel } from '../types';

export type { RiskLevel };

/* ---- status enums (kept as string unions so they map cleanly to badges) ---- */
export type ReadinessStatus = 'Met' | 'Partial' | 'Not Met' | 'Not Reviewed' | 'Not Applicable';
export type SspStatus = 'Complete' | 'Needs Fix' | 'Missing' | 'Mismatch' | 'Not Reviewed';
export type EvidenceStatus =
  | 'Requested'
  | 'Uploaded'
  | 'In Review'
  | 'Accepted'
  | 'Needs Revision'
  | 'Rejected'
  | 'Missing'
  | 'Expired'
  | 'Not Requested';
export type PoamStatus = 'None' | 'Not Started' | 'Ongoing' | 'Blocked' | 'Complete' | 'Validated' | 'Closed';
export type EvidenceQuality = 'Strong' | 'Acceptable' | 'Weak' | 'Missing' | 'Not Relevant' | 'Outdated';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Done';
export type PoamClass = 'Blocker' | 'Readiness' | 'Internal';

/* option lists used by the matrix dropdowns + detail controls */
export const READINESS_OPTIONS: ReadinessStatus[] = [
  'Met',
  'Partial',
  'Not Met',
  'Not Reviewed',
  'Not Applicable',
];
export const SSP_OPTIONS: SspStatus[] = ['Complete', 'Needs Fix', 'Missing', 'Mismatch', 'Not Reviewed'];
export const EVIDENCE_OPTIONS: EvidenceStatus[] = [
  'Not Requested',
  'Requested',
  'Uploaded',
  'In Review',
  'Accepted',
  'Needs Revision',
  'Rejected',
  'Missing',
  'Expired',
];
export const POAM_OPTIONS: PoamStatus[] = [
  'None',
  'Not Started',
  'Ongoing',
  'Blocked',
  'Complete',
  'Validated',
  'Closed',
];
export const OWNER_OPTIONS = ['IT Lead', 'CIO', 'MSP', 'HR / IT', 'Security', 'Unassigned'] as const;
export type Owner = (typeof OWNER_OPTIONS)[number];

/* ---- entities ---- */

export interface Client {
  id: string;
  name: string;
  cmmcPath: string;
  level: string;
  /** seed summary used by the Clients list (the active client's dashboard computes live values) */
  readiness: number;
  score: string;
  riskRating: RiskLevel;
  phase: string;
  owner: string;
  deadline?: string;
  lastUpdated: string;
  active: boolean;
}

/** Library-level control definition (client-independent). */
export interface Control {
  id: string; // e.g. '3.1.1' (same as number)
  number: string; // e.g. '3.1.1'
  code: string; // e.g. 'AC.L1-3.1.1'
  familyCode: string; // e.g. 'AC'
  familyName: string; // e.g. 'Access Control'
  /** lowest CMMC level at which the requirement applies */
  level: 'L1' | 'L2';
  /**
   * SPRS point weight deducted when the control is not implemented.
   * `null` = NOT FINALIZED — the official DoD Assessment Methodology value is
   * not available from a bundled local source, so it must not be guessed.
   */
  scoreValue: number | null;
  title: string; // short display label (derived from requirement)
  summary: string; // requirement summary for tables
  requirement: string; // official NIST SP 800-171 Rev. 2 requirement text
  explanation: string; // Benchmark Fox plain-English explanation ('' = TODO placeholder)
  commonMistakes?: string[];
  evidenceExamples?: string[];
  guidance?: { implementation?: string; interview?: string };
  sspGuidance?: string | null; // BF SSP language guidance (null = TODO)
  poamGuidance?: string | null; // BF POA&M guidance (null = TODO)
  /** NIST SP 800-171A assessment objectives (null = TODO, not bundled locally) */
  assessmentObjectives?: string[] | null;
  /** sourceId references into SOURCE_REFS */
  sourceRefs: string[];
}

/** Per-client assessment of a control — the editable, persisted record. */
export interface ClientControlAssessment {
  clientId: string;
  controlId: string;
  status: ReadinessStatus;
  sspStatus: SspStatus;
  evidenceStatus: EvidenceStatus;
  poamStatus: PoamStatus;
  risk: RiskLevel;
  owner: string;
  dueDate?: string;
  lastReviewed?: string;
  consultantNotes?: string;
  sspStatement?: string;
}

export interface EvidenceItem {
  id: string;
  clientId: string;
  title: string;
  controlId: string;
  /** NIST SP 800-171A assessment objective this evidence supports (e.g. '3.5.3[a]') */
  assessmentObjective?: string;
  owner: string;
  status: EvidenceStatus;
  quality: EvidenceQuality;
  freshness: 'Current' | 'Expired' | 'N/A';
  /** does the evidence support the SSP statement? */
  sspSupported?: 'Yes' | 'Partial' | 'No';
  poamId?: string;
  taskId?: string;
  method?: string;
  notes?: string;
}

export interface PoamMilestone {
  label: string;
  date: string;
  done?: boolean;
}

export interface PoamItem {
  id: string;
  clientId: string;
  controlId: string;
  weakness: string;
  owner: string;
  office?: string;
  risk: RiskLevel;
  dueDate: string;
  status: PoamStatus;
  classification: PoamClass;
  remediationPlan?: string;
  resourceEstimate?: string;
  howIdentified?: string;
  evidenceForClosure?: string;
  milestones?: PoamMilestone[];
  changesToMilestones?: string;
  /** relationship mapping */
  evidenceIds?: string[];
  taskIds?: string[];
}

export interface TaskItem {
  id: string;
  clientId: string;
  title: string;
  owner: string;
  priority: RiskLevel;
  dueDate: string;
  status: TaskStatus;
  description?: string;
  relatedControlId?: string;
  relatedPoamId?: string;
  relatedEvidenceId?: string;
}

export interface ReportItem {
  id: string;
  title: string;
  description: string;
  /** which data the report is generated from */
  feeds: string[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  client: string;
  action: string;
  details: string;
}
