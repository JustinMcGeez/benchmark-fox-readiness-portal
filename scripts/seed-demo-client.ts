/* ============================================================================
   seed-demo-client.ts

   Seeds the single DEMO ENGAGEMENT (Acme Defense Systems) so the app's
   repository layer (Task 04) has a real clients row to attach control
   assessments / intake / scope to in Supabase mode, until Task 07 makes
   clients first-class.

   The client id is the FIXED uuid in src/data/repository/clientIds.ts
   (DEMO_CLIENT_UUIDS.acme) — the same id the running app resolves 'acme' to.
   Run with Node 22.6+/24 (runs .ts directly via type stripping):

     npm run db:seed:demo

   ----------------------------------------------------------------------------
   DATA SENSITIVITY (HARD MVP RULE):
     * This seeds a NON-SENSITIVE demo engagement only (org + client row).
     * No CUI, no evidence files, no assessments/POA&Ms/reports.
     * The 110 assessment rows are created by the app (or imported via the
       in-app migration prompt) — not here.
   ----------------------------------------------------------------------------

   CONNECTION (never commit secrets — see .env.example / README):
     SUPABASE_URL              your project URL (falls back to VITE_SUPABASE_URL)
     SUPABASE_SERVICE_ROLE_KEY service_role key — SERVER-ONLY. Bypasses RLS to
                               write the demo rows. NEVER put it in a VITE_ var
                               or the browser bundle.

   IDEMPOTENT: upserts on organizations.slug and clients.id. Re-running does not
   duplicate rows.
   ============================================================================ */
import { createClient } from '@supabase/supabase-js';

import { DEMO_CLIENT_UUIDS } from '../src/data/repository/demoClients.ts';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '\n[seed:demo] Missing connection settings.\n' +
      '  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.\n' +
      '  The service_role key is SERVER-ONLY — never commit it or expose it to the browser.\n' +
      '  Example (PowerShell):\n' +
      '    $env:SUPABASE_URL = "https://<ref>.supabase.co"\n' +
      '    $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role key>"\n' +
      '    npm run db:seed:demo\n',
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log('[seed:demo] Seeding the Acme Defense Systems demo engagement…\n');

  // --- 1. the client's organization (is_internal false) ---------------------
  const { data: org, error: orgErr } = await db
    .from('organizations')
    .upsert([{ name: 'Acme Defense Systems', slug: 'acme-defense-systems', is_internal: false }], {
      onConflict: 'slug',
    })
    .select('id')
    .single();
  if (orgErr || !org) throw new Error(`organizations: ${orgErr?.message ?? 'no row returned'}`);
  console.log('  ✓ organizations            1 (acme-defense-systems)');

  // --- 2. the demo client (fixed uuid) --------------------------------------
  const { error: clientErr } = await db.from('clients').upsert(
    [
      {
        id: DEMO_CLIENT_UUIDS.acme,
        organization_id: org.id,
        name: 'Acme Defense Systems',
        status: 'Active',
        cmmc_path: 'Level 2',
        cmmc_level: 'L2',
        risk_rating: 'High',
        readiness_phase: 'Assessment',
      },
    ],
    { onConflict: 'id' },
  );
  if (clientErr) throw new Error(`clients: ${clientErr.message}`);
  console.log(`  ✓ clients                  1 (Acme Defense Systems · ${DEMO_CLIENT_UUIDS.acme})`);

  console.log(
    '\n[seed:demo] Done. The 110 assessment rows are created by the app ' +
      '(or via the in-app import prompt) — not here.',
  );
}

main().catch((err) => {
  console.error(`\n[seed:demo] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
