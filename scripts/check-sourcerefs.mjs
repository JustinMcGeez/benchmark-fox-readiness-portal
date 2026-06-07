/* ============================================================
   check-sourcerefs.mjs

   Proves <SourceRefs /> is actually rendered (JSX, not just imported) on the
   required screens, and that every referenced sourceId resolves in
   src/data/sourceRefs.ts. Fails (non-zero) if a screen is missing its render
   call or references an unknown id.

   Run: node scripts/check-sourcerefs.mjs   (also: npm run check:sourcerefs)
   ============================================================ */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED = ['controls', 'client', 'work', 'output']; // src/screens/<name>.tsx

function fail(msg) {
  console.error(`\n✗ SourceRefs check FAILED:\n  ${msg}\n`);
  process.exit(1);
}

// known sourceIds from the registry
const registry = readFileSync(resolve(root, 'src/data/sourceRefs.ts'), 'utf8');
const KNOWN = new Set([...registry.matchAll(/sourceId:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));

const usedIds = new Set();
let renderCalls = 0;

for (const name of REQUIRED) {
  const file = `src/screens/${name}.tsx`;
  const src = readFileSync(resolve(root, file), 'utf8');

  // an actual JSX render call must exist (not just the import line)
  const calls = [...src.matchAll(/<SourceRefs\b[\s\S]*?\/>/g)];
  if (calls.length === 0) {
    fail(`${file} has no <SourceRefs ... /> JSX render call (import alone is not enough).`);
  }
  renderCalls += calls.length;

  // every literal id used must resolve in the registry
  for (const call of calls) {
    for (const m of call[0].matchAll(/'([a-z0-9-]+)'/g)) {
      const id = m[1];
      usedIds.add(id);
      if (!KNOWN.has(id)) {
        fail(`${file} references unknown sourceId '${id}' (not in src/data/sourceRefs.ts).`);
      }
    }
  }
  const lines = calls.map((c) => c[0].split('\n')[0].trim()).join('  |  ');
  console.log(`✓ ${file.padEnd(26)} ${calls.length} render call(s) — ${lines}`);
}

console.log(
  `\n✓ SourceRefs check passed — ${renderCalls} render calls across ${REQUIRED.length} screens; ` +
    `${usedIds.size} literal source ids, all resolve in the registry.`,
);
