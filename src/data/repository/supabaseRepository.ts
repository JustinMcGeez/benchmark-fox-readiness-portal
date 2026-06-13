/* ============================================================
   supabaseRepository — ClientDataRepository backed by Supabase
   Postgres (configured + authenticated mode).

   Design notes:
   - This is the ONLY app-runtime file permitted to write to Supabase
     (insert/update/upsert); enforced by
     scripts/check-supabase-readonly-integration.mjs. It never hard-deletes —
     removals are soft (a deleted_at timestamp).
   - Domain ids ('acme', '3.1.1') are bridged to DB uuids:
       * client: resolveClientUuid (clientIds.ts)
       * control: a runtime-cached natural_id ↔ uuid map (one query).
   - Assessment rows are MATERIALIZED on first write: the NOT NULL enum
     columns mean a sparse "patch row" is indistinguishable from real
     values, so patchAssessment writes a full row built from seed+patch.
   - All errors are caught and rethrown as RepositoryError with a safe,
     user-presentable message (no SQL / table names / row data).
   ============================================================ */
import { getSupabase } from '../../lib/supabaseClient';
import type {
  AssignableConsultant,
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
import { stripInternalAssessmentFields } from '../internalFields';
import { DEFAULT_INTAKE, type IntakeState } from '../intake';
import { DEFAULT_SCOPE, type ScopeState } from '../scope';
import { assertTransition } from '../../lib/evidenceWorkflow';
import {
  auditRowToEntry,
  type AuditEventRow,
  type AuditLogEntry,
} from '../../lib/auditLog';
import { isUuid, resolveClientUuid } from './clientIds';
import {
  assessmentRowToDomain,
  assessmentToRowPayload,
  clientCreateToRowPayload,
  clientPatchToRowPayload,
  clientRowToDomain,
  evidenceCreateToRowPayload,
  evidencePatchToRowPayload,
  evidenceRowToDomain,
  evidenceTransitionToRowPayload,
  intakeRowToDomain,
  intakeToRowPayload,
  scopeAssetRowToDomain,
  scopeAssetToRowPayload,
  scopeRowToSummary,
  scopeSummaryToRowPayload,
  type AssessmentRow,
  type AssessmentRowPayload,
} from './mappers';
import {
  RepositoryError,
  type AssessmentPatch,
  type AssessmentReadOptions,
  type ClientAssessmentStatus,
  type ClientDataRepository,
  type ClientsRepository,
  type EvidenceRepository,
} from './types';

const ASSESSMENTS = 'client_control_assessments';
/** Column-restricted client-facing view (migration 009): omits internal-only
    columns (consultant_notes). security_invoker=on, so the 004 row RLS still
    applies — client roles read ONLY their assigned client's rows, minus the
    internal columns. The client-portal read path uses this instead of the base
    table so column hiding is enforced server-side, not just in the UI. */
const ASSESSMENTS_CLIENT_VIEW = 'client_control_assessments_client';
const INTAKE = 'intake_records';
const SCOPE = 'scope_records';
const SCOPE_ASSETS = 'scope_assets';
const EVIDENCE = 'evidence_items';
const AUDIT = 'audit_events';
const CLIENTS = 'clients';
const CLIENT_ASSIGNMENTS = 'client_assignments';
const ORGANIZATIONS = 'organizations';
const PROFILES = 'profiles';

const SEED_BY_CONTROL = new Map(SEED_ASSESSMENTS.map((s) => [s.controlId, s]));

/** Run a body, rethrowing RepositoryError as-is and wrapping anything else. */
async function guard<T>(
  kind: RepositoryError['kind'],
  message: string,
  body: () => Promise<T>,
): Promise<T> {
  try {
    return await body();
  } catch (e) {
    if (e instanceof RepositoryError) throw e;
    throw new RepositoryError(kind, message, { cause: e });
  }
}

/* ---- control natural_id ↔ uuid map (cached one query, retryable) ---- */

interface ControlIdMaps {
  byNatural: Map<string, string>;
  byUuid: Map<string, string>;
}

let controlIdMapPromise: Promise<ControlIdMaps> | null = null;

function getControlIdMaps(): Promise<ControlIdMaps> {
  if (!controlIdMapPromise) {
    controlIdMapPromise = (async () => {
      const { data, error } = await getSupabase().from('controls').select('id, natural_id');
      if (error) {
        throw new RepositoryError('load-failed', 'Could not load the control list.', { cause: error });
      }
      const byNatural = new Map<string, string>();
      const byUuid = new Map<string, string>();
      for (const row of data ?? []) {
        byNatural.set(row.natural_id, row.id);
        byUuid.set(row.id, row.natural_id);
      }
      return { byNatural, byUuid };
    })().catch((e) => {
      controlIdMapPromise = null; // let the next call (e.g. after Retry) try again
      throw e;
    });
  }
  return controlIdMapPromise;
}

/** Test-only: clear the cached control id map between tests. */
export function resetControlIdCacheForTests() {
  controlIdMapPromise = null;
}

function controlUuidOrThrow(maps: ControlIdMaps, controlId: string): string {
  const uuid = maps.byNatural.get(controlId);
  if (!uuid) {
    throw new RepositoryError('unknown-control', 'That control is not in the cloud workspace.');
  }
  return uuid;
}

/* ---- assessments ---- */

async function getAssessments(
  clientId: string,
  opts?: AssessmentReadOptions,
): Promise<ClientControlAssessment[]> {
  return guard('load-failed', 'Could not load assessments from the cloud workspace.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const maps = await getControlIdMaps();
    const sb = getSupabase();
    // Client-portal read path: the column-restricted view (no consultant_notes).
    // The view is a strict column SUBSET of the base table, so its rows map with
    // the same mapper (consultant_notes simply reads back undefined, then we strip
    // it to guarantee no seed fall-back leaks the field).
    const includeInternal = opts?.includeInternal !== false;
    const { data, error } = includeInternal
      ? await sb.from(ASSESSMENTS).select('*').eq('client_id', clientUuid)
      : await sb.from(ASSESSMENTS_CLIENT_VIEW).select('*').eq('client_id', clientUuid);
    if (error) throw new RepositoryError('load-failed', 'Could not load assessments.', { cause: error });

    const rows = (data ?? []) as unknown as AssessmentRow[];
    const rowByControlUuid = new Map(rows.map((row) => [row.control_id, row]));
    return SEED_ASSESSMENTS.map((seed) => {
      const controlUuid = maps.byNatural.get(seed.controlId);
      const row = controlUuid ? rowByControlUuid.get(controlUuid) : undefined;
      const domain = row ? assessmentRowToDomain(row, seed) : seed;
      return includeInternal ? domain : stripInternalAssessmentFields(domain);
    });
  });
}

