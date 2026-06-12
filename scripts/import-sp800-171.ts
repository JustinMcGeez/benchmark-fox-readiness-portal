/* ============================================================
   import-sp800-171.ts

   Generates src/data/generated/controls.generated.ts from the local
   source dataset data-sources/sp800-171r2.json (NIST SP 800-171 Rev. 2,
   public-domain U.S. Government requirement text).

   Run (Node 22.6+/24 runs .ts directly via type stripping):
     node scripts/import-sp800-171.ts

   SOURCE NOTE: this reads three bundled official sources:
     - data-sources/sp800-171r2.json — the 110 requirement statements.
     - data-sources/dod-assessment-methodology-scoring.json — official SPRS values.
     - data-sources/sp800-171a-assessment-objectives.json — official NIST SP
       800-171A assessment objectives.
   Every generated control receives its official SPRS deduction value AND its
   official assessment objectives (never null). Generation FAILS if a scoring or
   objective id does not match a known control, a control has no scoring record or
   no objectives, an objectiveId is duplicated, or a method is not
   examine/interview/test — values are never guessed. Re-running preserves the
   official objectives. The Benchmark Fox guidance fields
   (explanation/sspGuidance/poamGuidance) are emitted '' / null here by design —
   the authored guidance for all 110 controls lives in BF_OVERLAY in
   src/data/controls.ts (kept separate from official text; validated by
   npm run validate:guidance).
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const SRC = resolve(root, 'data-sources/sp800-171r2.json');
const SCORING = resolve(root, 'data-sources/dod-assessment-methodology-scoring.json');
const OBJECTIVES = resolve(root, 'data-sources/sp800-171a-assessment-objectives.json');
const OUT = resolve(root, 'src/data/generated/controls.generated.ts');

const ALLOWED_METHODS = new Set(['examine', 'interview', 'test']);

interface ObjectiveRecord {
  objectiveId: string;
  objectiveText: string;
  assessmentMethods: string[];
  source: string;
  sourceVersion?: string;
  benchmarkFoxNotes?: string;
}
interface ObjectiveGroup {
  requirementId: string;
  objectives: ObjectiveRecord[];
}

/** Load + validate the NIST SP 800-171A assessment objectives. */
function loadObjectives(): Map<string, ObjectiveRecord[]> {
  const groups = JSON.parse(readFileSync(OBJECTIVES, 'utf8')) as ObjectiveGroup[];
  const map = new Map<string, ObjectiveRecord[]>();
  const seenObjIds = new Set<string>();
  for (const g of groups) {
    if (map.has(g.requirementId)) throw new Error(`Duplicate objective group for ${g.requirementId}.`);
    if (!g.objectives || g.objectives.length === 0) {
      throw new Error(`Objective group ${g.requirementId} has no objectives.`);
    }
    for (const o of g.objectives) {
      if (seenObjIds.has(o.objectiveId)) throw new Error(`Duplicate objectiveId ${o.objectiveId}.`);
      seenObjIds.add(o.objectiveId);
      if (!o.objectiveText || !o.objectiveText.trim()) {
        throw new Error(`Objective ${o.objectiveId} has empty objectiveText.`);
      }
      for (const m of o.assessmentMethods) {
        if (!ALLOWED_METHODS.has(m)) {
          throw new Error(`Objective ${o.objectiveId} has invalid method "${m}" (allowed: examine/interview/test).`);
        }
      }
    }
    map.set(g.requirementId, g.objectives);
  }
  return map;
}

interface ScoringRecord {
  requirementId: string;
  sprsDeductionValue: number; // -5 | -3 | -1, or 0 for the NA control (3.12.4)
  scoreSource: string;
  sourceVersion?: string;
  sourceReference?: string;
  notes?: string;
}

function loadScoring(): Map<string, ScoringRecord> {
  const recs = JSON.parse(readFileSync(SCORING, 'utf8')) as ScoringRecord[];
  const map = new Map<string, ScoringRecord>();
  const allowed = new Set([-5, -3, -1, 0]);
  for (const r of recs) {
    if (!allowed.has(r.sprsDeductionValue)) {
      throw new Error(
        `Scoring ${r.requirementId}: sprsDeductionValue ${r.sprsDeductionValue} is not one of -5/-3/-1 (or 0 for NA).`,
      );
    }
    if (map.has(r.requirementId)) throw new Error(`Duplicate scoring record for ${r.requirementId}.`);
    map.set(r.requirementId, r);
  }
  return map;
}

const FAMILIES: Record<string, [string, string]> = {
  '1': ['AC', 'Access Control'],
  '2': ['AT', 'Awareness and Training'],
  '3': ['AU', 'Audit and Accountability'],
  '4': ['CM', 'Configuration Management'],
  '5': ['IA', 'Identification and Authentication'],
  '6': ['IR', 'Incident Response'],
  '7': ['MA', 'Maintenance'],
  '8': ['MP', 'Media Protection'],
  '9': ['PS', 'Personnel Security'],
  '10': ['PE', 'Physical Protection'],
  '11': ['RA', 'Risk Assessment'],
  '12': ['CA', 'Security Assessment'],
  '13': ['SC', 'System and Communications Protection'],
  '14': ['SI', 'System and Information Integrity'],
};

