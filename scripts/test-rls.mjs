/* ============================================================================
   test-rls.mjs — automated Row Level Security policy tests (Task 05)

   Proves the tenancy boundary in supabase/migrations/004_rls_policies.sql:
   no cross-client read/write is possible, reference data is read-only via
   anon/auth keys, and the audit trail is append-only. Runs against a LOCAL
   Supabase stack (`supabase start`); the CI `rls` job enforces it on every PR.

   ----------------------------------------------------------------------------
   HOW IT WORKS
     * A service_role client (bypasses RLS) seeds fixtures: two clients A and B,
       one control, an assessment + evidence row per client, and four users
       (admin / consultant / readonly_viewer / evidence_uploader). Setup is
       IDEMPOTENT (fixed UUIDs + upserts + create-or-reuse users) so it is safe
       to re-run locally.
     * consultant1 and clientuser1 and uploader1 are assigned to client A ONLY.
     * Each test signs in as one user with the ANON key, then queries through
       PostgREST — so RLS applies exactly as it would for the real app.

   Write-blocked has two distinct shapes, asserted accordingly:
     * INSERT that violates WITH CHECK  -> PostgREST returns an error (42501).
     * UPDATE/DELETE filtered by USING  -> 0 rows affected, NO error (the rows
       are simply invisible). Asserted via `.select()` returning an empty array.

   ----------------------------------------------------------------------------
   RUN LOCALLY (needs Docker + the Supabase CLI):
     supabase start
     # export the local stack's URL + keys into the env this script reads:
     #   PowerShell:  supabase status -o env | %% { $p=$_ -split '=',2; ... }
     #   bash:        set -a; eval "$(supabase status -o env)"; set +a
     #   then map API_URL->SUPABASE_URL, ANON_KEY->SUPABASE_ANON_KEY,
     #        SERVICE_ROLE_KEY->SUPABASE_SERVICE_ROLE_KEY
     npm run test:rls
     supabase stop

   SECRETS: reads SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
   from the environment. The service_role key is SERVER-ONLY — this script never
   logs keys or secrets, and the key never reaches a VITE_ var or the browser.
   ============================================================================ */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    '\n[test-rls] Missing connection settings.\n' +
      '  Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.\n' +
      '  Start the local stack with `supabase start`, then map the values from\n' +
      '  `supabase status -o env` (API_URL / ANON_KEY / SERVICE_ROLE_KEY).\n' +
      '  The service_role key is SERVER-ONLY — never commit or expose it.\n',
  );
  process.exit(1);
}

const RLS_VIOLATION = '42501'; // Postgres: "new row violates row-level security policy"

// --- Fixed fixture identifiers (idempotent re-runs) -------------------------
const CLIENT_A = '05000000-0000-4000-8000-00000000000a';
const CLIENT_B = '05000000-0000-4000-8000-00000000000b';
const EVIDENCE_A = '05000000-0000-4000-8000-0000000000ea';
const EVIDENCE_B = '05000000-0000-4000-8000-0000000000eb';
const ORG_SLUG = 'rls-test-org';
const CONTROL_NATURAL_ID = 'RLS-TEST-1';
const PASSWORD = 'rls-Test-Password-123!';

const USERS = {
  admin: { email: 'rls-admin@example.test', role: 'benchmark_fox_admin' },
  consultant: { email: 'rls-consultant@example.test', role: 'benchmark_fox_consultant' },
  readonly: { email: 'rls-readonly@example.test', role: 'readonly_viewer' },
  uploader: { email: 'rls-uploader@example.test', role: 'evidence_uploader' },
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Per-user signed-in PostgREST clients + their profile ids (filled by setup).
const clients = {};
const profileIds = {};
let anon;
let controlId;
let orgId;

/** Create a user, or reuse an existing one with the same email (re-runnable). */
async function createOrReuseUser(email, password) {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!created.error && created.data?.user) return created.data.user.id;

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 1000) break;
  }
  throw new Error(`could not create or find user ${email}: ${created.error?.message ?? 'unknown'}`);
}

/** Sign in via the ANON key so subsequent queries run as that user under RLS. */
async function signIn(email, password) {
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return c;
}

