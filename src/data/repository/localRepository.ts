/* ============================================================
   localRepository — Local Prototype mode storage.

   The localStorage logic extracted VERBATIM from src/data/store
   (same keys, same shallow-merge semantics, same corrupt-JSON
   fallback). The synchronous helpers are exported because the
   store's local engine uses them directly to stay synchronous
   (the store tests assert localStorage state on the same tick);
   the async ClientDataRepository wrappers resolve immediately.
   ============================================================ */
import type {
  ClientAssignment,
  ClientControlAssessment,
  ClientCreateInput,
  ClientPatch,
  ClientRecord,
  EvidenceItem,
  EvidencePatch,
  EvidenceRequestInput,
  EvidenceStatus,
} from '../types';
import { SEED_ASSESSMENTS } from '../controls';
import {
  DEMO_CLIENT_ID,
  SEED_ASSIGNABLE_CONSULTANTS,
  SEED_CLIENT_RECORDS,
} from '../clients';
import { EVIDENCE_ITEMS } from '../evidence';
import { DEFAULT_INTAKE, type IntakeState } from '../intake';
import { DEFAULT_SCOPE, type ScopeState } from '../scope';
import { assertTransition } from '../../lib/evidenceWorkflow';
import { cmmcLevelForPath } from './mappers';
import { stripInternalAssessmentFields } from '../internalFields';
import {
  RepositoryError,
  type AssessmentPatch,
  type AssessmentReadOptions,
  type ClientAssessmentStatus,
  type ClientDataRepository,
  type ClientsRepository,
  type EvidenceRepository,
} from './types';

export const LS_ASSESS = 'bf_assessments_v1';
export const LS_INTAKE = 'bf_intake_v1';
export const LS_SCOPE = 'bf_scope_v1';
export const LS_MIGRATED = 'bf_migrated_v1';
export const LS_CLIENTS = 'bf_clients_v1';
export const LS_ASSIGNMENTS = 'bf_client_assignments_v1';
export const LS_EVIDENCE = 'bf_evidence_v1';

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as T) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export type Overrides = Record<string, AssessmentPatch>;

export const overrideKey = (clientId: string, controlId: string) => `${clientId}:${controlId}`;

export function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(LS_ASSESS);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

/** Merge stored overrides onto the seed set — same semantics as the old store. */
export function mergeAssessments(overrides: Overrides): ClientControlAssessment[] {
  return SEED_ASSESSMENTS.map((a) => {
    const ov = overrides[overrideKey(a.clientId, a.controlId)];
    return ov ? { ...a, ...ov } : a;
  });
}

/**
 * The base assessment set for a client BEFORE local overrides:
 *  - the demo client carries the bundled worked seed (Acme).
 *  - every other client starts as 110 'Not Reviewed' rows (a fresh engagement).
 * This is what makes Local Prototype mode genuinely multi-client.
 */
export function baseAssessmentsFor(clientId: string): ClientControlAssessment[] {
  if (clientId === DEMO_CLIENT_ID) return SEED_ASSESSMENTS;
  return SEED_ASSESSMENTS.map((a) => ({
    clientId,
    controlId: a.controlId,
    status: 'Not Reviewed',
    sspStatus: 'Not Reviewed',
    evidenceStatus: 'Not Requested',
    poamStatus: 'None',
    risk: 'Medium',
    owner: 'Unassigned',
  }));
}

/** Merge the stored overrides for ONE client onto its base assessment set. */
export function mergeAssessmentsFor(
  clientId: string,
  overrides: Overrides,
): ClientControlAssessment[] {
  return baseAssessmentsFor(clientId).map((a) => {
    const ov = overrides[overrideKey(clientId, a.controlId)];
    return ov ? { ...a, ...ov } : a;
  });
}

/* ---- one-time migration helpers (Supabase import prompt) ---- */

export type MigrationMark = 'imported' | 'discarded';

export function loadMigrationMarks(): Record<string, MigrationMark> {
  try {
    const raw = localStorage.getItem(LS_MIGRATED);
    return raw ? (JSON.parse(raw) as Record<string, MigrationMark>) : {};
  } catch {
    return {};
  }
}

