/* ============================================================
   check-supabase-readonly-integration.mjs

   Enforces the integration boundary: SCREEN components must not query Supabase
   directly — all Supabase access goes through the service/hook layer. Fails
   (non-zero) if any file under src/screens imports the Supabase client / SDK or
   calls supabase.from(...) / getSupabase().

   Supabase usage is allowed ONLY in:
     - src/lib/supabaseClient.ts
     - src/services/**
     - src/hooks/useReferenceData.ts

   Run: node scripts/check-supabase-readonly-integration.mjs
        (also: npm run check:supabase-readonly)
   ============================================================ */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS_DIR = resolve(root, 'src/screens');

const ALLOWED = [
  'src/lib/supabaseClient.ts',
  'src/services/**',
  'src/hooks/useReferenceData.ts',
];

// Patterns that indicate a screen is talking to Supabase directly.
const FORBIDDEN = [
  { re: /from\s+['"][^'"]*\/supabaseClient['"]/, what: "imports '../lib/supabaseClient'" },
  { re: /from\s+['"]@supabase\/supabase-js['"]/, what: "imports '@supabase/supabase-js'" },
  { re: /\bsupabase\s*\.\s*from\s*\(/, what: 'calls supabase.from(...)' },
  { re: /\bgetSupabase\s*\(/, what: 'calls getSupabase()' },
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
const files = walk(SCREENS_DIR);

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(root, file).replace(/\\/g, '/');
  for (const { re, what } of FORBIDDEN) {
    const m = src.match(re);
    if (m) {
      const line = src.slice(0, m.index).split('\n').length;
      violations.push({ rel, line, what });
    }
  }
}

if (violations.length > 0) {
  console.error('\n✗ Supabase read-only integration check FAILED:\n');
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line} — screen ${v.what}`);
  }
  console.error(
    '\n  Screen components must not query Supabase directly. Route all reads ' +
      'through the service/hook layer:\n' +
      '    src/services/referenceDataService.ts  +  src/hooks/useReferenceData.ts\n' +
      `  Supabase usage is allowed only in: ${ALLOWED.join(', ')}.\n`,
  );
  process.exit(1);
}

console.log(
  `✓ Supabase read-only integration check passed — scanned ${files.length} screen file(s); ` +
    'no direct supabase.from / client imports in src/screens. ' +
    'Reads are routed through the service/hook layer.',
);
