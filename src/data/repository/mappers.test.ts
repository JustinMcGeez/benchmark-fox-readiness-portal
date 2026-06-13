/* ============================================================
   Mapper tests — DB row ↔ domain round-trips for every enum value
   (including 'Not Applicable' and special-character jsonb labels),
   null-column fallbacks to seed/defaults, and corrupt-jsonb handling.
   ============================================================ */
import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_OPTIONS,
  POAM_OPTIONS,
  READINESS_OPTIONS,
  SSP_OPTIONS,
  type ClientControlAssessment,
  type RiskLevel,
} from '../types';
import { DEFAULT_INTAKE, type ChoiceOption } from '../intake';
import { ASSET_CATEGORIES, DEFAULT_SCOPE, type ScopeAsset } from '../scope';
import {
  assessmentRowToDomain,
  assessmentToRowPayload,
  choiceOptionsToJson,
  intakeRowToDomain,
  intakeToRowPayload,
  parseChoiceOptions,
  scopeAssetRowToDomain,
  scopeAssetToRowPayload,
  scopeRowToSummary,
  scopeSummaryToRowPayload,
  type AssessmentRow,
  type IntakeRow,
  type ScopeAssetRow,
  type ScopeRow,
} from './mappers';

const RISK_LEVELS: RiskLevel[] = ['Low', 'Medium', 'High', 'Critical'];

const SEED: ClientControlAssessment = {
  clientId: 'acme',
  controlId: '3.1.1',
  status: 'Met',
  sspStatus: 'Complete',
  evidenceStatus: 'Accepted',
  poamStatus: 'None',
  risk: 'High',
  owner: 'IT Lead',
  dueDate: '08/15/2026',
  lastReviewed: 'Jul 1, 2026',
  consultantNotes: 'seed note',
  sspStatement: 'seed statement',
};

const IDS = {
  clientUuid: 'ac3e0000-0000-4000-8000-000000000001',
  controlUuid: 'c0000000-0000-4000-8000-000000000311',
};

/** Expand a managed-column payload into a full DB row (defaults for the rest). */
function rowFromPayload(payload: ReturnType<typeof assessmentToRowPayload>): AssessmentRow {
  return {
    id: 'r-1',
    implementation_status: 'Not Started',
    due_date: null,
    score_impact: null,
    client_notes: null,
    validation_method: null,
    last_reviewed_at: null,
    reviewed_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...payload,
  };
}

