/* ============================================================
   Seed data — clients + audit log.
   The active engagement (Acme) has a full control assessment set in
   controls.ts; other clients carry summary fields for the list view.
   ============================================================ */
import type {
  AppUser,
  AssignableConsultant,
  AuditEvent,
  Client,
  ClientRecord,
  CmmcPathValue,
} from './types';

/**
 * The demo engagement id. Used as the default client context off any
 * client-scoped route (e.g. the internal Dashboard), and as the clientId
 * stamped on the bundled seed data (controls/evidence/poam/tasks). The active
 * client on a client-scoped screen always comes from the route, never this.
 */
export const DEMO_CLIENT_ID = 'acme';

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

/* ---- real client records (Task 07) — Local Prototype mode seed ------------
   The clients list / CRUD work off ClientRecord (DB-backed in Supabase mode).
   In Local Prototype mode the list is seeded from these and persisted to
   localStorage (bf_clients_v1). Derived from the display CLIENTS above so the
   demo shows the same six engagements; readiness/SPRS are computed live from
   each client's real assessments (never these display numbers). --------------- */

const CMMC_PATH_FROM_LEVEL: Record<string, CmmcPathValue> = {
  'Level 1': 'Level 1',
  'Level 2': 'Level 2',
  'Level 3': 'Level 3',
};

function seedCmmcPath(level: string): CmmcPathValue {
  return CMMC_PATH_FROM_LEVEL[level] ?? 'Undetermined';
}

export const SEED_CLIENT_RECORDS: ClientRecord[] = CLIENTS.map((c) => {
  const cmmcPath = seedCmmcPath(c.level);
  return {
    id: c.id,
    name: c.name,
    status: 'Active',
    cmmcPath,
    cmmcLevel: cmmcPath === 'Level 1' ? 'L1' : cmmcPath === 'Level 2' ? 'L2' : null,
    riskRating: c.riskRating,
    readinessPhase: c.phase,
    contractTypes: [],
    owner: c.owner,
    deadline: c.deadline ?? null,
  };
});

/** Platform users (Settings → Users). */
export const USERS: AppUser[] = [
  { id: 'u1', name: 'Justin', email: 'justin@benchmarkfox.com', role: 'Admin', status: 'Active' },
  { id: 'u2', name: 'Dana', email: 'dana@benchmarkfox.com', role: 'Consultant', status: 'Active' },
  { id: 'u3', name: 'Client IT', email: 'it@client.com', role: 'Evidence Uploader', status: 'Invited' },
];

/** Benchmark Fox staff assignable to a client (Local Prototype mode). */
export const SEED_ASSIGNABLE_CONSULTANTS: AssignableConsultant[] = USERS.filter(
  (u) => u.role === 'Admin' || u.role === 'Consultant',
).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));

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
