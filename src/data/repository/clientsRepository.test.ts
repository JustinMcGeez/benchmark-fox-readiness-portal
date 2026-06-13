/* ============================================================
   Clients repository tests (Task 07) — local + Supabase.

   Verifies the two acceptance-critical behaviors: createClient seeds
   EXACTLY 110 assessment rows (and, in Supabase mode, in ONE batch
   insert — not a 110-row loop), and archiveClient is a status change to
   'Closed', NEVER a hard delete. Also covers update + assignment.
   ============================================================ */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_ASSESSMENTS } from '../controls';

/* ---- mocked supabaseClient (getSupabase returns the per-test fake) ---- */
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  getSupabase: () => holder.client,
}));

const localMod = await import('./localRepository');
const { localClientsRepository, localRepository } = localMod;
const repoMod = await import('./supabaseRepository');
const { supabaseClientsRepository, seedAssessmentRowsForClient, resetControlIdCacheForTests } = repoMod;

const NEW_CLIENT_UUID = '07000000-0000-4000-8000-000000000001';

/* ---- chainable fake query builder (same shape as supabaseRepository.test) -- */
type Op = [string, unknown[]];
interface Call {
  table: string;
  kind: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  terminal: 'maybeSingle' | 'single' | 'await';
  ops: Op[];
}
type Result = { data?: unknown; error?: unknown; count?: number };
type Handler = (call: Call) => Result | undefined;

function makeClient(handler: Handler) {
  const calls: Call[] = [];
  function build(table: string, ops: Op[]) {
    const kindOf = (): Call['kind'] => {
      for (const [m] of ops) {
        if (m === 'insert' || m === 'update' || m === 'upsert' || m === 'delete') return m;
      }
      return 'select';
    };
    const resolve = (terminal: Call['terminal']): Promise<Result> => {
      const call: Call = { table, kind: kindOf(), terminal, ops };
      calls.push(call);
      return Promise.resolve({ data: null, error: null, count: 0, ...(handler(call) ?? {}) });
    };
    const chain = (m: string) => (...args: unknown[]) => build(table, [...ops, [m, args]]);
    return {
      select: chain('select'),
      eq: chain('eq'),
      is: chain('is'),
      in: chain('in'),
      order: chain('order'),
      limit: chain('limit'),
      upsert: chain('upsert'),
      insert: chain('insert'),
      update: chain('update'),
      delete: chain('delete'),
      maybeSingle: () => resolve('maybeSingle'),
      single: () => resolve('single'),
      then: (onF: (r: Result) => unknown, onR?: (e: unknown) => unknown) => resolve('await').then(onF, onR),
    };
  }
  return { from: vi.fn((table: string) => build(table, [])), calls };
}

