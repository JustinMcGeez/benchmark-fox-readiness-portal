/* ============================================================
   Data store — in-memory seed merged with localStorage edits.

   Holds the active client's control assessments and the currently
   selected control. Edits made in the Control Matrix / Detail persist
   to localStorage and flow to every screen (dashboard recomputes).

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

const LS_ASSESS = 'bf_assessments_v1';
const LS_SELECTED = 'bf_selected_control';

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

function saveOverrides(o: Overrides) {
  try {
    localStorage.setItem(LS_ASSESS, JSON.stringify(o));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

interface DataContextValue {
  currentClientId: string;
  assessments: ClientControlAssessment[];
  assessmentFor: (controlId: string) => ClientControlAssessment | undefined;
  updateAssessment: (controlId: string, patch: AssessmentPatch) => void;
  selectedControlId: string;
  selectControl: (controlId: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [selectedControlId, setSelectedControlId] = useState<string>(
    () => localStorage.getItem(LS_SELECTED) || SEED_ASSESSMENTS[0]?.controlId || '3.1.1',
  );

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
      saveOverrides(next);
      return next;
    });
  }, []);

  const selectControl = useCallback((controlId: string) => {
    setSelectedControlId(controlId);
    try {
      localStorage.setItem(LS_SELECTED, controlId);
    } catch {
      /* ignore */
    }
  }, []);

  const value: DataContextValue = {
    currentClientId: CURRENT_CLIENT_ID,
    assessments,
    assessmentFor,
    updateAssessment,
    selectedControlId,
    selectControl,
  };

  return createElement(DataContext.Provider, { value }, children);
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within <DataProvider>');
  return ctx;
}
