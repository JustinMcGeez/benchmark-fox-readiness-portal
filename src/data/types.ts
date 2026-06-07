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
export type EvidenceQuality = 'Strong' | 'Acceptable' | 'Weak' | 'Missing';
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
  id: string; // e.g. '3.1.1'
  code: string; // e.g. 'AC.L2-3.1.1'
  familyCode: string; // e.g. 'AC'
  familyName: string; // e.g. 'Access Control'
  level: 'L1' | 'L2';
  /** SPRS point weight deducted when the control is not implemented (1, 3 or 5). */
  scoreValue: number;
  title: string;
  summary: string; // short requirement summary for tables
  requirement: string; // full requirement text
  explanation: string; // plain-English explanation
  commonMistakes?: string[];
  evidenceExamples?: string[];
  guidance?: { implementation?: string; interview?: string };
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
  owner: string;
  status: EvidenceStatus;
  quality: EvidenceQuality;
  freshness: 'Current' | 'Expired' | 'N/A';
  method?: string;
  notes?: string;
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
}

export interface ReportItem {
  id: string;
  title: string;
  description: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  client: string;
  action: string;
  details: string;
}
