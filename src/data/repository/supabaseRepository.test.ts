/* ============================================================
   supabaseRepository tests — mocked Supabase client.

   A small chainable fake records every query (table + which write/
   read kind + the chained ops) and resolves through a per-test
   handler. We assert the mapping, the materialize-on-first-write
   payload + onConflict, latest-live-row selection, asset soft-delete
   (never a hard delete), unknown-client handling, and that raw SQL
   never leaks into RepositoryError messages.
   ============================================================ */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_ASSESSMENTS } from '../controls';
import { DEFAULT_INTAKE } from '../intake';
import { DEFAULT_SCOPE } from '../scope';
import { isRepositoryError } from './types';
import { DEMO_CLIENT_UUIDS } from './clientIds';

/* ---- mocked supabaseClient (getSupabase returns the per-test fake) ---- */
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  getSupabase: () => holder.client,
}));

const repoModule = await import('./supabaseRepository');
const { hasRemoteClientData, resetControlIdCacheForTests, supabaseRepository } = repoModule;
const { getAssessments, patchAssessment, getIntake, saveIntake, getScope, saveScope } = supabaseRepository;

/* ---- chainable fake query builder ---- */
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

const ACME = 'acme';
const ACME_UUID = DEMO_CLIENT_UUIDS.acme;
const CTRL_311_UUID = 'c0000000-0000-4000-8000-000000000311';
const seed311 = SEED_ASSESSMENTS.find((a) => a.controlId === '3.1.1')!;

const controlsData = [{ id: CTRL_311_UUID, natural_id: '3.1.1' }];