export function markMigrated(clientId: string, mark: MigrationMark) {
  saveJson(LS_MIGRATED, { ...loadMigrationMarks(), [clientId]: mark });
}

export interface LocalSnapshot {
  /** Overrides for this client only, keyed by controlId. */
  overrides: Record<string, AssessmentPatch>;
  intake: IntakeState | null;
  scope: ScopeState | null;
  hasAny: boolean;
}

/** Raw local edits for one client — used by the "import to cloud" prompt. */
export function readLocalSnapshot(clientId: string): LocalSnapshot {
  const prefix = `${clientId}:`;
  const overrides: Record<string, AssessmentPatch> = {};
  for (const [key, patch] of Object.entries(loadOverrides())) {
    if (key.startsWith(prefix)) overrides[key.slice(prefix.length)] = patch;
  }
  const intake = localStorage.getItem(LS_INTAKE) ? loadJson(LS_INTAKE, DEFAULT_INTAKE) : null;
  const scope = localStorage.getItem(LS_SCOPE) ? loadJson(LS_SCOPE, DEFAULT_SCOPE) : null;
  return {
    overrides,
    intake,
    scope,
    hasAny: Object.keys(overrides).length > 0 || intake !== null || scope !== null,
  };
}

/* ---- ClientDataRepository implementation (resolves immediately) ---- */

export const localRepository: ClientDataRepository = {
  getAssessments(clientId: string, opts?: AssessmentReadOptions) {
    const list = mergeAssessmentsFor(clientId, loadOverrides());
    // Client-portal read path: strip internal-only fields (mirrors the Supabase
    // client view) so a simulated client role never receives consultant_notes.
    return Promise.resolve(
      opts?.includeInternal === false ? list.map(stripInternalAssessmentFields) : list,
    );
  },
  patchAssessment(clientId: string, controlId: string, patch: AssessmentPatch) {
    const overrides = loadOverrides();
    const k = overrideKey(clientId, controlId);
    saveJson(LS_ASSESS, { ...overrides, [k]: { ...overrides[k], ...patch } });
    return Promise.resolve();
  },
  getIntake() {
    return Promise.resolve(loadJson(LS_INTAKE, DEFAULT_INTAKE));
  },
  saveIntake(_clientId: string, intake: IntakeState) {
    saveJson(LS_INTAKE, intake);
    return Promise.resolve();
  },
  getScope() {
    return Promise.resolve(loadJson(LS_SCOPE, DEFAULT_SCOPE));
  },
  saveScope(_clientId: string, scope: ScopeState) {
    saveJson(LS_SCOPE, scope);
    return Promise.resolve();
  },
};

/* ============================================================
   Local clients + assignments (Task 07) — bf_clients_v1 /
   bf_client_assignments_v1. Seeded once from SEED_CLIENT_RECORDS so a
   fresh browser shows the demo engagements. Engagements are records:
   archiveClient sets status 'Closed' and NEVER removes a row.
   ============================================================ */

function loadClientList(): ClientRecord[] {
  try {
    const raw = localStorage.getItem(LS_CLIENTS);
    if (raw) return JSON.parse(raw) as ClientRecord[];
  } catch {
    /* fall through to seed */
  }
  // First run: persist the seed so subsequent reads + writes are stable.
  saveJson(LS_CLIENTS, SEED_CLIENT_RECORDS);
  return SEED_CLIENT_RECORDS.map((c) => ({ ...c }));
}

function saveClientList(list: ClientRecord[]) {
  saveJson(LS_CLIENTS, list);
}

/** Synchronous reads for the clients provider's local engine (no async tick,
    so the route's <ClientScope> can validate a clientId on first render). */
export function readLocalClients(): ClientRecord[] {
  return loadClientList();
}

