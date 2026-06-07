/* ============================================================
   Data store — in-memory seed merged with localStorage edits.

   Holds the active client's control assessments, the selected control,
   and the editable intake + scope workflows. All edits persist to
   localStorage and flow to every screen.

   No backend — this is the seam where Supabase/Postgres would slot in.
   ============================================================ */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ClientControlAssessment } from './types';
import { CURRENT_CLIENT_ID } from './clients';
import { SEED_ASSESSMENTS } from './controls';
import { DEFAULT_INTAKE, type IntakeState } from './intake';
import { DEFAULT_SCOPE, type ScopeAsset, type ScopeState, type ScopeSummary } from './scope';

const LS_ASSESS = 'bf_assessments_v1';
const LS_SELECTED = 'bf_selected_control';
const LS_INTAKE = 'bf_intake_v1';
const LS_SCOPE = 'bf_scope_v1';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as T) } as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/** Editable fields the matrix/detail can change. */
type AssessmentPatch = Partial<
  Pick<
    ClientControlAssessment,
    'status' | 'sspStatus' | 'evidenceStatus' | 'poamStatus' | 'owner' | 'consultantNotes' | 'sspStatement'
  >
>;
type Overrides = Record<string, AssessmentPatch>;

const overrideKey = (clientId: string, controlId: string) => `${clientId}:${controlId}`;

function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(LS_ASSESS);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

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
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [selectedControlId, setSelectedControlId] = useState<string>(
    () => localStorage.getItem(LS_SELECTED) || SEED_ASSESSMENTS[0]?.controlId || '3.1.1',
  );
  const [intake, setIntake] = useState<IntakeState>(() => loadJson(LS_INTAKE, DEFAULT_INTAKE));
  const [scope, setScope] = useState<ScopeState>(() => loadJson(LS_SCOPE, DEFAULT_SCOPE));

  const assessments = useMemo(
    () =>
      SEED_ASSESSMENTS.map((a) => {
        const ov = overrides[overrideKey(a.clientId, a.controlId)];
        return ov ? { ...a, ...ov } : a;
      }),
    [overrides],
  );

  const assessmentFor = useCallback(
    (controlId: string) => assessments.find((a) => a.controlId === controlId),
    [assessments],
  );

  const updateAssessment = useCallback((controlId: string, patch: AssessmentPatch) => {
    setOverrides((prev) => {
      const k = overrideKey(CURRENT_CLIENT_ID, controlId);
      const next = { ...prev, [k]: { ...prev[k], ...patch } };
      saveJson(LS_ASSESS, next);
      return next;
    });
  }, []);

  const selectControl = useCallback((controlId: string) => {
    setSelectedControlId(controlId);
    saveJson(LS_SELECTED, controlId);
  }, []);

  /* ---- intake ---- */
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

  /* ---- scope ---- */
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

  const value: DataContextValue = {
    currentClientId: CURRENT_CLIENT_ID,
    assessments,
    assessmentFor,
    updateAssessment,
    selectedControlId,
    selectControl,
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
  };

  return createElement(DataContext.Provider, { value }, children);
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within <DataProvider>');
  return ctx;
}
