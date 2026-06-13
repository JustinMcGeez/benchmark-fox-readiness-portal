# Task 05 — RLS hardening + automated policy tests

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Turn supabase/policies/rls_plan.sql from a draft into a tested,
production-grade Row Level Security policy set. This is the tenancy security
boundary for a CMMC consulting platform — cross-client data leakage is a
catastrophic failure. Treat this as a security engineering task, not a CRUD task.

PART A — Policy implementation
1. Create supabase/migrations/004_rls_policies.sql implementing the access model
   documented at the top of rls_plan.sql and in
   docs/backend/supabase-architecture.md §11:
   - benchmark_fox_admin: full read/write on all tenant tables.
   - benchmark_fox_consultant: read/write ONLY clients present in their
     client_assignments rows.
   - client_executive / client_it_owner / readonly_viewer: read-only on their
     single assigned client; NO access to other clients, internal notes fields,
     or the clients list.
   - evidence_uploader: read assigned client + insert/update evidence METADATA
     rows for that client only.
   - Reference tables (control families, controls, source refs, mappings):
     readable by any authenticated user; writable by NOBODY via anon/auth keys
     (service_role only, used by the seeding script).
   - Default deny: every table with RLS enabled must end up with explicit
     policies; any table without policies remains deny-all — enumerate all 18
     tables in a checklist comment and account for each.
2. Reuse/finish the helper functions in rls_plan.sql (current_profile_id,
   has_role, assignment predicates). All helpers: security definer, stable,
   set search_path = public, and grant execute to authenticated only.
3. Policies must use WITH CHECK as well as USING on writes (prevent writing
   rows into another client's tenancy).
4. Audit-log table: INSERT-only for authenticated users on their accessible
   clients; no UPDATE or DELETE policies for anyone (append-only).

PART B — Automated RLS tests (non-negotiable)
5. Create a test harness that runs against `supabase start` (local stack) in CI:
   scripts/test-rls.mjs (or SQL-based pgTAP if you prefer — your choice, justify
   it). It must create test users for EVERY role, two clients (A and B), assign
   consultant1→A only, clientuser1→A only, then assert at minimum:
   - consultant1 can read/write client A assessments; gets ZERO ROWS (not an
     error) from client B.
   - clientuser1 (readonly_viewer) can read A dashboard data, cannot write
     anything (insert/update/delete all fail), cannot read B.
   - evidence_uploader can insert evidence metadata for A, not for B; cannot
     update assessments.
   - anon (no session) can read nothing from tenant tables.
   - Nobody but service_role can write reference tables.
   - audit log rows cannot be updated or deleted by any non-service role.
6. Add a CI job (extend ci.yml) that spins up the Supabase local stack
   (supabase/setup-cli action), applies all migrations + seed, and runs the RLS
   test suite. The job must FAIL the build on any policy regression.

PART C — Documentation
7. Update docs/backend/supabase-architecture.md: mark RLS as implemented+tested,
   include the role/table access matrix as a table, and document how to run the
   RLS tests locally.

ACCEPTANCE: all RLS tests pass; the deny-all checklist accounts for all 18
tables; no policy uses auth.uid() directly against tenant tables without going
through the helper predicates; CI enforces it.