describe('assessment mapping', () => {
  it('round-trips every readiness/ssp/evidence/poam/risk enum value', () => {
    for (const status of READINESS_OPTIONS) {
      const domain = { ...SEED, status };
      expect(assessmentRowToDomain(rowFromPayload(assessmentToRowPayload(domain, IDS)), SEED).status).toBe(status);
    }
    for (const sspStatus of SSP_OPTIONS) {
      const domain = { ...SEED, sspStatus };
      expect(
        assessmentRowToDomain(rowFromPayload(assessmentToRowPayload(domain, IDS)), SEED).sspStatus,
      ).toBe(sspStatus);
    }
    for (const evidenceStatus of EVIDENCE_OPTIONS) {
      const domain = { ...SEED, evidenceStatus };
      expect(
        assessmentRowToDomain(rowFromPayload(assessmentToRowPayload(domain, IDS)), SEED).evidenceStatus,
      ).toBe(evidenceStatus);
    }
    for (const poamStatus of POAM_OPTIONS) {
      const domain = { ...SEED, poamStatus };
      expect(
        assessmentRowToDomain(rowFromPayload(assessmentToRowPayload(domain, IDS)), SEED).poamStatus,
      ).toBe(poamStatus);
    }
    for (const risk of RISK_LEVELS) {
      const domain = { ...SEED, risk };
      expect(assessmentRowToDomain(rowFromPayload(assessmentToRowPayload(domain, IDS)), SEED).risk).toBe(risk);
    }
  });

  it('round-trips a full assessment without losing any field', () => {
    const edited: ClientControlAssessment = {
      ...SEED,
      status: 'Not Applicable',
      sspStatus: 'Mismatch',
      evidenceStatus: 'Needs Revision',
      poamStatus: 'Validated',
      owner: 'CIO',
      consultantNotes: 'updated note',
      sspStatement: 'updated statement',
    };
    const back = assessmentRowToDomain(rowFromPayload(assessmentToRowPayload(edited, IDS)), SEED);
    expect(back).toEqual(edited);
  });

  it('writes only managed columns with the resolved uuids', () => {
    const payload = assessmentToRowPayload(SEED, IDS);
    expect(payload).toEqual({
      client_id: IDS.clientUuid,
      control_id: IDS.controlUuid,
      readiness_status: 'Met',
      ssp_status: 'Complete',
      evidence_status: 'Accepted',
      poam_status: 'None',
      risk_rating: 'High',
      owner_name: 'IT Lead',
      consultant_notes: 'seed note',
      ssp_statement: 'seed statement',
    });
    expect(Object.keys(payload)).not.toContain('due_date');
    expect(Object.keys(payload)).not.toContain('last_reviewed_at');
    expect(Object.keys(payload)).not.toContain('implementation_status');
  });

  it('falls back to the seed for null columns; dates always come from the seed', () => {
    const row = rowFromPayload(assessmentToRowPayload(SEED, IDS));
    const sparse: AssessmentRow = {
      ...row,
      risk_rating: null,
      owner_name: null,
      consultant_notes: null,
      ssp_statement: null,
      due_date: '2030-12-31',
      last_reviewed_at: '2030-12-31T00:00:00Z',
    };
    const domain = assessmentRowToDomain(sparse, SEED);
    expect(domain.risk).toBe(SEED.risk);
    expect(domain.owner).toBe(SEED.owner);
    expect(domain.consultantNotes).toBe(SEED.consultantNotes);
    expect(domain.sspStatement).toBe(SEED.sspStatement);
    expect(domain.dueDate).toBe(SEED.dueDate);
    expect(domain.lastReviewed).toBe(SEED.lastReviewed);
  });
});

describe('choice option jsonb mapping', () => {
  it('round-trips labels with special characters', () => {
    const options: ChoiceOption[] = [
      { label: 'POA&M', selected: true },
      { label: 'DFARS 252.204-7012', selected: false },
      { label: "Unknown / Needs contract review — l'été", selected: true },
    ];
    expect(parseChoiceOptions(choiceOptionsToJson(options), [])).toEqual(options);
  });

  it('returns the fallback for corrupt jsonb shapes', () => {
    const fallback = DEFAULT_INTAKE.contractClauses;
    expect(parseChoiceOptions('not an array', fallback)).toBe(fallback);
    expect(parseChoiceOptions(42, fallback)).toBe(fallback);
    expect(parseChoiceOptions(null, fallback)).toBe(fallback);
    expect(parseChoiceOptions([{ label: 1, selected: true }], fallback)).toBe(fallback);
    expect(parseChoiceOptions([{ label: 'x', selected: 'yes' }], fallback)).toBe(fallback);
    expect(parseChoiceOptions([{ selected: true }], fallback)).toBe(fallback);
    expect(parseChoiceOptions(['plain string'], fallback)).toBe(fallback);
  });

  it('accepts an empty array as a valid value (not corrupt)', () => {
    expect(parseChoiceOptions([], DEFAULT_INTAKE.contractClauses)).toEqual([]);
  });

  it('drops unexpected extra props when serializing', () => {
    const dirty = [{ label: 'FCI only', selected: true, extra: 'x' }] as unknown as ChoiceOption[];
    expect(choiceOptionsToJson(dirty)).toEqual([{ label: 'FCI only', selected: true }]);
  });
});

