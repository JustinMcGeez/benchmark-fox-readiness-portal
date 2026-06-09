/* ============================================================================
   referenceDataService.ts — read-only access to GLOBAL REFERENCE DATA.

   This is the ONLY place (besides the Supabase client + the reference-data hook)
   that talks to Supabase. Screen components must NOT call supabase.from(...)
   directly — they go through this service (enforced by
   scripts/check-supabase-readonly-integration.mjs).

   Behavior for every getter:
     * If Supabase is NOT configured -> return local generated data
       (source: 'local-fallback').
     * If Supabase IS configured -> attempt the read; on ANY failure, fall back
       to local generated data and report the error (source: 'local-fallback').
     * On success -> return mapped Supabase rows (source: 'supabase').

   READ-ONLY PHASE: see supabaseReadOnlyGuard. No writes of any kind.
   Client-specific data (intake/scope/assessments/evidence/POA&M/tasks/reports)
   is NOT handled here — it stays in localStorage this phase.
   ============================================================================ */
import { supabase } from '../lib/supabaseClient';
import { isSupabaseConfigured } from '../lib/backendConfig';
import { assertReadOnly } from './supabaseReadOnlyGuard';

import { CONTROL_FAMILIES, type ControlFamily } from '../data/controlFamilies';
import { CONTROL_LIBRARY } from '../data/controls';
import { SOURCE_REFS, type SourceRef } from '../data/sourceRefs';
import type { Control } from '../data/types';

export type ReferenceSource = 'supabase' | 'local-fallback';

/** A control <-> source-document link, keyed by the stable natural ids. */
export interface ControlSourceRef {
  controlId: string; // control natural_id (e.g. '3.1.1')
  sourceId: string; // source_references.source_id (e.g. 'nist-sp-800-171r2')
}

/** Result of a single reference-data read. */
export interface ServiceResult<T> {
  data: T;
  source: ReferenceSource;
  /** Set only when a Supabase read was attempted and failed (then we fell back). */
  error?: string;
}

/** The full bundle of global reference data. */
export interface ReferenceData {
  families: ControlFamily[];
  controls: Control[];
  sourceReferences: SourceRef[];
  controlSourceReferences: ControlSourceRef[];
}

export interface ReferenceDataHealth {
  source: ReferenceSource;
  supabaseConfigured: boolean;
  error?: string;
  counts: {
    families: number;
    controls: number;
    sourceReferences: number;
    controlSourceReferences: number;
  };
  lastChecked: string; // ISO timestamp
}

/* ---------------------------------------------------------------------------
   Local generated data (always available, synchronous). Used as the default
   and as the fallback when Supabase is unavailable.
   --------------------------------------------------------------------------- */
const localControlSourceRefs = (): ControlSourceRef[] =>
  CONTROL_LIBRARY.flatMap((c) => (c.sourceRefs ?? []).map((sourceId) => ({ controlId: c.id, sourceId })));

/** Synchronous local snapshot — the hook seeds its initial state from this. */
export function getLocalReferenceData(): ReferenceData {
  return {
    families: CONTROL_FAMILIES,
    controls: CONTROL_LIBRARY,
    sourceReferences: SOURCE_REFS,
    controlSourceReferences: localControlSourceRefs(),
  };
}

/* ---------------------------------------------------------------------------
   Supabase row shapes (this service is the mapping boundary; the generated
   database.types.ts models reference tables via an index signature, so we cast
   query rows to these explicit shapes here).
   --------------------------------------------------------------------------- */
type EmbeddedFamily = { code: string; name: string } | { code: string; name: string }[] | null;
interface ControlRow {
  natural_id: string;
  code: string;
  level: string;
  title: string;
  summary: string;
  requirement: string;
  explanation: string | null;
  score_value: number | null;
  score_source: string;
  ssp_guidance: string | null;
  poam_guidance: string | null;
  control_families: EmbeddedFamily;
}
interface FamilyRow { code: string; name: string; section: string; family_index: string }
interface SourceRow {
  source_id: string;
  source_name: string;
  publisher: string;
  document_type: string;
  version: string | null;
  url: string | null;
  reference: string | null;
  notes: string | null;
}
interface MapRow {
  controls: { natural_id: string } | { natural_id: string }[] | null;
  source_references: { source_id: string } | { source_id: string }[] | null;
}

const one = <T,>(v: T | T[] | null): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);
const errMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Run a Supabase read with automatic local fallback. Never throws — failures
 * become a 'local-fallback' result carrying the error message.
 */
async function readWithFallback<T>(
  localData: T,
  loader: (db: NonNullable<typeof supabase>) => Promise<T>,
): Promise<ServiceResult<T>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: localData, source: 'local-fallback' };
  }
  try {
    assertReadOnly('select'); // guard rail: this layer reads only
    const data = await loader(supabase);
    return { data, source: 'supabase' };
  } catch (e) {
    return { data: localData, source: 'local-fallback', error: errMessage(e) };
  }
}

