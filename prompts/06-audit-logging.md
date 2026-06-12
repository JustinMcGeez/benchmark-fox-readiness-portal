# Task 06 — Real audit logging

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Make the Audit Log real. The audit screen currently renders seed data from
src/data/clients.ts. After this task, meaningful actions write audit rows and
the screen reads them.

DESIGN DECISION (follow exactly): capture audit events in Postgres via triggers
for data changes, plus explicit app-level events for auth/workflow actions.
Triggers can't be bypassed by a buggy client — that's why.

1. Migration 004_audit_triggers.sql:
   - Ensure the audit table (from 001 — use its real name/columns) records:
     actor profile id, client id (nullable for global events), action (enum or
     text: e.g. 'assessment.updated', 'intake.saved', 'scope.saved',
     'client.created', 'evidence.status_changed', 'auth.signed_in'), target
     table + target id, a jsonb diff {field: {old, new}} for UPDATEs (only
     changed fields; EXCLUDE free-text note fields longer than 500 chars —
     store '[text changed]' instead to keep rows small), and created_at.
   - AFTER INSERT/UPDATE triggers on the assessments, intake, scope, and
     evidence tables that write audit rows. Resolve actor via auth.uid() →
     profiles; if null (service_role seeding), record actor as 'system'.
2. App-level events: add a tiny src/lib/audit.ts with logEvent(action, meta)
   that inserts directly (allowed by the INSERT-only RLS policy from Prompt 5).
   Call it for sign-in and sign-out.
3. Audit screen (src/screens/, find the audit screen): replace seed data with a
   paged query (newest first, 50/page, Load more), filters by client, actor, and
   action type, and a humanized diff renderer ("Readiness status: Partial → Met").
   Keep the existing table styling. Local Prototype mode: keep showing the seed
   rows with a "demo data" badge.
4. RLS check: confirm the Prompt 5 policies allow consultants to read audit rows
   only for assigned clients; client roles see only their client's rows and
   never internal-only actions (define which actions are internal in one
   constant and filter server-side via a policy predicate or view — not client-
   side filtering).
5. Tests: trigger tests in the RLS/local-stack suite (update an assessment →
   exactly one audit row with correct diff; long note change → '[text changed]');
   unit test the diff renderer.

ACCEPTANCE: editing a control in the matrix (Supabase mode) produces a visible,
correctly-diffed audit entry within one refresh; audit rows are append-only.
