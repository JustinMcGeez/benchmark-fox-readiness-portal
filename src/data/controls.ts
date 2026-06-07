/* ============================================================
   Control library + the active client's assessments.

   - Official skeleton: GENERATED_CONTROLS (all 110 NIST SP 800-171 Rev. 2
     requirements, built from data-sources/sp800-171r2.json).
   - BF_OVERLAY: Benchmark Fox-authored plain-English explanations, guidance,
     and evidence examples for a curated subset (the rest show TODO placeholders).
   - SEED_ASSESSMENTS: a default (Not Reviewed) assessment for every control,
     overlaid with a realistic worked subset for the active client.

   scoreValue stays null (placeholder) — see scoring.ts / "scoring not finalized".
   ============================================================ */
import type {
  ClientControlAssessment,
  Control,
  EvidenceStatus,
  Owner,
  PoamStatus,
  ReadinessStatus,
  RiskLevel,
  SspStatus,
} from './types';
import { CURRENT_CLIENT_ID } from './clients';
import { CONTROL_FAMILIES } from './controlFamilies';
import { GENERATED_CONTROLS } from './controls.generated';

/* ---- Benchmark Fox authored overlay (placeholders elsewhere) ---- */
type Overlay = Partial<
  Pick<Control, 'explanation' | 'commonMistakes' | 'evidenceExamples' | 'guidance' | 'sspGuidance'>
>;

const BF_OVERLAY: Record<string, Overlay> = {
  '3.1.1': {
    explanation:
      'Only approved users, services, and devices should be able to access systems that store, process, or transmit CUI.',
    commonMistakes: ['Shared/generic admin accounts', 'No device authorization list', 'Stale accounts not disabled'],
    evidenceExamples: ['Entra ID security group export', 'Intune device compliance policy', 'Account review records'],
    guidance: {
      implementation: 'Use Entra ID security groups + Conditional Access to scope CUI app access.',
      interview: '“How is a new employee granted access to CUI systems?”',
    },
    sspGuidance:
      'Describe how access is limited to authorized users/devices (identity provider, groups, device authorization) and how it is reviewed.',
  },
  '3.1.2': {
    explanation: 'Users should only be able to perform the actions and transactions their role requires — nothing more.',
    commonMistakes: ['Everyone is a local admin', 'No role-based access model'],
  },
  '3.1.3': {
    explanation: 'Define and enforce where CUI is allowed to move between systems, networks, and people.',
    commonMistakes: ['No documented CUI data flow', 'Unrestricted egress from the CUI enclave'],
    evidenceExamples: ['CUI data flow diagram', 'Firewall rule export', 'DLP policy'],
  },
  '3.1.12': {
    explanation: 'Remote connections into the environment must be authorized, encrypted, and logged.',
  },
  '3.3.1': {
    explanation: 'Collect and keep logs long enough to investigate incidents and prove what happened.',
    commonMistakes: ['Logging not centralized', 'Short or undefined retention', 'Key systems not logging'],
    evidenceExamples: ['SIEM/Sentinel retention config', 'Log source inventory'],
  },
  '3.4.2': {
    explanation: 'Apply and enforce hardened settings (e.g., CIS/STIG baselines) across devices.',
    evidenceExamples: ['Intune configuration profiles', 'CIS benchmark report'],
  },
  '3.5.3': {
    explanation: 'Require a second factor (app, token, key) in addition to a password for access to CUI systems.',
    commonMistakes: ['MFA only on email, not all CUI apps', 'SMS used for privileged accounts', 'Exclusions left in place'],
    evidenceExamples: ['MFA configuration screenshot', 'Conditional Access policy export'],
    guidance: {
      implementation: 'Enforce phishing-resistant MFA via Conditional Access for all CUI applications.',
      interview: '“Which accounts are exempt from MFA, and why?”',
    },
    sspGuidance: 'State which accounts require MFA, the factor types, and any documented exceptions.',
  },
  '3.6.1': {
    explanation: 'Have a real plan and team ready to detect and respond to security incidents.',
  },
  '3.13.1': {
    explanation: 'Use firewalls and segmentation to guard the edges of the CUI environment.',
    evidenceExamples: ['Firewall rules export', 'Network segmentation diagram'],
  },
  '3.13.11': {
    explanation: 'The encryption you rely on to protect CUI confidentiality must be FIPS 140-validated.',
  },
  '3.14.1': {
    explanation: 'Find and patch vulnerabilities on a defined timeline.',
  },
  '3.14.2': {
    explanation: 'Run endpoint/email protection (EDR/antivirus) where threats enter.',
  },
};

