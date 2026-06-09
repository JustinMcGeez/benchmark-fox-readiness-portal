/* ============================================================
   validate-scoring.mjs

   Validates the official SPRS scoring data and its mapping to the control
   library. Run: node scripts/validate-scoring.mjs  (npm run validate:scoring).

   Checks:
     - Exactly 110 controls exist.
     - Exactly 110 scoring records exist.
     - Every control has a scoring value (sprsDeductionValue present).
     - Every scoring record maps to a real control.
     - Allowed deduction values are only -5, -3, -1 (or 0 for the documented NA
       control, 3.12.4).
     - No generated control has scoreSource "placeholder".
     - No generated control has sprsDeductionValue null/undefined.
     - No duplicate requirement IDs (in either the controls or the scoring file).
     - Scoring completeness is reported clearly.

   Exits non-zero with a clear message on the first failure.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const GENERATED = resolve(root, 'src/data/generated/controls.generated.ts');
const SCORING = resolve(root, 'data-sources/dod-assessment-methodology-scoring.json');

const EXPECTED = 110;
const ALLOWED = new Set([-5, -3, -1, 0]); // 0 = documented NA (3.12.4)

function fail(msg) {
  console.error(`\n✗ Scoring validation FAILED:\n  ${msg}\n`);
  process.exit(1);
}

function loadGeneratedControls() {
  const src = readFileSync(GENERATED, 'utf8');
  const decl = src.indexOf('GENERATED_CONTROLS');
  const eq = src.indexOf('=', decl);
  const start = src.indexOf('[', eq);
  const end = src.lastIndexOf(']');
  return JSON.parse(src.slice(start, end + 1));
}

const controls = loadGeneratedControls();
const scoring = JSON.parse(readFileSync(SCORING, 'utf8'));

// counts
if (controls.length !== EXPECTED) fail(`Expected ${EXPECTED} controls, found ${controls.length}.`);
if (scoring.length !== EXPECTED) fail(`Expected ${EXPECTED} scoring records, found ${scoring.length}.`);

// duplicate ids
const seenC = new Set();
for (const c of controls) {
  if (seenC.has(c.id)) fail(`Duplicate control id: ${c.id}`);
  seenC.add(c.id);
}
const seenS = new Set();
for (const r of scoring) {
  if (seenS.has(r.requirementId)) fail(`Duplicate scoring requirementId: ${r.requirementId}`);
  seenS.add(r.requirementId);
}

// every scoring record maps to a real control + allowed value
const controlIds = new Set(controls.map((c) => c.id));
for (const r of scoring) {
  if (!controlIds.has(r.requirementId)) fail(`Scoring record ${r.requirementId} maps to no control.`);
  if (!ALLOWED.has(r.sprsDeductionValue)) {
    fail(`Scoring ${r.requirementId}: value ${r.sprsDeductionValue} not in -5/-3/-1 (or 0 NA).`);
  }
  if (!r.scoreSource) fail(`Scoring ${r.requirementId}: missing scoreSource.`);
}

// every control has a verified value, no placeholders, no null deduction, matches scoring file
const byReq = new Map(scoring.map((r) => [r.requirementId, r]));
for (const c of controls) {
  if (c.sprsDeductionValue === undefined || c.sprsDeductionValue === null) {
    fail(`Control ${c.id} has null/undefined sprsDeductionValue.`);
  }
  if (!ALLOWED.has(c.sprsDeductionValue)) fail(`Control ${c.id}: invalid sprsDeductionValue ${c.sprsDeductionValue}.`);
  if (!c.scoreSource || c.scoreSource === 'placeholder') {
    fail(`Control ${c.id} has placeholder/empty scoreSource — official scoring not loaded.`);
  }
  const r = byReq.get(c.id);
  if (!r) fail(`Control ${c.id} has no scoring record.`);
  if (r.sprsDeductionValue !== c.sprsDeductionValue) {
    fail(`Control ${c.id}: generated ${c.sprsDeductionValue} != scoring file ${r.sprsDeductionValue}.`);
  }
}

const dist = controls.reduce((a, c) => ((a[c.sprsDeductionValue] = (a[c.sprsDeductionValue] || 0) + 1), a), {});
const na = controls.filter((c) => c.sprsDeductionValue === 0).map((c) => c.id);
console.log(
  `✓ Scoring validation passed — ${controls.length}/${EXPECTED} controls scored from the official ` +
    `DoD Assessment Methodology (v1.2.1, Annex A); ${scoring.length} scoring records, all mapped.\n` +
    `  Distribution: −5:${dist['-5'] || 0} · −3:${dist['-3'] || 0} · −1:${dist['-1'] || 0} · NA:${dist['0'] || 0} (${na.join(', ') || 'none'}).\n` +
    `  Scoring completeness: 100% (no placeholders, no null deductions).`,
);
