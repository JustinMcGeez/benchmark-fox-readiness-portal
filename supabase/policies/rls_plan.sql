-- ============================================================================
-- Benchmark Fox Readiness Portal — Row Level Security PLAN (draft)
-- Target: Supabase / Postgres
--
-- STATUS: DRAFT. These policies are a realistic foundation, not a hardened,
-- tested production policy set. RLS is ENABLED on the tables in
-- 001_initial_schema.sql; this file holds the planned/draft POLICIES, kept
-- separate so the access model can be reviewed as one document.
--
-- Apply order: run 001_initial_schema.sql first (creates tables, enables RLS),
-- then this file. Until policies exist, RLS-enabled tables deny all access to
-- non-service_role callers — which is the safe default.
--
-- Access model (see docs/backend/supabase-architecture.md §11):
--   * benchmark_fox_admin      -> all Benchmark Fox records
--   * benchmark_fox_consultant -> only clients assigned via client_assignments
--   * client users (future)    -> only their single assigned client
--   * evidence_uploader (future) -> create/read evidence METADATA for assigned clients
--   * readonly_viewer          -> read assigned-client dashboards/reports; no writes
--   * NO cross-client data leakage — every tenant policy roots in the helpers below
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper predicates (SECURITY DEFINER so they can read profiles/assignments
-- without the caller needing direct access to those tables).
-- ----------------------------------------------------------------------------

-- The profile id for the currently-authenticated Supabase user.
create or replace function current_profile_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.id from profiles p where p.user_id = auth.uid();
$$;

-- Does the caller hold a given role?
create or replace function has_role(target app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    where ur.profile_id = current_profile_id()
      and ur.role = target
  );
$$;

-- Is the caller a Benchmark Fox admin? (sees everything)
create or replace function is_bf_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select has_role('benchmark_fox_admin');
$$;

-- Is the caller assigned to this client (any role)?  Admins always pass.
create or replace function is_assigned_to_client(target_client uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_bf_admin() or exists (
    select 1
    from client_assignments ca
    where ca.client_id = target_client
      and ca.profile_id = current_profile_id()
  );
$$;

-- Can the caller WRITE for this client? Admins + consultants assigned to the
-- client. (Read-only viewers and client execs are excluded.)
create or replace function can_write_client(target_client uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_bf_admin() or exists (
    select 1
    from client_assignments ca
    where ca.client_id = target_client
      and ca.profile_id = current_profile_id()
      and ca.role in ('benchmark_fox_consultant', 'client_it_owner')
  );
$$;

-- ============================================================================
-- REFERENCE DATA  (control library + source registry)
-- Readable by any authenticated user; writable only by admins / pipeline.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'control_families', 'controls', 'source_references', 'control_source_references'
  ] loop
    execute format($f$
      create policy %1$s_read_all on %1$s
        for select to authenticated using (true);
      create policy %1$s_admin_write on %1$s
        for all to authenticated
        using (is_bf_admin()) with check (is_bf_admin());
    $f$, t);
  end loop;
end $$;

-- ============================================================================
-- ORGANIZATIONS & PROFILES
-- ============================================================================

-- Organizations: any authenticated BF user may read; only admins may modify.
create policy organizations_read on organizations
  for select to authenticated using (true);
create policy organizations_admin_write on organizations
  for all to authenticated using (is_bf_admin()) with check (is_bf_admin());

-- Profiles: a user can read/update their own profile; admins manage all.
create policy profiles_self_read on profiles
  for select to authenticated
  using (user_id = auth.uid() or is_bf_admin());
create policy profiles_self_update on profiles
  for update to authenticated
  using (user_id = auth.uid() or is_bf_admin())
  with check (user_id = auth.uid() or is_bf_admin());
create policy profiles_admin_write on profiles
  for all to authenticated using (is_bf_admin()) with check (is_bf_admin());

-- Roles & assignments: caller may read their own; admins manage all.
create policy user_roles_read on user_roles
  for select to authenticated
  using (profile_id = current_profile_id() or is_bf_admin());
create policy user_roles_admin_write on user_roles
  for all to authenticated using (is_bf_admin()) with check (is_bf_admin());

create policy client_assignments_read on client_assignments
  for select to authenticated
  using (profile_id = current_profile_id() or is_assigned_to_client(client_id));
create policy client_assignments_admin_write on client_assignments
  for all to authenticated using (is_bf_admin()) with check (is_bf_admin());

-- ============================================================================
-- CLIENTS  — visible only to admins + assigned staff. No cross-client leakage.
-- ============================================================================
create policy clients_read on clients
  for select to authenticated
  using (deleted_at is null and is_assigned_to_client(id));
create policy clients_write on clients
  for all to authenticated
  using (can_write_client(id)) with check (can_write_client(id));

-- ============================================================================
-- PER-CLIENT TENANT TABLES
-- Pattern: SELECT if assigned to the row's client; write if can_write_client().
-- evidence_uploader is allowed to INSERT/SELECT evidence only (handled below).
-- readonly_viewer falls through to SELECT-only (no write policy matches them).
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'client_control_assessments', 'intake_records', 'scope_records',
    'poam_items', 'tasks', 'reports'
  ] loop
    execute format($f$
      create policy %1$s_read on %1$s
        for select to authenticated using (is_assigned_to_client(client_id));
      create policy %1$s_write on %1$s
        for all to authenticated
        using (can_write_client(client_id)) with check (can_write_client(client_id));
    $f$, t);
  end loop;