export function readLocalAssessmentStatuses(): ClientAssessmentStatus[] {
  const overrides = loadOverrides();
  const rows: ClientAssessmentStatus[] = [];
  for (const client of loadClientList()) {
    for (const a of mergeAssessmentsFor(client.id, overrides)) {
      rows.push({ clientId: client.id, controlId: a.controlId, status: a.status });
    }
  }
  return rows;
}

type AssignmentMap = Record<string, ClientAssignment[]>;

function loadAssignmentMap(): AssignmentMap {
  try {
    const raw = localStorage.getItem(LS_ASSIGNMENTS);
    return raw ? (JSON.parse(raw) as AssignmentMap) : {};
  } catch {
    return {};
  }
}

function consultantName(profileId: string): string | undefined {
  return SEED_ASSIGNABLE_CONSULTANTS.find((c) => c.id === profileId)?.name;
}

export const localClientsRepository: ClientsRepository = {
  listClients() {
    return Promise.resolve(loadClientList());
  },

  getClient(id: string) {
    return Promise.resolve(loadClientList().find((c) => c.id === id) ?? null);
  },

  createClient(input: ClientCreateInput) {
    const list = loadClientList();
    const owner = input.primaryConsultantId ? consultantName(input.primaryConsultantId) : undefined;
    const now = new Date().toISOString();
    const record: ClientRecord = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      status: 'Active',
      cmmcPath: input.cmmcPath,
      cmmcLevel: cmmcLevelForPath(input.cmmcPath),
      riskRating: null,
      readinessPhase: 'Intake',
      cageCode: input.cageCode?.trim() || null,
      dibRole: input.dibRole ?? null,
      contractTypes: input.contractTypes ?? [],
      primaryContactName: input.primaryContactName?.trim() || null,
      primaryContactEmail: input.primaryContactEmail?.trim() || null,
      primaryContactTitle: input.primaryContactTitle?.trim() || null,
      primaryConsultantId: input.primaryConsultantId ?? null,
      owner: owner ?? null,
      deadline: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };
    saveClientList([...list, record]);
    // The 110 assessment rows are VIRTUAL in local mode: baseAssessmentsFor()
    // returns 110 'Not Reviewed' rows for any non-demo client, so there is no
    // 110-row write loop — getAssessments(newId) already yields exactly 110.
    if (input.primaryConsultantId) {
      void this.assignConsultant(record.id, input.primaryConsultantId, true);
    }
    return Promise.resolve(record);
  },

  updateClient(id: string, patch: ClientPatch) {
    const list = loadClientList();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) {
      return Promise.reject(new RepositoryError('unknown-client', 'That client does not exist.'));
    }
    const owner =
      patch.primaryConsultantId !== undefined
        ? (patch.primaryConsultantId ? consultantName(patch.primaryConsultantId) ?? null : null)
        : list[idx].owner;
    const next: ClientRecord = {
      ...list[idx],
      ...patch,
      // Keep cmmcLevel consistent with cmmcPath unless the patch set it explicitly.
      cmmcLevel:
        patch.cmmcLevel !== undefined
          ? patch.cmmcLevel
          : patch.cmmcPath !== undefined
            ? cmmcLevelForPath(patch.cmmcPath)
            : list[idx].cmmcLevel,
      owner,
      updatedAt: new Date().toISOString(),
    };
    const updated = [...list];
    updated[idx] = next;
    saveClientList(updated);
    return Promise.resolve(next);
  },

  archiveClient(id: string) {
    return this.updateClient(id, { status: 'Closed' });
  },

  listAssessmentStatuses() {
    return Promise.resolve(readLocalAssessmentStatuses());
  },

  listAssignableConsultants() {
    return Promise.resolve(SEED_ASSIGNABLE_CONSULTANTS);
  },

  listAssignments(clientId: string) {
    return Promise.resolve(loadAssignmentMap()[clientId] ?? []);
  },

  assignConsultant(clientId: string, profileId: string, isPrimary = false) {
    const map = loadAssignmentMap();
    const existing = map[clientId] ?? [];
    if (!existing.some((a) => a.profileId === profileId)) {
      existing.push({
        id: crypto.randomUUID(),
        clientId,
        profileId,
        profileName: consultantName(profileId) ?? null,
        role: 'benchmark_fox_consultant',
        isPrimary,
      });
      saveJson(LS_ASSIGNMENTS, { ...map, [clientId]: existing });
    }
    return Promise.resolve();
  },

  removeAssignment(clientId: string, profileId: string) {
    // localStorage edit (not a Supabase hard-delete) — engagements stay records,
    // but a staff assignment may be revoked.
    const map = loadAssignmentMap();
    const next = (map[clientId] ?? []).filter((a) => a.profileId !== profileId);
    saveJson(LS_ASSIGNMENTS, { ...map, [clientId]: next });
    return Promise.resolve();
  },
};

