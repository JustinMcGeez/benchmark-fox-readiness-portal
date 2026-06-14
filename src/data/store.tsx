/* ============================================================
   Data store — the storage seam screens consume via useData().

   Two engines, one public API:
     - Local Prototype mode (no Supabase / not signed in): the original
       synchronous localStorage logic, unchanged.
     - Supabase mode (configured + authenticated): TanStack Query reads
       with optimistic-update mutations through the repository layer.

   The engine is chosen by useRepository(); the DataContextValue the
   screens see is identical in both modes. Local mode renders children
   synchronously; Supabase mode shows a loading gate while the first
   reads resolve and an error panel (with Retry) if they fail. Mutation
   failures roll back the optimistic cache and surface a dismissible
   toast.
   ============================================================ */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  ClientControlAssessment,
  EvidenceItem,
  EvidencePatch,
  EvidenceRequestInput,
  EvidenceStatus,
} from './types';
import { DEMO_CLIENT_ID } from './clients';
import { SEED_ASSESSMENTS } from './controls';
import { stripInternalAssessmentFields } from './internalFields';
import { isClientRole } from '../auth/roles';
import { useOptionalAuth } from '../auth/AuthProvider';
import { DEFAULT_INTAKE, type IntakeState } from './intake';
import { DEFAULT_SCOPE, type ScopeAsset, type ScopeState, type ScopeSummary } from './scope';
import { Btn, Card, WarnBanner } from '../components/primitives';
import { MigrationPrompt } from './MigrationPrompt';
import {
  RepositoryError,
  useRepository,
  type ClientDataRepository,
  type EvidenceRepository,
} from './repository';
import type { AssessmentPatch } from './repository/types';
import {
  baseAssessmentsFor,
  localEvidenceRepository,
  LS_ASSESS,
  LS_INTAKE,
  LS_SCOPE,
  loadJson,
  loadOverrides,
  overrideKey,
  readLocalEvidence,
  saveJson,
  type Overrides,
} from './repository/localRepository';

const LS_SELECTED = 'bf_selected_control';

interface DataContextValue {
  currentClientId: string;
  assessments: ClientControlAssessment[];
  assessmentFor: (controlId: string) => ClientControlAssessment | undefined;
  updateAssessment: (controlId: string, patch: AssessmentPatch) => void;
  selectedControlId: string;
  selectControl: (controlId: string) => void;

  /* editable intake workflow */
  intake: IntakeState;
  updateIntake: (patch: Partial<IntakeState>) => void;
  toggleContractClause: (label: string) => void;
  toggleDataHandling: (label: string) => void;
  resetIntake: () => void;

  /* editable scope workflow */
  scope: ScopeState;
  updateScopeSummary: (patch: Partial<ScopeSummary>) => void;
  addAsset: () => void;
  updateAsset: (id: string, patch: Partial<ScopeAsset>) => void;
  toggleAssetInScope: (id: string) => void;
  toggleAssetHandlesCui: (id: string) => void;
  resetScope: () => void;

  /* evidence lifecycle workflow (Task 08) */
  evidence: EvidenceItem[];
  requestEvidence: (input: EvidenceRequestInput) => void;
  updateEvidence: (id: string, patch: EvidencePatch) => void;
  transitionEvidence: (id: string, toStatus: EvidenceStatus, note?: string) => void;
}

/** The assessment/intake/scope portion produced by either engine. */
type DataSlice = Omit<
  DataContextValue,
  'currentClientId' | 'selectedControlId' | 'selectControl'
>;

interface EngineResult {
  slice: DataSlice;
  /** Supabase mode only: first reads not yet resolved. */
  isPending: boolean;
  /** Supabase mode only: a read failed. */
  isError: boolean;
  retry: () => void;
}

/** A surfaced write failure. `retry` (writes only) re-runs the failed mutation —
    writes are NEVER auto-retried (duplicate-write risk); the user chooses. */
interface MutationError {
  message: string;
  retry?: () => void;
}
type ReportMutationError = (message: string, retry?: () => void) => void;

const DataContext = createContext<DataContextValue | null>(null);