interface SourceReq {
  number: string;
  level: 'L1' | 'L2';
  text: string;
}

function loadRequirements(): SourceReq[] {
  const raw = JSON.parse(readFileSync(SRC, 'utf8')) as { requirements: SourceReq[] };
  return raw.requirements;
}

/** Short display label derived from the official requirement text. */
function deriveTitle(text: string): string {
  let t = text.split(/[.;:]| - /)[0].trim();
  if (t.length > 60) t = t.split(',')[0].trim();
  if (t.length > 70) t = t.slice(0, 67).trimEnd() + '…';
  return t;
}

function buildControl(
  req: SourceReq,
  scoring: Map<string, ScoringRecord>,
  objectives: Map<string, ObjectiveRecord[]>,
) {
  const idx = req.number.split('.')[1];
  const fam = FAMILIES[idx];
  if (!fam) throw new Error(`Unknown family for ${req.number}`);
  const [familyCode, familyName] = fam;

  const score = scoring.get(req.number);
  if (!score) {
    throw new Error(
      `Control ${req.number} has no scoring record in dod-assessment-methodology-scoring.json. ` +
        'Every control must have an official SPRS deduction value — values are never guessed.',
    );
  }

  const objs = objectives.get(req.number);
  if (!objs || objs.length === 0) {
    throw new Error(
      `Control ${req.number} has no assessment objectives in ` +
        'sp800-171a-assessment-objectives.json. Every control must have at least one objective.',
    );
  }
  // scoreValue = positive magnitude (5/3/1); null for the NA control (deduction 0).
  const scoreValue = score.sprsDeductionValue === 0 ? null : Math.abs(score.sprsDeductionValue);

  const officialSourceRefs = ['nist-sp-800-171r2', 'nist-sp-800-171a'];
  if (req.level === 'L1') officialSourceRefs.push('far-52-204-21');
  const benchmarkFoxSourceRefs = ['bf-internal'];
  const sourceRefs = [...officialSourceRefs, ...benchmarkFoxSourceRefs];

  return {
    id: req.number,
    number: req.number,
    code: `${familyCode}.${req.level}-${req.number}`,
    familyCode,
    familyName,
    level: req.level,
    scoreValue,
    sprsDeductionValue: score.sprsDeductionValue,
    scoreSource: score.scoreSource,
    scoreSourceVersion: score.sourceVersion,
    scoreNotes: score.notes || undefined,
    title: deriveTitle(req.text),
    summary: req.text,
    requirement: req.text,
    explanation: '', // authored guidance merges from BF_OVERLAY (src/data/controls.ts)
    sspGuidance: null,
    poamGuidance: null,
    // Official NIST SP 800-171A objectives (official text; benchmarkFoxNotes kept separate).
    assessmentObjectives: objs,
    sourceRefs,
    officialSourceRefs,
    benchmarkFoxSourceRefs,
  };
}

const requirements = loadRequirements();
const scoring = loadScoring();
const objectives = loadObjectives();

// Fail if a scoring record references a requirement that is not a known control.
const knownIds = new Set(requirements.map((r) => r.number));
for (const id of scoring.keys()) {
  if (!knownIds.has(id)) {
    throw new Error(
      `Scoring record ${id} does not match any known NIST SP 800-171 control. ` +
        'Fix data-sources/dod-assessment-methodology-scoring.json.',
    );
  }
}
// Fail if an objective group references a requirement that is not a known control.
for (const id of objectives.keys()) {
  if (!knownIds.has(id)) {
    throw new Error(
      `Objective group ${id} does not match any known NIST SP 800-171 control. ` +
        'Fix data-sources/sp800-171a-assessment-objectives.json.',
    );
  }
}

const controls = requirements.map((r) => buildControl(r, scoring, objectives));

const header = `/* AUTO-GENERATED by scripts/import-sp800-171.ts — DO NOT EDIT BY HAND.
   Sources: data-sources/sp800-171r2.json (NIST SP 800-171 Rev. 2 requirement
   text, public domain) + data-sources/dod-assessment-methodology-scoring.json
   (official SPRS deduction values, DoD Assessment Methodology v1.2.1 Annex A) +
   data-sources/sp800-171a-assessment-objectives.json (official NIST SP 800-171A
   assessment objectives). sprsDeductionValue/scoreValue/scoreSource and
   assessmentObjectives are official. The Benchmark Fox guidance fields
   (explanation/sspGuidance/poamGuidance) are '' / null in this skeleton; the
   authored guidance for all 110 controls is merged from BF_OVERLAY in
   src/data/controls.ts and stays separate from the official text.
   Regenerate: node scripts/import-sp800-171.ts
   Count: ${controls.length} requirements. */
import type { Control } from '../types';

export const GENERATED_CONTROLS: Control[] = ${JSON.stringify(controls, null, 2)};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, header, 'utf8');
console.log(`Wrote ${controls.length} controls -> ${OUT}`);