/* ============================================================
   Local evidence (Task 08) — bf_evidence_v1, a { clientId: EvidenceItem[] }
   map. The demo client (Acme) seeds from EVIDENCE_ITEMS; every other client
   starts with NO evidence (a fresh engagement). Items are soft-removed in
   Supabase mode — local mode simply replaces the client's array.
   ============================================================ */

type EvidenceMap = Record<string, EvidenceItem[]>;

/** The base evidence set for a client before any local edits. */
function baseEvidenceFor(clientId: string): EvidenceItem[] {
  if (clientId === DEMO_CLIENT_ID) return EVIDENCE_ITEMS.map((e) => ({ ...e }));
  return [];
}

function loadEvidenceMap(): EvidenceMap {
  try {
    const raw = localStorage.getItem(LS_EVIDENCE);
    return raw ? (JSON.parse(raw) as EvidenceMap) : {};
  } catch {
    return {};
  }
}

/** Synchronous read for the store's local engine: stored edits or the seed. */
export function readLocalEvidence(clientId: string): EvidenceItem[] {
  const map = loadEvidenceMap();
  return map[clientId] ?? baseEvidenceFor(clientId);
}

function saveLocalEvidence(clientId: string, items: EvidenceItem[]) {
  saveJson(LS_EVIDENCE, { ...loadEvidenceMap(), [clientId]: items });
}

function findEvidenceOrThrow(items: EvidenceItem[], id: string): EvidenceItem {
  const item = items.find((e) => e.id === id);
  if (!item) throw new RepositoryError('unknown-evidence', 'That evidence item no longer exists.');
  return item;
}

export const localEvidenceRepository: EvidenceRepository = {
  // async methods so a thrown validation error becomes a REJECTED promise
  // (honoring the Promise-returning contract — never a synchronous throw).
  async list(clientId: string) {
    return readLocalEvidence(clientId);
  },

  async create(clientId: string, input: EvidenceRequestInput) {
    const items = readLocalEvidence(clientId);
    const item: EvidenceItem = {
      id: crypto.randomUUID(),
      clientId,
      title: input.title.trim(),
      controlId: input.controlId,
      objectiveIds: input.objectiveIds ?? [],
      owner: input.owner?.trim() || 'Unassigned',
      status: 'Requested',
      quality: 'Missing',
      freshness: 'N/A',
      description: input.description?.trim() || undefined,
      dueDate: input.dueDate || undefined,
    };
    saveLocalEvidence(clientId, [...items, item]);
    return item;
  },

  async updateMetadata(clientId: string, id: string, patch: EvidencePatch) {
    const items = readLocalEvidence(clientId);
    findEvidenceOrThrow(items, id);
    const next = items.map((e) => (e.id === id ? { ...e, ...patch } : e));
    saveLocalEvidence(clientId, next);
    return next.find((e) => e.id === id)!;
  },

  async transition(clientId: string, id: string, toStatus: EvidenceStatus, note?: string) {
    const items = readLocalEvidence(clientId);
    const current = findEvidenceOrThrow(items, id);
    // Validate against the single source of truth — rejects on an illegal move.
    assertTransition(current.status, toStatus);
    const next = items.map((e) =>
      e.id === id ? { ...e, status: toStatus, notes: note ?? e.notes } : e,
    );
    saveLocalEvidence(clientId, next);
    return next.find((e) => e.id === id)!;
  },
};