/* ---------------------------------------------------------------------------
   Public getters
   --------------------------------------------------------------------------- */

export function getControlFamilies(): Promise<ServiceResult<ControlFamily[]>> {
  return readWithFallback(CONTROL_FAMILIES, async (db) => {
    const { data, error } = await db
      .from('control_families')
      .select('code, name, section, family_index');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as FamilyRow[];
    return rows.map((r) => ({
      index: r.family_index,
      code: r.code,
      name: r.name,
      section: r.section,
    }));
  });
}

export function getControls(): Promise<ServiceResult<Control[]>> {
  return readWithFallback(CONTROL_LIBRARY, async (db) => {
    const { data, error } = await db
      .from('controls')
      .select(
        'natural_id, code, level, title, summary, requirement, explanation, ' +
          'score_value, score_source, ssp_guidance, poam_guidance, ' +
          'control_families(code, name)',
      );
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as ControlRow[];
    return rows.map((r): Control => {
      const fam = one(r.control_families);
      return {
        id: r.natural_id,
        number: r.natural_id,
        code: r.code,
        familyCode: fam?.code ?? r.natural_id.split('.').slice(0, 2).join('.'),
        familyName: fam?.name ?? '',
        level: r.level === 'L1' ? 'L1' : 'L2',
        scoreValue: r.score_value,
        // Derive the signed SPRS deduction from the stored magnitude (0/NA → 0).
        sprsDeductionValue: r.score_value == null ? 0 : -Math.abs(r.score_value),
        scoreSource: r.score_source || 'placeholder',
        title: r.title,
        summary: r.summary,
        requirement: r.requirement,
        explanation: r.explanation ?? '',
        sspGuidance: r.ssp_guidance ?? null,
        poamGuidance: r.poam_guidance ?? null,
        assessmentObjectives: null,
        // The control<->source mapping is loaded separately; left empty here.
        sourceRefs: [],
      };
    });
  });
}

export function getSourceReferences(): Promise<ServiceResult<SourceRef[]>> {
  return readWithFallback(SOURCE_REFS, async (db) => {
    const { data, error } = await db
      .from('source_references')
      .select('source_id, source_name, publisher, document_type, version, url, reference, notes');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as SourceRow[];
    return rows.map((r): SourceRef => ({
      sourceId: r.source_id,
      sourceName: r.source_name,
      publisher: r.publisher,
      documentType: r.document_type as SourceRef['documentType'],
      version: r.version ?? undefined,
      url: r.url ?? undefined,
      reference: r.reference ?? undefined,
      notes: r.notes ?? undefined,
    }));
  });
}

export function getControlSourceReferences(): Promise<ServiceResult<ControlSourceRef[]>> {
  return readWithFallback(localControlSourceRefs(), async (db) => {
    const { data, error } = await db
      .from('control_source_references')
      .select('controls(natural_id), source_references(source_id)');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as MapRow[];
    return rows
      .map((r) => ({
        controlId: one(r.controls)?.natural_id ?? '',
        sourceId: one(r.source_references)?.source_id ?? '',
      }))
      .filter((m) => m.controlId && m.sourceId);
  });
}

/* ---------------------------------------------------------------------------
   Orchestration + health
   --------------------------------------------------------------------------- */

/** Load every reference-data set once and report aggregate health. */
export async function loadAllReferenceData(): Promise<{
  data: ReferenceData;
  health: ReferenceDataHealth;
}> {
  const [families, controls, sourceReferences, controlSourceReferences] = await Promise.all([
    getControlFamilies(),
    getControls(),
    getSourceReferences(),
    getControlSourceReferences(),
  ]);

  const results = [families, controls, sourceReferences, controlSourceReferences];
  // Aggregate source is 'supabase' only if EVERY read came from Supabase.
  const source: ReferenceSource = results.every((r) => r.source === 'supabase')
    ? 'supabase'
    : 'local-fallback';
  const error = results.find((r) => r.error)?.error;

  const data: ReferenceData = {
    families: families.data,
    controls: controls.data,
    sourceReferences: sourceReferences.data,
    controlSourceReferences: controlSourceReferences.data,
  };

  const health: ReferenceDataHealth = {
    source,
    supabaseConfigured: isSupabaseConfigured,
    error,
    counts: {
      families: data.families.length,
      controls: data.controls.length,
      sourceReferences: data.sourceReferences.length,
      controlSourceReferences: data.controlSourceReferences.length,
    },
    lastChecked: new Date().toISOString(),
  };

  return { data, health };
}

/** Current reference-data health/status (used by the Backend Status card). */
export async function getReferenceDataHealth(): Promise<ReferenceDataHealth> {
  const { health } = await loadAllReferenceData();
  return health;
}
