/* ============================================================================
   seed-supabase-reference-data.ts

   Seeds GLOBAL REFERENCE DATA ONLY into a Supabase/Postgres project:
     - organizations          (the Benchmark Fox internal org)
     - control_families       (all 14 NIST SP 800-171 Rev. 2 families)
     - controls               (all 110 generated controls)
     - source_references      (the official + BF source registry)
     - control_source_references (each control -> its source refs)

   It reads from the same TypeScript sources the app uses, so the database
   reference data always matches the frontend library. Run with Node 22.6+/24
   (runs .ts directly via type stripping):

     npm run db:seed:refs

   ----------------------------------------------------------------------------
   DATA SENSITIVITY (HARD MVP RULE):
     * Do NOT store CUI (Controlled Unclassified Information).
     * Do NOT store real client evidence files.
     * This script seeds NON-SENSITIVE GLOBAL REFERENCE DATA ONLY.
     * It never inserts real clients, evidence, POA&Ms, tasks, or reports.
     * evidence_items / reports are METADATA + EXTERNAL LINKS ONLY by design.
   ----------------------------------------------------------------------------

   CONNECTION (never commit secrets — see .env.example / README):
     SUPABASE_URL              your project URL (e.g. https://xxx.supabase.co)
                               (falls back to VITE_SUPABASE_URL if set)
     SUPABASE_SERVICE_ROLE_KEY service_role key — SERVER-ONLY. Required: seeding
                               reference data + bypassing RLS needs this key.
                               NEVER put it in a VITE_ var or the browser bundle.

   IDEMPOTENT: every write is an UPSERT on a stable unique key
     organizations.slug · control_families.code · controls.natural_id ·
     source_references.source_id · (control_id, source_id). Re-running does not
     duplicate rows.
   ============================================================================ */
import { createClient } from '@supabase/supabase-js';

import { CONTROL_FAMILIES } from '../src/data/controlFamilies.ts';
import { GENERATED_CONTROLS } from '../src/data/generated/controls.generated.ts';
import { SOURCE_REFS } from '../src/data/sourceRefs.ts';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '\n[seed] Missing connection settings.\n' +
      '  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.\n' +
      '  The service_role key is SERVER-ONLY — never commit it or expose it to the browser.\n' +
      '  Example (PowerShell):\n' +
      '    $env:SUPABASE_URL = "https://<ref>.supabase.co"\n' +
      '    $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role key>"\n' +
      '    npm run db:seed:refs\n',
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Source ids that are Benchmark Fox internal (everything else is official). */
const isOfficialSource = (documentType: string) => documentType !== 'Benchmark Fox Internal';

async function main() {
  console.log('[seed] Seeding GLOBAL REFERENCE DATA ONLY (no clients/evidence/CUI)…\n');

  // --- 1. organization (Benchmark Fox internal) -----------------------------
  const { error: orgErr } = await db
    .from('organizations')
    .upsert(
      [{ name: 'Benchmark Fox', slug: 'benchmark-fox', is_internal: true }],
      { onConflict: 'slug' },
    );
  if (orgErr) throw new Error(`organizations: ${orgErr.message}`);
  console.log('  ✓ organizations            1 (benchmark-fox)');

  // --- 2. control_families (14) ---------------------------------------------
  const familyRows = CONTROL_FAMILIES.map((f) => ({
    code: f.code,
    name: f.name,
    section: f.section,
    family_index: f.index,
  }));
  const { data: families, error: famErr } = await db
    .from('control_families')
    .upsert(familyRows, { onConflict: 'code' })
    .select('id, code');
  if (famErr) throw new Error(`control_families: ${famErr.message}`);
  const familyIdByCode = new Map((families ?? []).map((f) => [f.code as string, f.id as string]));
  console.log(`  ✓ control_families         ${familyIdByCode.size}`);

  // --- 3. source_references --------------------------------------------------
  const sourceRows = SOURCE_REFS.map((s) => ({
    source_id: s.sourceId,
    source_name: s.sourceName,
    publisher: s.publisher,
    document_type: s.documentType,
    version: s.version ?? null,
    url: s.url ?? null,
    reference: s.reference ?? null,
    is_official: isOfficialSource(s.documentType),
    notes: s.notes ?? null,
  }));
  const { data: sources, error: srcErr } = await db
    .from('source_references')
    .upsert(sourceRows, { onConflict: 'source_id' })
    .select('id, source_id');
  if (srcErr) throw new Error(`source_references: ${srcErr.message}`);
  const sourceIdByKey = new Map((sources ?? []).map((s) => [s.source_id as string, s.id as string]));
  console.log(`  ✓ source_references        ${sourceIdByKey.size}`);

  // --- 4. controls (110) -----------------------------------------------------
  const controlRows = GENERATED_CONTROLS.map((c) => {
    const familyId = familyIdByCode.get(c.familyCode);
    if (!familyId) throw new Error(`control ${c.id}: unknown family code "${c.familyCode}"`);
    return {
      natural_id: c.id,
      code: c.code,
      family_id: familyId,
      level: c.level,
      title: c.title,
      summary: c.summary,
      requirement: c.requirement,
      explanation: c.explanation || null,
      score_value: c.scoreValue, // null = placeholder (DoD methodology not bundled)
      score_source: c.scoreSource,
      ssp_guidance: c.sspGuidance ?? null,
      poam_guidance: c.poamGuidance ?? null,
    };
  });
  const { data: controls, error: ctrlErr } = await db
    .from('controls')
    .upsert(controlRows, { onConflict: 'natural_id' })
    .select('id, natural_id');
  if (ctrlErr) throw new Error(`controls: ${ctrlErr.message}`);
  const controlIdByNatural = new Map(
    (controls ?? []).map((c) => [c.natural_id as string, c.id as string]),
  );
  console.log(`  ✓ controls                 ${controlIdByNatural.size}`);

  // --- 5. control_source_references (mapping) -------------------------------
  const mapRows: { control_id: string; source_id: string }[] = [];
  let skipped = 0;
  for (const c of GENERATED_CONTROLS) {
    const controlId = controlIdByNatural.get(c.id);
    if (!controlId) continue;
    for (const ref of c.sourceRefs ?? []) {
      const sourceId = sourceIdByKey.get(ref);
      if (!sourceId) {
        skipped++;
        console.warn(`    ! control ${c.id} references unknown source "${ref}" — skipped`);
        continue;
      }
      mapRows.push({ control_id: controlId, source_id: sourceId });
    }
  }
  const { error: mapErr } = await db
    .from('control_source_references')
    .upsert(mapRows, { onConflict: 'control_id,source_id', ignoreDuplicates: true });
  if (mapErr) throw new Error(`control_source_references: ${mapErr.message}`);
  console.log(`  ✓ control_source_references ${mapRows.length}${skipped ? ` (${skipped} skipped)` : ''}`);

  console.log('\n[seed] Done. Reference data is idempotent — safe to re-run.');
}

main().catch((err) => {
  console.error(`\n[seed] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