async function patchAssessment(
  clientId: string,
  controlId: string,
  patch: AssessmentPatch,
): Promise<void> {
  return guard('save-failed', 'Could not save your change to the cloud workspace.', async () => {
    const seed = SEED_BY_CONTROL.get(controlId);
    if (!seed) throw new RepositoryError('unknown-control', 'That control is not in the cloud workspace.');

    const clientUuid = resolveClientUuid(clientId);
    const maps = await getControlIdMaps();
    const controlUuid = controlUuidOrThrow(maps, controlId);

    const sb = getSupabase();
    const { data: existing, error: readError } = await sb
      .from(ASSESSMENTS)
      .select('*')
      .eq('client_id', clientUuid)
      .eq('control_id', controlUuid)
      .maybeSingle();
    if (readError) {
      throw new RepositoryError('save-failed', 'Could not save your change.', { cause: readError });
    }

    // Materialize a full row: existing values (or seed) overlaid with the patch.
    const base = existing ? assessmentRowToDomain(existing, seed) : seed;
    const next: ClientControlAssessment = { ...base, ...patch };
    const payload = assessmentToRowPayload(next, { clientUuid, controlUuid });

    const { error: writeError } = await sb
      .from(ASSESSMENTS)
      .upsert(payload, { onConflict: 'client_id,control_id' });
    if (writeError) {
      throw new RepositoryError('save-failed', 'Could not save your change.', { cause: writeError });
    }
  });
}

/* ---- intake (latest non-deleted row per client) ---- */

