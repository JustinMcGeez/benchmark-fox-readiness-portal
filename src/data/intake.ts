/* ============================================================
   Seed data — guided intake summary + CMMC path recommendation.
   Prototype data for the active engagement; moved out of the screens.
   ============================================================ */
import type { RiskLevel } from './types';

export interface IntakeSummaryItem {
  label: string;
  value: string;
}

/** Auto-drafted internal summary shown on the final intake step. */
export const INTAKE_SUMMARY: IntakeSummaryItem[] = [
  { label: 'Likely CMMC Path', value: 'Level 2 · C3PAO' },
  { label: 'Estimated Scope', value: 'CUI enclave' },
  { label: 'Likely Data Type', value: 'CUI / CTI' },
  { label: 'Initial Risk Rating', value: 'High' },
  { label: 'Recommended Next Step', value: 'Scoping Workshop' },
  { label: 'Proposed Engagement', value: 'CMMC Readiness Program' },
];

export interface ChoiceOption {
  label: string;
  selected: boolean;
}

export interface PathRecommendation {
  path: string;
  confidence: RiskLevel | 'Medium';
  reason: string;
  contractClauses: ChoiceOption[];
  dataHandling: ChoiceOption[];
}

export const PATH_RECOMMENDATION: PathRecommendation = {
  path: 'Level 2 · C3PAO Certification',
  confidence: 'Medium',
  reason: 'CUI selected and DFARS 252.204-7012 identified.',
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
