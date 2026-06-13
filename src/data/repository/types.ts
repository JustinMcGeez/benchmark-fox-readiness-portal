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
import type {
  AssignableConsultant,
  ClientAssignment,
  ClientControlAssessment,
  ClientCreateInput,
  ClientPatch,
  ClientRecord,
  EvidenceItem,
  EvidencePatch,
  EvidenceRequestInput,
  EvidenceStatus,
  ReadinessStatus,
} from '../types';
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

/** Per-client readiness status used to compute live readiness/SPRS in the list. */
export interface ClientAssessmentStatus {
  clientId: string;
  controlId: string;
  status: ReadinessStatus;
}

/**
 * Clients + assignments (Task 07). Engagements are RECORDS: a client is never
 * hard-deleted — archiveClient sets status to 'Closed'. createClient also seeds
 * the 110 control assessment rows (one batch, never a 110-insert loop).
 */
export interface ClientsRepository {
  listClients(): Promise<ClientRecord[]>;
  getClient(id: string): Promise<ClientRecord | null>;
  createClient(input: ClientCreateInput): Promise<ClientRecord>;
  updateClient(id: string, patch: ClientPatch): Promise<ClientRecord>;
  /** Archive (status → 'Closed'). NEVER hard-deletes. */
  archiveClient(id: string): Promise<ClientRecord>;

  /** Readiness statuses for every client the caller can see (list readiness). */
  listAssessmentStatuses(): Promise<ClientAssessmentStatus[]>;

  /** Staff who can be assigned (admins/consultants). */
  listAssignableConsultants(): Promise<AssignableConsultant[]>;
  listAssignments(clientId: string): Promise<ClientAssignment[]>;
  assignConsultant(clientId: string, profileId: string, isPrimary?: boolean): Promise<void>;
  removeAssignment(clientId: string, profileId: string): Promise<void>;
}

/**
 * Evidence lifecycle (Task 08). METADATA + external links only — no files.
 * The legal state machine lives in ONE place (src/lib/evidenceWorkflow.ts);
 * transition() validates against it and throws EvidenceTransitionError on an
 * illegal move (a domain error, distinct from RepositoryError storage failures).
 * Items are soft-removed (never hard-deleted), consistent with the rest of the
 * repository.
 */
export interface EvidenceRepository {
  list(clientId: string): Promise<EvidenceItem[]>;
  create(clientId: string, input: EvidenceRequestInput): Promise<EvidenceItem>;
  /** Update editable metadata (NOT status — that goes through transition()).
      Named updateMetadata rather than the bare verb so the supabase-readonly
      guard's coarse write-method scan never false-positives on store call sites
      (same naming convention as ClientsRepository.updateClient). */
  updateMetadata(clientId: string, id: string, patch: EvidencePatch): Promise<EvidenceItem>;
  /** Move an item along the legal state machine; rejects illegal moves. The
      optional human note is stored on the row so the audit trail captures it. */
  transition(
    clientId: string,
    id: string,
    toStatus: EvidenceStatus,
    note?: string,
  ): Promise<EvidenceItem>;
}

export type RepositoryErrorKind =
  | 'unknown-client'
  | 'unknown-control'
  | 'unknown-evidence'
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