async function getIntake(clientId: string): Promise<IntakeState> {
  return guard('load-failed', 'Could not load intake from the cloud workspace.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const { data, error } = await getSupabase()
      .from(INTAKE)
      .select('*')
      .eq('client_id', clientUuid)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new RepositoryError('load-failed', 'Could not load intake.', { cause: error });
    return data ? intakeRowToDomain(data) : DEFAULT_INTAKE;
  });
}

async function saveIntake(clientId: string, intake: IntakeState): Promise<void> {
  return guard('save-failed', 'Could not save intake to the cloud workspace.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const sb = getSupabase();
    const payload = intakeToRowPayload(intake);

    const { data: existing, error: readError } = await sb
      .from(INTAKE)
      .select('id')
      .eq('client_id', clientUuid)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw new RepositoryError('save-failed', 'Could not save intake.', { cause: readError });

    const { error: writeError } = existing
      ? await sb.from(INTAKE).update(payload).eq('id', existing.id)
      : await sb.from(INTAKE).insert({ client_id: clientUuid, ...payload });
    if (writeError) throw new RepositoryError('save-failed', 'Could not save intake.', { cause: writeError });
  });
}

/* ---- scope (latest non-deleted record + its assets) ---- */

/** Ensure ids are uuids before they reach the DB (seed/local ids are not). */
function withUuidId<T extends { id: string }>(item: T): T {
  return isUuid(item.id) ? item : { ...item, id: crypto.randomUUID() };
}

async function getScope(clientId: string): Promise<ScopeState> {
  return guard('load-failed', 'Could not load scope from the cloud workspace.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const sb = getSupabase();

    const { data: record, error: recordError } = await sb
      .from(SCOPE)
      .select('*')
      .eq('client_id', clientUuid)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recordError) throw new RepositoryError('load-failed', 'Could not load scope.', { cause: recordError });

    if (!record) {
      // No cloud scope yet: hand back the defaults, but re-id assets so a
      // subsequent save never tries to write the non-uuid seed ids.
      return { summary: DEFAULT_SCOPE.summary, assets: DEFAULT_SCOPE.assets.map(withUuidId) };
    }

    const { data: assetRows, error: assetError } = await sb
      .from(SCOPE_ASSETS)
      .select('*')
      .eq('scope_record_id', record.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (assetError) throw new RepositoryError('load-failed', 'Could not load scope assets.', { cause: assetError });

    return {
      summary: scopeRowToSummary(record),
      assets: (assetRows ?? []).map(scopeAssetRowToDomain),
    };
  });
}

async function saveScope(clientId: string, scope: ScopeState): Promise<void> {
  return guard('save-failed', 'Could not save scope to the cloud workspace.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const sb = getSupabase();
    const summaryPayload = scopeSummaryToRowPayload(scope.summary);

    // 1. Resolve (or create) the scope record id.
    const { data: existing, error: readError } = await sb
      .from(SCOPE)
      .select('id')
      .eq('client_id', clientUuid)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw new RepositoryError('save-failed', 'Could not save scope.', { cause: readError });

    let recordId: string;
    if (existing) {
      recordId = existing.id;
      const { error } = await sb.from(SCOPE).update(summaryPayload).eq('id', recordId);
      if (error) throw new RepositoryError('save-failed', 'Could not save scope.', { cause: error });
    } else {
      const { data: inserted, error } = await sb
        .from(SCOPE)
        .insert({ client_id: clientUuid, ...summaryPayload })
        .select('id')
        .single();
      if (error || !inserted) {
        throw new RepositoryError('save-failed', 'Could not save scope.', { cause: error });
      }
      recordId = inserted.id;
    }

    // 2. Upsert the assets (defensively re-id any non-uuid id).
    const assets = scope.assets.map(withUuidId);
    if (assets.length > 0) {
      const { error } = await sb
        .from(SCOPE_ASSETS)
        .upsert(
          assets.map((a) => scopeAssetToRowPayload(a, recordId)),
          { onConflict: 'id' },
        );
      if (error) throw new RepositoryError('save-failed', 'Could not save scope assets.', { cause: error });
    }

    // 3. Soft-delete live assets that are no longer present (never hard delete).
    const { data: liveRows, error: liveError } = await sb
      .from(SCOPE_ASSETS)
      .select('id')
      .eq('scope_record_id', recordId)
      .is('deleted_at', null);
    if (liveError) throw new RepositoryError('save-failed', 'Could not save scope assets.', { cause: liveError });

    const keep = new Set(assets.map((a) => a.id));
    const toRemove = (liveRows ?? []).map((r) => r.id).filter((id) => !keep.has(id));
    if (toRemove.length > 0) {
      const { error } = await sb
        .from(SCOPE_ASSETS)
        .update({ deleted_at: new Date().toISOString() })
        .in('id', toRemove);
      if (error) throw new RepositoryError('save-failed', 'Could not save scope assets.', { cause: error });
    }
  });
}