export const CONTROL_LIBRARY: Control[] = GENERATED_CONTROLS.map((c) => {
  const o = BF_OVERLAY[c.number];
  return o ? { ...c, ...o } : c;
});

export const CONTROLS_BY_ID: Record<string, Control> = Object.fromEntries(
  CONTROL_LIBRARY.map((c) => [c.id, c]),
);

/* ---- family summary for the Control Library screen ---- */
export interface FamilySummary {
  code: string;
  name: string;
  count: number;
  l1Count: number;
}
export const FAMILIES: FamilySummary[] = CONTROL_FAMILIES.map((f) => {
  const inFam = CONTROL_LIBRARY.filter((c) => c.familyCode === f.code);
  return {
    code: f.code,
    name: f.name,
    count: inFam.length,
    l1Count: inFam.filter((c) => c.level === 'L1').length,
  };
});

/* ---- active client's assessments: default for all 110 + worked subset ---- */
type ARow = [string, ReadinessStatus, SspStatus, EvidenceStatus, PoamStatus, RiskLevel, Owner];

const WORKED: ARow[] = [
  ['3.1.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.1.2', 'Partial', 'Needs Fix', 'Needs Revision', 'Ongoing', 'Medium', 'IT Lead'],
  ['3.1.3', 'Not Met', 'Missing', 'Missing', 'Blocked', 'Critical', 'CIO'],
  ['3.1.5', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'IT Lead'],
  ['3.1.12', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.1.20', 'Not Met', 'Missing', 'Missing', 'Not Started', 'Medium', 'MSP'],
  ['3.1.22', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.2.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'HR / IT'],
  ['3.2.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'HR / IT'],
  ['3.3.1', 'Not Met', 'Needs Fix', 'Missing', 'Blocked', 'High', 'CIO'],
  ['3.3.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.4.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.4.2', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.4.6', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.5.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.5.2', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.5.3', 'Partial', 'Complete', 'In Review', 'Ongoing', 'High', 'IT Lead'],
  ['3.5.10', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.6.1', 'Not Met', 'Missing', 'Missing', 'Not Started', 'High', 'Security'],
  ['3.7.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.8.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.8.3', 'Not Met', 'Missing', 'Missing', 'Not Started', 'Medium', 'IT Lead'],
  ['3.10.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.10.3', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.11.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.12.4', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'CIO'],
  ['3.13.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.13.8', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.13.11', 'Not Met', 'Missing', 'Missing', 'Blocked', 'High', 'MSP'],
  ['3.14.1', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.14.2', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.14.4', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
];

const WORKED_BY_ID = new Map(WORKED.map((r) => [r[0], r]));

const SSP_STATEMENTS: Record<string, string> = {
  '3.1.1':
    'Access to CUI systems is restricted to authorized personnel via Entra ID role-based groups, with device compliance enforced through Intune. Reviewed quarterly.',
  '3.5.3':
    'Phishing-resistant MFA is enforced for all CUI applications through Conditional Access. Privileged accounts require hardware security keys.',
};

export const SEED_ASSESSMENTS: ClientControlAssessment[] = CONTROL_LIBRARY.map((c) => {
  const w = WORKED_BY_ID.get(c.number);
  if (w) {
    const [, status, sspStatus, evidenceStatus, poamStatus, risk, owner] = w;
    return {
      clientId: CURRENT_CLIENT_ID,
      controlId: c.id,
      status,
      sspStatus,
      evidenceStatus,
      poamStatus,
      risk,
      owner,
      dueDate: '08/15/2026',
      lastReviewed: 'Jul 1, 2026',
      sspStatement: SSP_STATEMENTS[c.number],
      consultantNotes:
        c.number === '3.1.1' ? 'RBAC enforced via Entra ID groups. Verified Jul 1.' : undefined,
    };
  }
  // default: not yet reviewed
  return {
    clientId: CURRENT_CLIENT_ID,
    controlId: c.id,
    status: 'Not Reviewed',
    sspStatus: 'Not Reviewed',
    evidenceStatus: 'Not Requested',
    poamStatus: 'None',
    risk: 'Medium',
    owner: 'Unassigned',
  };
});
