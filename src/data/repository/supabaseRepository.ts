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
import type { ClientControlAssessment } from '../types';
import { SEED_ASSESSMENTS } from '../controls';
import { DEFAULT_INTAKE, type IntakeState } from '../intake';
import { DEFAULT_SCOPE, type ScopeState } from '../scope';
import { isUuid, resolveClientUuid } from './clientIds';
import {
  assessmentRowToDomain,
  assessmentToRowPayload,
  intakeRowToDomain,
  intakeToRowPayload,
  scopeAssetRowToDomain,
  scopeAssetToRowPayload,
  scopeRowToSummary,
  scopeSummaryToRowPayload,
} from './mappers';
import { RepositoryError, type AssessmentPatch, type ClientDataRepository } from './types';

const ASSESSMENTS = 'client_control_assessments';
const INTAKE = 'intake_records';
const SCOPE = 'scope_records';
const SCOPE_ASSETS = 'scope_assets';

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

async function getAssessments(clientId: string): Promise<ClientControlAssessment[]> {
  return guard('load-failed', 'Could not load assessments from the cloud workspace.', async () => {
    const clientUuid = resolveClientUuid(clientId);
    const maps = await getControlIdMaps();
    const { data, error } = await getSupabase().from(ASSESSMENTS).select('*').eq('client_id', clientUuid);
    if (error) throw new RepositoryError('load-failed', 'Could not load assessments.', { cause: error });

    const rowByControlUuid = new Map((data ?? []).map((row) => [row.control_id, row]));
    return SEED_ASSESSMENTS.map((seed) => {
      const controlUuid = maps.byNatural.get(seed.controlId);
      const row = controlUuid ? rowByControlUuid.get(controlUuid) : undefined;
      return row ? assessmentRowToDomain(row, seed) : seed;
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

export const supabaseRepository: ClientDataRepository = {
  getAssessments,
  patchAssessment,
  getIntake,
  saveIntake,
  getScope,
  saveScope,
};
