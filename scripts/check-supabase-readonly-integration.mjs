/* ============================================================
   check-supabase-readonly-integration.mjs

   Enforces the read-only Supabase integration boundary across the app:

   1. SCREENS: no file under src/screens may import the Supabase client/SDK or
      call supabase.from(...) / getSupabase(). All reads go through the
      service/hook/provider layer.
   2. SDK LOCATION: only src/lib/supabaseClient.ts may import
      '@supabase/supabase-js'.
   3. NO WRITES: no file under src/ that touches Supabase may call a write op
      (.insert/.update/.upsert/.delete). Supabase writes are allowed only in the
      seed/validate scripts (scripts/, not scanned here). This keeps
      referenceDataService SELECT/RPC-only.

   Supabase usage in app code is allowed only in:
     - src/lib/supabaseClient.ts      (creates the client; imports the SDK)
     - src/lib/backendConfig.ts       (reads isSupabaseConfigured)
     - src/services/**                (referenceDataService: SELECT/RPC reads)
     - src/hooks/useReferenceData.ts  (calls the service)

   Run: node scripts/check-supabase-readonly-integration.mjs
        (also: npm run check:supabase-readonly)
   ============================================================ */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src');

const rel = (f) => relative(root, f).replace(/\\/g, '/');

// Screen-specific forbidden patterns (the hard guarantee).
const SCREEN_FORBIDDEN = [
  { re: /from\s+['"][^'"]*\/supabaseClient['"]/, what: "imports the Supabase client" },
  { re: /from\s+['"]@supabase\/supabase-js['"]/, what: "imports '@supabase/supabase-js'" },
  { re: /\bsupabase\s*\.\s*from\s*\(/, what: 'calls supabase.from(...)' },
  { re: /\bgetSupabase\s*\(/, what: 'calls getSupabase()' },
];

const SDK_IMPORT_RE = /from\s+['"]@supabase\/supabase-js['"]/;
const CLIENT_IMPORT_RE = /from\s+['"][^'"]*\/supabaseClient['"]/;
const WRITE_RE = /\.(insert|update|upsert|delete)\s*\(/;

// Only this file may import the SDK directly.
const SDK_ALLOWED = 'src/lib/supabaseClient.ts';

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

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const path = rel(file);
  const lineOf = (m) => src.slice(0, m.index).split('\n').length;

  // 1. Screens must not touch Supabase directly.
  if (path.startsWith('src/screens/')) {
    screenCount++;
    for (const { re, what } of SCREEN_FORBIDDEN) {
      const m = src.match(re);
      if (m) violations.push({ path, line: lineOf(m), msg: `screen ${what}` });
    }
  }

  // 2. Only supabaseClient.ts may import the SDK.
  const sdk = src.match(SDK_IMPORT_RE);
  if (sdk && path !== SDK_ALLOWED) {
    violations.push({
      path,
      line: lineOf(sdk),
      msg: `imports '@supabase/supabase-js' outside ${SDK_ALLOWED}`,
    });
  }

  // 3. No Supabase writes in app code (only files that touch the client).
  const touchesSupabase = SDK_IMPORT_RE.test(src) || CLIENT_IMPORT_RE.test(src);
  if (touchesSupabase) {
    const w = src.match(WRITE_RE);
    if (w) {
      violations.push({
        path,
        line: lineOf(w),
        msg: `Supabase write op .${w[1]}(...) — forbidden in the read-only phase`,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('\n✗ Supabase read-only integration check FAILED:\n');
  for (const v of violations) console.error(`  ${v.path}:${v.line} — ${v.msg}`);
  console.error(
    '\n  Route all Supabase access through the service/hook/provider layer:\n' +
      '    src/services/referenceDataService.ts → src/hooks/useReferenceData.ts → ' +
      'src/data/referenceStore.tsx\n' +
      '  The SDK may be imported only in src/lib/supabaseClient.ts, and no writes ' +
      'are allowed in src/ (read-only phase).\n',
  );
  process.exit(1);
}

console.log(
  `✓ Supabase read-only integration check passed — scanned ${files.length} src file(s) ` +
    `(${screenCount} screens). No direct Supabase access in screens, SDK imported only in ` +
    `${SDK_ALLOWED}, and no Supabase writes in src/. Reads flow through the service/hook/provider.`,
);
