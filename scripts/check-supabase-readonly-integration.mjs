/* ============================================================
   check-supabase-readonly-integration.mjs

   Validates the APP RUNTIME (everything under src/) Supabase access boundary.
   Prints a clear pass/fail summary with file paths and line numbers.

   Why src/ only: the seeding/validation scripts under scripts/ run server-side
   with the service_role key and are never shipped to the browser; they are not
   scanned here. App runtime under src/ may READ Supabase only through the
   approved service/hook/provider layer, and may WRITE only through the single
   repository file (Task 04). No file under src/ may ever hard-delete.

   Rules:
   A. SCREENS: no file under src/screens may import the Supabase client/SDK,
      call supabase.from(...) / getSupabase(), or import the repository layer
      directly. (Screens use auth via useAuth() and data via useData() — never
      the client or the repository modules.)
   B. SDK LOCATION: only src/lib/supabaseClient.ts may import
      '@supabase/supabase-js'.
   C. RUNTIME ACCESS: the Supabase client (the `supabase`/`getSupabase` binding,
      or a supabase.from(...) call) may be used ONLY from these app-runtime files:
        - src/lib/supabaseClient.ts
        - src/services/referenceDataService.ts
        - src/services/supabaseReadOnlyGuard.ts
        - src/services/authService.ts        (Task 03: auth + own-profile read)
        - src/hooks/useReferenceData.ts
        - src/data/repository/supabaseRepository.ts  (Task 04: client data writes)
      (Importing the `isSupabaseConfigured` flag from supabaseClient is allowed
      anywhere — that's configuration, not Supabase access.)
   D. WRITES: write ops (.insert/.update/.upsert) in a Supabase-adjacent src file
      are allowed ONLY in src/data/repository/supabaseRepository.ts. A hard
      .delete() is forbidden EVERYWHERE under src/ (removals are soft — a
      deleted_at timestamp). Server-side seeding/validation scripts under
      scripts/ are not scanned here.

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
  'src/services/authService.ts', // Task 03: Supabase Auth + own-profile SELECT (no writes)
  'src/hooks/useReferenceData.ts',
  'src/data/repository/supabaseRepository.ts', // Task 04: client data reads + writes
]);
const SDK_ALLOWED = 'src/lib/supabaseClient.ts';
// The single file allowed to write (insert/update/upsert) to Supabase in src/.
const WRITE_ALLOWED = 'src/data/repository/supabaseRepository.ts';

const SDK_IMPORT_RE = /from\s+['"]@supabase\/supabase-js['"]/;
// Imports the client BINDING (supabase / getSupabase), not the config flag.
const CLIENT_BINDING_RE =
  /import\s*(?:type\s*)?\{[^}]*\b(?:supabase|getSupabase)\b[^}]*\}\s*from\s*['"][^'"]*supabaseClient['"]/;
const ANY_CLIENT_IMPORT_RE = /from\s+['"][^'"]*\/supabaseClient['"]/;
const DOT_FROM_RE = /\bsupabase\s*\.\s*from\s*\(/;
const GET_SUPABASE_RE = /\bgetSupabase\s*\(/;
// Mutating writes allowed only in the repository file.
const WRITE_RE = /\.(insert|update|upsert)\s*\(/;
// Hard deletes forbidden everywhere in src/ (removals are soft via deleted_at).
const DELETE_RE = /\.delete\s*\(/;
// Screens must not import the repository layer (they go through useData()).
const REPO_IMPORT_RE = /from\s+['"][^'"]*data\/repository[^'"]*['"]/;

const SCREEN_FORBIDDEN = [
  { re: ANY_CLIENT_IMPORT_RE, what: 'imports the Supabase client' },
  { re: SDK_IMPORT_RE, what: "imports '@supabase/supabase-js'" },
  { re: DOT_FROM_RE, what: 'calls supabase.from(...)' },
  { re: GET_SUPABASE_RE, what: 'calls getSupabase()' },
  { re: REPO_IMPORT_RE, what: 'imports the repository layer directly (use useData())' },
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

  // D. Writes in any src file that looks Supabase-adjacent. Coarse on purpose:
  //    flag a write method in any file that also mentions supabase / getSupabase
  //    or a `.from(` query builder, so an accidental direct write is hard to miss.
  //    .insert/.update/.upsert are allowed only in the repository file; a hard
  //    .delete() is forbidden everywhere under src/.
  const supabaseAdjacent =
    /supabase/i.test(src) || GET_SUPABASE_RE.test(src) || /\.from\s*\(/.test(src);
  if (supabaseAdjacent && path !== WRITE_ALLOWED) {
    const w = src.match(WRITE_RE);
    if (w) {
      violations.push({
        path,
        line: lineOf(w),
        msg: `Supabase write op .${w[1]}(...) outside ${WRITE_ALLOWED} — writes are allowed only in the repository`,
      });
    }
  }
  // A hard delete is forbidden in EVERY src file, including the repository.
  const del = src.match(DELETE_RE);
  if (del && (supabaseAdjacent || path === WRITE_ALLOWED)) {
    violations.push({
      path,
      line: lineOf(del),
      msg: 'hard .delete() is forbidden under src/ — soft-delete with a deleted_at timestamp instead',
    });
  }
}

if (violations.length > 0) {
  console.error('\n✗ check:supabase-readonly FAILED — ' + `${violations.length} violation(s):\n`);
  for (const v of violations) console.error(`  ${v.path}:${v.line} — ${v.msg}`);
  console.error(
    '\n  Route all Supabase reads through the service/hook/provider layers:\n' +
      '    src/services/referenceDataService.ts → src/hooks/useReferenceData.ts → ' +
      'src/data/referenceStore.tsx\n' +
      '    src/services/authService.ts → src/auth/AuthProvider.tsx (useAuth)\n' +
      '  Client data flows through src/data/repository → src/data/store.tsx (useData).\n' +
      `  SDK import only in src/lib/supabaseClient.ts; Supabase writes only in ${WRITE_ALLOWED}; ` +
      'no hard .delete() anywhere in src/.\n',
  );
  process.exit(1);
}

console.log(
  `✓ check:supabase-readonly PASSED — scanned ${files.length} src file(s) ` +
    `(${screenCount} screens). No Supabase access in screens; SDK imported only in ${SDK_ALLOWED}; ` +
    `client accessed only in ${runtimeAccessFiles} approved runtime file(s); ` +
    `writes confined to ${WRITE_ALLOWED}; no hard deletes in src/. ` +
    'Reads flow through the service/hook/provider layer. ' +
    '(Server-side seeding/validation scripts under scripts/ may write via service_role and are not scanned.)',
);