end $$;

-- scope_assets is scoped through its parent scope_record's client.
create policy scope_assets_read on scope_assets
  for select to authenticated
  using (exists (
    select 1 from scope_records sr
    where sr.id = scope_assets.scope_record_id
      and is_assigned_to_client(sr.client_id)
  ));
create policy scope_assets_write on scope_assets
  for all to authenticated
  using (exists (
    select 1 from scope_records sr
    where sr.id = scope_assets.scope_record_id
      and can_write_client(sr.client_id)
  ))
  with check (exists (
    select 1 from scope_records sr
    where sr.id = scope_assets.scope_record_id
      and can_write_client(sr.client_id)
  ));

-- ============================================================================
-- EVIDENCE  — assigned staff read/write; evidence_uploader (future) may
-- INSERT + SELECT metadata for assigned clients, but not edit assessments.
-- (Still METADATA + links only — enforced by table shape, not policy.)
-- ============================================================================
create policy evidence_read on evidence_items
  for select to authenticated using (is_assigned_to_client(client_id));
create policy evidence_write on evidence_items
  for all to authenticated
  using (can_write_client(client_id)) with check (can_write_client(client_id));
create policy evidence_uploader_insert on evidence_items
  for insert to authenticated
  with check (
    has_role('evidence_uploader') and is_assigned_to_client(client_id)
  );

-- ============================================================================
-- AUDIT EVENTS — APPEND-ONLY.
-- Assigned staff may read their client's events (admins all). Any authenticated
-- caller may INSERT (the app writes the trail). NO update/delete policy exists,
-- so the trail cannot be altered or removed through the app.
-- ============================================================================
create policy audit_read on audit_events
  for select to authenticated
  using (is_bf_admin() or (client_id is not null and is_assigned_to_client(client_id)));
create policy audit_insert on audit_events
  for insert to authenticated with check (true);
-- (Intentionally NO update/delete policies — append-only.)

-- ============================================================================
-- FUTURE / TODO (client portal hardening — not enabled in MVP):
--   * Split read vs. write per client role more granularly (executive vs.
--     it_owner vs. readonly_viewer) once the portal ships.
--   * Restrict client users to non-internal columns (e.g. hide consultant_notes
--     from client_executive) via column-level grants or split views.
--   * Add DB triggers to auto-emit audit_events on mutating statements (defense
--     in depth) so the trail does not rely solely on the app.
--   * Add tests proving NO cross-client SELECT/UPDATE is ever possible.
-- ============================================================================