before(async () => {
  // 1. org (service_role bypasses RLS for all setup writes).
  const org = await admin
    .from('organizations')
    .upsert([{ name: 'RLS Test Org', slug: ORG_SLUG, is_internal: false }], { onConflict: 'slug' })
    .select('id')
    .single();
  if (org.error) throw new Error(`org: ${org.error.message}`);
  orgId = org.data.id;

  // 2. a control family + one control (assessments need a control_id).
  const fam = await admin
    .from('control_families')
    .upsert([{ code: 'AC', name: 'Access Control', section: '3.1', family_index: '1' }], {
      onConflict: 'code',
    })
    .select('id')
    .single();
  if (fam.error) throw new Error(`family: ${fam.error.message}`);

  const ctrl = await admin
    .from('controls')
    .upsert(
      [
        {
          natural_id: CONTROL_NATURAL_ID,
          code: 'RLS.TEST-1',
          family_id: fam.data.id,
          level: 'L1',
          title: 'RLS test control',
          summary: 'Fixture control for RLS policy tests.',
          requirement: 'Fixture requirement text.',
        },
      ],
      { onConflict: 'natural_id' },
    )
    .select('id')
    .single();
  if (ctrl.error) throw new Error(`control: ${ctrl.error.message}`);
  controlId = ctrl.data.id;

  // 3. clients A and B (fixed ids).
  const cl = await admin.from('clients').upsert(
    [
      { id: CLIENT_A, organization_id: orgId, name: 'RLS Test Client A', status: 'Active' },
      { id: CLIENT_B, organization_id: orgId, name: 'RLS Test Client B', status: 'Active' },
    ],
    { onConflict: 'id' },
  );
  if (cl.error) throw new Error(`clients: ${cl.error.message}`);

  // 4. one assessment + one evidence row per client.
  const asmt = await admin.from('client_control_assessments').upsert(
    [
      { client_id: CLIENT_A, control_id: controlId },
      { client_id: CLIENT_B, control_id: controlId },
    ],
    { onConflict: 'client_id,control_id' },
  );
  if (asmt.error) throw new Error(`assessments: ${asmt.error.message}`);

  const ev = await admin.from('evidence_items').upsert(
    [
      { id: EVIDENCE_A, client_id: CLIENT_A, title: 'Evidence A' },
      { id: EVIDENCE_B, client_id: CLIENT_B, title: 'Evidence B' },
    ],
    { onConflict: 'id' },
  );
  if (ev.error) throw new Error(`evidence: ${ev.error.message}`);

  // 5. users: create/reuse, set profiles.role (the authoritative role), sign in.
  for (const [key, { email, role }] of Object.entries(USERS)) {
    const userId = await createOrReuseUser(email, PASSWORD);
    const upd = await admin.from('profiles').update({ role }).eq('user_id', userId).select('id').single();
    if (upd.error) throw new Error(`set role ${email}: ${upd.error.message}`);
    profileIds[key] = upd.data.id;
    clients[key] = await signIn(email, PASSWORD);
  }

  // 6. assignments: consultant / readonly / uploader -> client A ONLY.
  const assignRows = [
    { client_id: CLIENT_A, profile_id: profileIds.consultant, role: 'benchmark_fox_consultant' },
    { client_id: CLIENT_A, profile_id: profileIds.readonly, role: 'readonly_viewer' },
    { client_id: CLIENT_A, profile_id: profileIds.uploader, role: 'evidence_uploader' },
  ];
  const asg = await admin
    .from('client_assignments')
    .upsert(assignRows, { onConflict: 'client_id,profile_id' });
  if (asg.error) throw new Error(`assignments: ${asg.error.message}`);

  anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

// ---------------------------------------------------------------------------
// consultant1: read/write client A; ZERO ROWS (not an error) from client B.
// ---------------------------------------------------------------------------
test('consultant reads client A assessments', async () => {
  const { data, error } = await clients.consultant
    .from('client_control_assessments')
    .select('*')
    .eq('client_id', CLIENT_A);
  assert.equal(error, null);
  assert.ok(data.length >= 1, 'consultant should see client A assessments');
});

test('consultant gets ZERO rows from client B (no error)', async () => {
  const { data, error } = await clients.consultant
    .from('client_control_assessments')
    .select('*')
    .eq('client_id', CLIENT_B);
  assert.equal(error, null, 'cross-client read is filtered, not an error');
  assert.equal(data.length, 0, 'consultant must not see ANY client B rows');
});

test('consultant can write a client A assessment', async () => {
  const { data, error } = await clients.consultant
    .from('client_control_assessments')
    .update({ consultant_notes: 'rls-test write A' })
    .eq('client_id', CLIENT_A)
    .eq('control_id', controlId)
    .select();
  assert.equal(error, null);
  assert.equal(data.length, 1, 'consultant write to assigned client A should affect the row');
});

test('consultant cannot write a client B assessment (0 rows)', async () => {
  const { data, error } = await clients.consultant
    .from('client_control_assessments')
    .update({ consultant_notes: 'should not apply' })
    .eq('client_id', CLIENT_B)
    .eq('control_id', controlId)
    .select();
  assert.equal(error, null);
  assert.equal(data.length, 0, 'consultant must not write client B');
});

// ---------------------------------------------------------------------------
// clientuser1 (readonly_viewer): read A; no writes anywhere; cannot read B.
// ---------------------------------------------------------------------------
test('readonly_viewer reads client A data', async () => {
  const { data, error } = await clients.readonly
    .from('client_control_assessments')
    .select('*')
    .eq('client_id', CLIENT_A);
  assert.equal(error, null);
  assert.ok(data.length >= 1, 'readonly viewer should read its assigned client');
});

test('readonly_viewer cannot read client B', async () => {
  const { data, error } = await clients.readonly
    .from('client_control_assessments')
    .select('*')
    .eq('client_id', CLIENT_B);
  assert.equal(error, null);
  assert.equal(data.length, 0);
});

test('readonly_viewer INSERT fails (RLS violation)', async () => {
  const { error } = await clients.readonly
    .from('evidence_items')
    .insert({ client_id: CLIENT_A, title: 'readonly should not insert' })
    .select();
  assert.notEqual(error, null, 'insert must be rejected');
  assert.equal(error.code, RLS_VIOLATION);
});

test('readonly_viewer UPDATE affects 0 rows', async () => {
  const { data, error } = await clients.readonly
    .from('client_control_assessments')
    .update({ client_notes: 'nope' })
    .eq('client_id', CLIENT_A)
    .eq('control_id', controlId)
    .select();
  assert.equal(error, null);
  assert.equal(data.length, 0, 'readonly update must change nothing');
});

test('readonly_viewer DELETE affects 0 rows', async () => {
  const { data, error } = await clients.readonly
    .from('client_control_assessments')
    .delete()
    .eq('client_id', CLIENT_A)
    .select();
  assert.equal(error, null);
  assert.equal(data.length, 0, 'readonly delete must remove nothing');
});

// ---------------------------------------------------------------------------
// evidence_uploader: insert evidence for A, not B; cannot write assessments.
// ---------------------------------------------------------------------------
test('evidence_uploader inserts evidence for client A', async () => {
  const { data, error } = await clients.uploader
    .from('evidence_items')
    .insert({ client_id: CLIENT_A, title: 'uploader evidence A' })
    .select();
  assert.equal(error, null);
  assert.equal(data.length, 1);
});

test('evidence_uploader can update evidence metadata for client A', async () => {
  const { data, error } = await clients.uploader
    .from('evidence_items')
    .update({ notes: 'uploader updated metadata' })
    .eq('id', EVIDENCE_A)
    .select();
  assert.equal(error, null);
  assert.equal(data.length, 1, 'uploader should update evidence for its assigned client');
});

test('evidence_uploader cannot insert evidence for client B', async () => {
  const { error } = await clients.uploader
    .from('evidence_items')
    .insert({ client_id: CLIENT_B, title: 'uploader evidence B' })
    .select();
  assert.notEqual(error, null);
  assert.equal(error.code, RLS_VIOLATION);
});

test('evidence_uploader cannot update assessments (0 rows)', async () => {
  const { data, error } = await clients.uploader
    .from('client_control_assessments')
    .update({ consultant_notes: 'uploader should not write assessments' })
    .eq('client_id', CLIENT_A)
    .eq('control_id', controlId)
    .select();
  assert.equal(error, null);
  assert.equal(data.length, 0);
});

// ---------------------------------------------------------------------------
// EVIDENCE TRANSITION GUARD (migration 007): review transitions (In Review /
// Accepted / Needs Revision / Rejected) are Benchmark Fox staff only, enforced
// by the BEFORE INSERT/UPDATE trigger even though 004 lets an uploader write
// evidence metadata. evidence_uploader may set non-review statuses; staff may
// set any.
// ---------------------------------------------------------------------------
const EVIDENCE_GUARD = '05000000-0000-4000-8000-0000000000e7';

test('evidence_uploader CAN move evidence to a non-review status (Uploaded)', async () => {
  // service_role seeds a fresh row (bypasses RLS + the guard).
  const seed = await admin.from('evidence_items').upsert(
    { id: EVIDENCE_GUARD, client_id: CLIENT_A, title: 'Guard test evidence', status: 'Requested' },
    { onConflict: 'id' },
  );
  assert.equal(seed.error, null);

  const { data, error } = await clients.uploader
    .from('evidence_items')
    .update({ status: 'Uploaded' })
    .eq('id', EVIDENCE_GUARD)
    .select();
  assert.equal(error, null, 'uploader may set a non-review status');
  assert.equal(data.length, 1);
  assert.equal(data[0].status, 'Uploaded');
});

test('evidence_uploader CANNOT make a review transition (status → Accepted)', async () => {
  const { error } = await clients.uploader
    .from('evidence_items')
    .update({ status: 'Accepted' })
    .eq('id', EVIDENCE_GUARD)
    .select();
  assert.notEqual(error, null, 'uploader review transition must be rejected by the guard');
  assert.equal(error.code, RLS_VIOLATION); // trigger raises with errcode 42501
});

test('evidence_uploader CANNOT take an item into review (status → In Review)', async () => {
  // 'In Review' is reviewer-only too — taking an item into review is a staff act.
  const { error } = await clients.uploader
    .from('evidence_items')
    .update({ status: 'In Review' })
    .eq('id', EVIDENCE_GUARD)
    .select();
  assert.notEqual(error, null, 'uploader cannot move evidence to In Review');
  assert.equal(error.code, RLS_VIOLATION);
});

test('evidence_uploader CANNOT create evidence already in a review status', async () => {
  const { error } = await clients.uploader
    .from('evidence_items')
    .insert({ client_id: CLIENT_A, title: 'self-accepted', status: 'Accepted' })
    .select();
  assert.notEqual(error, null, 'uploader cannot self-accept on insert');
  assert.equal(error.code, RLS_VIOLATION);
});

test('consultant CAN make a review transition (status → Accepted) and it is audited', async () => {
  const { data, error } = await clients.consultant
    .from('evidence_items')
    .update({ status: 'Accepted', notes: 'Reviewed — covers the objective.' })
    .eq('id', EVIDENCE_GUARD)
    .select();
  assert.equal(error, null, 'Benchmark Fox staff may perform review transitions');
  assert.equal(data.length, 1);
  assert.equal(data[0].status, 'Accepted');

  // The 005 trigger captures the status change as an evidence.status_changed
  // audit row (service_role read bypasses RLS) — the acceptance criterion that a
  // transition is "visible in the audit log".
  const audit = await admin
    .from('audit_events')
    .select('action, new_value, actor_name')
    .eq('entity_type', 'evidence_items')
    .eq('entity_id', EVIDENCE_GUARD)
    .eq('action', 'evidence.status_changed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  assert.equal(audit.error, null);
  assert.deepEqual(audit.data.new_value.status, { old: 'Uploaded', new: 'Accepted' });
  assert.notEqual(audit.data.actor_name, 'system', 'authenticated consultant is the stamped actor');
});

// ---------------------------------------------------------------------------
// anon (no session): reads nothing from tenant tables.
// ---------------------------------------------------------------------------
test('anon reads nothing from tenant tables', async () => {
  for (const table of ['clients', 'client_control_assessments', 'evidence_items', 'poam_items']) {
    const { data, error } = await anon.from(table).select('*');
    assert.equal(error, null, `${table}: anon select should not error`);
    assert.equal(data.length, 0, `${table}: anon must read zero rows`);
  }
});

// ---------------------------------------------------------------------------
// Reference tables: read-all for authenticated; writable only by service_role.
// ---------------------------------------------------------------------------
test('authenticated user can READ reference tables', async () => {
  const { data, error } = await clients.consultant.from('controls').select('*').limit(1);
  assert.equal(error, null);
  assert.ok(Array.isArray(data));
});

test('authenticated user cannot WRITE reference tables', async () => {
  const { error } = await clients.consultant
    .from('controls')
    .insert({
      natural_id: 'RLS-TEST-NOPE',
      code: 'RLS.NOPE',
      family_id: null,
      level: 'L1',
      title: 'x',
      summary: 'x',
      requirement: 'x',
    })
    .select();
  assert.notEqual(error, null, 'reference write via auth key must be rejected');
  assert.equal(error.code, RLS_VIOLATION);
});

test('service_role CAN write reference tables (seeding path)', async () => {
  const { error } = await admin
    .from('source_references')
    .upsert(
      [
        {
          source_id: 'rls-test-source',
          source_name: 'RLS Test Source',
          publisher: 'Test',
          document_type: 'Benchmark Fox Internal',
          is_official: false,
        },
      ],
      { onConflict: 'source_id' },
    );
  assert.equal(error, null, 'service_role bypasses RLS and may seed reference data');
});

// ---------------------------------------------------------------------------
// audit_events: insert on accessible clients; append-only (no update/delete).
// ---------------------------------------------------------------------------
test('audit insert succeeds for an accessible client', async () => {
  const { data, error } = await clients.consultant
    .from('audit_events')
    .insert({ client_id: CLIENT_A, action: 'rls.test.audit' })
    .select();
  assert.equal(error, null);
  assert.equal(data.length, 1);
});

test('audit insert is rejected for an inaccessible client', async () => {
  const { error } = await clients.consultant
    .from('audit_events')
    .insert({ client_id: CLIENT_B, action: 'rls.test.audit.b' })
    .select();
  assert.notEqual(error, null);
  assert.equal(error.code, RLS_VIOLATION);
});

test('audit rows cannot be updated or deleted by a non-service role', async () => {
  const seed = await clients.consultant
    .from('audit_events')
    .insert({ client_id: CLIENT_A, action: 'rls.test.audit.immutable' })
    .select()
    .single();
  assert.equal(seed.error, null);
  const auditId = seed.data.id;

  const upd = await clients.consultant
    .from('audit_events')
    .update({ action: 'tampered' })
    .eq('id', auditId)
    .select();
  assert.equal(upd.error, null);
  assert.equal(upd.data.length, 0, 'no UPDATE policy → 0 rows changed');

  const del = await clients.consultant
    .from('audit_events')
    .delete()
    .eq('id', auditId)
    .select();
  assert.equal(del.error, null);
  assert.equal(del.data.length, 0, 'no DELETE policy → 0 rows removed');
});

// ---------------------------------------------------------------------------
// admin: full access across clients (sanity check on the admin path).
// ---------------------------------------------------------------------------
test('admin reads across all clients', async () => {
  const { data, error } = await clients.admin
    .from('client_control_assessments')
    .select('client_id')
    .in('client_id', [CLIENT_A, CLIENT_B]);
  assert.equal(error, null);
  const seen = new Set(data.map((r) => r.client_id));
  assert.ok(seen.has(CLIENT_A) && seen.has(CLIENT_B), 'admin should see both clients');
});

// ===========================================================================
// AUDIT TRIGGERS (migration 005): data-change capture + actor stamping +
// internal-action hiding. `admin` is the service_role client (reads bypass RLS),
// used here to inspect the trail deterministically.
// ===========================================================================

/** Count assessment.updated audit rows for one entity (service_role read). */
async function countAssessmentUpdates(entityId) {
  const { count, error } = await admin
    .from('audit_events')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'client_control_assessments')
    .eq('entity_id', entityId)
    .eq('action', 'assessment.updated');
  if (error) throw new Error(`count audit rows: ${error.message}`);
  return count ?? 0;
}

test('UPDATE on an assessment writes exactly ONE audit row with the correct diff', async () => {
  // Current state of the client A assessment (read past RLS for setup).
  const cur = await admin
    .from('client_control_assessments')
    .select('id, readiness_status')
    .eq('client_id', CLIENT_A)
    .eq('control_id', controlId)
    .single();
  assert.equal(cur.error, null);
  const entityId = cur.data.id;
  const oldStatus = cur.data.readiness_status;
  const newStatus = oldStatus === 'Met' ? 'Partial' : 'Met'; // guaranteed change

  const before = await countAssessmentUpdates(entityId);

  // Make the change as the assigned consultant (a real authenticated user).
  const upd = await clients.consultant
    .from('client_control_assessments')
    .update({ readiness_status: newStatus })
    .eq('id', entityId)
    .select();
  assert.equal(upd.error, null);
  assert.equal(upd.data.length, 1, 'consultant should update its assigned client');

  const after = await countAssessmentUpdates(entityId);
  assert.equal(after - before, 1, 'exactly one assessment.updated audit row per change');

  // Inspect the newest audit row for this entity.
  const latest = await admin
    .from('audit_events')
    .select('user_id, actor_name, new_value')
    .eq('entity_type', 'client_control_assessments')
    .eq('entity_id', entityId)
    .eq('action', 'assessment.updated')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  assert.equal(latest.error, null);
  assert.deepEqual(
    latest.data.new_value.readiness_status,
    { old: oldStatus, new: newStatus },
    'diff records only the changed field, old → new',
  );
  // Actor is resolved from auth.uid() → profile (not service_role / system).
  assert.equal(latest.data.user_id, profileIds.consultant, 'actor stamped from the session');
  assert.notEqual(latest.data.actor_name, 'system', 'authenticated writes are not "system"');
});

test('consultant_notes change is recorded as an INTERNAL note action, collapsed, never in a client-visible diff (009)', async () => {
  const cur = await admin
    .from('client_control_assessments')
    .select('id')
    .eq('client_id', CLIENT_A)
    .eq('control_id', controlId)
    .single();
  assert.equal(cur.error, null);
  const entityId = cur.data.id;

  // Unique > 500-char value so it always differs from the prior note.
  const longNote = 'SENSITIVE-'.repeat(60) + Date.now(); // ~600+ chars
  assert.ok(longNote.length > 500);

  const upd = await clients.consultant
    .from('client_control_assessments')
    .update({ consultant_notes: longNote })
    .eq('id', entityId)
    .select();
  assert.equal(upd.error, null);
  assert.equal(upd.data.length, 1);

  // The change rides on an INTERNAL action type (assessment.internal_note) — the
  // 009 trigger keeps internal-only columns out of the client-visible diff.
  const internal = await admin
    .from('audit_events')
    .select('new_value')
    .eq('entity_type', 'client_control_assessments')
    .eq('entity_id', entityId)
    .eq('action', 'assessment.internal_note')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  assert.equal(internal.error, null);
  assert.equal(
    internal.data.new_value.consultant_notes.new,
    '[text changed]',
    'long note value is replaced by the marker',
  );
  assert.ok(
    !JSON.stringify(internal.data.new_value).includes('SENSITIVE-'),
    'the long note text is NEVER copied into the audit row',
  );

  // The most recent client-visible assessment.updated diff (if any) NEVER carries
  // consultant_notes.
  const visible = await admin
    .from('audit_events')
    .select('new_value')
    .eq('entity_type', 'client_control_assessments')
    .eq('entity_id', entityId)
    .eq('action', 'assessment.updated')
    .order('created_at', { ascending: false })
    .limit(1);
  assert.equal(visible.error, null);
  for (const row of visible.data) {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(row.new_value, 'consultant_notes'),
      'consultant_notes must never appear in a client-visible assessment.updated diff',
    );
  }
});

test('an idempotent no-op UPDATE writes no audit row', async () => {
  const cur = await admin
    .from('client_control_assessments')
    .select('id, readiness_status')
    .eq('client_id', CLIENT_A)
    .eq('control_id', controlId)
    .single();
  assert.equal(cur.error, null);
  const entityId = cur.data.id;
  const before = await countAssessmentUpdates(entityId);

  // Re-write the SAME value → diff is empty → no row.
  const upd = await clients.consultant
    .from('client_control_assessments')
    .update({ readiness_status: cur.data.readiness_status })
    .eq('id', entityId)
    .select();
  assert.equal(upd.error, null);

  const after = await countAssessmentUpdates(entityId);
  assert.equal(after, before, 'no diff → no audit row');
});

test('consultant cannot read another client\'s audit rows (0 rows, no error)', async () => {
  // Seed an audit row for client B (service_role bypasses RLS).
  const seed = await admin
    .from('audit_events')
    .insert({ client_id: CLIENT_B, action: 'assessment.updated' });
  assert.equal(seed.error, null);

  const ro = await clients.consultant
    .from('audit_events')
    .select('id')
    .eq('client_id', CLIENT_B);
  assert.equal(ro.error, null, 'cross-client audit read is filtered, not an error');
  assert.equal(ro.data.length, 0, 'consultant assigned to A must not read client B audit rows');
});

test('client-role users never see internal-only audit actions; staff do', async () => {
  // Seed one internal-action row + one normal row for client A (service_role).
  const ins = await admin.from('audit_events').insert([
    { client_id: CLIENT_A, action: 'internal.secret_test' },
    { client_id: CLIENT_A, action: 'assessment.updated' },
  ]);
  assert.equal(ins.error, null);

  // readonly_viewer (client role, assigned to A): sees normal rows, NOT internal.
  const ro = await clients.readonly.from('audit_events').select('action').eq('client_id', CLIENT_A);
  assert.equal(ro.error, null);
  assert.ok(ro.data.length >= 1, 'client role should still see non-internal client rows');
  assert.ok(
    ro.data.every((r) => !r.action.startsWith('internal.')),
    'client role must never see internal-only actions',
  );

  // consultant (BF staff, assigned to A): sees the internal row.
  const staff = await clients.consultant
    .from('audit_events')
    .select('action')
    .eq('client_id', CLIENT_A)
    .eq('action', 'internal.secret_test');
  assert.equal(staff.error, null);
  assert.ok(staff.data.length >= 1, 'BF staff should see internal actions for their client');
});

// ===========================================================================
// CLIENTS + ASSIGNMENTS endpoints (Task 07): client CRUD is admin-only and
// cross-client isolated; assignments are admin-managed and honor soft-delete.
// ===========================================================================
const ADMIN_CREATED_CLIENT = '05000000-0000-4000-8000-0000000000ac';

test('consultant reads only assigned clients from the clients table', async () => {
  const { data, error } = await clients.consultant
    .from('clients')
    .select('id')
    .in('id', [CLIENT_A, CLIENT_B]);
  assert.equal(error, null);
  const ids = new Set(data.map((r) => r.id));
  assert.ok(ids.has(CLIENT_A), 'consultant should see assigned client A');
  assert.ok(!ids.has(CLIENT_B), 'consultant must NOT see unassigned client B');
});

test('consultant cannot CREATE a client (admin-only)', async () => {
  const { error } = await clients.consultant
    .from('clients')
    .insert({
      id: '05000000-0000-4000-8000-0000000000c9',
      organization_id: orgId,
      name: 'Sneaky Co',
      status: 'Active',
    })
    .select();
  assert.notEqual(error, null, 'consultant client insert must be rejected');
  assert.equal(error.code, RLS_VIOLATION);
});

test('consultant cannot UPDATE another client (0 rows)', async () => {
  const { data, error } = await clients.consultant
    .from('clients')
    .update({ name: 'hijacked' })
    .eq('id', CLIENT_B)
    .select();
  assert.equal(error, null);
  assert.equal(data.length, 0, 'consultant must not write client B');
});

test('admin CAN create a client (and the new profile columns exist)', async () => {
  const { data, error } = await clients.admin
    .from('clients')
    .upsert(
      {
        id: ADMIN_CREATED_CLIENT,
        organization_id: orgId,
        name: 'Admin Created Co',
        status: 'Active',
        cage_code: '1ABC2',
        dib_role: 'Prime',
        contract_types: ['DFARS 252.204-7012'],
        primary_contact_name: 'Pat Lee',
      },
      { onConflict: 'id' },
    )
    .select();
  assert.equal(error, null, '006 columns must exist and admin may create clients');
  assert.equal(data.length, 1);
});

test('consultant cannot CREATE an assignment (admin-only)', async () => {
  const { error } = await clients.consultant
    .from('client_assignments')
    .insert({ client_id: CLIENT_A, profile_id: profileIds.readonly, role: 'readonly_viewer' })
    .select();
  assert.notEqual(error, null, 'consultant assignment insert must be rejected');
  assert.equal(error.code, RLS_VIOLATION);
});

test('soft-removing an assignment (deleted_at) revokes access via the helpers', async () => {
  // Grant consultant access to client B by assigning them (admin).
  const grant = await admin
    .from('client_assignments')
    .upsert(
      {
        client_id: CLIENT_B,
        profile_id: profileIds.consultant,
        role: 'benchmark_fox_consultant',
        deleted_at: null,
      },
      { onConflict: 'client_id,profile_id' },
    )
    .select();
  assert.equal(grant.error, null);

  const granted = await clients.consultant.from('clients').select('id').eq('id', CLIENT_B);
  assert.equal(granted.error, null);
  assert.equal(granted.data.length, 1, 'a live assignment grants access to client B');

  // Soft-remove the assignment (what removeAssignment does — never a hard delete).
  const remove = await admin
    .from('client_assignments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('client_id', CLIENT_B)
    .eq('profile_id', profileIds.consultant)
    .select();
  assert.equal(remove.error, null);
  assert.equal(remove.data.length, 1);

  // is_assigned_to_client now ignores the soft-deleted row → access revoked.
  const revoked = await clients.consultant.from('clients').select('id').eq('id', CLIENT_B);
  assert.equal(revoked.error, null, 'cross-client read is filtered, not an error');
  assert.equal(revoked.data.length, 0, 'soft-removed assignment must revoke client B access');
});

// ===========================================================================
// CLIENT PORTAL — column-restricted view + internal-action hiding (Task 11,
// migration 009). A client-role user reads assessments through the client view,
// which OMITS internal-only columns (consultant_notes) while RLS still scopes
// rows to their assigned client (security_invoker = on).
// ===========================================================================
const ASSESS_CLIENT_VIEW = 'client_control_assessments_client';

test('client view omits consultant_notes and still scopes rows to the assigned client', async () => {
  const { data, error } = await clients.readonly
    .from(ASSESS_CLIENT_VIEW)
    .select('*')
    .eq('client_id', CLIENT_A);
  assert.equal(error, null, 'client role may read its assigned client via the view');
  assert.ok(data.length >= 1, 'view returns the assigned client rows');
  for (const row of data) {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(row, 'consultant_notes'),
      'the client view must NOT expose consultant_notes',
    );
    // a client-visible column is still present
    assert.ok(Object.prototype.hasOwnProperty.call(row, 'readiness_status'));
  }
});

test('client role cannot SELECT consultant_notes through the view (column does not exist)', async () => {
  const { error } = await clients.readonly.from(ASSESS_CLIENT_VIEW).select('consultant_notes');
  assert.notEqual(error, null, 'consultant_notes is not a column on the client view');
});

test('client view honors row RLS: a client role reads ZERO rows for an unassigned client', async () => {
  const { data, error } = await clients.readonly
    .from(ASSESS_CLIENT_VIEW)
    .select('id')
    .eq('client_id', CLIENT_B);
  assert.equal(error, null, 'cross-client view read is filtered, not an error');
  assert.equal(data.length, 0, 'security_invoker view must not leak another client (B) rows');
});

test('staff still read consultant_notes from the base table (their full read path is unchanged)', async () => {
  const { data, error } = await clients.consultant
    .from('client_control_assessments')
    .select('consultant_notes')
    .eq('client_id', CLIENT_A)
    .limit(1);
  assert.equal(error, null);
  assert.ok(data.length >= 1);
  assert.ok(
    Object.prototype.hasOwnProperty.call(data[0], 'consultant_notes'),
    'staff base-table reads include the internal column',
  );
});

test('client roles never see *.internal_note audit actions; staff do (009 hardening)', async () => {
  // Seed an internal-note row + a normal row for client A (service_role).
  const ins = await admin.from('audit_events').insert([
    { client_id: CLIENT_A, action: 'assessment.internal_note', new_value: { consultant_notes: { old: null, new: 'x' } } },
    { client_id: CLIENT_A, action: 'assessment.updated' },
  ]);
  assert.equal(ins.error, null);

  const ro = await clients.readonly.from('audit_events').select('action').eq('client_id', CLIENT_A);
  assert.equal(ro.error, null);
  assert.ok(
    ro.data.every((r) => r.action !== 'assessment.internal_note' && !r.action.endsWith('.internal_note')),
    'client role must never see internal-note audit actions',
  );

  const staff = await clients.consultant
    .from('audit_events')
    .select('action')
    .eq('client_id', CLIENT_A)
    .eq('action', 'assessment.internal_note');
  assert.equal(staff.error, null);
  assert.ok(staff.data.length >= 1, 'BF staff DO see internal-note actions for their client');
});
