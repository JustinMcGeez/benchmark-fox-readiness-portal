/* ============================================================
   Seed data — CMMC / NIST SP 800-171 control library + the active
   client's per-control assessments.

   This is a representative slice (not all 110 controls); the dashboard
   and matrix compute their numbers from whatever lives here, so adding
   controls/assessments simply makes the figures richer.
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

const FAMILY_NAME: Record<string, string> = {
  AC: 'Access Control',
  AT: 'Awareness & Training',
  AU: 'Audit & Accountability',
  CM: 'Configuration Management',
  IA: 'Identification & Authentication',
  IR: 'Incident Response',
  MA: 'Maintenance',
  MP: 'Media Protection',
  SC: 'System & Comms Protection',
  SI: 'System & Info Integrity',
};

/** Library-screen summary (official family counts shown for context). */
export const FAMILIES: { name: string; code: string; count: number; risk: RiskLevel }[] = [
  { name: 'Access Control', code: 'AC', count: 22, risk: 'High' },
  { name: 'Awareness & Training', code: 'AT', count: 3, risk: 'Medium' },
  { name: 'Audit & Accountability', code: 'AU', count: 9, risk: 'High' },
  { name: 'Configuration Management', code: 'CM', count: 9, risk: 'High' },
  { name: 'Identification & Authentication', code: 'IA', count: 11, risk: 'High' },
  { name: 'Incident Response', code: 'IR', count: 3, risk: 'Medium' },
  { name: 'Maintenance', code: 'MA', count: 6, risk: 'Low' },
  { name: 'Media Protection', code: 'MP', count: 9, risk: 'Medium' },
  { name: 'System & Comms Protection', code: 'SC', count: 16, risk: 'High' },
  { name: 'System & Info Integrity', code: 'SI', count: 7, risk: 'High' },
];

/* compact control definition; expanded into Control objects below */
type Def = {
  id: string;
  fam: string;
  level?: 'L1' | 'L2';
  pts: number;
  title: string;
  summary: string;
  requirement: string;
  explanation: string;
  commonMistakes?: string[];
  evidenceExamples?: string[];
  guidance?: { implementation?: string; interview?: string };
};

