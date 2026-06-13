/* ============================================================
   Repository layer — contract between the data store (DataProvider)
   and storage backends.

   Two implementations exist:
     localRepository    — localStorage (Local Prototype mode), the
                          extracted-verbatim logic from store.tsx.
     supabaseRepository — Supabase Postgres (configured + authed mode).

   The repository adapts STORAGE to the DOMAIN types in src/data/
   (types.ts / intake.ts / scope.ts) — never the reverse.
   ============================================================ */
import type { ClientControlAssessment } from '../types';
import type { IntakeState } from '../intake';
import type { ScopeState } from '../scope';

/** Editable fields the matrix/detail can change. */
export type AssessmentPatch = Partial<
  Pick<
    ClientControlAssessment,
    'status' | 'sspStatus' | 'evidenceStatus' | 'poamStatus' | 'owner' | 'consultantNotes' | 'sspStatement'
  >
>;

export interface ClientDataRepository {
  getAssessments(clientId: string): Promise<ClientControlAssessment[]>;
  patchAssessment(clientId: string, controlId: string, patch: AssessmentPatch): Promise<void>;
  getIntake(clientId: string): Promise<IntakeState>;
  saveIntake(clientId: string, intake: IntakeState): Promise<void>;
  getScope(clientId: string): Promise<ScopeState>;
  saveScope(clientId: string, scope: ScopeState): Promise<void>;
}

export type RepositoryErrorKind =
  | 'unknown-client'
  | 'unknown-control'
  | 'load-failed'
  | 'save-failed'
  | 'not-configured';

/**
 * Typed error every repository method may reject with. `message` is a safe,
 * user-presentable sentence — never raw SQL, Postgres error text, table
 * names, or client data. The underlying error (e.g. a PostgrestError) goes
 * in `cause` for debugging only.
 */
export class RepositoryError extends Error {
  readonly kind: RepositoryErrorKind;

  constructor(kind: RepositoryErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RepositoryError';
    this.kind = kind;
  }
}

/** Narrowing helper for catch blocks. */
export function isRepositoryError(e: unknown): e is RepositoryError {
  return e instanceof RepositoryError;
}