const controlsData = SEED_ASSESSMENTS.map((s, i) => ({
  id: `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  natural_id: s.controlId,
}));

function clientRow(over: Record<string, unknown> = {}) {
  return {
    id: NEW_CLIENT_UUID,
    organization_id: 'org-1',
    name: 'New Co',
    status: 'Active',
    cmmc_path: 'Level 2',
    cmmc_level: 'L2',
    risk_rating: null,
    readiness_phase: 'Intake',
    primary_consultant_id: null,
    secondary_consultant_id: null,
    deadline: null,
    notes: null,
    cage_code: null,
    dib_role: null,
    contract_types: [],
    primary_contact_name: null,
    primary_contact_email: null,
    primary_contact_title: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...over,
  };
}

function opArgs(call: Call, method: string): unknown[] | undefined {
  return call.ops.find(([m]) => m === method)?.[1];
}

beforeEach(() => {
  localStorage.clear();
  resetControlIdCacheForTests();
});

/* ===========================================================================
   LOCAL repository
   =========================================================================== */
describe('local clients repository', () => {
  it('createClient seeds exactly 110 assessment rows, all Not Reviewed', async () => {
    const record = await localClientsRepository.createClient({ name: 'New Co', cmmcPath: 'Level 2' });
    expect(record.name).toBe('New Co');
    expect(record.status).toBe('Active');
    expect(record.cmmcLevel).toBe('L2');

    const assessments = await localRepository.getAssessments(record.id);
    expect(assessments).toHaveLength(110);
    expect(assessments.every((a) => a.status === 'Not Reviewed')).toBe(true);
    expect(assessments.every((a) => a.clientId === record.id)).toBe(true);
  });

  it('archiveClient sets status Closed and never removes the row', async () => {
    const record = await localClientsRepository.createClient({ name: 'Archive Me', cmmcPath: 'Level 1' });
    const before = await localClientsRepository.listClients();
    expect(before.some((c) => c.id === record.id)).toBe(true);

    const archived = await localClientsRepository.archiveClient(record.id);
    expect(archived.status).toBe('Closed');

    const after = await localClientsRepository.listClients();
    // still present (records are never hard-deleted), just Closed
    expect(after.some((c) => c.id === record.id)).toBe(true);
    expect(after.find((c) => c.id === record.id)?.status).toBe('Closed');
  });

  it('updateClient patches fields and refreshes the list', async () => {
    const record = await localClientsRepository.createClient({ name: 'Patch Co', cmmcPath: 'Undetermined' });
    const updated = await localClientsRepository.updateClient(record.id, {
      name: 'Patched Co',
      cmmcPath: 'Level 2',
    });
    expect(updated.name).toBe('Patched Co');
    expect(updated.cmmcPath).toBe('Level 2');
    expect(updated.cmmcLevel).toBe('L2');
    const list = await localClientsRepository.listClients();
    expect(list.find((c) => c.id === record.id)?.name).toBe('Patched Co');
  });

  it('records an assignment when a consultant is chosen on create', async () => {
    const record = await localClientsRepository.createClient({
      name: 'Assigned Co',
      cmmcPath: 'Level 2',
      primaryConsultantId: 'u2',
    });
    const assignments = await localClientsRepository.listAssignments(record.id);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].profileId).toBe('u2');
    expect(assignments[0].isPrimary).toBe(true);
  });
});

/* ===========================================================================
   Pure seed-row builder
   =========================================================================== */
describe('seedAssessmentRowsForClient', () => {
  it('produces exactly 110 Not-Reviewed rows for the new client', () => {
    const maps = { byNatural: new Map(controlsData.map((c) => [c.natural_id, c.id])) };
    const rows = seedAssessmentRowsForClient(NEW_CLIENT_UUID, maps);
    expect(rows).toHaveLength(110);
    expect(rows.every((r) => r.client_id === NEW_CLIENT_UUID)).toBe(true);
    expect(rows.every((r) => r.readiness_status === 'Not Reviewed')).toBe(true);
    expect(rows.every((r) => r.ssp_status === 'Not Reviewed')).toBe(true);
  });
});

/* ===========================================================================
   SUPABASE repository
   =========================================================================== */
describe('supabase clients repository', () => {
  it('createClient inserts the 110 assessment rows in ONE batch (no loop, no delete)', async () => {
    const client = makeClient((call) => {
      if (call.table === 'organizations') return { data: { id: 'org-1' } };
      if (call.table === 'clients' && call.kind === 'insert') return { data: clientRow() };
      if (call.table === 'controls') return { data: controlsData };
      return {};
    });
    holder.client = client;

    const record = await supabaseClientsRepository.createClient({ name: 'New Co', cmmcPath: 'Level 2' });
    expect(record.id).toBe(NEW_CLIENT_UUID);

    const seedInserts = client.calls.filter(
      (c) => c.table === 'client_control_assessments' && c.kind === 'insert',
    );
    expect(seedInserts).toHaveLength(1); // exactly one batch insert
    const rows = opArgs(seedInserts[0], 'insert')?.[0] as unknown[];
    expect(rows).toHaveLength(110);

    // engagements are records — never a hard delete during creation
    expect(client.calls.some((c) => c.kind === 'delete')).toBe(false);
  });

  it('assigns the chosen consultant via upsert during create', async () => {
    const client = makeClient((call) => {
      if (call.table === 'organizations') return { data: { id: 'org-1' } };
      if (call.table === 'clients' && call.kind === 'insert') {
        return { data: clientRow({ primary_consultant_id: 'p-1' }) };
      }
      if (call.table === 'controls') return { data: controlsData };
      if (call.table === 'profiles') return { data: [{ id: 'p-1', full_name: 'Dana' }] };
      return {};
    });
    holder.client = client;

    await supabaseClientsRepository.createClient({
      name: 'Assigned Co',
      cmmcPath: 'Level 2',
      primaryConsultantId: 'p-1',
    });

    const assignUpsert = client.calls.find(
      (c) => c.table === 'client_assignments' && c.kind === 'upsert',
    );
    expect(assignUpsert).toBeDefined();
    const [payload, options] = opArgs(assignUpsert!, 'upsert') as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(payload).toMatchObject({ client_id: NEW_CLIENT_UUID, profile_id: 'p-1', is_primary: true });
    expect(options).toEqual({ onConflict: 'client_id,profile_id' });
  });

  it('archiveClient updates status to Closed and never hard-deletes', async () => {
    const client = makeClient((call) => {
      if (call.table === 'clients' && call.kind === 'update') {
        return { data: clientRow({ status: 'Closed' }) };
      }
      return {};
    });
    holder.client = client;

    const archived = await supabaseClientsRepository.archiveClient(NEW_CLIENT_UUID);
    expect(archived.status).toBe('Closed');

    const update = client.calls.find((c) => c.table === 'clients' && c.kind === 'update')!;
    expect(update).toBeDefined();
    expect((opArgs(update, 'update')?.[0] as Record<string, unknown>).status).toBe('Closed');
    expect(client.calls.some((c) => c.kind === 'delete')).toBe(false);
  });

  it('removeAssignment soft-deletes (deleted_at) instead of hard-deleting', async () => {
    const client = makeClient(() => ({}));
    holder.client = client;

    await supabaseClientsRepository.removeAssignment(NEW_CLIENT_UUID, 'p-1');

    const update = client.calls.find((c) => c.table === 'client_assignments' && c.kind === 'update')!;
    expect(update).toBeDefined();
    expect((opArgs(update, 'update')?.[0] as Record<string, unknown>).deleted_at).toEqual(expect.any(String));
    expect(client.calls.some((c) => c.kind === 'delete')).toBe(false);
  });
});
