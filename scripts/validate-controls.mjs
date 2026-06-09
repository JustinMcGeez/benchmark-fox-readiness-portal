/* ============================================================
   validate-controls.mjs

   Validates the generated control library against NIST SP 800-171 Rev. 2
   structural expectations. Run: node scripts/validate-controls.mjs
   (also runs via `npm run validate:controls` / `npm run build:data`).

   Exits non-zero with a clear message on the first failure.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const GENERATED = resolve(root, 'src/data/generated/controls.generated.ts');

const EXPECTED_COUNT = 110;
const REQUIRED_FIELDS = [
  'id',
  'number',
  'code',
  'familyCode',
  'familyName',
  'level',
  'requirement',
  'sourceRefs',
];
const EXPECTED_FAMILIES = ['AC', 'AT', 'AU', 'CM', 'IA', 'IR', 'MA', 'MP', 'PS', 'PE', 'RA', 'CA', 'SC', 'SI'];

function fail(msg) {
  console.error(`\n✗ Control validation FAILED:\n  ${msg}\n`);
  process.exit(1);
}

/** Extract the JSON array literal from the auto-generated TS module. */
function loadGeneratedControls() {
  let src;
  try {
    src = readFileSync(GENERATED, 'utf8');
  } catch {
    fail(`Could not read ${GENERATED}. Run "npm run import:sources" first.`);
  }
  // anchor to the array literal after `GENERATED_CONTROLS ... =` so the `[]` in
  // the `Control[]` type annotation is not mistaken for the array start
  const decl = src.indexOf('GENERATED_CONTROLS');
  const eq = decl === -1 ? -1 : src.indexOf('=', decl);
  const start = eq === -1 ? -1 : src.indexOf('[', eq);
  const end = src.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    fail('Could not locate the controls array in controls.generated.ts.');
  }
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch (e) {
    fail(`controls.generated.ts array is not valid JSON: ${e.message}`);
  }
}

const controls = loadGeneratedControls();

// 1. exact count
if (controls.length !== EXPECTED_COUNT) {
  fail(`Expected exactly ${EXPECTED_COUNT} controls, found ${controls.length}.`);
}

// 2. no duplicate numbers
const seen = new Set();
for (const c of controls) {
  if (seen.has(c.number)) fail(`Duplicate control number: ${c.number}`);
  seen.add(c.number);
}

// 3. required fields present + non-empty
for (const c of controls) {
  for (const f of REQUIRED_FIELDS) {
    const v = c[f];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) fail(`Control ${c.number ?? '(unknown)'} is missing required field "${f}".`);
  }
  // 4. official scoring loaded (no placeholders)
  if (!c.scoreSource || c.scoreSource === 'placeholder') {
    fail(`Control ${c.number} still has placeholder/empty scoreSource — official scoring not loaded.`);
  }
  // 5. sprsDeductionValue present and allowed (-5/-3/-1, or 0 for the NA control)
  if (c.sprsDeductionValue === undefined || c.sprsDeductionValue === null) {
    fail(`Control ${c.number} is missing sprsDeductionValue.`);
  }
  if (![-5, -3, -1, 0].includes(c.sprsDeductionValue)) {
    fail(`Control ${c.number} has invalid sprsDeductionValue ${c.sprsDeductionValue} (allowed: -5/-3/-1, or 0 for NA).`);
  }
  // 6. scoreValue (magnitude) consistent with the deduction; null only for NA (0)
  if (c.sprsDeductionValue === 0) {
    if (c.scoreValue !== null) fail(`Control ${c.number} is NA (0 deduction) but scoreValue is not null.`);
  } else if (c.scoreValue !== Math.abs(c.sprsDeductionValue)) {
    fail(`Control ${c.number} scoreValue ${c.scoreValue} != magnitude of sprsDeductionValue ${c.sprsDeductionValue}.`);
  }
  // 7. must cite NIST SP 800-171 Rev. 2
  if (!Array.isArray(c.sourceRefs) || !c.sourceRefs.includes('nist-sp-800-171r2')) {
    fail(`Control ${c.number} does not include "nist-sp-800-171r2" in sourceRefs.`);
  }
}

// 7. all 14 families represented
const families = new Set(controls.map((c) => c.familyCode));
const missing = EXPECTED_FAMILIES.filter((f) => !families.has(f));
if (missing.length) fail(`Missing control families: ${missing.join(', ')}`);
if (families.size !== EXPECTED_FAMILIES.length) {
  fail(`Expected ${EXPECTED_FAMILIES.length} families, found ${families.size}: ${[...families].join(', ')}`);
}

const placeholders = controls.filter((c) => !c.scoreSource || c.scoreSource === 'placeholder').length;
const dist = controls.reduce((a, c) => ((a[c.sprsDeductionValue] = (a[c.sprsDeductionValue] || 0) + 1), a), {});
console.log(
  `✓ Control validation passed — ${controls.length} controls, ${families.size} families, ` +
    `no duplicates, all required fields present.\n` +
    `  Scoring: ${controls.length - placeholders}/${controls.length} official (DoD Assessment Methodology). ` +
    `Distribution −5:${dist['-5'] || 0} −3:${dist['-3'] || 0} −1:${dist['-1'] || 0} NA:${dist['0'] || 0}.`,
);
