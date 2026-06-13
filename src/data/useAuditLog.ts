/* ============================================================================
   useAuditLog — the audit screen's data seam.

   Two modes, one shape (mirrors the store's dual-engine pattern):
     * Local Prototype mode: maps the in-memory seed (AUDIT_EVENTS) to entries,
       filtered client-side. No paging. The screen badges these as demo data.
     * Supabase mode: a paged, server-filtered query through the repository
       (listAuditEvents) via TanStack Query's useInfiniteQuery — newest first,
       50 per page, "Load more".

   Filter values are opaque strings the hook interprets per mode (client value =
   uuid in Supabase mode, client NAME in local mode); the screen just renders
   {value,label} options and calls setFilter. Options are derived from the rows
   currently loaded.
   ============================================================================ */
import { useCallback, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRepository } from './repository';
import { listAuditEvents } from './repository/supabaseRepository';
import { AUDIT_EVENTS } from './clients';
import { humanizeAuditAction, type AuditLogEntry } from '../lib/auditLog';

const PAGE_SIZE = 50;

/** Sentinel filter value meaning "no filter". */
export const AUDIT_FILTER_ALL = '__all__';

export interface AuditFilters {
  client: string;
  actor: string;
  action: string;
}

const NO_FILTERS: AuditFilters = {
  client: AUDIT_FILTER_ALL,
  actor: AUDIT_FILTER_ALL,
  action: AUDIT_FILTER_ALL,
};

export interface AuditFilterOption {
  value: string;
  label: string;
}

export interface UseAuditLog {
  mode: 'local' | 'supabase';
  entries: AuditLogEntry[];
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  hasMore: boolean;
  loadMore: () => void;
  isFetchingMore: boolean;
  filters: AuditFilters;
  setFilter: (key: keyof AuditFilters, value: string) => void;
  clientOptions: AuditFilterOption[];
  actorOptions: AuditFilterOption[];
  actionOptions: AuditFilterOption[];
}

/* ---- seed (local mode) ---- */

const SEED_ENTRIES: AuditLogEntry[] = AUDIT_EVENTS.map((e) => ({
  id: e.id,
  timestamp: e.timestamp,
  actorName: e.user,
  clientId: null,
  clientName: e.client,
  action: e.action,
  diff: null,
  details: e.details,
}));

/* ---- option helpers ---- */

function dedupeOptions(options: AuditFilterOption[]): AuditFilterOption[] {
  const byValue = new Map<string, AuditFilterOption>();
  for (const o of options) if (!byValue.has(o.value)) byValue.set(o.value, o);
  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function deriveOptions(entries: AuditLogEntry[], useClientId: boolean) {
  const clientOptions = dedupeOptions(
    entries
      .filter((e) => e.clientName)
      .map((e) => ({
        value: (useClientId ? e.clientId : e.clientName) ?? '',
        label: e.clientName ?? '',
      }))
      .filter((o) => o.value),
  );
  const actorOptions = dedupeOptions(
    entries.filter((e) => e.actorName).map((e) => ({ value: e.actorName, label: e.actorName })),
  );
  const actionOptions = dedupeOptions(
    entries.map((e) => ({ value: e.action, label: humanizeAuditAction(e.action) })),
  );
  return { clientOptions, actorOptions, actionOptions };
}

/* ---- hook ---- */

export function useAuditLog(): UseAuditLog {
  const { mode } = useRepository();
  const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS);
  const setFilter = useCallback((key: keyof AuditFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isSupabase = mode === 'supabase';
  const noneOr = (v: string) => (v === AUDIT_FILTER_ALL ? null : v);

  const query = useInfiniteQuery({
    queryKey: ['audit', filters] as const,
    enabled: isSupabase,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listAuditEvents({
        clientId: noneOr(filters.client),
        actorName: noneOr(filters.actor),
        action: noneOr(filters.action),
        limit: PAGE_SIZE,
        offset: pageParam * PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length : undefined),
  });

  const remoteEntries = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.entries),
    [query.data],
  );

  /* Local mode: filter the seed client-side by the displayed values. */
  const localEntries = useMemo(() => {
    return SEED_ENTRIES.filter(
      (e) =>
        (filters.client === AUDIT_FILTER_ALL || e.clientName === filters.client) &&
        (filters.actor === AUDIT_FILTER_ALL || e.actorName === filters.actor) &&
        (filters.action === AUDIT_FILTER_ALL || e.action === filters.action),
    );
  }, [filters]);

  // Options are derived from the full dataset available in each mode (all seed
  // rows locally; the rows loaded so far in Supabase mode).
  const optionSource = isSupabase ? remoteEntries : SEED_ENTRIES;
  const { clientOptions, actorOptions, actionOptions } = useMemo(
    () => deriveOptions(optionSource, isSupabase),
    [optionSource, isSupabase],
  );

  const retry = useCallback(() => void query.refetch(), [query]);
  const loadMore = useCallback(() => void query.fetchNextPage(), [query]);

  return {
    mode: isSupabase ? 'supabase' : 'local',
    entries: isSupabase ? remoteEntries : localEntries,
    isLoading: isSupabase && query.isPending,
    isError: isSupabase && query.isError,
    retry,
    hasMore: isSupabase && Boolean(query.hasNextPage),
    loadMore,
    isFetchingMore: isSupabase && query.isFetchingNextPage,
    filters,
    setFilter,
    clientOptions,
    actorOptions,
    actionOptions,
  };
}