/* ---- migration helpers (used by the "import local edits" prompt) ---- */

/** True if the client already has any assessment/intake/scope rows in the cloud. */
export async function hasRemoteClientData(clientId: string): Promise<boolean> {
  return guard('load-failed', 'Could not check the cloud workspace.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const sb = getSupabase();

    const counts = await Promise.all([
      sb.from(ASSESSMENTS).select('id', { count: 'exact', head: true }).eq('client_id', clientUuid),
      sb.from(INTAKE).select('id', { count: 'exact', head: true }).eq('client_id', clientUuid).is('deleted_at', null),
      sb.from(SCOPE).select('id', { count: 'exact', head: true }).eq('client_id', clientUuid).is('deleted_at', null),
    ]);
    for (const { error } of counts) {
      if (error) throw new RepositoryError('load-failed', 'Could not check the cloud workspace.', { cause: error });
    }
    return counts.some((c) => (c.count ?? 0) > 0);
  });
}

export interface ImportSnapshot {
  overrides: Record<string, AssessmentPatch>;
  intake: IntakeState | null;
  scope: ScopeState | null;
}

/** Batch-import local edits for a client into the cloud workspace. */
export async function importLocalData(clientId: string, snapshot: ImportSnapshot): Promise<void> {
  return guard('save-failed', 'Could not import your local edits to the cloud workspace.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const maps = await getControlIdMaps();
    const sb = getSupabase();

    const controlIds = Object.keys(snapshot.overrides);
    if (controlIds.length > 0) {
      const rows = controlIds.map((controlId) => {
        const seed = SEED_BY_CONTROL.get(controlId);
        if (!seed) throw new RepositoryError('unknown-control', 'A local edit references an unknown control.');
        const controlUuid = controlUuidOrThrow(maps, controlId);
        const next: ClientControlAssessment = { ...seed, ...snapshot.overrides[controlId] };
        return assessmentToRowPayload(next, { clientUuid, controlUuid });
      });
      // One batched upsert for all imported assessments.
      const { error } = await sb.from(ASSESSMENTS).upsert(rows, { onConflict: 'client_id,control_id' });
      if (error) throw new RepositoryError('save-failed', 'Could not import assessments.', { cause: error });
    }

    if (snapshot.intake) await saveIntake(clientId, snapshot.intake);
    if (snapshot.scope) await saveScope(clientId, snapshot.scope);
  });
}

/* ---- audit log (append-only) ---- */

/** Append an app-level audit event. The DB stamps the actor (user_id +
    actor_name) from the session; callers never pass identity. Used by
    src/lib/audit.ts logEvent for sign-in / sign-out. */
export interface AppendAuditEvent {
  action: string;
  /** Domain client id or uuid; null for global events (e.g. auth). */
  clientId?: string | null;
}

export async function appendAuditEvent(event: AppendAuditEvent): Promise<void> {
  return guard('save-failed', 'Could not record the audit event.', async () => {
    const clientUuid = event.clientId ? resolveClientUuid(event.clientId) : null;
    const { error } = await getSupabase()
      .from(AUDIT)
      .insert({ action: event.action, client_id: clientUuid });
    if (error) throw new RepositoryError('save-failed', 'Could not record the audit event.', { cause: error });
  });
}

