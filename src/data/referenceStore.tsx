/* ============================================================================
   referenceStore.tsx — ReferenceDataProvider + useReference().

   A single React context over useReferenceData() so the whole app reads global
   reference data (control families, controls, source references, control/source
   mappings) from ONE place — Supabase when configured, else the local generated
   data, with automatic fallback. Screens consume this context instead of
   importing the static CONTROL_LIBRARY / CONTROLS_BY_ID directly.

   Key properties:
     * Starts SYNCHRONOUSLY with local generated data (via the hook) so the app
       never renders blank, even before a Supabase read resolves.
     * `controls` are ENRICHED: each control's `sourceRefs` is filled from the
       control/source mapping, and Benchmark Fox-authored overlay fields
       (explanation/guidance/examples — local repo content, NOT CUI or client
       data) are preserved when the reference source doesn't carry them. This
       keeps Control Detail fully populated in either mode.
     * `controlsById` provides O(1) lookup, used for scoring display and detail.

   This phase is READ-ONLY reference data. Client-specific data
   (assessments/intake/scope/evidence/POA&M/tasks/reports) stays in localStorage
   via data/store.ts — this provider never touches it.
   ============================================================================ */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Control } from './types';
import type { ControlFamily } from './controlFamilies';
import type { SourceRef } from './sourceRefs';
import { CONTROLS_BY_ID } from './controls';
import { useReferenceData } from '../hooks/useReferenceData';
import type {
  ControlSourceRef,
  ReferenceDataHealth,
  ReferenceSource,
} from '../services/referenceDataService';

export interface ReferenceContextValue {
  controls: Control[];
  controlsById: Record<string, Control>;
  controlFamilies: ControlFamily[];
  sourceReferences: SourceRef[];
  controlSourceReferences: ControlSourceRef[];
  loading: boolean;
  source: ReferenceSource;
  error?: string;
  health: ReferenceDataHealth | null;
  refresh: () => void;
}

const ReferenceContext = createContext<ReferenceContextValue | null>(null);

export function ReferenceDataProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, source, health, refresh } = useReferenceData();

  const value = useMemo<ReferenceContextValue>(() => {
    // control natural_id -> [sourceId, ...] from the mapping
    const refsByControl = new Map<string, string[]>();
    for (const m of data.controlSourceReferences) {
      const list = refsByControl.get(m.controlId);
      if (list) list.push(m.sourceId);
      else refsByControl.set(m.controlId, [m.sourceId]);
    }

    const controls: Control[] = data.controls.map((c) => {
      const local = CONTROLS_BY_ID[c.id];
      const sourceRefs = refsByControl.get(c.id) ?? c.sourceRefs ?? local?.sourceRefs ?? [];
      return {
        ...c,
        // Prefer the reference value; fall back to the local BF overlay so
        // Supabase-sourced controls keep their authored explanation/guidance.
        explanation: c.explanation || local?.explanation || '',
        commonMistakes: c.commonMistakes ?? local?.commonMistakes,
        evidenceExamples: c.evidenceExamples ?? local?.evidenceExamples,
        guidance: c.guidance ?? local?.guidance,
        sspGuidance: c.sspGuidance ?? local?.sspGuidance ?? null,
        poamGuidance: c.poamGuidance ?? local?.poamGuidance ?? null,
        officialSourceRefs: c.officialSourceRefs ?? local?.officialSourceRefs,
        benchmarkFoxSourceRefs: c.benchmarkFoxSourceRefs ?? local?.benchmarkFoxSourceRefs,
        // Scoring provenance columns aren't in the reference-read schema yet.
        scoreSourceVersion: c.scoreSourceVersion ?? local?.scoreSourceVersion,
        scoreNotes: c.scoreNotes ?? local?.scoreNotes,
        // Assessment objectives are bundled in generated local reference data during
        // this phase. Supabase currently stores core control rows only, so we merge
        // local objective metadata (matched by control id) onto Supabase-loaded
        // controls until reference objective tables are added. Never null; falls
        // back to [] when no local control is found.
        assessmentObjectives: c.assessmentObjectives?.length
          ? c.assessmentObjectives
          : (local?.assessmentObjectives ?? []),
        sourceRefs,
      };
    });

    const controlsById: Record<string, Control> = Object.fromEntries(
      controls.map((c) => [c.id, c]),
    );

    return {
      controls,
      controlsById,
      controlFamilies: data.families,
      sourceReferences: data.sourceReferences,
      controlSourceReferences: data.controlSourceReferences,
      loading,
      source,
      error,
      health,
      refresh,
    };
  }, [data, loading, error, source, health, refresh]);

  return <ReferenceContext.Provider value={value}>{children}</ReferenceContext.Provider>;
}

export function useReference(): ReferenceContextValue {
  const ctx = useContext(ReferenceContext);
  if (!ctx) throw new Error('useReference must be used within <ReferenceDataProvider>');
  return ctx;
}