/** Build a full assessment DB row from a partial. */
function assessmentRow(over: Record<string, unknown>) {
  return {
    id: 'row-1',
    client_id: ACME_UUID,
    control_id: CTRL_311_UUID,
    readiness_status: 'Met',
    implementation_status: 'Not Started',
    ssp_status: 'Complete',
    evidence_status: 'Accepted',
    poam_status: 'None',
    risk_rating: 'High',
    owner_name: 'IT Lead',
    due_date: null,
    score_impact: null,
    consultant_notes: null,
    client_notes: null,
    validation_method: null,
    ssp_statement: null,
    last_reviewed_at: null,
    reviewed_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function opArgs(call: Call, method: string): unknown[] | undefined {
  return call.ops.find(([m]) => m === method)?.[1];
}

beforeEach(() => {
  resetControlIdCacheForTests();
});

describe('getAssessments', () => {
  it('merges a DB row over its seed and leaves other controls as seed', async () => {
    holder.client = makeClient((call) => {
      if (call.table === 'controls') return { data: controlsData };
      if (call.table === 'client_control_assessments') {
        return { data: [assessmentRow({ readiness_status: 'Not Met', owner_name: 'CIO' })] };
      }
      return { data: [] };
    });

    const result = await getAssessments(ACME);
    expect(result).toHaveLength(SEED_ASSESSMENTS.length);
    const a311 = result.find((a) => a.controlId === '3.1.1')!;
    expect(a311.status).toBe('Not Met');
    expect(a311.owner).toBe('CIO');
    // untouched controls keep seed values
    const other = SEED_ASSESSMENTS.find((a) => a.controlId !== '3.1.1')!;
    expect(result.find((a) => a.controlId === other.controlId)).toEqual(other);
  });

  it('returns pure seeds when the client has no rows (RLS-empty)', async () => {
    holder.client = makeClient((call) =>
      call.table === 'controls' ? { data: controlsData } : { data: [] },
    );
    expect(await getAssessments(ACME)).toEqual(SEED_ASSESSMENTS);
  });

  it('rejects with an unknown-client RepositoryError for an unmapped id', async () => {
    holder.client = makeClient(() => ({ data: [] }));
    await expect(getAssessments('nonexistent')).rejects.toMatchObject({ kind: 'unknown-client' });
  });
});

describe('patchAssessment', () => {
  it('materializes a full row from seed + patch and upserts with onConflict', async () => {
    const client = makeClient((call) => {
      if (call.table === 'controls') return { data: controlsData };
      if (call.table === 'client_control_assessments' && call.terminal === 'maybeSingle') {
        return { data: null }; // no existing row
      }
      return {};
    });
    holder.client = client;

    await patchAssessment(ACME, '3.1.1', { status: 'Partial', owner: 'CIO' });

    const upsert = client.calls.find((c) => c.kind === 'upsert')!;
    expect(upsert).toBeDefined();
    const [payload, options] = opArgs(upsert, 'upsert') as [Record<string, unknown>, { onConflict: string }];
    expect(options).toEqual({ onConflict: 'client_id,control_id' });
    expect(payload).toMatchObject({
      client_id: ACME_UUID,
      control_id: CTRL_311_UUID,
      readiness_status: 'Partial', // from patch
      owner_name: 'CIO', // from patch
      ssp_status: seed311.sspStatus, // materialized from seed
      evidence_status: seed311.evidenceStatus,
      poam_status: seed311.poamStatus,
    });
  });

  it('merges the patch over an existing row', async () => {
    const client = makeClient((call) => {
      if (call.table === 'controls') return { data: controlsData };
      if (call.table === 'client_control_assessments' && call.terminal === 'maybeSingle') {
        return { data: assessmentRow({ readiness_status: 'Not Met', ssp_status: 'Needs Fix' }) };
      }
      return {};
    });
    holder.client = client;

    await patchAssessment(ACME, '3.1.1', { owner: 'MSP' });

    const [payload] = opArgs(client.calls.find((c) => c.kind === 'upsert')!, 'upsert') as [Record<string, unknown>];
    expect(payload).toMatchObject({
      readiness_status: 'Not Met', // preserved from existing row
      ssp_status: 'Needs Fix', // preserved from existing row
      owner_name: 'MSP', // from patch
    });
  });
});

describe('getIntake / saveIntake', () => {
  it('selects the latest non-deleted row and maps it', async () => {
    const client = makeClient((call) =>
      call.table === 'intake_records'
        ? { data: { ...intakeRowDefaults(), estimated_scope: 'Whole network' } }
        : {},
    );
    holder.client = client;

    const intake = await getIntake(ACME);
    expect(intake.estimatedScope).toBe('Whole network');

    const select = client.calls.find((c) => c.table === 'intake_records')!;
    expect(opArgs(select, 'is')).toEqual(['deleted_at', null]);
    expect(opArgs(select, 'order')).toEqual(['updated_at', { ascending: false }]);
    expect(opArgs(select, 'limit')).toEqual([1]);
  });

  it('updates the existing row when one is present', async () => {
    const client = makeClient((call) => {
      if (call.table === 'intake_records' && call.terminal === 'maybeSingle') return { data: { id: 'i-1' } };
      return {};
    });
    holder.client = client;

    await saveIntake(ACME, DEFAULT_INTAKE);
    const update = client.calls.find((c) => c.table === 'intake_records' && c.kind === 'update');
    expect(update).toBeDefined();
    expect(opArgs(update!, 'eq')).toEqual(['id', 'i-1']);
    expect(client.calls.some((c) => c.kind === 'insert')).toBe(false);
  });

  it('inserts a new row when none exists', async () => {
    const client = makeClient((call) => {
      if (call.table === 'intake_records' && call.terminal === 'maybeSingle') return { data: null };
      return {};
    });
    holder.client = client;

    await saveIntake(ACME, DEFAULT_INTAKE);
    expect(client.calls.some((c) => c.table === 'intake_records' && c.kind === 'insert')).toBe(true);
  });
});

describe('getScope / saveScope', () => {
  it('returns defaults with uuid asset ids when no record exists', async () => {
    holder.client = makeClient(() => ({ data: null }));
    const scope = await getScope(ACME);
    expect(scope.summary).toEqual(DEFAULT_SCOPE.summary);
    for (const asset of scope.assets) {
      expect(asset.id).toMatch(/^[0-9a-f-]{36}$/i);
    }
  });

  it('soft-deletes assets that are no longer present and never hard-deletes', async () => {
    const keptId = 'a0000000-0000-4000-8000-000000000001';
    const goneId = 'a0000000-0000-4000-8000-000000000002';
    const client = makeClient((call) => {
      if (call.table === 'scope_records' && call.terminal === 'maybeSingle') return { data: { id: 's-1' } };
      if (call.table === 'scope_assets' && call.kind === 'select') {
        return { data: [{ id: keptId }, { id: goneId }] };
      }
      return {};
    });
    holder.client = client;

    await saveScope(ACME, {
      summary: DEFAULT_SCOPE.summary,
      assets: [
        { id: keptId, name: 'Kept', type: 'Cloud', category: 'CUI Asset', handlesCui: true, owner: 'MSP', inScope: true },
      ],
    });

    const softDelete = client.calls.find((c) => c.table === 'scope_assets' && c.kind === 'update');
    expect(softDelete).toBeDefined();
    expect((opArgs(softDelete!, 'update')?.[0] as Record<string, unknown>).deleted_at).toEqual(expect.any(String));
    expect(opArgs(softDelete!, 'in')).toEqual(['id', [goneId]]);
    // never a hard delete, anywhere
    expect(client.calls.some((c) => c.kind === 'delete')).toBe(false);
  });

  it('re-ids non-uuid asset ids before writing', async () => {
    const client = makeClient((call) => {
      if (call.table === 'scope_records' && call.terminal === 'maybeSingle') return { data: { id: 's-1' } };
      if (call.table === 'scope_assets' && call.kind === 'select') return { data: [] };
      return {};
    });
    holder.client = client;

    await saveScope(ACME, {
      summary: DEFAULT_SCOPE.summary,
      assets: [
        { id: 'as-1', name: 'Seed', type: 'Cloud', category: 'CUI Asset', handlesCui: true, owner: 'MSP', inScope: true },
      ],
    });

    const upsert = client.calls.find((c) => c.table === 'scope_assets' && c.kind === 'upsert')!;
    const rows = opArgs(upsert, 'upsert')?.[0] as Array<{ id: string }>;
    expect(rows[0].id).not.toBe('as-1');
    expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('error handling', () => {
  it('rethrows DB errors as RepositoryError without leaking SQL', async () => {
    holder.client = makeClient((call) => {
      if (call.table === 'controls') return { data: controlsData };
      return { error: { message: 'permission denied for table client_control_assessments', code: '42501' } };
    });

    let caught: unknown;
    try {
      await getAssessments(ACME);
    } catch (e) {
      caught = e;
    }
    expect(isRepositoryError(caught)).toBe(true);
    if (isRepositoryError(caught)) {
      expect(caught.kind).toBe('load-failed');
      expect(caught.message).not.toMatch(/permission denied|client_control_assessments|42501/);
      expect(caught.cause).toMatchObject({ code: '42501' }); // original kept for debugging
    }
  });
});

describe('read retry-with-backoff', () => {
  it('retries a transient read failure and then succeeds', async () => {
    let assessmentAttempts = 0;
    holder.client = makeClient((call) => {
      if (call.table === 'controls') return { data: controlsData };
      if (call.table === 'client_control_assessments') {
        assessmentAttempts++;
        if (assessmentAttempts === 1) return { error: { message: 'transient network blip' } };
        return { data: [assessmentRow({ readiness_status: 'Met' })] };
      }
      return { data: [] };
    });

    const result = await getAssessments(ACME);
    expect(assessmentAttempts).toBe(2); // first attempt failed, retry succeeded
    expect(result).toHaveLength(SEED_ASSESSMENTS.length);
  });

  it('NEVER retries a failed write (duplicate-write risk)', async () => {
    let upsertAttempts = 0;
    const client = makeClient((call) => {
      if (call.table === 'controls') return { data: controlsData };
      if (call.table === 'client_control_assessments' && call.terminal === 'maybeSingle') {
        return { data: null };
      }
      if (call.table === 'client_control_assessments' && call.kind === 'upsert') {
        upsertAttempts++;
        return { error: { message: 'write failed' } };
      }
      return {};
    });
    holder.client = client;

    await expect(patchAssessment(ACME, '3.1.1', { status: 'Met' })).rejects.toMatchObject({
      kind: 'save-failed',
    });
    expect(upsertAttempts).toBe(1); // exactly one attempt — no retry
  });
});

describe('hasRemoteClientData', () => {
  it('is true when any counted table has rows', async () => {
    holder.client = makeClient((call) =>
      call.table === 'intake_records' ? { count: 1 } : { count: 0 },
    );
    expect(await hasRemoteClientData(ACME)).toBe(true);
  });

  it('is false when every counted table is empty', async () => {
    holder.client = makeClient(() => ({ count: 0 }));
    expect(await hasRemoteClientData(ACME)).toBe(false);
  });
});

function intakeRowDefaults() {
  return {
    id: 'i-1',
    client_id: ACME_UUID,
    system_name: DEFAULT_INTAKE.systemName,
    likely_cmmc_path: DEFAULT_INTAKE.likelyPath,
    estimated_scope: DEFAULT_INTAKE.estimatedScope,
    likely_data_type: DEFAULT_INTAKE.likelyDataType,
    initial_risk_rating: DEFAULT_INTAKE.initialRisk,
    recommended_next_step: DEFAULT_INTAKE.recommendedNextStep,
    proposed_engagement: DEFAULT_INTAKE.proposedEngagement,
    contract_clauses: DEFAULT_INTAKE.contractClauses,
    data_handling_types: DEFAULT_INTAKE.dataHandling,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  };
}
