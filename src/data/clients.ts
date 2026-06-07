/* ============================================================
   Seed data — clients + audit log.
   The active engagement (Acme) has a full control assessment set in
   controls.ts; other clients carry summary fields for the list view.
   ============================================================ */
import type { AuditEvent, Client } from './types';

/** The client currently in context throughout the client-scoped screens. */
export const CURRENT_CLIENT_ID = 'acme';

export const CLIENTS: Client[] = [
  {
    id: 'acme',
    name: 'Acme Defense Systems',
    cmmcPath: 'Level 2 · C3PAO',
    level: 'Level 2',
    readiness: 62,
    score: '−38',
    riskRating: 'High',
    phase: 'Evidence',
    owner: 'Justin',
    deadline: 'Aug 15, 2026',
    lastUpdated: '2d ago',
    active: true,
  },
  {
    id: 'bravo',
    name: 'Bravo Machine Works',
    cmmcPath: 'Level 1',
    level: 'Level 1',
    readiness: 84,
    score: '+6',
    riskRating: 'Medium',
    phase: 'Report',
    owner: 'Justin',
    deadline: 'Jul 30, 2026',
    lastUpdated: '1d ago',
    active: true,
  },
  {
    id: 'cobalt',
    name: 'Cobalt Aerospace',
    cmmcPath: 'Level 2 · C3PAO',
    level: 'Level 2',
    readiness: 49,
    score: '−61',
    riskRating: 'Medium',
    phase: 'Controls',
    owner: 'Dana',
    lastUpdated: '5h ago',
    active: true,
  },
  {
    id: 'delta',
    name: 'Delta Systems',
    cmmcPath: 'Unknown',
    level: 'Unknown',
    readiness: 20,
    score: 'TBD',
    riskRating: 'High',
    phase: 'Intake',
    owner: 'Justin',
    lastUpdated: '3d ago',
    active: true,
  },
  {
    id: 'echo',
    name: 'Echo Logistics',
    cmmcPath: 'Level 2 · Self',
    level: 'Level 2',
    readiness: 71,
    score: '−22',
    riskRating: 'Low',
    phase: 'SSP',
    owner: 'Dana',
    lastUpdated: '6h ago',
    active: true,
  },
  {
    id: 'foxtrot',
    name: 'Foxtrot Materials',
    cmmcPath: 'Level 1',
    level: 'Level 1',
    readiness: 90,
    score: '+9',
    riskRating: 'Low',
    phase: 'Report',
    owner: 'Justin',
    lastUpdated: '1w ago',
    active: true,
  },
];

export const clientById = (id: string): Client | undefined => CLIENTS.find((c) => c.id === id);

export const AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'a1',
    timestamp: '07/01 09:15',
    user: 'Justin',
    client: 'Acme Defense',
    action: 'Control status changed',
    details: '3.5.3 → Partial',
  },
  {
    id: 'a2',
    timestamp: '07/01 09:22',
    user: 'Justin',
    client: 'Acme Defense',
    action: 'Evidence accepted',
    details: 'MFA screenshot',
  },
  {
    id: 'a3',
    timestamp: '07/01 10:01',
    user: 'Admin',
    client: 'Bravo Machine',
    action: 'Report generated',
    details: 'Executive Summary',
  },
  {
    id: 'a4',
    timestamp: '07/01 10:14',
    user: 'Dana',
    client: 'Cobalt Aero',
    action: 'POA&M created',
    details: '3.13.1',
  },
  {
    id: 'a5',
    timestamp: '07/01 11:02',
    user: 'Justin',
    client: 'Acme Defense',
    action: 'SSP updated',
    details: '3.1.1 statement',
  },
  {
    id: 'a6',
    timestamp: '07/01 11:40',
    user: 'it@client.com',
    client: 'Acme Defense',
    action: 'Evidence uploaded',
    details: 'Firewall export',
  },
];