export interface AuditQuery {
  /** Domain client id or uuid; resolved before querying. */
  clientId?: string | null;
  actorName?: string | null;
  action?: string | null;
  /** Page size. */
  limit: number;
  /** Rows to skip (page * limit). */
  offset: number;
}

export interface AuditPage {
  entries: AuditLogEntry[];
  /** True when more rows exist past this page. */
  hasMore: boolean;
}

/**
 * Read a page of audit events (newest first). RLS scopes the rows to what the
 * caller may see (admins: all; staff: assigned clients; client roles: their
 * client minus internal-only actions). Client names are resolved with a second
 * RLS-safe lookup; actor names ride on the row (denormalized in migration 005).
 */
export async function listAuditEvents(query: AuditQuery): Promise<AuditPage> {
  return guard('load-failed', 'Could not load the audit log.', async () => {
    const sb = getSupabase();
    let q = sb
      .from(AUDIT)
      .select('id, created_at, action, entity_type, entity_id, client_id, user_id, actor_name, new_value')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      // fetch one extra row to detect a next page without a count query.
      .range(query.offset, query.offset + query.limit);
    if (query.clientId) q = q.eq('client_id', resolveClientUuid(query.clientId));
    if (query.actorName) q = q.eq('actor_name', query.actorName);
    if (query.action) q = q.eq('action', query.action);

    const { data, error } = await q;
    if (error) throw new RepositoryError('load-failed', 'Could not load the audit log.', { cause: error });

    const rows = (data ?? []) as unknown as AuditEventRow[];
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    // Resolve client names for the page (RLS returns only accessible clients —
    // which is exactly the set the visible audit rows belong to).
    const clientIds = [...new Set(pageRows.map((r) => r.client_id).filter((id): id is string => Boolean(id)))];
    const nameById = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clientsData, error: clientsError } = await sb
        .from(CLIENTS)
        .select('id, name')
        .in('id', clientIds);
      if (clientsError) {
        throw new RepositoryError('load-failed', 'Could not load the audit log.', { cause: clientsError });
      }
      for (const c of clientsData ?? []) nameById.set(c.id, c.name);
    }

    return {
      entries: pageRows.map((r) => auditRowToEntry(r, r.client_id ? nameById.get(r.client_id) ?? null : null)),
      hasMore,
    };
  });
}

export const supabaseRepository: ClientDataRepository = {
  getAssessments,
  patchAssessment,
  getIntake,
  saveIntake,
  getScope,
  saveScope,
};

/* ============================================================
   EVIDENCE (Task 08) — METADATA + external links only. The legal state
   machine lives in src/lib/evidenceWorkflow.ts; transition() validates against
   it (throwing EvidenceTransitionError on an illegal move) BEFORE writing, and
   migration 007's DB guard backstops the role boundary (uploaders cannot make
   review transitions). Status changes are captured by the 005 audit trigger
   (evidence.status_changed) — the human note is stored on the row so the trail
   captures it. Items are soft-removed elsewhere; this never hard-deletes.
   ============================================================ */

async function listEvidence(clientId: string): Promise<EvidenceItem[]> {
  return guard('load-failed', 'Could not load evidence from the cloud workspace.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const maps = await getControlIdMaps();
    const { data, error } = await getSupabase()
      .from(EVIDENCE)
      .select('*')
      .eq('client_id', clientUuid)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw new RepositoryError('load-failed', 'Could not load evidence.', { cause: error });
    return (data ?? []).map((row) =>
      evidenceRowToDomain(row, row.control_id ? maps.byUuid.get(row.control_id) ?? '' : ''),
    );
  });
}

async function createEvidence(clientId: string, input: EvidenceRequestInput): Promise<EvidenceItem> {
  return guard('save-failed', 'Could not request the evidence item.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const maps = await getControlIdMaps();
    const controlUuid = input.controlId ? controlUuidOrThrow(maps, input.controlId) : null;
    const { data, error } = await getSupabase()
      .from(EVIDENCE)
      .insert(evidenceCreateToRowPayload(input, { clientUuid, controlUuid }))
      .select('*')
      .single();
    if (error || !data) {
      throw new RepositoryError('save-failed', 'Could not request the evidence item.', { cause: error });
    }
    return evidenceRowToDomain(data, data.control_id ? maps.byUuid.get(data.control_id) ?? '' : '');
  });
}

