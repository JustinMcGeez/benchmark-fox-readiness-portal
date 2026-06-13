/* ============================================================
   Clients store — the multi-client seam screens consume via
   useClients() (the list + CRUD) and useCurrentClient() (the client
   the route is scoped to).

   Two engines, one public API (mirrors data/store.tsx):
     - Local Prototype mode: synchronous localStorage reads (bf_clients_v1)
       so the route's <ClientScope> can validate a clientId on first render.
     - Supabase mode: TanStack Query reads + mutations through the
       ClientsRepository. Engagements are RECORDS — archiveClient flips
       status to 'Closed', never a hard delete.

   This provider owns its OWN QueryClient (independent of DataProvider's)
   and never reads reference data, so it is safe to mount with or without
   the ReferenceDataProvider. Per-client live readiness/SPRS is computed by
   the Clients screen from assessmentStatusesByClientId + the control library.
   ============================================================ */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  AssignableConsultant,
  ClientCreateInput,
  ClientPatch,
  ClientRecord,
} from './types';
import { SEED_ASSIGNABLE_CONSULTANTS } from './clients';
import { clientIdFromPathname } from './clientRoute';
import {
  RepositoryError,
  useRepository,
  type ClientsRepository,
} from './repository';
import {
  localClientsRepository,
  readLocalAssessmentStatuses,
  readLocalClients,
} from './repository/localRepository';
import type { ClientAssessmentStatus } from './repository/types';

/** Per-client readiness statuses, keyed by clientId (110 entries each). */
export type StatusesByClient = Record<string, ClientAssessmentStatus[]>;

interface ClientsContextValue {
  clients: ClientRecord[];
  loading: boolean;
  error: string | null;
  /** Readiness statuses keyed by clientId — feeds the list's live readiness/SPRS. */
  assessmentStatusesByClientId: StatusesByClient;
  /** Staff assignable as consultants (admins only get a populated list under RLS). */
  assignableConsultants: AssignableConsultant[];
  createClient(input: ClientCreateInput): Promise<ClientRecord>;
  updateClient(id: string, patch: ClientPatch): Promise<ClientRecord>;
  archiveClient(id: string): Promise<ClientRecord>;
  refetch(): void;
}

interface ClientsEngine extends ClientsContextValue {}

const ClientsContext = createContext<ClientsContextValue | null>(null);

function groupStatuses(rows: ClientAssessmentStatus[]): StatusesByClient {
  const out: StatusesByClient = {};
  for (const r of rows) (out[r.clientId] ??= []).push(r);
  return out;
}

const errorMessage = (e: unknown, fallback: string): string =>
  e instanceof RepositoryError ? e.message : fallback;

/* ---- provider: owns the QueryClient, then the engine ---- */

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ClientsEngineHost>{children}</ClientsEngineHost>
    </QueryClientProvider>
  );
}

function ClientsEngineHost({ children }: { children: ReactNode }) {
  const { mode, clients: repository } = useRepository();
  /* Both engines run every render (stable hook order); only one is exposed. */
  const local = useLocalClientsEngine();
  const remote = useSupabaseClientsEngine(repository, mode === 'supabase');
  const engine = mode === 'supabase' ? remote : local;

  return <ClientsContext.Provider value={engine}>{children}</ClientsContext.Provider>;
}

/* ============================================================
   Local engine — synchronous localStorage.
   ============================================================ */