/* ---- provider: owns the QueryClient, then the engine ---- */

export function DataProvider({
  clientId = DEMO_CLIENT_ID,
  children,
}: {
  /** The client the data is scoped to (from the route; defaults to the demo
      engagement off any client-scoped route, e.g. the internal Dashboard). */
  clientId?: string;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // networkMode 'online' (the default, set explicitly): while the browser
          // is offline, reads pause and mutations are HELD (not failed) and resume
          // automatically on reconnect — the connectivity banner promises this.
          // The repository owns read retry/backoff, so react-query retry stays off.
          queries: { retry: false, networkMode: 'online', refetchOnWindowFocus: false, staleTime: 30_000 },
          mutations: { retry: false, networkMode: 'online' },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <DataEngine clientId={clientId}>{children}</DataEngine>
    </QueryClientProvider>
  );
}

function DataEngine({ clientId, children }: { clientId: string; children: ReactNode }) {
  const { mode, repository, evidence: evidenceRepo } = useRepository();

  /* selected control is shared by both modes and out of this task's scope */
  const [selectedControlId, setSelectedControlId] = useState<string>(
    () => localStorage.getItem(LS_SELECTED) || SEED_ASSESSMENTS[0]?.controlId || '3.1.1',
  );
  const selectControl = useCallback((controlId: string) => {
    setSelectedControlId(controlId);
    saveJson(LS_SELECTED, controlId);
  }, []);

  const [mutationError, setMutationError] = useState<MutationError | null>(null);
  const reportMutationError = useCallback<ReportMutationError>(
    (message, retry) => setMutationError({ message, retry }),
    [],
  );

  // Client-portal read posture: a client-role session never receives internal-
  // only fields (consultant_notes). useOptionalAuth so the store still works when
  // mounted bare in unit tests (no AuthProvider → null → staff/full read).
  const hideInternal = isClientRole(useOptionalAuth()?.role ?? null);

  /* Both engines run every render (stable hook order); only one is exposed. */
  const local = useLocalEngine(clientId, reportMutationError, hideInternal);
  const remote = useSupabaseEngine(repository, evidenceRepo, clientId, mode === 'supabase', reportMutationError, hideInternal);
  const engine = mode === 'supabase' ? remote : local;

  const value = useMemo<DataContextValue>(
    () => ({
      currentClientId: clientId,
      selectedControlId,
      selectControl,
      ...engine.slice,
    }),
    [clientId, selectedControlId, selectControl, engine.slice],
  );

  let body: ReactNode = children;
  if (mode === 'supabase' && engine.isError) body = <DataErrorPanel onRetry={engine.retry} />;
  else if (mode === 'supabase' && engine.isPending) body = <DataLoadingGate />;

  const ready = mode === 'supabase' && !engine.isPending && !engine.isError;
  return (
    <DataContext.Provider value={value}>
      {body}
      {ready && <MigrationPrompt clientId={clientId} onError={(m) => reportMutationError(m)} />}
      {mutationError && (
        <MutationErrorToast error={mutationError} onDismiss={() => setMutationError(null)} />
      )}
    </DataContext.Provider>
  );
}

/* ============================================================
   Local engine — the original synchronous localStorage logic.
   ============================================================ */
