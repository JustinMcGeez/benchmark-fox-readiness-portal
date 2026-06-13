/* ============================================================
   localRepository — Local Prototype mode storage.

   The localStorage logic extracted VERBATIM from src/data/store
   (same keys, same shallow-merge semantics, same corrupt-JSON
   fallback). The synchronous helpers are exported because the
   store's local engine uses them directly to stay synchronous
   (the store tests assert localStorage state on the same tick);
   the async ClientDataRepository wrappers resolve immediately.
   ============================================================ */
import type { ClientControlAssessment } from '../types';
import { SEED_ASSESSMENTS } from '../controls';
import { DEFAULT_INTAKE, type IntakeState } from '../intake';
import { DEFAULT_SCOPE, type ScopeState } from '../scope';
import type { AssessmentPatch, ClientDataRepository } from './types';

export const LS_ASSESS = 'bf_assessments_v1';
export const LS_INTAKE = 'bf_intake_v1';
export const LS_SCOPE = 'bf_scope_v1';
export const LS_MIGRATED = 'bf_migrated_v1';

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as T) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export type Overrides = Record<string, AssessmentPatch>;

export const overrideKey = (clientId: string, controlId: string) => `${clientId}:${controlId}`;

export function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(LS_ASSESS);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

/** Merge stored overrides onto the seed set — same semantics as the old store. */
export function mergeAssessments(overrides: Overrides): ClientControlAssessment[] {
  return SEED_ASSESSMENTS.map((a) => {
    const ov = overrides[overrideKey(a.clientId, a.controlId)];
    return ov ? { ...a, ...ov } : a;
  });
}

/* ---- one-time migration helpers (Supabase import prompt) ---- */

export type MigrationMark = 'imported' | 'discarded';

export function loadMigrationMarks(): Record<string, MigrationMark> {
  try {
    const raw = localStorage.getItem(LS_MIGRATED);
    return raw ? (JSON.parse(raw) as Record<string, MigrationMark>) : {};
  } catch {
    return {};
  }
}

export function markMigrated(clientId: string, mark: MigrationMark) {
  saveJson(LS_MIGRATED, { ...loadMigrationMarks(), [clientId]: mark });
}

export interface LocalSnapshot {
  /** Overrides for this client only, keyed by controlId. */
  overrides: Record<string, AssessmentPatch>;
  intake: IntakeState | null;
  scope: ScopeState | null;
  hasAny: boolean;
}

/** Raw local edits for one client — used by the "import to cloud" prompt. */
export function readLocalSnapshot(clientId: string): LocalSnapshot {
  const prefix = `${clientId}:`;
  const overrides: Record<string, AssessmentPatch> = {};
  for (const [key, patch] of Object.entries(loadOverrides())) {
    if (key.startsWith(prefix)) overrides[key.slice(prefix.length)] = patch;
  }
  const intake = localStorage.getItem(LS_INTAKE) ? loadJson(LS_INTAKE, DEFAULT_INTAKE) : null;
  const scope = localStorage.getItem(LS_SCOPE) ? loadJson(LS_SCOPE, DEFAULT_SCOPE) : null;
  return {
    overrides,
    intake,
    scope,
    hasAny: Object.keys(overrides).length > 0 || intake !== null || scope !== null,
  };
}

/* ---- ClientDataRepository implementation (resolves immediately) ---- */

export const localRepository: ClientDataRepository = {
  getAssessments(clientId: string) {
    void clientId; // overrides are already keyed per client; seeds carry the demo client
    return Promise.resolve(mergeAssessments(loadOverrides()));
  },
  patchAssessment(clientId: string, controlId: string, patch: AssessmentPatch) {
    const overrides = loadOverrides();
    const k = overrideKey(clientId, controlId);
    saveJson(LS_ASSESS, { ...overrides, [k]: { ...overrides[k], ...patch } });
    return Promise.resolve();
  },
  getIntake() {
    return Promise.resolve(loadJson(LS_INTAKE, DEFAULT_INTAKE));
  },
  saveIntake(_clientId: string, intake: IntakeState) {
    saveJson(LS_INTAKE, intake);
    return Promise.resolve();
  },
  getScope() {
    return Promise.resolve(loadJson(LS_SCOPE, DEFAULT_SCOPE));
  },
  saveScope(_clientId: string, scope: ScopeState) {
    saveJson(LS_SCOPE, scope);
    return Promise.resolve();
  },
};
