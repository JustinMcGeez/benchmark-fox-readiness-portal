/* Seed data — POA&M items for the active client. */
import type { PoamItem } from './types';
import { CURRENT_CLIENT_ID } from './clients';

export const POAM_ITEMS: PoamItem[] = [
  {
    id: 'PM-014',
    clientId: CURRENT_CLIENT_ID,
    controlId: '3.1.3',
    weakness: 'CUI data flow between CAD workstations and file share is not controlled or documented.',
    owner: 'CIO',
    office: 'IT / Security',
    risk: 'High',
    dueDate: '08/01/2026',
    status: 'Blocked',
    classification: 'Blocker',
    remediationPlan:
      'Implement enclave segmentation; route CUI through GCC High; document data flow diagram.',
    resourceEstimate: '40 hrs + segmentation license',
    howIdentified: 'Scoping workshop — CUI boundary review',
  },
  {
    id: 'PM-021',
    clientId: CURRENT_CLIENT_ID,
    controlId: '3.5.3',
    weakness: 'MFA evidence incomplete for CAD application.',
    owner: 'IT Lead',
    office: 'IT',
    risk: 'High',
    dueDate: '07/15/2026',
    status: 'Ongoing',
    classification: 'Readiness',
  },
  {
    id: 'PM-019',
    clientId: CURRENT_CLIENT_ID,
    controlId: '3.3.1',
    weakness: 'Audit logging not centralized across CUI systems.',
    owner: 'MSP',
    office: 'IT',
    risk: 'High',
    dueDate: '07/22/2026',
    status: 'Blocked',
    classification: 'Blocker',
  },
  {
    id: 'PM-008',
    clientId: CURRENT_CLIENT_ID,
    controlId: '3.13.11',
    weakness: 'CUI transmission not using FIPS-validated cryptography end-to-end.',
    owner: 'MSP',
    office: 'IT',
    risk: 'High',
    dueDate: '07/30/2026',
    status: 'Ongoing',
    classification: 'Readiness',
  },
  {
    id: 'PM-031',
    clientId: CURRENT_CLIENT_ID,
    controlId: '3.6.1',
    weakness: 'No documented incident-response plan or runbook.',
    owner: 'Security',
    office: 'Security',
    risk: 'Medium',
    dueDate: '08/05/2026',
    status: 'Not Started',
    classification: 'Readiness',
  },
];

export const poamForControl = (controlId: string): PoamItem[] =>
  POAM_ITEMS.filter((p) => p.controlId === controlId);
