# Task 14 — Staff-only consultant-notes table [security]

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

```
TASK: Eliminate the documented LOW residual from Task 11: a client-role user,
using their own valid login, can read consultant_notes ABOUT THEIR OWN
engagement by querying the base table directly (bypassing the app and the
client view). Cross-client access is already RLS-blocked; this task closes the
same-client base-table read. The fix is STRUCTURAL: move consultant notes out
of any table client roles can touch, so there is nothing to leak — do not try
to patch this with column tricks on the existing table.

BACKGROUND (verify against the actual code before changing anything)
- Task 11 added migration 009: a security_invoker client view that omits
  consultant_notes, plus src/data/internalFields.ts (the mirrored list of
  internal-only fields) and audit rerouting of internal-column changes to a
  hidden *.internal_note action.
- The root cause is that all authenticated users share one Postgres role, and
  consultant_notes currently lives as a column on a tenant table that client
  roles have row SELECT on. Read the current schema (supabase/migrations/*) to
  find EXACTLY which table(s) and column(s) hold consultant_notes today before
  designing the move. Do not assume the table name.

AUTHORIZED NEW DEPENDENCIES: none.

DESIGN (follow this approach)
1. New migration supabase/migrations/010_consultant_notes_table.sql (append-only;
   never edit 009 or earlier). It must:
   - Create a dedicated table for consultant notes — one row per
     (client_id, control_id) (match the existing assessment grain; confirm it
     from the schema). Columns: id, client_id, control_id, note text,
     author profile id, created_at, updated_at, with the standard updated_at
     trigger. Foreign keys to client and control consistent with sibling tables.
   - Backfill: copy every existing non-null consultant_notes value from the
     current location into the new table, preserving client_id/control_id and,
     where determinable, the author (else 'system'). Use a single set-based
     INSERT ... SELECT, not row loops.
   - Remove consultant_notes from the old location ONLY AFTER backfill in the
     same migration: drop the column (and update the Task 11 client view /
     internalFields handling so it no longer references a now-absent column —
     the view should simply no longer need to omit it). If dropping the column
     is risky for any reason you discover, STOP and report rather than guessing.
   - Enable RLS on the new table and add policies (this is the whole point):
       * benchmark_fox_admin: full read/write.
       * benchmark_fox_consultant: read/write ONLY for assigned clients
         (reuse the existing assignment helper predicates from the RLS task —
         do not write new bespoke predicates if the helpers exist).
       * ALL client roles (client_executive, client_it_owner,
         evidence_uploader, readonly_viewer): NO policy at all → default deny →
         zero access, even via a direct base-table query with a valid client
         session. This is the fix.
       * WITH CHECK on writes so a consultant cannot write a note into a client
         they are not assigned to.
   - Account for the new table in the deny-all checklist comment style used by
     the earlier RLS migration.
2. Repository layer:
   - Extend the repository (same pattern as the existing ClientDataRepository)
     with consultant-notes read/write methods, Local + Supabase implementations.
     Local Prototype mode keeps notes in a bf_consultant_notes_v1 localStorage
     key (staff-only is moot locally, but keep the API identical).
   - Update every place that currently reads/writes consultant_notes (Control
     Detail, SSP statement workflow, anywhere selectors surface it) to go
     through the new methods. grep for consultant_notes / consultantNotes across
     src/ and list every call site you migrated.
   - The Task 11 client view no longer needs to special-case this column; update
     internalFields.ts and any view-read path accordingly. Do NOT leave the app
     reading a dropped column (that would break client-role loads).
3. Audit: note changes write audit rows (same append-only pattern). Confirm the
   Task 06 trigger logic covers the new table (add an AFTER INSERT/UPDATE trigger
   if triggers are how audit is captured); keep the long-text → '[text changed]'
   rule so note bodies never land in audit rows.

TESTS (the proof the residual is gone — non-negotiable)
4. Extend the RLS suite (the JS/Supabase-client harness from Task 05) with:
   - A consultant assigned to client A can read/write A's consultant notes and
     gets ZERO ROWS (not an error) selecting client B's notes.
   - EVERY client role, with a valid session for their own assigned client,
     gets ZERO ROWS selecting the consultant-notes table directly (base table,
     not the view) — assert for client_executive, client_it_owner,
     evidence_uploader, readonly_viewer. This is the specific exploit from the
     Task 11 residual; it must now fail to return data.
   - anon (no session) reads nothing.
   - WITH CHECK: a consultant cannot insert a note row for an unassigned client.
5. Unit tests: repository methods (Local + mocked Supabase), backfill mapping,
   and that no src/ code references the dropped column anymore (a simple grep
   assertion test is fine).
6. Migration safety: include in your summary the manual steps to apply 010 to a
   live project and how to confirm the backfill row count matches the pre-drop
   non-null count.

DO NOT
- Weaken any Task 05/11 policy to make this simpler.
- Store note bodies in audit rows.
- Touch generated files, data-sources/, or scoring.ts.
- Add per-database-role Postgres roles (out of scope; default-deny on the new
  table is sufficient and simpler).

ACCEPTANCE CRITERIA
- consultant_notes no longer exists as a column on any table a client role can
  SELECT; it lives only in the new staff-only table.
- The RLS suite proves all four client roles get zero rows from the new table on
  a direct base-table query, while cross-client consultant access stays blocked
  and assigned-consultant access still works.
- Backfill preserved all existing notes (row counts match; spot-check 2-3).
- App still reads/writes notes correctly for staff in both Local and Supabase
  modes; client-role screens load with no error and simply show no notes.
- Full gate green; RLS CI job green.
```