describe('intake mapping', () => {
  const baseRow: IntakeRow = {
    id: 'i-1',
    client_id: IDS.clientUuid,
    system_name: null,
    likely_cmmc_path: null,
    estimated_scope: null,
    likely_data_type: null,
    initial_risk_rating: null,
    recommended_next_step: null,
    proposed_engagement: null,
    contract_clauses: [],
    data_handling_types: [],
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  };

  it('round-trips the full default intake', () => {
    const payload = intakeToRowPayload(DEFAULT_INTAKE);
    expect(intakeRowToDomain({ ...baseRow, ...payload })).toEqual(DEFAULT_INTAKE);
  });

  it('falls back per-field to DEFAULT_INTAKE for null columns', () => {
    const domain = intakeRowToDomain({ ...baseRow, estimated_scope: 'Whole network' });
    expect(domain.estimatedScope).toBe('Whole network');
    expect(domain.likelyPath).toBe(DEFAULT_INTAKE.likelyPath);
    expect(domain.proposedEngagement).toBe(DEFAULT_INTAKE.proposedEngagement);
  });

  it('falls back to default choice lists for corrupt jsonb', () => {
    const domain = intakeRowToDomain({ ...baseRow, contract_clauses: 'oops', data_handling_types: 7 });
    expect(domain.contractClauses).toEqual(DEFAULT_INTAKE.contractClauses);
    expect(domain.dataHandling).toEqual(DEFAULT_INTAKE.dataHandling);
  });

  it('never includes the notes column in the payload', () => {
    expect(Object.keys(intakeToRowPayload(DEFAULT_INTAKE))).not.toContain('notes');
  });
});

describe('scope mapping', () => {
  const baseRow: ScopeRow = {
    id: 's-1',
    client_id: IDS.clientUuid,
    assessment_boundary: null,
    cui_strategy: null,
    msp_esp_involved: null,
    cloud_services: null,
    scope_notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  };

  it('round-trips the scope summary', () => {
    const payload = scopeSummaryToRowPayload(DEFAULT_SCOPE.summary);
    expect(scopeRowToSummary({ ...baseRow, ...payload })).toEqual(DEFAULT_SCOPE.summary);
  });

  it('falls back per-field to defaults for null columns', () => {
    const summary = scopeRowToSummary({ ...baseRow, cloud_services: 'AWS GovCloud' });
    expect(summary.cloudServices).toBe('AWS GovCloud');
    expect(summary.assessmentBoundary).toBe(DEFAULT_SCOPE.summary.assessmentBoundary);
    expect(summary.notes).toBe(DEFAULT_SCOPE.summary.notes);
  });

  const assetRow = (over: Partial<ScopeAssetRow>): ScopeAssetRow => ({
    id: 'a0000000-0000-4000-8000-000000000001',
    scope_record_id: 's-1',
    asset_name: 'GCC High Tenant',
    asset_type: 'Cloud',
    asset_category: 'CUI Asset',
    handles_cui: true,
    in_scope: true,
    owner_name: 'MSP',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...over,
  });

  it('round-trips assets for every category', () => {
    for (const category of ASSET_CATEGORIES) {
      const asset: ScopeAsset = {
        id: 'a0000000-0000-4000-8000-000000000001',
        name: 'CAD Workstations',
        type: 'Endpoint',
        category,
        handlesCui: true,
        owner: 'IT Lead',
        inScope: false,
      };
      const payload = scopeAssetToRowPayload(asset, 's-1');
      expect(payload.scope_record_id).toBe('s-1');
      expect(scopeAssetRowToDomain(assetRow(payload))).toEqual(asset);
    }
  });

  it('maps unknown categories and null owner/type to safe defaults', () => {
    const domain = scopeAssetRowToDomain(
      assetRow({ asset_category: 'Mystery', asset_type: null, owner_name: null }),
    );
    expect(domain.category).toBe('CUI Asset');
    expect(domain.type).toBe('Endpoint');
    expect(domain.owner).toBe('Unassigned');
  });
});
