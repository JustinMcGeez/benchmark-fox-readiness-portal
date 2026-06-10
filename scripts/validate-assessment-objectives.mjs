/* ============================================================
   validate-assessment-objectives.mjs

   Validates the official NIST SP 800-171A assessment objectives and their
   mapping to the control library. Run: node scripts/validate-assessment-objectives.mjs
   (npm run validate:objectives).

   Checks:
     - Exactly 110 controls exist.
     - Exactly 110 requirement groups in the objectives data-source.
     - Every generated control has at least one assessment objective.
     - Every objectiveId is unique.
     - Every objective maps to a valid requirementId (a real control).
     - Every assessment method is one of examine/interview/test.
     - No objectiveText is empty.
     - No obvious placeholder objective text (TODO / TBD / placeholder / coming soon).
     - Official objectiveText and Benchmark Fox notes are separate fields.

   Exits non-zero with a clear message on the first failure.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const GENERATED = resolve(root, 'src/data/generated/controls.generated.ts');
const OBJECTIVES = resolve(root, 'data-sources/sp800-171a-assessment-objectives.json');

const EXPECTED = 110;
const ALLOWED_METHODS = new Set(['examine', 'interview', 'test']);
const PLACEHOLDER_RE = /\b(TODO|TBD|placeholder|coming soon)\b/i;

function fail(msg) {
  console.error(`\n✗ Assessment-objective validation FAILED:\n  ${msg}\n`);
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
const groups = JSON.parse(readFileSync(OBJECTIVES, 'utf8'));

if (controls.length !== EXPECTED) fail(`Expected ${EXPECTED} controls, found ${controls.length}.`);
if (groups.length !== EXPECTED) fail(`Expected ${EXPECTED} objective groups, found ${groups.length}.`);

const controlIds = new Set(controls.map((c) => c.id));

// objectives data-source checks
const seenObjIds = new Set();
let total = 0;
for (const g of groups) {
  if (!controlIds.has(g.requirementId)) fail(`Objective group ${g.requirementId} maps to no control.`);
  if (!Array.isArray(g.objectives) || g.objectives.length === 0) {
    fail(`Objective group ${g.requirementId} has no objectives.`);
  }
  for (const o of g.objectives) {
    total++;
    if (seenObjIds.has(o.objectiveId)) fail(`Duplicate objectiveId: ${o.objectiveId}`);
    seenObjIds.add(o.objectiveId);
    if (!o.objectiveId.startsWith(g.requirementId)) {
      fail(`Objective ${o.objectiveId} does not belong to requirement ${g.requirementId}.`);
    }
    if (!o.objectiveText || !o.objectiveText.trim()) fail(`Objective ${o.objectiveId} has empty objectiveText.`);
    if (PLACEHOLDER_RE.test(o.objectiveText)) fail(`Objective ${o.objectiveId} contains placeholder text.`);
    if (!Array.isArray(o.assessmentMethods) || o.assessmentMethods.length === 0) {
      fail(`Objective ${o.objectiveId} has no assessment methods.`);
    }
    for (const m of o.assessmentMethods) {
      if (!ALLOWED_METHODS.has(m)) fail(`Objective ${o.objectiveId} has invalid method "${m}".`);
    }
    if (!o.source) fail(`Objective ${o.objectiveId} has no source.`);
    // official text must be a separate field from BF notes
    if (!('objectiveText' in o)) fail(`Objective ${o.objectiveId} missing official objectiveText field.`);
    if (o.benchmarkFoxNotes !== undefined && typeof o.benchmarkFoxNotes !== 'string') {
      fail(`Objective ${o.objectiveId} benchmarkFoxNotes must be a string (separate from objectiveText).`);
    }
  }
}

// every generated control has at least one objective, all unique, mapped
const genIds = new Set();
let genTotal = 0;
for (const c of controls) {
  if (!Array.isArray(c.assessmentObjectives) || c.assessmentObjectives.length === 0) {
    fail(`Control ${c.id} has no assessment objectives in the generated library.`);
  }
  for (const o of c.assessmentObjectives) {
    genTotal++;
    if (genIds.has(o.objectiveId)) fail(`Duplicate objectiveId in generated controls: ${o.objectiveId}`);
    genIds.add(o.objectiveId);
    for (const m of o.assessmentMethods) {
      if (!ALLOWED_METHODS.has(m)) fail(`Generated control ${c.id} objective ${o.objectiveId} bad method "${m}".`);
    }
  }
}
if (genTotal !== total) fail(`Generated objective count ${genTotal} != data-source count ${total}.`);

console.log(
  `✓ Assessment-objective validation passed — ${controls.length}/${EXPECTED} controls, ` +
    `${groups.length} requirement groups, ${total} official NIST SP 800-171A objectives ` +
    `(all unique, mapped, examine/interview/test only, no placeholders). Official text is kept ` +
    `separate from Benchmark Fox notes.`,
);
