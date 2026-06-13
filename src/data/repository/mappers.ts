/* ============================================================
   Mappers — DB rows ↔ domain types. Pure functions, no Supabase
   client. The repository adapts storage to the domain, never the
   reverse, so every mapper returns exact src/data domain shapes.

   Conventions:
   - Domain enums and DB enums share string values; DB-enforced enum
     columns are trusted as-is.
   - Nullable columns fall back per-field to the seed/default value,
     mirroring the localStorage shallow-merge semantics.
   - due_date / last_reviewed_at are NEVER written and never read into
     the domain: the seed values are display strings ('08/15/2026',
     'Jul 1, 2026'), not ISO dates, and neither field is patchable.
   ============================================================ */
import type {
  ClientControlAssessment,
  ClientCreateInput,
  ClientPatch,
  ClientRecord,
  ClientStatus,
  CmmcPathValue,
  DibRole,
  EvidenceItem,
  EvidencePatch,
  EvidenceQuality,
  EvidenceRequestInput,
  EvidenceStatus,
  RiskLevel,
} from '../types';
import { DEFAULT_INTAKE, type ChoiceOption, type IntakeState } from '../intake';
import {
  ASSET_CATEGORIES,
  DEFAULT_SCOPE,
  type ScopeAsset,
  type ScopeAssetCategory,
  type ScopeSummary,
} from '../scope';
import type { Database, Json } from '../../lib/database.types';

type Tables = Database['public']['Tables'];
export type AssessmentRow = Tables['client_control_assessments']['Row'];
export type IntakeRow = Tables['intake_records']['Row'];
export type ScopeRow = Tables['scope_records']['Row'];
export type ScopeAssetRow = Tables['scope_assets']['Row'];
export type ClientRow = Tables['clients']['Row'];
export type ClientUpdatePayload = Tables['clients']['Update'];
export type EvidenceRow = Tables['evidence_items']['Row'];
export type EvidenceUpdatePayload = Tables['evidence_items']['Update'];

/* ---- clients (Task 07) ---- */

const CLIENT_STATUSES: ClientStatus[] = ['Prospect', 'Active', 'On Hold', 'Closed'];
const CMMC_PATHS: CmmcPathValue[] = ['Level 1', 'Level 2', 'Level 3', 'Undetermined'];
const RISK_LEVELS: RiskLevel[] = ['Low', 'Medium', 'High', 'Critical'];

const asEnum = <T extends string>(value: string | null, allowed: T[], fallback: T): T =>
  value !== null && (allowed as string[]).includes(value) ? (value as T) : fallback;

/** Parse a jsonb string[] (e.g. contract_types); anything malformed → []. */
function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

/** cmmc_path → concrete cmmc_level the DB stores (L1/L2, or null when not L1/L2). */
export function cmmcLevelForPath(path: CmmcPathValue): 'L1' | 'L2' | null {
  if (path === 'Level 1') return 'L1';
  if (path === 'Level 2') return 'L2';
  return null;
}

