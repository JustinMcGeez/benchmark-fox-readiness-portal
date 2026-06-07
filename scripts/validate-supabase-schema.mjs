/* ============================================================================
   validate-supabase-schema.mjs

   Validates the GLOBAL REFERENCE DATA seeded into Supabase/Postgres. Run after
   `npm run db:seed:refs`:

     npm run db:validate

   Checks:
     1. 14 control families exist
     2. 110 controls exist
     3. no duplicate control natural_id values
     4. every control has >= 1 source reference
     5. every control has score_source set
     6. score_value may be null ONLY when score_source = 'placeholder'
     7. source_references exist
     8. RLS is enabled on tenant tables (best-effort, via tenant_rls_status())

   CONNECTION (never commit secrets — see .env.example / README):
     SUPABASE_URL              project URL (falls back to VITE_SUPABASE_URL)
     SUPABASE_SERVICE_ROLE_KEY service_role key — SERVER-ONLY. Required to read
                               past RLS. NEVER expose it to the browser.

   This is a READ-ONLY validator. It never writes, and never touches client /
   evidence / CUI data (there should be none — reference data only).
   ============================================================================ */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EXPECTED_FAMILIES = 14;
const EXPECTED_CONTROLS = 110;
const TENANT_TABLES = [
  'organizations', 'clients', 'profiles', 'user_roles', 'client_assignments',
  'client_control_assessments', 'intake_records', 'scope_records',
  'scope_assets', 'evidence_items', 'poam_items', 'tasks', 'reports',
  'audit_events',
];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '\n[validate] Missing connection settings.\n' +
      '  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.\n' +
      '  The service_role key is SERVER-ONLY — never commit it.\n' +
      '  Example (PowerShell):\n' +
      '    $env:SUPABASE_URL = "https://<ref>.supabase.co"\n' +
      '    $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role key>"\n' +
      '    npm run db:validate\n',
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
let warnings = 0;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  console.error(`  ✗ ${m}`);
  failures++;
};
const warn = (m) => {
  console.warn(`  ! ${m}`);
  warnings++;
};

async function main() {
  console.log('[validate] Checking Supabase reference data…\n');

  // 7 (run first — many checks depend on these reads) ------------------------
  const { data: sources, error: srcErr } = await db
    .from('source_references')
    .select('id, source_id');
  if (srcErr) throw new Error(`read source_references: ${srcErr.message}`);
  if ((sources?.length ?? 0) > 0) pass(`source_references exist (${sources.length})`);
  else fail('source_references is empty');

  // 1 -----------------------------------------------------------------------
  const { data: families, error: famErr } = await db
    .from('control_families')
    .select('id, code');
  if (famErr) throw new Error(`read control_families: ${famErr.message}`);
  if (families.length === EXPECTED_FAMILIES) pass(`${EXPECTED_FAMILIES} control families exist`);
  else fail(`expected ${EXPECTED_FAMILIES} control families, found ${families.length}`);

  // 2, 3, 5, 6 --------------------------------------------------------------
  const { data: controls, error: ctrlErr } = await db
    .from('controls')
    .select('id, natural_id, score_source, score_value');
  if (ctrlErr) throw new Error(`read controls: ${ctrlErr.message}`);

  if (controls.length === EXPECTED_CONTROLS) pass(`${EXPECTED_CONTROLS} controls exist`);
  else fail(`expected ${EXPECTED_CONTROLS} controls, found ${controls.length}`);

  const seen = new Set();
  const dupes = new Set();
  for (const c of controls) {
    if (seen.has(c.natural_id)) dupes.add(c.natural_id);
    seen.add(c.natural_id);
  }
  if (dupes.size === 0) pass('no duplicate control natural_id values');
  else fail(`duplicate natural_id values: ${[...dupes].join(', ')}`);

  const missingSource = controls.filter((c) => !c.score_source);
  if (missingSource.length === 0) pass('every control has score_source set');
  else fail(`${missingSource.length} controls missing score_source`);

  const badScore = controls.filter(
    (c) => c.score_value === null && c.score_source !== 'placeholder',
  );
  if (badScore.length === 0) {
    pass("score_value is null only when score_source = 'placeholder'");
  } else {
    fail(
      `${badScore.length} controls have null score_value but non-placeholder ` +
        `score_source (e.g. ${badScore[0].natural_id})`,
    );
  }

  // 4 — every control has >= 1 source reference -----------------------------
  const { data: maps, error: mapErr } = await db
    .from('control_source_references')
    .select('control_id');
  if (mapErr) throw new Error(`read control_source_references: ${mapErr.message}`);
  const controlsWithSource = new Set(maps.map((m) => m.control_id));
  const orphan = controls.filter((c) => !controlsWithSource.has(c.id));
  if (orphan.length === 0) pass('every control has at least one source reference');
  else fail(`${orphan.length} controls have no source reference (e.g. ${orphan[0].natural_id})`);

  // 8 — RLS enabled on tenant tables (best-effort) --------------------------
  const { data: rls, error: rlsErr } = await db.rpc('tenant_rls_status');
  if (rlsErr) {
    warn(
      `RLS check skipped — tenant_rls_status() not callable (${rlsErr.message}). ` +
        'Apply supabase/seed.sql or run `supabase db reset` to install it.',
    );
  } else {
    const off = (rls ?? []).filter((r) => !r.rls_enabled).map((r) => r.table_name);
    const present = new Set((rls ?? []).map((r) => r.table_name));
    const missing = TENANT_TABLES.filter((t) => !present.has(t));
    if (off.length === 0 && missing.length === 0) {
      pass(`RLS enabled on all ${TENANT_TABLES.length} tenant tables`);
    } else {
      if (off.length) fail(`RLS NOT enabled on: ${off.join(', ')}`);
      if (missing.length) warn(`tenant tables not found (not migrated?): ${missing.join(', ')}`);
    }
  }

  console.log('');
  if (failures > 0) {
    console.error(`[validate] FAILED — ${failures} check(s) failed${warnings ? `, ${warnings} warning(s)` : ''}.`);
    process.exit(1);
  }
  console.log(`[validate] All checks passed${warnings ? ` (${warnings} warning(s))` : ''}.`);
}

main().catch((err) => {
  console.error(`\n[validate] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
