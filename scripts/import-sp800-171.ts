/* ============================================================
   import-sp800-171.ts

   Generates src/data/generated/controls.generated.ts from the local
   source dataset data-sources/sp800-171r2.json (NIST SP 800-171 Rev. 2,
   public-domain U.S. Government requirement text).

   Run (Node 22.6+/24 runs .ts directly via type stripping):
     node scripts/import-sp800-171.ts

   SOURCE NOTE: this reads the bundled requirement JSON (all 110 statements) and
   the official scoring JSON (DoD Assessment Methodology v1.2.1, Annex A). Every
   generated control receives its official SPRS deduction value. If a scoring id
   does not match a known control, or a control has no scoring record, generation
   FAILS — values are never guessed.

   assessmentObjectives and the Benchmark Fox guidance fields remain null/empty
   placeholders on purpose (authored elsewhere).
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const SRC = resolve(root, 'data-sources/sp800-171r2.json');
const SCORING = resolve(root, 'data-sources/dod-assessment-methodology-scoring.json');
const OUT = resolve(root, 'src/data/generated/controls.generated.ts');

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

function buildControl(req: SourceReq, scoring: Map<string, ScoringRecord>) {
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
    explanation: '', // Benchmark Fox to author (placeholder)
    sspGuidance: null,
    poamGuidance: null,
    assessmentObjectives: null, // NIST SP 800-171A — not bundled locally
    sourceRefs,
    officialSourceRefs,
    benchmarkFoxSourceRefs,
  };
}

const requirements = loadRequirements();
const scoring = loadScoring();

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

const controls = requirements.map((r) => buildControl(r, scoring));

const header = `/* AUTO-GENERATED by scripts/import-sp800-171.ts — DO NOT EDIT BY HAND.
   Sources: data-sources/sp800-171r2.json (NIST SP 800-171 Rev. 2 requirement
   text, public domain) + data-sources/dod-assessment-methodology-scoring.json
   (official SPRS deduction values, DoD Assessment Methodology v1.2.1 Annex A).
   sprsDeductionValue/scoreValue/scoreSource are official. assessmentObjectives
   and the Benchmark Fox guidance fields remain null/'' placeholders.
   Regenerate: node scripts/import-sp800-171.ts
   Count: ${controls.length} requirements. */
import type { Control } from '../types';

export const GENERATED_CONTROLS: Control[] = ${JSON.stringify(controls, null, 2)};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, header, 'utf8');
console.log(`Wrote ${controls.length} controls -> ${OUT}`);