function useLocalClientsEngine(): ClientsEngine {
  const [clients, setClients] = useState<ClientRecord[]>(() => readLocalClients());
  const [statuses, setStatuses] = useState<ClientAssessmentStatus[]>(() =>
    readLocalAssessmentStatuses(),
  );

  const reload = useCallback(() => {
    setClients(readLocalClients());
    setStatuses(readLocalAssessmentStatuses());
  }, []);

  const createClient = useCallback(
    async (input: ClientCreateInput) => {
      const record = await localClientsRepository.createClient(input);
      reload();
      return record;
    },
    [reload],
  );
  const updateClient = useCallback(
    async (id: string, patch: ClientPatch) => {
      const record = await localClientsRepository.updateClient(id, patch);
      reload();
      return record;
    },
    [reload],
  );
  const archiveClient = useCallback(
    async (id: string) => {
      const record = await localClientsRepository.archiveClient(id);
      reload();
      return record;
    },
    [reload],
  );

  return useMemo<ClientsEngine>(
    () => ({
      clients,
      loading: false,
      error: null,
      assessmentStatusesByClientId: groupStatuses(statuses),
      assignableConsultants: SEED_ASSIGNABLE_CONSULTANTS,
      createClient,
      updateClient,
      archiveClient,
      refetch: reload,
    }),
    [clients, statuses, createClient, updateClient, archiveClient, reload],
  );
}

/* ============================================================
   Supabase engine — TanStack Query reads + mutations.
   ============================================================ */
function useSupabaseClientsEngine(repository: ClientsRepository, enabled: boolean): ClientsEngine {
  const qc = useQueryClient();
  const clientsKey = ['clients'] as const;
  const statusesKey = ['client-statuses'] as const;
  const consultantsKey = ['assignable-consultants'] as const;

  const clientsQ = useQuery({ queryKey: clientsKey, queryFn: () => repository.listClients(), enabled });
  const statusesQ = useQuery({
    queryKey: statusesKey,
    queryFn: () => repository.listAssessmentStatuses(),
    enabled,
  });
  const consultantsQ = useQuery({
    queryKey: consultantsKey,
    queryFn: () => repository.listAssignableConsultants(),
    enabled,
  });

  const invalidateAll = useCallback(() => {
    void qc.invalidateQueries({ queryKey: clientsKey });
    void qc.invalidateQueries({ queryKey: statusesKey });
  }, [qc]);

  const createMut = useMutation({
    mutationFn: (input: ClientCreateInput) => repository.createClient(input),
    onSuccess: (record) => {
      // Optimistically add so navigation to /clients/:newId validates immediately.
      qc.setQueryData<ClientRecord[]>(clientsKey, (old) => [...(old ?? []), record]);
      invalidateAll();
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ClientPatch }) => repository.updateClient(id, patch),
    onSuccess: invalidateAll,
  });
  const archiveMut = useMutation({
    mutationFn: (id: string) => repository.archiveClient(id),
    onSuccess: invalidateAll,
  });

  const error =
    clientsQ.error || statusesQ.error
      ? errorMessage(clientsQ.error ?? statusesQ.error, 'Could not load clients from the cloud workspace.')
      : null;

  return useMemo<ClientsEngine>(
    () => ({
      clients: clientsQ.data ?? [],
      loading: enabled && clientsQ.isPending,
      error,
      assessmentStatusesByClientId: groupStatuses(statusesQ.data ?? []),
      assignableConsultants: consultantsQ.data ?? [],
      createClient: (input) => createMut.mutateAsync(input),
      updateClient: (id, patch) => updateMut.mutateAsync({ id, patch }),
      archiveClient: (id) => archiveMut.mutateAsync(id),
      refetch: () => {
        void clientsQ.refetch();
        void statusesQ.refetch();
      },
    }),
    [enabled, error, clientsQ, statusesQ, consultantsQ, createMut, updateMut, archiveMut],
  );
}

export function useClients(): ClientsContextValue {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error('useClients must be used within <ClientsProvider>');
  return ctx;
}

/**
 * The client the current route is scoped to (from `/clients/:clientId/...`),
 * resolved against the live clients list. `undefined` off a client route, while
 * the list loads, or for an unknown id (the route's <ClientScope> handles the
 * redirect). Used by the Shell client bar and client-scoped screen titles.
 */
export function useCurrentClient(): ClientRecord | undefined {
  const { pathname } = useLocation();
  const { clients } = useClients();
  const id = clientIdFromPathname(pathname);
  if (!id) return undefined;
  return clients.find((c) => c.id === id);
}