async function updateEvidence(
  clientId: string,
  id: string,
  patch: EvidencePatch,
): Promise<EvidenceItem> {
  return guard('save-failed', 'Could not save your evidence changes.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const maps = await getControlIdMaps();
    const { data, error } = await getSupabase()
      .from(EVIDENCE)
      .update(evidencePatchToRowPayload(patch))
      .eq('id', id)
      .eq('client_id', clientUuid)
      .select('*')
      .single();
    if (error || !data) {
      throw new RepositoryError('save-failed', 'Could not save your evidence changes.', { cause: error });
    }
    return evidenceRowToDomain(data, data.control_id ? maps.byUuid.get(data.control_id) ?? '' : '');
  });
}

async function transitionEvidence(
  clientId: string,
  id: string,
  toStatus: EvidenceStatus,
  note?: string,
): Promise<EvidenceItem> {
  return guard('save-failed', 'Could not update the evidence status.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const maps = await getControlIdMaps();
    const sb = getSupabase();

    const { data: existing, error: readError } = await sb
      .from(EVIDENCE)
      .select('status')
      .eq('id', id)
      .eq('client_id', clientUuid)
      .is('deleted_at', null)
      .maybeSingle();
    if (readError) {
      throw new RepositoryError('save-failed', 'Could not update the evidence status.', { cause: readError });
    }
    if (!existing) throw new RepositoryError('unknown-evidence', 'That evidence item no longer exists.');

    // Validate against the single source of truth BEFORE any write (throws
    // EvidenceTransitionError on an illegal move). The DB guard backstops roles.
    assertTransition(existing.status, toStatus);

    const { data, error } = await sb
      .from(EVIDENCE)
      .update(evidenceTransitionToRowPayload(toStatus, note))
      .eq('id', id)
      .eq('client_id', clientUuid)
      .select('*')
      .single();
    if (error || !data) {
      throw new RepositoryError('save-failed', 'Could not update the evidence status.', { cause: error });
    }
    return evidenceRowToDomain(data, data.control_id ? maps.byUuid.get(data.control_id) ?? '' : '');
  });
}

export const supabaseEvidenceRepository: EvidenceRepository = {
  list: listEvidence,
  create: createEvidence,
  updateMetadata: updateEvidence,
  transition: transitionEvidence,
};

/* ============================================================
   CLIENTS + ASSIGNMENTS (Task 07)

   Engagements are RECORDS: archiveClient flips status to 'Closed' (never a
   hard delete), assignment removal is a deleted_at soft-delete. createClient
   inserts the client, optionally assigns a consultant, then seeds the 110
   control assessment rows in ONE batch insert (never a 110-row loop) and
   appends a client.created audit event. RLS (004) gates all of this to admins
   (consultants are read-only on assigned clients; creation is admin-only).
   ============================================================ */

/** Resolve profile display names for a set of ids (RLS: admins read profiles;
    others get an empty map — names degrade to null, never an error). */
async function fetchProfileNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return names;
  const { data, error } = await getSupabase().from(PROFILES).select('id, full_name').in('id', unique);
  if (error) return names; // best-effort; non-admins can't read profiles under RLS
  for (const p of (data ?? []) as { id: string; full_name: string }[]) names.set(p.id, p.full_name);
  return names;
}

/** Build the 110 'Not Reviewed' seed assessment rows for a new client (pure). */
export function seedAssessmentRowsForClient(
  clientUuid: string,
  maps: { byNatural: Map<string, string> },
): AssessmentRowPayload[] {
  return SEED_ASSESSMENTS.map((seed) => {
    const controlUuid = maps.byNatural.get(seed.controlId);
    if (!controlUuid) {
      throw new RepositoryError('unknown-control', 'That control is not in the cloud workspace.');
    }
    return assessmentToRowPayload(
      {
        clientId: seed.clientId,
        controlId: seed.controlId,
        status: 'Not Reviewed',
        sspStatus: 'Not Reviewed',
        evidenceStatus: 'Not Requested',
        poamStatus: 'None',
        risk: 'Medium',
        owner: 'Unassigned',
      },
      { clientUuid, controlUuid },
    );
  });
}

