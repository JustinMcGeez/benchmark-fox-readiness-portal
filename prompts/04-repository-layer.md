# Task 04 — Repository layer: client data localStorage → Supabase (TanStack Query)

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Move per-client data (control assessments, intake, scope) from
localStorage to Supabase, behind a repository interface, while preserving Local
Prototype mode. This is the single most important refactor in the project —
work carefully and incrementally.

AUTHORIZED NEW DEPENDENCY: @tanstack/react-query v5 only.

CONTEXT: src/data/store.ts is the documented seam. It currently merges seed
data with localStorage overrides (bf_assessments_v1 keyed clientId:controlId,
bf_intake_v1, bf_scope_v1). The Supabase schema (001) already has tables for
client control assessments, intake, and scope (read the migration carefully and
use the actual table/column names — do not invent names).

STEP 1 — Define the repository interface
Create src/data/repository/types.ts with an interface like:
  interface ClientDataRepository {
    getAssessments(clientId: string): Promise<ClientControlAssessment[]>;
    patchAssessment(clientId: string, controlId: string, patch: AssessmentPatch): Promise<void>;
    getIntake(clientId: string): Promise<IntakeState>;
    saveIntake(clientId: string, intake: IntakeState): Promise<void>;
    getScope(clientId: string): Promise<ScopeState>;
    saveScope(clientId: string, scope: ScopeState): Promise<void>;
  }
Match the existing domain types in src/data/types.ts / intake.ts / scope.ts
EXACTLY — the repository adapts storage to the domain, never the reverse.

STEP 2 — Two implementations
- src/data/repository/localRepository.ts: extracts the CURRENT localStorage
  logic from store.ts verbatim (same keys, same merge semantics, same corrupt-
  JSON fallback). Zero behavior change.
- src/data/repository/supabaseRepository.ts: reads/writes the Supabase tables.
  Mapping rules: DB rows ↔ domain types live in one mappers.ts file with unit
  tests. Upserts use onConflict on (client_id, control_id) for assessments.
  All errors are caught and rethrown as a typed RepositoryError with a safe
  message (no SQL in user-facing errors).

STEP 3 — Selection + wiring
- src/data/repository/index.ts picks the implementation: Supabase env vars
  present AND session authenticated → supabaseRepository; otherwise
  localRepository. Expose useRepository().
- Refactor store.ts/DataProvider to consume the repository through TanStack
  Query: useQuery for reads (keys: ['assessments', clientId] etc.), useMutation
  with OPTIMISTIC UPDATES for patchAssessment (the Control Matrix inline edits
  must feel instant — apply patch to cache onMutate, rollback onError with a
  visible toast-style error using existing primitives, invalidate onSettled).
- The public API of DataProvider (what screens consume) must NOT change. Screens
  must not import supabase directly — repository only. Add an ESLint-style
  comment guard or a check script if simple.

STEP 4 — One-time migration helper
- When a signed-in user has bf_* localStorage data and the Supabase store for
  that client is empty, show a non-blocking prompt: "Import local demo edits to
  the cloud workspace?" with Import / Discard. Import = batch upsert, then mark
  bf_migrated_v1 so it never re-prompts. Never auto-migrate silently.

STEP 5 — Loading/error states
- Screens currently assume synchronous data. Add skeleton/loading states using
  existing Card primitives for the async path, and an error panel with a Retry
  button. Local Prototype mode stays synchronous-feeling (localRepository can
  resolve immediately).

STEP 6 — Tests
- Unit tests: mappers (round-trip every enum value, including 'POA&M' phase and
  'Not Applicable'), repository selection logic, optimistic update + rollback
  (mock repository that rejects).
- All existing tests still pass — localRepository behavior is bit-identical to
  the old store logic (the store tests from Prompt 1 should pass against it
  unchanged).

DO NOT migrate evidence/POA&M/tasks/reports yet — assessments + intake + scope
only. Do not touch RLS policies (next task). Do not remove localStorage code.

ACCEPTANCE: typecheck/build/tests/e2e green; Local Prototype mode identical to
before; with Supabase configured + authed, edits in the Control Matrix persist
across browsers/devices.
