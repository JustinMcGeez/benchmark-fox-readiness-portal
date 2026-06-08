/* ============================================================================
   useReferenceData.ts — React hook for global reference data.

   Loads control families, controls, source references, the control/source
   mapping, and a health/status snapshot through the reference-data SERVICE
   (never Supabase directly).

   Default behavior:
     * Local generated data is available IMMEDIATELY (synchronous initial state)
       so the UI never blocks or flashes empty.
     * When Supabase is configured, it loads once on mount and replaces the data
       on success; on failure it keeps the local data (the service handles the
       fallback). Supabase errors never break the app.
     * No infinite loops, no repeated queries — fetch runs once per mount and
       once per explicit refresh().
   ============================================================================ */
import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/backendConfig';
import {
  getLocalReferenceData,
  loadAllReferenceData,
  type ReferenceData,
  type ReferenceDataHealth,
  type ReferenceSource,
} from '../services/referenceDataService';

export interface UseReferenceDataResult {
  data: ReferenceData;
  loading: boolean;
  error?: string;
  source: ReferenceSource;
  health: ReferenceDataHealth | null;
  refresh: () => void;
}

function localHealth(data: ReferenceData): ReferenceDataHealth {
  return {
    source: 'local-fallback',
    supabaseConfigured: false,
    counts: {
      families: data.families.length,
      controls: data.controls.length,
      sourceReferences: data.sourceReferences.length,
      controlSourceReferences: data.controlSourceReferences.length,
    },
    lastChecked: new Date().toISOString(),
  };
}

export function useReferenceData(): UseReferenceDataResult {
  // Seed synchronously with local generated data — always present.
  const [data, setData] = useState<ReferenceData>(getLocalReferenceData);
  const [health, setHealth] = useState<ReferenceDataHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | undefined>(undefined);
  const [source, setSource] = useState<ReferenceSource>('local-fallback');
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    // Local mode: nothing to fetch — record a local health snapshot and stop.
    if (!isSupabaseConfigured) {
      setHealth(localHealth(getLocalReferenceData()));
      setSource('local-fallback');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadAllReferenceData()
      .then(({ data: loaded, health: h }) => {
        if (cancelled) return;
        setData(loaded);
        setHealth(h);
        setSource(h.source);
        setError(h.error);
      })
      .catch((e: unknown) => {
        // The service is designed not to throw; this is a final safety net.
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setSource('local-fallback');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { data, loading, error, source, health, refresh };
}