/** ownerName is resolved from a separate profiles lookup (RLS-permitting). */
export function clientRowToDomain(row: ClientRow, ownerName?: string | null): ClientRecord {
  return {
    id: row.id,
    name: row.name,
    status: asEnum<ClientStatus>(row.status, CLIENT_STATUSES, 'Active'),
    cmmcPath: asEnum<CmmcPathValue>(row.cmmc_path, CMMC_PATHS, 'Undetermined'),
    cmmcLevel: row.cmmc_level === 'L1' || row.cmmc_level === 'L2' ? row.cmmc_level : null,
    riskRating: row.risk_rating !== null && (RISK_LEVELS as string[]).includes(row.risk_rating)
      ? (row.risk_rating as RiskLevel)
      : null,
    readinessPhase: row.readiness_phase,
    cageCode: row.cage_code,
    dibRole: (row.dib_role as DibRole | null) ?? null,
    contractTypes: parseStringArray(row.contract_types),
    primaryContactName: row.primary_contact_name,
    primaryContactEmail: row.primary_contact_email,
    primaryContactTitle: row.primary_contact_title,
    primaryConsultantId: row.primary_consultant_id,
    owner: ownerName ?? null,
    deadline: row.deadline,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Columns the repository writes when creating a client (org_id added by caller). */
export interface ClientCreateRowPayload {
  name: string;
  status: ClientStatus;
  cmmc_path: CmmcPathValue;
  cmmc_level: 'L1' | 'L2' | null;
  readiness_phase: string;
  cage_code: string | null;
  dib_role: string | null;
  contract_types: Json;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_title: string | null;
  primary_consultant_id: string | null;
}

export function clientCreateToRowPayload(input: ClientCreateInput): ClientCreateRowPayload {
  return {
    name: input.name.trim(),
    status: 'Active',
    cmmc_path: input.cmmcPath,
    cmmc_level: cmmcLevelForPath(input.cmmcPath),
    readiness_phase: 'Intake',
    cage_code: input.cageCode?.trim() || null,
    dib_role: input.dibRole ?? null,
    contract_types: input.contractTypes ?? [],
    primary_contact_name: input.primaryContactName?.trim() || null,
    primary_contact_email: input.primaryContactEmail?.trim() || null,
    primary_contact_title: input.primaryContactTitle?.trim() || null,
    primary_consultant_id: input.primaryConsultantId ?? null,
  };
}

/** Map a domain ClientPatch onto the DB column names it touches. */
export function clientPatchToRowPayload(patch: ClientPatch): ClientUpdatePayload {
  const out: Record<string, Json> = {};
  if (patch.name !== undefined) out.name = patch.name.trim();
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.cmmcPath !== undefined) {
    out.cmmc_path = patch.cmmcPath;
    out.cmmc_level = cmmcLevelForPath(patch.cmmcPath);
  }
  if (patch.cmmcLevel !== undefined) out.cmmc_level = patch.cmmcLevel;
  if (patch.riskRating !== undefined) out.risk_rating = patch.riskRating;
  if (patch.readinessPhase !== undefined) out.readiness_phase = patch.readinessPhase;
  if (patch.cageCode !== undefined) out.cage_code = patch.cageCode ?? null;
  if (patch.dibRole !== undefined) out.dib_role = patch.dibRole ?? null;
  if (patch.contractTypes !== undefined) out.contract_types = patch.contractTypes;
  if (patch.primaryContactName !== undefined) out.primary_contact_name = patch.primaryContactName ?? null;
  if (patch.primaryContactEmail !== undefined) out.primary_contact_email = patch.primaryContactEmail ?? null;
  if (patch.primaryContactTitle !== undefined) out.primary_contact_title = patch.primaryContactTitle ?? null;
  if (patch.primaryConsultantId !== undefined) out.primary_consultant_id = patch.primaryConsultantId ?? null;
  if (patch.deadline !== undefined) out.deadline = patch.deadline ?? null;
  if (patch.notes !== undefined) out.notes = patch.notes ?? null;
  return out as unknown as ClientUpdatePayload;
}

/* ---- control assessments ---- */

/**
 * Map a DB row onto its seed assessment. Enum columns are authoritative
 * (rows are fully materialized on first write); nullable columns fall
 * back to the seed so an untouched field never loses its demo value.
 */
export function assessmentRowToDomain(
  row: AssessmentRow,
  seed: ClientControlAssessment,
): ClientControlAssessment {
  return {
    clientId: seed.clientId,
    controlId: seed.controlId,
    status: row.readiness_status,
    sspStatus: row.ssp_status,
    evidenceStatus: row.evidence_status,
    poamStatus: row.poam_status,
    risk: row.risk_rating ?? seed.risk,
    owner: row.owner_name ?? seed.owner,
    dueDate: seed.dueDate,
    lastReviewed: seed.lastReviewed,
    consultantNotes: row.consultant_notes ?? seed.consultantNotes,
    sspStatement: row.ssp_statement ?? seed.sspStatement,
  };
}

/** Columns the repository manages on client_control_assessments. */
export interface AssessmentRowPayload {
  client_id: string;
  control_id: string;
  readiness_status: AssessmentRow['readiness_status'];
  ssp_status: AssessmentRow['ssp_status'];
  evidence_status: AssessmentRow['evidence_status'];
  poam_status: AssessmentRow['poam_status'];
  risk_rating: AssessmentRow['risk_rating'];
  owner_name: string | null;
  consultant_notes: string | null;
  ssp_statement: string | null;
}

/**
 * Build the upsert payload for a fully-materialized assessment. Only the
 * columns above are ever written — implementation_status, due_date,
 * score_impact, client_notes, validation_method, last_reviewed_at and
 * reviewed_by are left to their DB defaults / other workflows.
 */
export function assessmentToRowPayload(
  a: ClientControlAssessment,
  ids: { clientUuid: string; controlUuid: string },
): AssessmentRowPayload {
  return {
    client_id: ids.clientUuid,
    control_id: ids.controlUuid,
    readiness_status: a.status,
    ssp_status: a.sspStatus,
    evidence_status: a.evidenceStatus,
    poam_status: a.poamStatus,
    risk_rating: a.risk,
    owner_name: a.owner,
    consultant_notes: a.consultantNotes ?? null,
    ssp_statement: a.sspStatement ?? null,
  };
}

/* ---- choice options (jsonb) ---- */

/**
 * Strictly validate a jsonb value as ChoiceOption[]; anything malformed
 * (wrong container, wrong field types, missing fields) yields the
 * fallback — mirroring the corrupt-localStorage behavior.
 */
export function parseChoiceOptions(value: unknown, fallback: ChoiceOption[]): ChoiceOption[] {
  if (!Array.isArray(value)) return fallback;
  const out: ChoiceOption[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return fallback;
    const { label, selected } = entry as Record<string, unknown>;
    if (typeof label !== 'string' || typeof selected !== 'boolean') return fallback;
    out.push({ label, selected });
  }
  return out;
}

/** Serialize to a clean jsonb payload (drops any unexpected props). */
export function choiceOptionsToJson(options: ChoiceOption[]): Json {
  return options.map((o) => ({ label: o.label, selected: o.selected }));
}

/* ---- intake ---- */

export function intakeRowToDomain(row: IntakeRow): IntakeState {
  return {
    likelyPath: row.likely_cmmc_path ?? DEFAULT_INTAKE.likelyPath,
    estimatedScope: row.estimated_scope ?? DEFAULT_INTAKE.estimatedScope,
    likelyDataType: row.likely_data_type ?? DEFAULT_INTAKE.likelyDataType,
    initialRisk: row.initial_risk_rating ?? DEFAULT_INTAKE.initialRisk,
    recommendedNextStep: row.recommended_next_step ?? DEFAULT_INTAKE.recommendedNextStep,
    proposedEngagement: row.proposed_engagement ?? DEFAULT_INTAKE.proposedEngagement,
    contractClauses: parseChoiceOptions(row.contract_clauses, DEFAULT_INTAKE.contractClauses),
    dataHandling: parseChoiceOptions(row.data_handling_types, DEFAULT_INTAKE.dataHandling),
  };
}

export interface IntakeRowPayload {
  likely_cmmc_path: string;
  estimated_scope: string;
  likely_data_type: string;
  initial_risk_rating: string;
  recommended_next_step: string;
  proposed_engagement: string;
  contract_clauses: Json;
  data_handling_types: Json;
}

/** The `notes` column is not part of the domain and is never touched. */
export function intakeToRowPayload(intake: IntakeState): IntakeRowPayload {
  return {
    likely_cmmc_path: intake.likelyPath,
    estimated_scope: intake.estimatedScope,
    likely_data_type: intake.likelyDataType,
    initial_risk_rating: intake.initialRisk,
    recommended_next_step: intake.recommendedNextStep,
    proposed_engagement: intake.proposedEngagement,
    contract_clauses: choiceOptionsToJson(intake.contractClauses),
    data_handling_types: choiceOptionsToJson(intake.dataHandling),
  };
}

/* ---- scope ---- */

export function scopeRowToSummary(row: ScopeRow): ScopeSummary {
  return {
    assessmentBoundary: row.assessment_boundary ?? DEFAULT_SCOPE.summary.assessmentBoundary,
    cuiStrategy: row.cui_strategy ?? DEFAULT_SCOPE.summary.cuiStrategy,
    mspInvolved: row.msp_esp_involved ?? DEFAULT_SCOPE.summary.mspInvolved,
    cloudServices: row.cloud_services ?? DEFAULT_SCOPE.summary.cloudServices,
    notes: row.scope_notes ?? DEFAULT_SCOPE.summary.notes,
  };
}

export interface ScopeRowPayload {
  assessment_boundary: string;
  cui_strategy: string;
  msp_esp_involved: string;
  cloud_services: string;
  scope_notes: string;
}

export function scopeSummaryToRowPayload(summary: ScopeSummary): ScopeRowPayload {
  return {
    assessment_boundary: summary.assessmentBoundary,
    cui_strategy: summary.cuiStrategy,
    msp_esp_involved: summary.mspInvolved,
    cloud_services: summary.cloudServices,
    scope_notes: summary.notes,
  };
}

function isAssetCategory(value: string | null): value is ScopeAssetCategory {
  return value !== null && (ASSET_CATEGORIES as string[]).includes(value);
}

export function scopeAssetRowToDomain(row: ScopeAssetRow): ScopeAsset {
  return {
    id: row.id,
    name: row.asset_name,
    type: row.asset_type ?? 'Endpoint',
    category: isAssetCategory(row.asset_category) ? row.asset_category : 'CUI Asset',
    handlesCui: row.handles_cui,
    owner: row.owner_name ?? 'Unassigned',
    inScope: row.in_scope,
  };
}

export interface ScopeAssetRowPayload {
  id: string;
  scope_record_id: string;
  asset_name: string;
  asset_type: string;
  asset_category: string;
  handles_cui: boolean;
  in_scope: boolean;
  owner_name: string;
}

export function scopeAssetToRowPayload(asset: ScopeAsset, scopeRecordId: string): ScopeAssetRowPayload {
  return {
    id: asset.id,
    scope_record_id: scopeRecordId,
    asset_name: asset.name,
    asset_type: asset.type,
    asset_category: asset.category,
    handles_cui: asset.handlesCui,
    in_scope: asset.inScope,
    owner_name: asset.owner,
  };
}

/* ---- evidence (Task 08) ---- */

const EVIDENCE_QUALITIES: EvidenceQuality[] = [
  'Strong',
  'Acceptable',
  'Weak',
  'Missing',
  'Not Relevant',
  'Outdated',
];
const EVIDENCE_FRESHNESS: EvidenceItem['freshness'][] = ['Current', 'Expired', 'N/A'];
const SSP_SUPPORT: NonNullable<EvidenceItem['sspSupported']>[] = ['Yes', 'Partial', 'No'];

/**
 * Map an evidence_items row to the domain shape. `controlId` is the control's
 * natural id ('3.1.1'), resolved by the repository from the row's control_id
 * uuid (null → '' so the item still lists). METADATA + external link only.
 */
export function evidenceRowToDomain(row: EvidenceRow, controlId: string): EvidenceItem {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    controlId,
    objectiveIds: parseStringArray(row.objective_ids),
    owner: row.owner_name ?? 'Unassigned',
    status: row.status,
    quality: asEnum<EvidenceQuality>(row.quality, EVIDENCE_QUALITIES, 'Missing'),
    freshness: asEnum<EvidenceItem['freshness']>(row.freshness_status, EVIDENCE_FRESHNESS, 'N/A'),
    sspSupported:
      row.supports_ssp !== null && (SSP_SUPPORT as string[]).includes(row.supports_ssp)
        ? (row.supports_ssp as EvidenceItem['sspSupported'])
        : undefined,
    method: row.evidence_type ?? undefined,
    notes: row.notes ?? undefined,
    externalLink: row.external_link ?? undefined,
    storageLocationNote: row.storage_location_note ?? undefined,
    description: row.description ?? undefined,
    dueDate: row.due_date ?? undefined,
    expiresOn: row.expires_on ?? undefined,
  };
}

