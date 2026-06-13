/* ============================================================================
   SSP content model — the PURE, DOM-free document model the .docx renderer
   (sspDocx.ts) walks. Data in → structured content out; no docx, no DOM, no
   side effects. This is the layer the unit tests target ("the generated
   document model"), so it must be deterministic and fully typed.

   It NEVER alters official source text: control.requirement and the assessment
   objectives are copied through verbatim. Benchmark Fox-authored statements
   live in a separate field; a control with no authored statement is flagged so
   the renderer can show the visible "[IMPLEMENTATION STATEMENT REQUIRED]"
   placeholder — a half-finished SSP must look half-finished, never silently
   blank.
   ============================================================================ */
import type {
  ClientControlAssessment,
  Control,
  EvidenceItem,
  PoamItem,
  ReadinessStatus,
} from '../../data/types';
import type { IntakeState } from '../../data/intake';
import type { ScopeState } from '../../data/scope';
import { CONTROL_FAMILIES, type ControlFamily } from '../../data/controlFamilies';
import { estimateSprs, readinessPct, statusCounts, type SprsEstimate, type StatusCounts } from '../scoring';
import { effectiveStatus } from '../evidenceWorkflow';
import { objectiveCoverageSummary, type ObjectiveCoverageSummary } from '../objectives';

/** Shown on the cover/System Identification when no system name is authored. */
export const SSP_SYSTEM_NAME_PLACEHOLDER = '[SYSTEM NAME REQUIRED]';
/** Shown for a control whose implementation statement has not been authored. */
export const SSP_STATEMENT_PLACEHOLDER = '[IMPLEMENTATION STATEMENT REQUIRED]';

/** Everything the model builder needs. Plain data — caller resolves it from the stores. */
export interface SspInput {
  clientName: string;
  /** Raw intake.systemName (may be empty — the model resolves a placeholder). */
  systemName: string;
  /** CMMC target label, e.g. "Level 2" / "Undetermined". */
  cmmcTarget: string;
  intake: IntakeState;
  scope: ScopeState;
  assessments: ClientControlAssessment[];
  /** The full control library (expected 110). */
  controls: Control[];
  evidence: EvidenceItem[];
  poam: PoamItem[];
  /** Document version label, e.g. "1.0". */
  version: string;
  /** When the document is generated (defaults to now). */
  generatedAt?: Date;
}

/** One requirement subsection (Section 3) — one per control, 110 total. */
export interface SspControlEntry {
  controlId: string; // '3.1.1'
  code: string; // 'AC.L1-3.1.1'
  title: string;
  familyCode: string;
  /** OFFICIAL NIST SP 800-171 Rev. 2 requirement text — verbatim, never edited. */
  requirement: string;
  status: ReadinessStatus;
  /** Authored implementation statement, or null when none → renderer shows the placeholder. */
  statement: string | null;
  hasStatement: boolean;
  /** Related POA&M item ids — populated only when status is Not Met / Partial. */
  poamIds: string[];
}

/** A family grouping for Section 3 (14 families, official NIST order). */
export interface SspFamilySection {
  family: ControlFamily;
  controls: SspControlEntry[];
}

/** A labelled key/value row for the System Identification table (Section 1). */
export interface SspIdentificationRow {
  label: string;
  value: string;
}

/** One scope asset row for the System Environment table (Section 2). */
export interface SspAssetRow {
  asset: string;
  type: string;
  inScope: string; // 'In scope' | 'Out of scope'
  notes: string; // category · owner · handles-CUI
}

/** One evidence row for Appendix B. METADATA + external link reference only. */
export interface SspEvidenceRow {
  title: string;
  controlId: string;
  status: ReadinessStatus | string; // effective evidence status
  quality: string;
  objectives: string; // joined objective ids, or 'Whole control'
  reference: string; // external https link, or '—'
}

/** Pre-flight summary surfaced before generation ("Generate anyway"). */
export interface SspPreflight {
  total: number;
  withStatements: number;
  placeholders: number;
  notReviewed: number;
}

/** The full document content model. */
export interface SspModel {
  meta: {
    clientName: string;
    /** Resolved system name (placeholder when none authored). */
    systemName: string;
    systemNameProvided: boolean;
    cmmcTarget: string;
    version: string;
    generatedAt: Date;
    generatedAtLabel: string;
  };
  preflight: SspPreflight;
  statusCounts: StatusCounts;
  readinessPct: number;
  sprs: SprsEstimate;
  identification: SspIdentificationRow[];
  /** Narrative paragraphs for Section 1 (from scope notes, etc.). */
  narrative: string[];
  assets: SspAssetRow[];
  families: SspFamilySection[];
  /** Flat, numeric-ordered list of all control entries (110). Mirrors `families`. */
  controlEntries: SspControlEntry[];
  evidence: SspEvidenceRow[];
  objectiveCoverage: ObjectiveCoverageSummary;
}

/** Numeric comparison of requirement numbers: 3.1.2 < 3.1.10 < 3.10.1. */
export function compareControlNumbers(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10));
  const pb = b.split('.').map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "June 13, 2026" — locale-independent so tests and Word output are stable. */
