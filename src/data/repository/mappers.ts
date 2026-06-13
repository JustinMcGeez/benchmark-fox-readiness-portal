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
import type { ClientControlAssessment } from '../types';
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