async function listClients(): Promise<ClientRecord[]> {
  return guard('load-failed', 'Could not load clients from the cloud workspace.', async () => {
    const { data, error } = await getSupabase()
      .from(CLIENTS)
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw new RepositoryError('load-failed', 'Could not load clients.', { cause: error });

    const rows = data ?? [];
    const names = await fetchProfileNames(
      rows.map((r) => r.primary_consultant_id).filter((id): id is string => Boolean(id)),
    );
    return rows.map((r) =>
      clientRowToDomain(r, r.primary_consultant_id ? names.get(r.primary_consultant_id) ?? null : null),
    );
  });
}

async function getClient(id: string): Promise<ClientRecord | null> {
  return guard('load-failed', 'Could not load the client.', async () => {
    const clientUuid = resolveClientUuid(id);
    const { data, error } = await getSupabase()
      .from(CLIENTS)
      .select('*')
      .eq('id', clientUuid)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new RepositoryError('load-failed', 'Could not load the client.', { cause: error });
    if (!data) return null;
    const names = await fetchProfileNames(data.primary_consultant_id ? [data.primary_consultant_id] : []);
    return clientRowToDomain(data, data.primary_consultant_id ? names.get(data.primary_consultant_id) ?? null : null);
  });
}

async function createClient(input: ClientCreateInput): Promise<ClientRecord> {
  return guard('save-failed', 'Could not create the client in the cloud workspace.', async () => {
    const sb = getSupabase();

    // 1. Resolve the owning organization (internal Benchmark Fox org first).
    const { data: org, error: orgError } = await sb
      .from(ORGANIZATIONS)
      .select('id')
      .order('is_internal', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (orgError) throw new RepositoryError('save-failed', 'Could not create the client.', { cause: orgError });
    if (!org) {
      throw new RepositoryError(
        'save-failed',
        'No organization is configured for the workspace yet. Contact an administrator.',
      );
    }
    const organizationId = (org as { id: string }).id;

    // 2. Insert the client row.
    const { data: inserted, error: insertError } = await sb
      .from(CLIENTS)
      .insert({ organization_id: organizationId, ...clientCreateToRowPayload(input) })
      .select('*')
      .single();
    if (insertError || !inserted) {
      throw new RepositoryError('save-failed', 'Could not create the client.', { cause: insertError });
    }
    const clientUuid = inserted.id;

    // 3. Initial consultant assignment (authoritative tenancy mapping).
    if (input.primaryConsultantId) {
      const { error: assignError } = await sb.from(CLIENT_ASSIGNMENTS).upsert(
        {
          client_id: clientUuid,
          profile_id: input.primaryConsultantId,
          role: 'benchmark_fox_consultant',
          is_primary: true,
          deleted_at: null,
        },
        { onConflict: 'client_id,profile_id' },
      );
      if (assignError) {
        throw new RepositoryError('save-failed', 'Could not assign the consultant.', { cause: assignError });
      }
    }

    // 4. Seed the 110 control assessment rows in ONE batch insert.
    const maps = await getControlIdMaps();
    const { error: seedError } = await sb
      .from(ASSESSMENTS)
      .insert(seedAssessmentRowsForClient(clientUuid, maps));
    if (seedError) {
      throw new RepositoryError('save-failed', 'Could not initialize the control set.', { cause: seedError });
    }

    // 5. Append a client.created audit event (best-effort — the DB stamps the actor).
    await sb.from(AUDIT).insert({ action: 'client.created', client_id: clientUuid }).then(
      () => undefined,
      () => undefined,
    );

    const names = await fetchProfileNames(input.primaryConsultantId ? [input.primaryConsultantId] : []);
    return clientRowToDomain(
      inserted,
      input.primaryConsultantId ? names.get(input.primaryConsultantId) ?? null : null,
    );
  });
}

async function updateClient(id: string, patch: ClientPatch): Promise<ClientRecord> {
  return guard('save-failed', 'Could not save the client changes.', async () => {
    const clientUuid = resolveClientUuid(id);
    const payload = clientPatchToRowPayload(patch);
    const { data, error } = await getSupabase()
      .from(CLIENTS)
      .update(payload)
      .eq('id', clientUuid)
      .select('*')
      .single();
    if (error || !data) throw new RepositoryError('save-failed', 'Could not save the client changes.', { cause: error });
    const names = await fetchProfileNames(data.primary_consultant_id ? [data.primary_consultant_id] : []);
    return clientRowToDomain(data, data.primary_consultant_id ? names.get(data.primary_consultant_id) ?? null : null);
  });
}

/** Archive: status -> 'Closed'. NEVER hard-deletes (engagements are records). */
async function archiveClient(id: string): Promise<ClientRecord> {
  return updateClient(id, { status: 'Closed' });
}

async function listAssessmentStatuses(): Promise<ClientAssessmentStatus[]> {
  return guard('load-failed', 'Could not load client readiness.', async () => {
    const maps = await getControlIdMaps();
    const { data, error } = await getSupabase()
      .from(ASSESSMENTS)
      .select('client_id, control_id, readiness_status');
    if (error) throw new RepositoryError('load-failed', 'Could not load client readiness.', { cause: error });
    return (data ?? []).map((r) => ({
      clientId: r.client_id,
      controlId: maps.byUuid.get(r.control_id) ?? r.control_id,
      status: r.readiness_status,
    }));
  });
}

async function listAssignableConsultants(): Promise<AssignableConsultant[]> {
  return guard('load-failed', 'Could not load assignable staff.', async () => {
    const { data, error } = await getSupabase()
      .from(PROFILES)
      .select('id, full_name, email, role')
      .in('role', ['benchmark_fox_admin', 'benchmark_fox_consultant']);
    if (error) throw new RepositoryError('load-failed', 'Could not load assignable staff.', { cause: error });
    return (data ?? []).map((p) => ({ id: p.id, name: p.full_name, email: p.email, role: p.role }));
  });
}

async function listAssignments(clientId: string): Promise<ClientAssignment[]> {
  return guard('load-failed', 'Could not load client assignments.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const { data, error } = await getSupabase()
      .from(CLIENT_ASSIGNMENTS)
      .select('id, client_id, profile_id, role, is_primary')
      .eq('client_id', clientUuid)
      .is('deleted_at', null);
    if (error) throw new RepositoryError('load-failed', 'Could not load client assignments.', { cause: error });

    const rows = data ?? [];
    const names = await fetchProfileNames(rows.map((r) => r.profile_id));
    return rows.map((r) => ({
      id: r.id,
      clientId: r.client_id,
      profileId: r.profile_id,
      profileName: names.get(r.profile_id) ?? null,
      role: r.role,
      isPrimary: r.is_primary,
    }));
  });
}

