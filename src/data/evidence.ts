/* Seed data — evidence items for the active client. */
import type { EvidenceItem } from './types';
import { CURRENT_CLIENT_ID } from './clients';

export const EVIDENCE_ITEMS: EvidenceItem[] = [
  {
    id: 'ev-1',
    clientId: CURRENT_CLIENT_ID,
    title: 'MFA Configuration Screenshot',
    controlId: '3.5.3',
    owner: 'IT Lead',
    status: 'In Review',
    quality: 'Acceptable',
    freshness: 'Current',
    method: 'Examine / Test',
    notes: 'Covers primary tenant; confirm coverage for CAD app.',
  },
  {
    id: 'ev-2',
    clientId: CURRENT_CLIENT_ID,
    title: 'Quarterly Access Review',
    controlId: '3.1.5',
    owner: 'HR / IT',
    status: 'Missing',
    quality: 'Missing',
    freshness: 'N/A',
  },
  {
    id: 'ev-3',
    clientId: CURRENT_CLIENT_ID,
    title: 'Firewall Rules Export',
    controlId: '3.13.1',
    owner: 'MSP',
    status: 'Accepted',
    quality: 'Strong',
    freshness: 'Current',
  },
  {
    id: 'ev-4',
    clientId: CURRENT_CLIENT_ID,
    title: 'Audit Log Retention Policy',
    controlId: '3.3.1',
    owner: 'MSP',
    status: 'Requested',
    quality: 'Missing',
    freshness: 'N/A',
  },
  {
    id: 'ev-5',
    clientId: CURRENT_CLIENT_ID,
    title: 'Entra ID Group Export',
    controlId: '3.1.1',
    owner: 'IT Lead',
    status: 'Accepted',
    quality: 'Strong',
    freshness: 'Current',
  },
  {
    id: 'ev-6',
    clientId: CURRENT_CLIENT_ID,
    title: 'Intune Compliance Policy',
    controlId: '3.1.1',
    owner: 'IT Lead',
    status: 'In Review',
    quality: 'Acceptable',
    freshness: 'Current',
  },
];

export const evidenceForControl = (controlId: string): EvidenceItem[] =>
  EVIDENCE_ITEMS.filter((e) => e.controlId === controlId);