const DEFS: Def[] = [
  // ---- Access Control ----
  {
    id: '3.1.1', fam: 'AC', pts: 5,
    title: 'Limit system access to authorized users',
    summary: 'Limit access to authorized users, processes, and devices.',
    requirement:
      'Limit system access to authorized users, processes acting on behalf of authorized users, and devices (including other systems).',
    explanation:
      'Only approved users, services, and devices should be able to access systems that store, process, or transmit CUI.',
    commonMistakes: ['Shared/generic admin accounts', 'No device authorization list', 'Stale accounts not disabled'],
    evidenceExamples: ['Entra ID security group export', 'Intune device compliance policy', 'Account review records'],
    guidance: {
      implementation: 'Use Entra ID security groups + Conditional Access to scope CUI app access.',
      interview: '“How is a new employee granted access to CUI systems?”',
    },
  },
  {
    id: '3.1.2', fam: 'AC', pts: 5,
    title: 'Limit access to permitted transactions and functions',
    summary: 'Limit access to the transactions and functions users may execute.',
    requirement: 'Limit system access to the types of transactions and functions that authorized users are permitted to execute.',
    explanation: 'Users should only be able to perform the actions their role requires — nothing more.',
    commonMistakes: ['Everyone is a local admin', 'No role-based access model'],
  },
  {
    id: '3.1.3', fam: 'AC', pts: 5,
    title: 'Control the flow of CUI',
    summary: 'Control CUI flow in accordance with approved authorizations.',
    requirement: 'Control the flow of CUI in accordance with approved authorizations.',
    explanation: 'Define and enforce where CUI is allowed to move between systems, networks, and people.',
    commonMistakes: ['No documented CUI data flow', 'Unrestricted egress from the CUI enclave'],
    evidenceExamples: ['CUI data flow diagram', 'Firewall rule export', 'DLP policy'],
  },
  {
    id: '3.1.4', fam: 'AC', pts: 1,
    title: 'Separate duties of individuals',
    summary: 'Separate duties to reduce malevolent activity without collusion.',
    requirement: 'Separate the duties of individuals to reduce the risk of malevolent activity without collusion.',
    explanation: 'Split sensitive responsibilities so no single person can both perform and conceal an action.',
  },
  {
    id: '3.1.5', fam: 'AC', pts: 3,
    title: 'Employ least privilege',
    summary: 'Employ least privilege, including for privileged accounts.',
    requirement: 'Employ the principle of least privilege, including for specific security functions and privileged accounts.',
    explanation: 'Grant the minimum access needed; tightly control and monitor administrative rights.',
  },
  {
    id: '3.1.12', fam: 'AC', pts: 5,
    title: 'Monitor and control remote access',
    summary: 'Monitor and control remote access sessions.',
    requirement: 'Monitor and control remote access sessions.',
    explanation: 'Remote connections into the environment must be authorized, encrypted, and logged.',
  },
  {
    id: '3.1.20', fam: 'AC', pts: 1,
    title: 'Control use of external systems',
    summary: 'Verify and control connections to external systems.',
    requirement: 'Verify and control/limit connections to and use of external systems.',
    explanation: 'Limit how personal devices, partners, and cloud services connect to your environment.',
  },
  {
    id: '3.1.22', fam: 'AC', pts: 1,
    title: 'Control CUI on public systems',
    summary: 'Control information posted on publicly accessible systems.',
    requirement: 'Control CUI posted or processed on publicly accessible systems.',
    explanation: 'Ensure CUI is never published to public websites or unmanaged public services.',
  },

  // ---- Awareness & Training ----
  {
    id: '3.2.1', fam: 'AT', pts: 5,
    title: 'Security awareness',
    summary: 'Make personnel aware of security risks and responsibilities.',
    requirement:
      'Ensure that managers, systems administrators, and users are made aware of the security risks associated with their activities and applicable policies.',
    explanation: 'Everyone who touches CUI should understand the threats and their security obligations.',
  },
  {
    id: '3.2.2', fam: 'AT', pts: 5,
    title: 'Role-based training',
    summary: 'Train personnel to carry out their security duties.',
    requirement: 'Ensure that personnel are trained to carry out their assigned information security-related duties and responsibilities.',
    explanation: 'People with security responsibilities get training specific to those duties.',
  },

  // ---- Audit & Accountability ----
  {
    id: '3.3.1', fam: 'AU', pts: 5,
    title: 'Create and retain audit logs',
    summary: 'Create and retain logs enabling monitoring and investigation.',
    requirement:
      'Create and retain system audit logs and records to the extent needed to enable the monitoring, analysis, investigation, and reporting of unlawful or unauthorized system activity.',
    explanation: 'Collect and keep logs long enough to investigate incidents and prove what happened.',
    commonMistakes: ['Logging not centralized', 'Short or undefined retention', 'Key systems not logging'],
    evidenceExamples: ['SIEM/Sentinel retention config', 'Log source inventory'],
  },
  {
    id: '3.3.2', fam: 'AU', pts: 3,
    title: 'Trace actions to individual users',
    summary: 'Ensure actions can be traced to individual users.',
    requirement: 'Ensure that the actions of individual system users can be uniquely traced to those users so they can be held accountable.',
    explanation: 'No shared accounts — each action must be attributable to a specific person.',
  },
  {
    id: '3.3.5', fam: 'AU', pts: 5,
    title: 'Correlate audit review',
    summary: 'Correlate audit review, analysis, and reporting.',
    requirement: 'Correlate audit record review, analysis, and reporting processes for investigation and response to indications of unlawful activity.',
    explanation: 'Tie logs together so suspicious patterns across systems are actually noticed.',
  },

  // ---- Configuration Management ----
  {
    id: '3.4.1', fam: 'CM', pts: 5,
    title: 'Establish configuration baselines',
    summary: 'Establish and maintain baseline configurations and inventories.',
    requirement: 'Establish and maintain baseline configurations and inventories of organizational systems throughout the system development life cycle.',
    explanation: 'Know what a “known-good” system looks like and keep an accurate asset inventory.',
  },
  {
    id: '3.4.2', fam: 'CM', pts: 5,
    title: 'Enforce security configuration settings',
    summary: 'Enforce security configuration settings for IT products.',
    requirement: 'Establish and enforce security configuration settings for information technology products employed in organizational systems.',
    explanation: 'Apply and enforce hardened settings (e.g., CIS/STIG baselines) across devices.',
    evidenceExamples: ['Intune configuration profiles', 'CIS benchmark report'],
  },
  {
    id: '3.4.6', fam: 'CM', pts: 5,
    title: 'Least functionality',
    summary: 'Configure systems to provide only essential capabilities.',
    requirement: 'Employ the principle of least functionality by configuring systems to provide only essential capabilities.',
    explanation: 'Disable unnecessary services, ports, and software to shrink the attack surface.',
  },

  // ---- Identification & Authentication ----
  {
    id: '3.5.1', fam: 'IA', pts: 5,
    title: 'Identify users and devices',
    summary: 'Identify system users, processes, and devices.',
    requirement: 'Identify system users, processes acting on behalf of users, and devices.',
    explanation: 'Every user, service, and device needs a unique identity before access is granted.',
  },
  {
    id: '3.5.2', fam: 'IA', pts: 5,
    title: 'Authenticate identities',
    summary: 'Authenticate identities before granting access.',
    requirement: 'Authenticate (or verify) the identities of users, processes, or devices as a prerequisite to allowing access to organizational systems.',
    explanation: 'Prove identity (passwords, certificates, etc.) before allowing any access.',
  },
  {
    id: '3.5.3', fam: 'IA', pts: 5,
    title: 'Multifactor authentication',
    summary: 'Use MFA for local and network access.',
    requirement:
      'Use multifactor authentication for local and network access to privileged accounts and for network access to non-privileged accounts.',
    explanation: 'Require a second factor (app, token, key) in addition to a password for access to CUI systems.',
    commonMistakes: ['MFA only on email, not all CUI apps', 'SMS used for privileged accounts', 'Exclusions left in place'],
    evidenceExamples: ['MFA configuration screenshot', 'Conditional Access policy export'],
    guidance: {
      implementation: 'Enforce phishing-resistant MFA via Conditional Access for all CUI applications.',
      interview: '“Which accounts are exempt from MFA, and why?”',
    },
  },
  {
    id: '3.5.10', fam: 'IA', pts: 5,
    title: 'Protect stored/transmitted passwords',
    summary: 'Store and transmit only cryptographically-protected passwords.',
    requirement: 'Store and transmit only cryptographically-protected passwords.',
    explanation: 'Passwords must always be hashed/encrypted — never stored or sent in clear text.',
  },

  // ---- Incident Response ----
  {
    id: '3.6.1', fam: 'IR', pts: 5,
    title: 'Incident-handling capability',
    summary: 'Establish an operational incident-handling capability.',
    requirement:
      'Establish an operational incident-handling capability that includes preparation, detection, analysis, containment, recovery, and user response activities.',
    explanation: 'Have a real plan and team ready to detect and respond to security incidents.',
  },
  {
    id: '3.6.2', fam: 'IR', pts: 5,
    title: 'Track and report incidents',
    summary: 'Track, document, and report incidents.',
    requirement: 'Track, document, and report incidents to designated officials and/or authorities both internal and external to the organization.',
    explanation: 'Record incidents and report them to the right people (including DoD when required).',
  },

  // ---- Maintenance ----
  {
    id: '3.7.1', fam: 'MA', pts: 3,
    title: 'Perform system maintenance',
    summary: 'Perform maintenance on organizational systems.',
    requirement: 'Perform maintenance on organizational systems.',
    explanation: 'Keep systems maintained and patched on a defined schedule.',
  },
  {
    id: '3.7.2', fam: 'MA', pts: 5,
    title: 'Control maintenance tools',
    summary: 'Control tools, techniques, and personnel used for maintenance.',
    requirement: 'Provide controls on the tools, techniques, mechanisms, and personnel used to conduct system maintenance.',
    explanation: 'Maintenance tools and the people using them must be authorized and monitored.',
  },

  // ---- Media Protection ----
  {
    id: '3.8.1', fam: 'MP', pts: 3,
    title: 'Protect media containing CUI',
    summary: 'Protect system media (paper and digital) containing CUI.',
    requirement: 'Protect (i.e., physically control and securely store) system media containing CUI, both paper and digital.',
    explanation: 'Physically secure drives, backups, and printouts that hold CUI.',
  },
  {
    id: '3.8.3', fam: 'MP', pts: 5,
    title: 'Sanitize media before disposal',
    summary: 'Sanitize or destroy media before disposal or reuse.',
    requirement: 'Sanitize or destroy system media containing CUI before disposal or release for reuse.',
    explanation: 'Wipe or destroy drives and devices so CUI cannot be recovered later.',
  },
  {
    id: '3.8.9', fam: 'MP', pts: 1,
    title: 'Protect backup CUI',
    summary: 'Protect the confidentiality of backup CUI.',
    requirement: 'Protect the confidentiality of backup CUI at storage locations.',
    explanation: 'Backups containing CUI must be encrypted and access-controlled like production data.',
  },

  // ---- System & Comms Protection ----
  {
    id: '3.13.1', fam: 'SC', pts: 5,
    title: 'Boundary protection',
    summary: 'Monitor and protect communications at system boundaries.',
    requirement:
      'Monitor, control, and protect communications at the external boundaries and key internal boundaries of organizational systems.',
    explanation: 'Use firewalls and segmentation to guard the edges of the CUI environment.',
    evidenceExamples: ['Firewall rules export', 'Network segmentation diagram'],
  },
  {
    id: '3.13.2', fam: 'SC', pts: 5,
    title: 'Secure architecture & design',
    summary: 'Employ secure architectural designs and engineering principles.',
    requirement:
      'Employ architectural designs, software development techniques, and systems engineering principles that promote effective information security.',
    explanation: 'Build security into the design of systems rather than bolting it on later.',
  },
  {
    id: '3.13.8', fam: 'SC', pts: 3,
    title: 'Transmission confidentiality',
    summary: 'Use cryptography to protect CUI in transit.',
    requirement: 'Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission unless otherwise protected by physical safeguards.',
    explanation: 'Encrypt CUI whenever it moves across networks.',
  },
  {
    id: '3.13.11', fam: 'SC', pts: 5,
    title: 'FIPS-validated cryptography',
    summary: 'Use FIPS-validated cryptography to protect CUI.',
    requirement: 'Employ FIPS-validated cryptography when used to protect the confidentiality of CUI.',
    explanation: 'The encryption you rely on for CUI must be FIPS 140-validated.',
  },

  // ---- System & Info Integrity ----
  {
    id: '3.14.1', fam: 'SI', pts: 5,
    title: 'Flaw remediation',
    summary: 'Identify, report, and correct system flaws timely.',
    requirement: 'Identify, report, and correct system flaws in a timely manner.',
    explanation: 'Find and patch vulnerabilities on a defined timeline.',
  },
  {
    id: '3.14.2', fam: 'SI', pts: 5,
    title: 'Malicious code protection',
    summary: 'Provide protection from malicious code.',
    requirement: 'Provide protection from malicious code at designated locations within organizational systems.',
    explanation: 'Run endpoint/email protection (EDR/antivirus) where threats enter.',
  },
  {
    id: '3.14.4', fam: 'SI', pts: 5,
    title: 'Update malicious code protection',
    summary: 'Keep malicious code protection mechanisms updated.',
    requirement: 'Update malicious code protection mechanisms when new releases are available.',
    explanation: 'Keep security tooling and signatures current.',
  },
];

