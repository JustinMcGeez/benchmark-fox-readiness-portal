/* ============================================================
   validate-benchmarkfox-guidance.mjs

   Validates the Benchmark Fox-authored guidance overlay (BF_OVERLAY in
   src/data/controls.ts) merged over the generated official control library.
   Run: node scripts/validate-benchmarkfox-guidance.mjs (npm run validate:guidance).

   Checks:
     - Exactly 110 controls exist in the generated library.
     - Every BF_OVERLAY key maps to a real control (no orphans).
     - Every control (after overlay merge) has:
         * a non-empty explanation
         * at least one common mistake
         * at least one evidence example
         * guidance.implementation and guidance.interview
         * sspGuidance and poamGuidance
     - No Benchmark Fox guidance field contains TODO, TBD, placeholder,
       lorem ipsum, or coming soon.
     - Official 800-171A objectiveText is NOT copied as the Benchmark Fox
       explanation (official text must stay separate from authored guidance),
       and the explanation is not just the official requirement text.
     - Prints a per-family summary of guidance completion.

   Exits non-zero with a clear message on the first failure.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const GENERATED = resolve(root, 'src/data/generated/controls.generated.ts');
const CONTROLS_TS = resolve(root, 'src/data/controls.ts');

const EXPECTED = 110;
const PLACEHOLDER_RE = /\b(TODO|TBD|placeholder|lorem ipsum|coming soon)\b/i;

function fail(msg) {
  console.error(`\n✗ Benchmark Fox guidance validation FAILED:\n  ${msg}\n`);
  process.exit(1);
}

/* Same extraction approach as the other validators: the generated file embeds
   the controls as a JSON array literal. */
function loadGeneratedControls() {
  const src = readFileSync(GENERATED, 'utf8');
  const decl = src.indexOf('GENERATED_CONTROLS');
  const eq = src.indexOf('=', decl);
  const start = src.indexOf('[', eq);
  const end = src.lastIndexOf(']');
  return JSON.parse(src.slice(start, end + 1));
}

/* BF_OVERLAY in src/data/controls.ts is intentionally written as a strict-JSON
   object literal (see the comment above it in that file). Extract it with a
   string-aware brace matcher and JSON.parse it. */
function loadOverlay() {
  const src = readFileSync(CONTROLS_TS, 'utf8');
  const decl = src.indexOf('const BF_OVERLAY');
  if (decl === -1) fail('const BF_OVERLAY not found in src/data/controls.ts.');
  const eq = src.indexOf('=', decl);
  const start = src.indexOf('{', eq);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(src.slice(start, i + 1));
        } catch (e) {
          fail(`BF_OVERLAY is not valid strict JSON (it must stay JSON-parseable): ${e.message}`);
        }
      }
    }
  }
  fail('Could not find the end of the BF_OVERLAY object literal.');
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const controls = loadGeneratedControls();
const overlay = loadOverlay();

if (controls.length !== EXPECTED) fail(`Expected ${EXPECTED} controls, found ${controls.length}.`);

const byNumber = new Map(controls.map((c) => [c.number, c]));
for (const key of Object.keys(overlay)) {
  if (!byNumber.has(key)) fail(`BF_OVERLAY key ${key} does not match any generated control.`);
}

/* The Benchmark Fox guidance fields to placeholder-check on each control. */
function guidanceStrings(id, o) {
  const out = [];
  const push = (field, v) => out.push([field, v]);
  push('explanation', o.explanation);
  for (const m of o.commonMistakes ?? []) push('commonMistakes', m);
  for (const e of o.evidenceExamples ?? []) push('evidenceExamples', e);
  if (o.guidance?.implementation) push('guidance.implementation', o.guidance.implementation);
  if (o.guidance?.interview) push('guidance.interview', o.guidance.interview);
  if (o.sspGuidance) push('sspGuidance', o.sspGuidance);
  if (o.poamGuidance) push('poamGuidance', o.poamGuidance);
  return out;
}

const familyTotals = new Map(); // familyCode -> { name, total, complete }
let completeCount = 0;

for (const c of controls) {
  const o = overlay[c.number];
  if (!o) fail(`Control ${c.number} has no BF_OVERLAY entry.`);
  // merge the same way src/data/controls.ts does ({ ...c, ...o })
  const merged = { ...c, ...o };

  if (!merged.explanation || !merged.explanation.trim()) {
    fail(`Control ${c.number} has an empty explanation.`);
  }
  if (!Array.isArray(merged.commonMistakes) || merged.commonMistakes.length === 0) {
    fail(`Control ${c.number} has no common mistakes.`);
  }
  if (!Array.isArray(merged.evidenceExamples) || merged.evidenceExamples.length === 0) {
    fail(`Control ${c.number} has no evidence examples.`);
  }
  if (!merged.guidance?.implementation || !merged.guidance.implementation.trim()) {
    fail(`Control ${c.number} has no guidance.implementation.`);
  }
  if (!merged.guidance?.interview || !merged.guidance.interview.trim()) {
    fail(`Control ${c.number} has no guidance.interview.`);
  }
  if (!merged.sspGuidance || !merged.sspGuidance.trim()) {
    fail(`Control ${c.number} has no sspGuidance.`);
  }
  if (!merged.poamGuidance || !merged.poamGuidance.trim()) {
    fail(`Control ${c.number} has no poamGuidance.`);
  }

  for (const [field, value] of guidanceStrings(c.number, merged)) {
    if (PLACEHOLDER_RE.test(value)) {
      fail(`Control ${c.number} ${field} contains placeholder language: "${value.slice(0, 80)}…"`);
    }
  }

  // Official text must stay separate: the BF explanation may not simply be a
  // copy of an official 800-171A objective or the official requirement text.
  const explNorm = norm(merged.explanation);
  if (explNorm === norm(c.requirement)) {
    fail(`Control ${c.number} explanation is a copy of the official requirement text.`);
  }
  for (const obj of c.assessmentObjectives ?? []) {
    if (explNorm === norm(obj.objectiveText)) {
      fail(`Control ${c.number} explanation is a copy of official objective ${obj.objectiveId} text.`);
    }
  }

  completeCount++;
  const fam = familyTotals.get(c.familyCode) ?? { name: c.familyName, total: 0, complete: 0 };
  fam.total++;
  fam.complete++; // fail() exits, so any control reaching here is complete
  familyTotals.set(c.familyCode, fam);
}

console.log('\nBenchmark Fox guidance completion by family:');
for (const [code, fam] of familyTotals) {
  console.log(`  ${code.padEnd(4)} ${fam.name.padEnd(36)} ${fam.complete}/${fam.total}`);
}
console.log(
  `\n✓ Benchmark Fox guidance validation passed — ${completeCount}/${EXPECTED} controls have ` +
    `complete authored guidance (explanation, common mistakes, evidence examples, ` +
    `implementation/interview guidance, SSP guidance, POA&M guidance), no placeholder ` +
    `language, and official requirement/objective text is kept separate from authored content.`,
);