function useLocalEngine(
  clientId: string,
  reportMutationError: ReportMutationError,
  hideInternal: boolean,
): EngineResult {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [intake, setIntake] = useState<IntakeState>(() => loadJson(LS_INTAKE, DEFAULT_INTAKE));
  const [scope, setScope] = useState<ScopeState>(() => loadJson(LS_SCOPE, DEFAULT_SCOPE));
  const [evidence, setEvidence] = useState<EvidenceItem[]>(() => readLocalEvidence(clientId));

  /* Re-read evidence whenever the route's client changes. */
  useEffect(() => {
    setEvidence(readLocalEvidence(clientId));
  }, [clientId]);

  /* Evidence mutations go through localEvidenceRepository (which persists +
     validates transitions), then re-read into state. Promise.resolve().then
     turns any synchronous throw (e.g. an illegal transition) into a rejection. */
  const runEvidence = useCallback(
    (work: () => Promise<unknown>) => {
      Promise.resolve()
        .then(work)
        .then(() => setEvidence(readLocalEvidence(clientId)))
        .catch((e) =>
          // Local evidence failures are deterministic (illegal transition) — no
          // Retry would help, so the toast just surfaces the message.
          reportMutationError(e instanceof Error ? e.message : 'Could not update evidence.'),
        );
    },
    [clientId, reportMutationError],
  );
  const requestEvidence = useCallback(
    (input: EvidenceRequestInput) => runEvidence(() => localEvidenceRepository.create(clientId, input)),
    [runEvidence, clientId],
  );
  const updateEvidence = useCallback(
    (id: string, patch: EvidencePatch) =>
      runEvidence(() => localEvidenceRepository.updateMetadata(clientId, id, patch)),
    [runEvidence, clientId],
  );
  const transitionEvidence = useCallback(
    (id: string, toStatus: EvidenceStatus, note?: string) =>
      runEvidence(() => localEvidenceRepository.transition(clientId, id, toStatus, note)),
    [runEvidence, clientId],
  );

  const assessments = useMemo(
    () =>
      baseAssessmentsFor(clientId).map((a) => {
        const ov = overrides[overrideKey(clientId, a.controlId)];
        const merged = ov ? { ...a, ...ov } : a;
        return hideInternal ? stripInternalAssessmentFields(merged) : merged;
      }),
    [overrides, clientId, hideInternal],
  );

  const assessmentFor = useCallback(
    (controlId: string) => assessments.find((a) => a.controlId === controlId),
    [assessments],
  );

  const updateAssessment = useCallback(
    (controlId: string, patch: AssessmentPatch) => {
      setOverrides((prev) => {
        const k = overrideKey(clientId, controlId);
        const next = { ...prev, [k]: { ...prev[k], ...patch } };
        saveJson(LS_ASSESS, next);
        return next;
      });
    },
    [clientId],
  );

  const persistIntake = useCallback((next: IntakeState) => {
    saveJson(LS_INTAKE, next);
    return next;
  }, []);
  const updateIntake = useCallback(
    (patch: Partial<IntakeState>) => setIntake((prev) => persistIntake({ ...prev, ...patch })),
    [persistIntake],
  );
  const toggleContractClause = useCallback(
    (label: string) =>
      setIntake((prev) =>
        persistIntake({
          ...prev,
          contractClauses: prev.contractClauses.map((c) =>
            c.label === label ? { ...c, selected: !c.selected } : c,
          ),
        }),
      ),
    [persistIntake],
  );
  const toggleDataHandling = useCallback(
    (label: string) =>
      setIntake((prev) =>
        persistIntake({
          ...prev,
          dataHandling: prev.dataHandling.map((c) =>
            c.label === label ? { ...c, selected: !c.selected } : c,
          ),
        }),
      ),
    [persistIntake],
  );
  const resetIntake = useCallback(() => setIntake(persistIntake(DEFAULT_INTAKE)), [persistIntake]);

  const persistScope = useCallback((next: ScopeState) => {
    saveJson(LS_SCOPE, next);
    return next;
  }, []);
  const updateScopeSummary = useCallback(
    (patch: Partial<ScopeSummary>) =>
      setScope((prev) => persistScope({ ...prev, summary: { ...prev.summary, ...patch } })),
    [persistScope],
  );
  const addAsset = useCallback(
    () =>
      setScope((prev) =>
        persistScope({
          ...prev,
          assets: [
            ...prev.assets,
            {
              id: 'as-' + Date.now(),
              name: 'New asset',
              type: 'Endpoint',
              category: 'CUI Asset',
              handlesCui: false,
              owner: 'Unassigned',
              inScope: true,
            },
          ],
        }),
      ),
    [persistScope],
  );
  const updateAsset = useCallback(
    (id: string, patch: Partial<ScopeAsset>) =>
      setScope((prev) =>
        persistScope({
          ...prev,
          assets: prev.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }),
      ),
    [persistScope],
  );
  const toggleAssetInScope = useCallback(
    (id: string) =>
      setScope((prev) =>
        persistScope({
          ...prev,
          assets: prev.assets.map((a) => (a.id === id ? { ...a, inScope: !a.inScope } : a)),
        }),
      ),
    [persistScope],
  );
  const toggleAssetHandlesCui = useCallback(
    (id: string) =>
      setScope((prev) =>
        persistScope({
          ...prev,
          assets: prev.assets.map((a) => (a.id === id ? { ...a, handlesCui: !a.handlesCui } : a)),
        }),
      ),
    [persistScope],
  );
  const resetScope = useCallback(() => setScope(persistScope(DEFAULT_SCOPE)), [persistScope]);

  const slice = useMemo<DataSlice>(
    () => ({
      assessments,
      assessmentFor,
      updateAssessment,
      intake,
      updateIntake,
      toggleContractClause,
      toggleDataHandling,
      resetIntake,
      scope,
      updateScopeSummary,
      addAsset,
      updateAsset,
      toggleAssetInScope,
      toggleAssetHandlesCui,
      resetScope,
      evidence,
      requestEvidence,
      updateEvidence,
      transitionEvidence,
    }),
    [
      assessments,
      assessmentFor,
      updateAssessment,
      intake,
      updateIntake,
      toggleContractClause,
      toggleDataHandling,
      resetIntake,
      scope,
      updateScopeSummary,
      addAsset,
      updateAsset,
      toggleAssetInScope,
      toggleAssetHandlesCui,
      resetScope,
      evidence,
      requestEvidence,
      updateEvidence,
      transitionEvidence,
    ],
  );

  const noop = useCallback(() => {}, []);
  return { slice, isPending: false, isError: false, retry: noop };
}

