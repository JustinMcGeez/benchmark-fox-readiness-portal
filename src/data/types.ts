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

/**
 * Official SPRS deduction values (DoD Assessment Methodology, Annex A):
 * -5 / -3 / -1, plus 0 for the single documented "NA" control (3.12.4).
 */
export type SprsDeduction = -5 | -3 | -1 | 0;

/** NIST SP 800-171A assessment methods. */
export type AssessmentMethod = 'examine' | 'interview' | 'test';

/**
 * A single official NIST SP 800-171A assessment objective (determination
 * statement). `objectiveText` is OFFICIAL source text and must stay separate
 * from any Benchmark Fox-authored guidance (`benchmarkFoxNotes`).
 */
export interface AssessmentObjective {
  objectiveId: string; // e.g. '3.1.1[a]' (or '3.4.4' for single-objective reqs)
  objectiveText: string; // official NIST SP 800-171A text — never mixed with BF notes
  assessmentMethods: AssessmentMethod[];
  source: string; // 'nist-sp-800-171a'
  sourceVersion?: string;
  /** Optional Benchmark Fox readiness note — NOT official source text. */
  benchmarkFoxNotes?: string;
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
   * Display magnitude (positive, 5/3/1) of the SPRS deduction — used by the UI.
   * `null` ONLY for the official "NA" control (3.12.4), whose Annex A value is
   * "NA" (System Security Plan — not point-scored; see scoreNotes). Never guessed.
   */
  scoreValue: number | null;
  /**
   * Official signed SPRS deduction (DoD Assessment Methodology) applied when the
   * control is not implemented: -5 | -3 | -1, or 0 for the single documented "NA"
   * control (3.12.4). Source of truth for scoring math.
   */
  sprsDeductionValue: SprsDeduction;
  /**
   * Identifies the source of the scoring value. The literal
   * 'nist-sp-800-171-dod-assessment-methodology' once official values are loaded
   * (current state); 'placeholder' only before they are. String (not a fixed
   * union) so the official source id is explicit.
   */
  scoreSource: string;
  /** Official scoring document version, e.g. 'Version 1.2.1 (June 24, 2020)'. */
  scoreSourceVersion?: string;
  /**
   * Notes on the scoring value — special cases (3.5.3 / 3.13.11 are "3 to 5",
   * base -5) and the NA control (3.12.4). NOTE: "Partial" is not an official
   * final SPRS status; the app counts it conservatively as a full deduction.
   */
  scoreNotes?: string;
  title: string; // short display label (derived from requirement)
  summary: string; // requirement summary for tables
  requirement: string; // official NIST SP 800-171 Rev. 2 requirement text
  explanation: string; // Benchmark Fox plain-English explanation ('' = TODO placeholder)
  commonMistakes?: string[];
  evidenceExamples?: string[];
  guidance?: { implementation?: string; interview?: string };
  sspGuidance?: string | null; // BF SSP language guidance (null = TODO)
  poamGuidance?: string | null; // BF POA&M guidance (null = TODO)
  /**
   * Official NIST SP 800-171A assessment objectives (determination statements
   * + assessment methods). Always populated from
   * data-sources/sp800-171a-assessment-objectives.json. Official `objectiveText`
   * is kept SEPARATE from Benchmark Fox-authored notes (`benchmarkFoxNotes`).
   */
  assessmentObjectives: AssessmentObjective[];
  /** all sourceId references into SOURCE_REFS (official + Benchmark Fox) */
  sourceRefs: string[];
  /** official document sourceIds (NIST/FAR/DFARS/CMMC/CFR) */
  officialSourceRefs?: string[];
  /** Benchmark Fox internal sourceIds */
  benchmarkFoxSourceRefs?: string[];
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
  /**
   * Optional NIST SP 800-171A objective ids this evidence covers (e.g.
   * ['3.1.1[a]','3.1.1[b]']). If empty/omitted, the evidence still maps to the
   * control. Metadata only — no evidence files are stored.
   */
  objectiveIds?: string[];
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

export interface KnowledgeItem {
  id: string;
  title: string;
  relatedControl: string;
  type: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Invited' | 'Disabled';
}