async function assignConsultant(clientId: string, profileId: string, isPrimary = false): Promise<void> {
  return guard('save-failed', 'Could not assign the consultant.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const { error } = await getSupabase().from(CLIENT_ASSIGNMENTS).upsert(
      {
        client_id: clientUuid,
        profile_id: profileId,
        role: 'benchmark_fox_consultant',
        is_primary: isPrimary,
        deleted_at: null,
      },
      { onConflict: 'client_id,profile_id' },
    );
    if (error) throw new RepositoryError('save-failed', 'Could not assign the consultant.', { cause: error });
  });
}

/** Remove an assignment by SOFT-DELETE (deleted_at) — never a hard delete. */
async function removeAssignment(clientId: string, profileId: string): Promise<void> {
  return guard('save-failed', 'Could not remove the assignment.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const { error } = await getSupabase()
      .from(CLIENT_ASSIGNMENTS)
      .update({ deleted_at: new Date().toISOString() })
      .eq('client_id', clientUuid)
      .eq('profile_id', profileId);
    if (error) throw new RepositoryError('save-failed', 'Could not remove the assignment.', { cause: error });
  });
}

export const supabaseClientsRepository: ClientsRepository = {
  listClients,
  getClient,
  createClient,
  updateClient,
  archiveClient,
  listAssessmentStatuses,
  listAssignableConsultants,
  listAssignments,
  assignConsultant,
  removeAssignment,
};