/* ============================================================
   Supabase engine — TanStack Query reads + optimistic mutations.
   ============================================================ */
function useSupabaseEngine(
  repository: ClientDataRepository,
  evidenceRepo: EvidenceRepository,
  clientId: string,
  enabled: boolean,
  reportMutationError: ReportMutationError,
  hideInternal: boolean,
): EngineResult {
  const qc = useQueryClient();
  const assessmentsKey = useMemo(() => ['assessments', clientId] as const, [clientId]);
  const intakeKey = useMemo(() => ['intake', clientId] as const, [clientId]);
  const scopeKey = useMemo(() => ['scope', clientId] as const, [clientId]);
  const evidenceKey = useMemo(() => ['evidence', clientId] as const, [clientId]);

  const assessmentsQ = useQuery({
    queryKey: assessmentsKey,
    // Client-portal sessions read through the column-restricted view (no
    // internal-only fields); staff read the full row. The mutation key stays
    // ['assessments', clientId] — client roles are read-only, so optimistic
    // patches (staff only) and this read never disagree on the cache key.
    queryFn: () => repository.getAssessments(clientId, { includeInternal: !hideInternal }),
    enabled,
  });
  const intakeQ = useQuery({
    queryKey: intakeKey,
    queryFn: () => repository.getIntake(clientId),
    enabled,
  });
  const scopeQ = useQuery({
    queryKey: scopeKey,
    queryFn: () => repository.getScope(clientId),
    enabled,
  });
  const evidenceQ = useQuery({
    queryKey: evidenceKey,
    queryFn: () => evidenceRepo.list(clientId),
    enabled,
  });

  const reportError = useCallback(
    // `retry` (writes only) lets the toast re-run the failed mutation — we NEVER
    // auto-retry a write (duplicate-write risk); the user decides.
    (e: unknown, retry?: () => void) =>
      reportMutationError(
        e instanceof RepositoryError || e instanceof Error
          ? e.message
          : 'Could not save your change to the cloud workspace. Please try again.',
        retry,
      ),
    [reportMutationError],
  );

  /* -- assessments: optimistic patch -- */
  const patchMut = useMutation<void, unknown, { controlId: string; patch: AssessmentPatch }, { prev?: ClientControlAssessment[] }>({
    mutationKey: assessmentsKey,
    mutationFn: ({ controlId, patch }) => repository.patchAssessment(clientId, controlId, patch),
    onMutate: async ({ controlId, patch }) => {
      await qc.cancelQueries({ queryKey: assessmentsKey });
      const prev = qc.getQueryData<ClientControlAssessment[]>(assessmentsKey);
      qc.setQueryData<ClientControlAssessment[]>(assessmentsKey, (old) =>
        (old ?? SEED_ASSESSMENTS).map((a) => (a.controlId === controlId ? { ...a, ...patch } : a)),
      );
      return { prev };
    },
    onError: (e, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(assessmentsKey, ctx.prev);
      reportError(e, () => patchMut.mutate(vars));
    },
    onSettled: () => {
      // Only the last in-flight assessment write refetches — avoids a refetch
      // storm during rapid Control Matrix inline edits.
      if (qc.isMutating({ mutationKey: assessmentsKey }) === 1) {
        void qc.invalidateQueries({ queryKey: assessmentsKey });
      }
    },
  });

  /* -- intake: one mutation takes the full next state -- */
  const intakeMut = useMutation<void, unknown, IntakeState, { prev?: IntakeState }>({
    mutationKey: intakeKey,
    mutationFn: (next) => repository.saveIntake(clientId, next),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: intakeKey });
      const prev = qc.getQueryData<IntakeState>(intakeKey);
      qc.setQueryData<IntakeState>(intakeKey, next);
      return { prev };
    },
    onError: (e, next, ctx) => {
      if (ctx?.prev) qc.setQueryData(intakeKey, ctx.prev);
      reportError(e, () => intakeMut.mutate(next));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: intakeKey }) === 1) void qc.invalidateQueries({ queryKey: intakeKey });
    },
  });

  /* -- scope: one mutation takes the full next state -- */
  const scopeMut = useMutation<void, unknown, ScopeState, { prev?: ScopeState }>({
    mutationKey: scopeKey,
    mutationFn: (next) => repository.saveScope(clientId, next),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: scopeKey });
      const prev = qc.getQueryData<ScopeState>(scopeKey);
      qc.setQueryData<ScopeState>(scopeKey, next);
      return { prev };
    },
    onError: (e, next, ctx) => {
      if (ctx?.prev) qc.setQueryData(scopeKey, ctx.prev);
      reportError(e, () => scopeMut.mutate(next));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: scopeKey }) === 1) void qc.invalidateQueries({ queryKey: scopeKey });
    },
  });

  /* -- evidence: create / metadata patch / legal transition -- */
  const requestMut = useMutation<EvidenceItem, unknown, EvidenceRequestInput>({
    mutationFn: (input) => evidenceRepo.create(clientId, input),
    onError: (e, input) => reportError(e, () => requestMut.mutate(input)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: evidenceKey });
    },
  });
  const updateEvidenceMut = useMutation<
    EvidenceItem,
    unknown,
    { id: string; patch: EvidencePatch },
    { prev?: EvidenceItem[] }
  >({
    mutationKey: evidenceKey,
    mutationFn: ({ id, patch }) => evidenceRepo.updateMetadata(clientId, id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: evidenceKey });
      const prev = qc.getQueryData<EvidenceItem[]>(evidenceKey);
      qc.setQueryData<EvidenceItem[]>(evidenceKey, (old) =>
        (old ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
      return { prev };
    },
    onError: (e, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(evidenceKey, ctx.prev);
      reportError(e, () => updateEvidenceMut.mutate(vars));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: evidenceKey }) === 1) {
        void qc.invalidateQueries({ queryKey: evidenceKey });
      }
    },
  });
  const transitionMut = useMutation<
    EvidenceItem,
    unknown,
    { id: string; toStatus: EvidenceStatus; note?: string },
    { prev?: EvidenceItem[] }
  >({
    mutationKey: evidenceKey,
    mutationFn: ({ id, toStatus, note }) => evidenceRepo.transition(clientId, id, toStatus, note),
    onMutate: async ({ id, toStatus, note }) => {
      await qc.cancelQueries({ queryKey: evidenceKey });
      const prev = qc.getQueryData<EvidenceItem[]>(evidenceKey);
      qc.setQueryData<EvidenceItem[]>(evidenceKey, (old) =>
        (old ?? []).map((e) =>
          e.id === id ? { ...e, status: toStatus, notes: note ?? e.notes } : e,
        ),
      );
      return { prev };
    },
    onError: (e, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(evidenceKey, ctx.prev);
      reportError(e, () => transitionMut.mutate(vars));
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: evidenceKey }) === 1) {
        void qc.invalidateQueries({ queryKey: evidenceKey });
      }
    },
  });

  const assessments = assessmentsQ.data ?? SEED_ASSESSMENTS;
  const intake = intakeQ.data ?? DEFAULT_INTAKE;
  const scope = scopeQ.data ?? DEFAULT_SCOPE;
  const evidence = evidenceQ.data ?? [];

  const assessmentFor = useCallback(
    (controlId: string) => assessments.find((a) => a.controlId === controlId),
    [assessments],
  );
  const updateAssessment = useCallback(
    (controlId: string, patch: AssessmentPatch) => patchMut.mutate({ controlId, patch }),
    [patchMut],
  );

  /* intake helpers compute next from the freshest cache value */
  const currentIntake = useCallback(
    () => qc.getQueryData<IntakeState>(intakeKey) ?? DEFAULT_INTAKE,
    [qc, intakeKey],
  );
  const updateIntake = useCallback(
    (patch: Partial<IntakeState>) => intakeMut.mutate({ ...currentIntake(), ...patch }),
    [intakeMut, currentIntake],
  );
  const toggleContractClause = useCallback(
    (label: string) => {
      const base = currentIntake();
      intakeMut.mutate({
        ...base,
        contractClauses: base.contractClauses.map((c) =>
          c.label === label ? { ...c, selected: !c.selected } : c,
        ),
      });
    },
    [intakeMut, currentIntake],
  );
  const toggleDataHandling = useCallback(
    (label: string) => {
      const base = currentIntake();
      intakeMut.mutate({
        ...base,
        dataHandling: base.dataHandling.map((c) =>
          c.label === label ? { ...c, selected: !c.selected } : c,
        ),
      });
    },
    [intakeMut, currentIntake],
  );
  const resetIntake = useCallback(() => intakeMut.mutate(DEFAULT_INTAKE), [intakeMut]);

  /* scope helpers compute next from the freshest cache value */
  const currentScope = useCallback(
    () => qc.getQueryData<ScopeState>(scopeKey) ?? DEFAULT_SCOPE,
    [qc, scopeKey],
  );
  const updateScopeSummary = useCallback(
    (patch: Partial<ScopeSummary>) => {
      const base = currentScope();
      scopeMut.mutate({ ...base, summary: { ...base.summary, ...patch } });
    },
    [scopeMut, currentScope],
  );
  const addAsset = useCallback(() => {
    const base = currentScope();
    scopeMut.mutate({
      ...base,
      assets: [
        ...base.assets,
        {
          id: crypto.randomUUID(),
          name: 'New asset',
          type: 'Endpoint',
          category: 'CUI Asset',
          handlesCui: false,
          owner: 'Unassigned',
          inScope: true,
        },
      ],
    });
  }, [scopeMut, currentScope]);
  const updateAsset = useCallback(
    (id: string, patch: Partial<ScopeAsset>) => {
      const base = currentScope();
      scopeMut.mutate({ ...base, assets: base.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
    },
    [scopeMut, currentScope],
  );
  const toggleAssetInScope = useCallback(
    (id: string) => {
      const base = currentScope();
      scopeMut.mutate({
        ...base,
        assets: base.assets.map((a) => (a.id === id ? { ...a, inScope: !a.inScope } : a)),
      });
    },
    [scopeMut, currentScope],
  );
  const toggleAssetHandlesCui = useCallback(
    (id: string) => {
      const base = currentScope();
      scopeMut.mutate({
        ...base,
        assets: base.assets.map((a) => (a.id === id ? { ...a, handlesCui: !a.handlesCui } : a)),
      });
    },
    [scopeMut, currentScope],
  );
  const resetScope = useCallback(
    () =>
      scopeMut.mutate({
        summary: DEFAULT_SCOPE.summary,
        assets: DEFAULT_SCOPE.assets.map((a) => ({ ...a, id: crypto.randomUUID() })),
      }),
    [scopeMut],
  );

  /* evidence helpers */
  const requestEvidence = useCallback(
    (input: EvidenceRequestInput) => requestMut.mutate(input),
    [requestMut],
  );
  const updateEvidence = useCallback(
    (id: string, patch: EvidencePatch) => updateEvidenceMut.mutate({ id, patch }),
    [updateEvidenceMut],
  );
  const transitionEvidence = useCallback(
    (id: string, toStatus: EvidenceStatus, note?: string) => transitionMut.mutate({ id, toStatus, note }),
    [transitionMut],
  );

  const slice = useMemo<DataSlice>(
    () => ({
      assessments,
      assessmentFor,
      updateAssessment,
      intake,
      updateIntake,
      toggleContractClause,
      toggleDataHandling,
      resetIntake,
      scope,
      updateScopeSummary,
      addAsset,
      updateAsset,
      toggleAssetInScope,
      toggleAssetHandlesCui,
      resetScope,
      evidence,
      requestEvidence,
      updateEvidence,
      transitionEvidence,
    }),
    [
      assessments,
      assessmentFor,
      updateAssessment,
      intake,
      updateIntake,
      toggleContractClause,
      toggleDataHandling,
      resetIntake,
      scope,
      updateScopeSummary,
      addAsset,
      updateAsset,
      toggleAssetInScope,
      toggleAssetHandlesCui,
      resetScope,
      evidence,
      requestEvidence,
      updateEvidence,
      transitionEvidence,
    ],
  );

  const retry = useCallback(() => {
    void assessmentsQ.refetch();
    void intakeQ.refetch();
    void scopeQ.refetch();
    void evidenceQ.refetch();
  }, [assessmentsQ, intakeQ, scopeQ, evidenceQ]);

  return {
    slice,
    isPending:
      enabled &&
      (assessmentsQ.isPending || intakeQ.isPending || scopeQ.isPending || evidenceQ.isPending),
    isError:
      enabled &&
      (assessmentsQ.isError || intakeQ.isError || scopeQ.isError || evidenceQ.isError),
    retry,
  };
}

/* ============================================================
   Async-path UI (Supabase mode only). Local mode never renders these.
   ============================================================ */
function DataLoadingGate() {
  return (
    <div className="center" style={{ minHeight: '100vh', padding: 24, alignItems: 'flex-start' }}>
      <Card title="Loading workspace…" style={{ width: 'min(720px, 100%)', margin: '48px auto' }}>
        <div className="col" style={{ gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-skeleton" style={{ height: 18, width: `${90 - i * 8}%` }} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function DataErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="center" style={{ minHeight: '100vh', padding: 24, alignItems: 'flex-start' }}>
      <Card title="Couldn’t load the workspace" style={{ width: 'min(560px, 100%)', margin: '48px auto' }}>
        <div className="col" style={{ gap: 14 }}>
          <WarnBanner tone="bad">
            We couldn’t reach the cloud workspace. Your local demo data is safe.
          </WarnBanner>
          <div>
            <Btn primary onClick={onRetry}>
              Retry
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MutationErrorToast({ error, onDismiss }: { error: MutationError; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="w-card center"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        gap: 10,
        padding: '8px 10px 8px 14px',
        borderStyle: 'dashed',
        boxShadow: 'var(--sh-md)',
        fontSize: '.85rem',
        maxWidth: 'min(560px, 92vw)',
      }}
    >
      <span className="dot bad" style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none' }} />
      <span>{error.message}</span>
      {/* Writes are never auto-retried; the user re-runs the failed write here. */}
      {error.retry && (
        <button
          className="w-btn sm"
          onClick={() => {
            error.retry?.();
            onDismiss();
          }}
        >
          Retry
        </button>
      )}
      <button className="w-btn sm" aria-label="Dismiss" onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within <DataProvider>');
  return ctx;
}