/** Columns written when creating a requested evidence item (ids added by caller). */
export interface EvidenceCreatePayload {
  client_id: string;
  control_id: string | null;
  title: string;
  status: EvidenceStatus;
  objective_ids: Json;
  owner_name: string | null;
  description: string | null;
  due_date: string | null;
}

export function evidenceCreateToRowPayload(
  input: EvidenceRequestInput,
  ids: { clientUuid: string; controlUuid: string | null },
): EvidenceCreatePayload {
  return {
    client_id: ids.clientUuid,
    control_id: ids.controlUuid,
    title: input.title.trim(),
    status: 'Requested',
    objective_ids: input.objectiveIds ?? [],
    owner_name: input.owner?.trim() || null,
    description: input.description?.trim() || null,
    due_date: input.dueDate || null,
  };
}

/** Map an EvidencePatch onto the DB column names it touches (status excluded). */
export function evidencePatchToRowPayload(patch: EvidencePatch): EvidenceUpdatePayload {
  const out: Record<string, Json> = {};
  if (patch.title !== undefined) out.title = patch.title.trim();
  if (patch.owner !== undefined) out.owner_name = patch.owner || null;
  if (patch.externalLink !== undefined) out.external_link = patch.externalLink?.trim() || null;
  if (patch.storageLocationNote !== undefined) out.storage_location_note = patch.storageLocationNote || null;
  if (patch.quality !== undefined) out.quality = patch.quality;
  if (patch.notes !== undefined) out.notes = patch.notes || null;
  if (patch.objectiveIds !== undefined) out.objective_ids = patch.objectiveIds;
  if (patch.description !== undefined) out.description = patch.description || null;
  if (patch.dueDate !== undefined) out.due_date = patch.dueDate || null;
  if (patch.expiresOn !== undefined) out.expires_on = patch.expiresOn || null;
  if (patch.sspSupported !== undefined) out.supports_ssp = patch.sspSupported ?? null;
  if (patch.method !== undefined) out.evidence_type = patch.method || null;
  return out as unknown as EvidenceUpdatePayload;
}

/** Build the status-transition update payload (status + optional note). */
export function evidenceTransitionToRowPayload(
  toStatus: EvidenceStatus,
  note?: string,
): EvidenceUpdatePayload {
  const out: Record<string, Json> = { status: toStatus };
  if (note !== undefined) out.notes = note || null;
  return out as unknown as EvidenceUpdatePayload;
}