export function formatLongDate(d: Date): string {
  return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const selectedLabels = (opts: { label: string; selected: boolean }[]): string =>
  opts.filter((o) => o.selected).map((o) => o.label).join(', ') || 'None recorded';

/** Build the full SSP content model from the app's data. Pure + deterministic. */
export function buildSspModel(input: SspInput): SspModel {
  const generatedAt = input.generatedAt ?? new Date();
  const controlsById = Object.fromEntries(input.controls.map((c) => [c.id, c]));
  const assessmentById = new Map(input.assessments.map((a) => [a.controlId, a]));

  // POA&M ids grouped by control (only referenced for Not Met / Partial controls).
  const poamByControl = new Map<string, string[]>();
  for (const p of input.poam) {
    const list = poamByControl.get(p.controlId);
    if (list) list.push(p.id);
    else poamByControl.set(p.controlId, [p.id]);
  }

  const entryFor = (control: Control): SspControlEntry => {
    const a = assessmentById.get(control.id);
    const status: ReadinessStatus = a?.status ?? 'Not Reviewed';
    const statement = a?.sspStatement?.trim() ? a.sspStatement.trim() : null;
    const needsPoam = status === 'Not Met' || status === 'Partial';
    return {
      controlId: control.id,
      code: control.code,
      title: control.title,
      familyCode: control.familyCode,
      requirement: control.requirement, // VERBATIM — never transformed
      status,
      statement,
      hasStatement: statement !== null,
      poamIds: needsPoam ? (poamByControl.get(control.id) ?? []) : [],
    };
  };

  // Section 3: group by the 14 official families, numeric order within each.
  const families: SspFamilySection[] = CONTROL_FAMILIES.map((family) => {
    const controls = input.controls
      .filter((c) => c.familyCode === family.code)
      .sort((a, b) => compareControlNumbers(a.number, b.number))
      .map(entryFor);
    return { family, controls };
  });
  const controlEntries = families.flatMap((f) => f.controls);

  // The estimate / readiness snapshot are computed by the isolated scoring engine.
  const counts = statusCounts(input.assessments);
  const sprs = estimateSprs(input.assessments, controlsById);

  const preflight: SspPreflight = {
    total: controlEntries.length,
    withStatements: controlEntries.filter((e) => e.hasStatement).length,
    placeholders: controlEntries.filter((e) => !e.hasStatement).length,
    notReviewed: controlEntries.filter((e) => e.status === 'Not Reviewed').length,
  };

  const systemNameProvided = input.systemName.trim().length > 0;
  const systemName = systemNameProvided ? input.systemName.trim() : SSP_SYSTEM_NAME_PLACEHOLDER;

  const identification: SspIdentificationRow[] = [
    { label: 'System name', value: systemName },
    { label: 'Organization', value: input.clientName },
    { label: 'CMMC target level', value: input.cmmcTarget },
    { label: 'Likely data type', value: input.intake.likelyDataType },
    { label: 'Estimated scope', value: input.intake.estimatedScope },
    { label: 'Assessment boundary', value: input.scope.summary.assessmentBoundary },
    { label: 'CUI handling strategy', value: input.scope.summary.cuiStrategy },
    { label: 'MSP / ESP involved', value: input.scope.summary.mspInvolved },
    { label: 'Cloud services', value: input.scope.summary.cloudServices },
    { label: 'Contract clauses', value: selectedLabels(input.intake.contractClauses) },
    { label: 'Data handling', value: selectedLabels(input.intake.dataHandling) },
  ];

  const narrative = [
    `This System Security Plan describes ${systemName}, the information system operated by ` +
      `${input.clientName} within the scope of its CMMC ${input.cmmcTarget} readiness effort. The ` +
      `assessment boundary is the ${input.scope.summary.assessmentBoundary}; CUI is handled using a ` +
      `${input.scope.summary.cuiStrategy} approach.`,
    input.scope.summary.notes,
  ].filter((s) => s.trim().length > 0);

  const assets: SspAssetRow[] = input.scope.assets.map((asset) => ({
    asset: asset.name,
    type: asset.type,
    inScope: asset.inScope ? 'In scope' : 'Out of scope',
    notes:
      `${asset.category} · Owner: ${asset.owner}` +
      ` · ${asset.handlesCui ? 'Handles CUI' : 'No CUI'}`,
  }));

  const evidence: SspEvidenceRow[] = [...input.evidence]
    .sort(
      (a, b) =>
        compareControlNumbers(a.controlId || '0', b.controlId || '0') ||
        a.title.localeCompare(b.title),
    )
    .map((e) => ({
      title: e.title,
      controlId: e.controlId || '—',
      status: effectiveStatus(e, generatedAt),
      quality: e.quality,
      objectives: e.objectiveIds && e.objectiveIds.length > 0 ? e.objectiveIds.join(', ') : 'Whole control',
      reference: e.externalLink?.trim() || '—',
    }));

  const objectiveCoverage = objectiveCoverageSummary(
    input.controls,
    input.evidence.filter((e) => effectiveStatus(e, generatedAt) === 'Accepted'),
  );

  return {
    meta: {
      clientName: input.clientName,
      systemName,
      systemNameProvided,
      cmmcTarget: input.cmmcTarget,
      version: input.version,
      generatedAt,
      generatedAtLabel: formatLongDate(generatedAt),
    },
    preflight,
    statusCounts: counts,
    readinessPct: readinessPct(input.assessments),
    sprs,
    identification,
    narrative,
    assets,
    families,
    controlEntries,
    evidence,
    objectiveCoverage,
  };
}