export const CONTROL_LIBRARY: Control[] = DEFS.map((d) => ({
  id: d.id,
  code: `${d.fam}.${d.level ?? 'L2'}-${d.id}`,
  familyCode: d.fam,
  familyName: FAMILY_NAME[d.fam] ?? d.fam,
  level: d.level ?? 'L2',
  scoreValue: d.pts,
  title: d.title,
  summary: d.summary,
  requirement: d.requirement,
  explanation: d.explanation,
  commonMistakes: d.commonMistakes,
  evidenceExamples: d.evidenceExamples,
  guidance: d.guidance,
}));

export const CONTROLS_BY_ID: Record<string, Control> = Object.fromEntries(
  CONTROL_LIBRARY.map((c) => [c.id, c]),
);

/* ---- active client's assessments ---- */
type ARow = [string, ReadinessStatus, SspStatus, EvidenceStatus, PoamStatus, RiskLevel, Owner];

// controlId, status, ssp, evidence, poam, risk, owner
const ASSESS: ARow[] = [
  ['3.1.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.1.2', 'Partial', 'Needs Fix', 'Needs Revision', 'Ongoing', 'Medium', 'IT Lead'],
  ['3.1.3', 'Not Met', 'Missing', 'Missing', 'Blocked', 'Critical', 'CIO'],
  ['3.1.4', 'Not Reviewed', 'Not Reviewed', 'Not Requested', 'None', 'Medium', 'Unassigned'],
  ['3.1.5', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'IT Lead'],
  ['3.1.12', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.1.20', 'Not Met', 'Missing', 'Missing', 'Not Started', 'Medium', 'MSP'],
  ['3.1.22', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.2.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'HR / IT'],
  ['3.2.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'HR / IT'],
  ['3.3.1', 'Not Met', 'Needs Fix', 'Missing', 'Blocked', 'High', 'CIO'],
  ['3.3.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.3.5', 'Not Reviewed', 'Not Reviewed', 'Not Requested', 'None', 'Medium', 'MSP'],
  ['3.4.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.4.2', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.4.6', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.5.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.5.2', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.5.3', 'Partial', 'Complete', 'In Review', 'Ongoing', 'High', 'IT Lead'],
  ['3.5.10', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.6.1', 'Not Met', 'Missing', 'Missing', 'Not Started', 'High', 'Security'],
  ['3.6.2', 'Not Reviewed', 'Not Reviewed', 'Not Requested', 'None', 'Medium', 'Security'],
  ['3.7.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.7.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.8.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'IT Lead'],
  ['3.8.3', 'Not Met', 'Missing', 'Missing', 'Not Started', 'Medium', 'IT Lead'],
  ['3.8.9', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.13.1', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.13.2', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.13.8', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.13.11', 'Not Met', 'Missing', 'Missing', 'Blocked', 'High', 'MSP'],
  ['3.14.1', 'Partial', 'Needs Fix', 'In Review', 'Ongoing', 'Medium', 'MSP'],
  ['3.14.2', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
  ['3.14.4', 'Met', 'Complete', 'Accepted', 'None', 'Low', 'MSP'],
];

const SSP_STATEMENTS: Record<string, string> = {
  '3.1.1':
    'Access to CUI systems is restricted to authorized personnel via Entra ID role-based groups, with device compliance enforced through Intune. Reviewed quarterly.',
  '3.5.3':
    'Phishing-resistant MFA is enforced for all CUI applications through Conditional Access. Privileged accounts require hardware security keys.',
};

export const SEED_ASSESSMENTS: ClientControlAssessment[] = ASSESS.map(
  ([controlId, status, sspStatus, evidenceStatus, poamStatus, risk, owner]) => ({
    clientId: CURRENT_CLIENT_ID,
    controlId,
    status,
    sspStatus,
    evidenceStatus,
    poamStatus,
    risk,
    owner,
    dueDate: '08/15/2026',
    lastReviewed: 'Jul 1, 2026',
    sspStatement: SSP_STATEMENTS[controlId],
    consultantNotes:
      controlId === '3.1.1' ? 'RBAC enforced via Entra ID groups. Verified Jul 1.' : undefined,
  }),
);
