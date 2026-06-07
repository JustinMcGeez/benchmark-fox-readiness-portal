/* ============================================================
   Seed data — guided intake summary + CMMC path recommendation.
   Prototype data for the active engagement; editable copies live in the
   data store (localStorage-backed). See store.ts.
   ============================================================ */
import type { RiskLevel } from './types';

export interface ChoiceOption {
  label: string;
  selected: boolean;
}

/** Editable intake state (persisted to localStorage). */
export interface IntakeState {
  likelyPath: string;
  estimatedScope: string;
  likelyDataType: string;
  initialRisk: string;
  recommendedNextStep: string;
  proposedEngagement: string;
  contractClauses: ChoiceOption[];
  dataHandling: ChoiceOption[];
}

export const DEFAULT_INTAKE: IntakeState = {
  likelyPath: 'Level 2 · C3PAO',
  estimatedScope: 'CUI enclave',
  likelyDataType: 'CUI / CTI',
  initialRisk: 'High',
  recommendedNextStep: 'Scoping Workshop',
  proposedEngagement: 'CMMC Readiness Program',
  contractClauses: [
    { label: 'FAR 52.204-21', selected: false },
    { label: 'DFARS 252.204-7012', selected: true },
    { label: 'DFARS 252.204-7019', selected: false },
    { label: 'DFARS 252.204-7020', selected: false },
    { label: 'DFARS 252.204-7021', selected: false },
    { label: 'Unknown / Needs contract review', selected: false },
  ],
  dataHandling: [
    { label: 'FCI only', selected: false },
    { label: 'CUI', selected: true },
    { label: 'CDI / CTI', selected: false },
    { label: 'ITAR / Export-Controlled', selected: false },
    { label: 'Engineering drawings / CAD', selected: false },
  ],
};

/** The six editable text fields of the auto-drafted intake summary, in display order. */
export const INTAKE_SUMMARY_FIELDS: {
  key: keyof Pick<
    IntakeState,
    | 'likelyPath'
    | 'estimatedScope'
    | 'likelyDataType'
    | 'initialRisk'
    | 'recommendedNextStep'
    | 'proposedEngagement'
  >;
  label: string;
}[] = [
  { key: 'likelyPath', label: 'Likely CMMC Path' },
  { key: 'estimatedScope', label: 'Estimated Scope' },
  { key: 'likelyDataType', label: 'Likely Data Type' },
  { key: 'initialRisk', label: 'Initial Risk Rating' },
  { key: 'recommendedNextStep', label: 'Recommended Next Step' },
  { key: 'proposedEngagement', label: 'Proposed Engagement' },
];

/** Static recommendation summary (path/confidence/reason) shown on the Path screen. */
export interface PathRecommendation {
  path: string;
  confidence: RiskLevel | 'Medium';
  reason: string;
}

export const PATH_RECOMMENDATION: PathRecommendation = {
  path: 'Level 2 · C3PAO Certification',
  confidence: 'Medium',
  reason: 'CUI selected and DFARS 252.204-7012 identified.',
};
