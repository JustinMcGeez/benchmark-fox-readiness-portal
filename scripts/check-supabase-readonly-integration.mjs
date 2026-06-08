/* ============================================================
   check-supabase-readonly-integration.mjs

   Validates the APP RUNTIME (everything under src/) read-only Supabase boundary.
   Prints a clear pass/fail summary with file paths and line numbers.

   Why src/ only: the seeding/validation scripts under scripts/ ARE allowed to
   write to Supabase (e.g. seed-supabase-reference-data.ts) — they are server-side
   maintenance scripts that run with the service_role key, never shipped to the
   browser. App runtime under src/ must stay read-only (reference data only):
   no inserts/updates/upserts/deletes, and screens must never import Supabase
   directly. This script therefore scans src/ and intentionally ignores scripts/.

   Rules:
   A. SCREENS: no file under src/screens may import the Supabase client/SDK or
      call supabase.from(...) / getSupabase().
   B. SDK LOCATION: only src/lib/supabaseClient.ts may import
      '@supabase/supabase-js'.
   C. RUNTIME ACCESS: the Supabase client (the `supabase`/`getSupabase` binding,
      or a supabase.from(...) call) may be used ONLY from these app-runtime files:
        - src/lib/supabaseClient.ts
        - src/services/referenceDataService.ts
        - src/services/supabaseReadOnlyGuard.ts
        - src/hooks/useReferenceData.ts
      (Importing the `isSupabaseConfigured` flag from supabaseClient is allowed
      anywhere — that's configuration, not Supabase access.)
   D. NO WRITES: no file under src/ that touches Supabase may call a write op
      (.insert/.update/.upsert/.delete). Supabase writes are allowed only in the
      seeding/validation scripts under scripts/ (e.g.
      seed-supabase-reference-data.ts, validate-supabase-schema.mjs) — those are
      NOT under src/ and are not scanned here.

   Run: node scripts/check-supabase-readonly-integration.mjs
        (also: npm run check:supabase-readonly)
   ============================================================ */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src');
const rel = (f) => relative(root, f).replace(/\\/g, '/');

// App-runtime files permitted to access the Supabase client.
const RUNTIME_ALLOW = new Set([
  'src/lib/supabaseClient.ts',
  'src/services/referenceDataService.ts',
  'src/services/supabaseReadOnlyGuard.ts',
  'src/hooks/useReferenceData.ts',
]);
const SDK_ALLOWED = 'src/lib/supabaseClient.ts';

const SDK_IMPORT_RE = /from\s+['"]@supabase\/supabase-js['"]/;
// Imports the client BINDING (supabase / getSupabase), not the config flag.
const CLIENT_BINDING_RE =
  /import\s*(?:type\s*)?\{[^}]*\b(?:supabase|getSupabase)\b[^}]*\}\s*from\s*['"][^'"]*supabaseClient['"]/;
const ANY_CLIENT_IMPORT_RE = /from\s+['"][^'"]*\/supabaseClient['"]/;
const DOT_FROM_RE = /\bsupabase\s*\.\s*from\s*\(/;
const GET_SUPABASE_RE = /\bgetSupabase\s*\(/;
const WRITE_RE = /\.(insert|update|upsert|delete)\s*\(/;

const SCREEN_FORBIDDEN = [
  { re: ANY_CLIENT_IMPORT_RE, what: 'imports the Supabase client' },
  { re: SDK_IMPORT_RE, what: "imports '@supabase/supabase-js'" },
  { re: DOT_FROM_RE, what: 'calls supabase.from(...)' },
  { re: GET_SUPABASE_RE, what: 'calls getSupabase()' },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

const violations = [];
const files = walk(SRC);
let screenCount = 0;
let runtimeAccessFiles = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const path = rel(file);
  const lineOf = (m) => src.slice(0, m.index).split('\n').length;
  const isScreen = path.startsWith('src/screens/');
  if (isScreen) screenCount++;

  // A. Screens: detailed, no Supabase access at all.
  if (isScreen) {
    for (const { re, what } of SCREEN_FORBIDDEN) {
      const m = src.match(re);
      if (m) violations.push({ path, line: lineOf(m), msg: `screen ${what}` });
    }
  }

  // B. SDK import only in supabaseClient.ts.
  const sdk = src.match(SDK_IMPORT_RE);
  if (sdk && path !== SDK_ALLOWED) {
    violations.push({ path, line: lineOf(sdk), msg: `imports '@supabase/supabase-js' outside ${SDK_ALLOWED}` });
  }

  // C. Client access (binding import / .from / getSupabase) only in RUNTIME_ALLOW.
  const accessMatch = src.match(CLIENT_BINDING_RE) || src.match(DOT_FROM_RE) || src.match(GET_SUPABASE_RE);
  if (accessMatch) {
    if (RUNTIME_ALLOW.has(path)) runtimeAccessFiles++;
    else if (!isScreen) {
      violations.push({
        path,
        line: lineOf(accessMatch),
        msg: 'accesses the Supabase client outside the approved runtime layer ' +
          '(supabaseClient.ts / referenceDataService.ts / supabaseReadOnlyGuard.ts / useReferenceData.ts)',
      });
    }
  }

  // D. No writes in any src file that looks Supabase-adjacent. Coarse on purpose:
  //    flag a write method in any file that also mentions supabase / getSupabase
  //    or a `.from(` query builder, so an accidental direct write is hard to miss.
  const supabaseAdjacent =
    /supabase/i.test(src) || GET_SUPABASE_RE.test(src) || /\.from\s*\(/.test(src);
  if (supabaseAdjacent) {
    const w = src.match(WRITE_RE);
    if (w) {
      violations.push({
        path,
        line: lineOf(w),
        msg: `Supabase write op .${w[1]}(...) in a Supabase-adjacent file — forbidden in the read-only phase`,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('\n✗ check:supabase-readonly FAILED — ' + `${violations.length} violation(s):\n`);
  for (const v of violations) console.error(`  ${v.path}:${v.line} — ${v.msg}`);
  console.error(
    '\n  Route all Supabase reads through the service/hook/provider layer:\n' +
      '    src/services/referenceDataService.ts → src/hooks/useReferenceData.ts → ' +
      'src/data/referenceStore.tsx\n' +
      '  SDK import only in src/lib/supabaseClient.ts; no Supabase writes in src/ ' +
      '(writes live only in scripts/ seeding/validation).\n',
  );
  process.exit(1);
}

console.log(
  `✓ check:supabase-readonly PASSED — scanned ${files.length} src file(s) ` +
    `(${screenCount} screens). No Supabase access in screens; SDK imported only in ${SDK_ALLOWED}; ` +
    `client accessed only in ${runtimeAccessFiles} approved runtime file(s); no Supabase writes in src/. ` +
    'Reads flow through the service/hook/provider layer. ' +
    '(Server-side seeding/validation scripts under scripts/ may write via service_role and are not scanned.)',
);
