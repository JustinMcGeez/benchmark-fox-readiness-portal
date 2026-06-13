-- ============================================================================
-- Benchmark Fox Readiness Portal — Row Level Security POLICIES (004)
-- Target: Supabase / Postgres
--
-- Task 05 (RLS hardening). APPEND-ONLY: 001/002/003 are never edited.
--
-- This migration turns the DRAFT in supabase/policies/rls_plan.sql into the
-- applied, tested tenancy boundary. RLS is already ENABLED on every tenant table
-- by 001; this file installs the helper predicates and the POLICIES. Until this
-- ran, RLS-enabled tables denied all non-service_role access (safe default).
--
-- Tested by scripts/test-rls.mjs against a local `supabase start` stack; CI runs
-- it on every PR (the `rls` job in .github/workflows/ci.yml).
--
-- ----------------------------------------------------------------------------
-- ACCESS MODEL (docs/backend/supabase-architecture.md §11):
--   * benchmark_fox_admin       -> full read/write on ALL tenant tables
--   * benchmark_fox_consultant  -> read/write ONLY clients in client_assignments
--   * client_executive / client_it_owner / readonly_viewer
--                               -> READ-ONLY on their single assigned client
--   * evidence_uploader         -> read assigned client + insert/update evidence
--                                  METADATA for that client only (no assessments)
--   * Reference tables          -> readable by any authenticated user; writable
--                                  by NOBODY via anon/auth keys (service_role,
--                                  used by the seed script, bypasses RLS).
--
-- AUTHORITATIVE ROLE SOURCE: profiles.role (added by 002, set by the admin
-- promotion path and read by the app). The 001 user_roles table is vestigial
-- for now; the helpers below intentionally key off profiles.role so the policies
-- match how roles are actually assigned. (The draft keyed off user_roles, which
-- nothing populates — it would have denied everyone.)
--
-- No tenant-table policy references auth.uid() directly — every one roots in the
-- helper predicates below, so there is a single place that defines "who can see /
-- write which client".
-- ----------------------------------------------------------------------------
-- DENY-ALL CHECKLIST — all 18 RLS-enabled tables (001) accounted for:
--   REFERENCE  (read: any authenticated · write: NONE / service_role only)
--     1. control_families            read-all,           no write policy
--     2. controls                    read-all,           no write policy
--     3. source_references           read-all,           no write policy
--     4. control_source_references   read-all,           no write policy
--   IDENTITY / TENANCY-CONTROL
--     5. organizations               read: all auth      write: admin
--     6. profiles                    read: self(002)+admin  write: NONE (svc/Task07)
--     7. user_roles                  read: own+admin     write: admin
--     8. client_assignments          read: own+admin     write: admin
--   TENANT DATA  (read: is_assigned_to_client · write: can_write_client)
--     9. clients                     read: assigned(non-deleted) · write: can_write
--    10. client_control_assessments  read: assigned · write: can_write
--    11. intake_records              read: assigned · write: can_write
--    12. scope_records               read: assigned · write: can_write
--    13. scope_assets                read/write via parent scope_records.client_id
--    14. evidence_items              read: assigned · write: can_write
--                                    + evidence_uploader insert/update (metadata)
--    15. poam_items                  read: assigned · write: can_write
--    16. tasks                       read: assigned · write: can_write
--    17. reports                     read: assigned · write: can_write
--    18. audit_events                read: admin|assigned · insert: accessible
--                                    client · NO update/delete (append-only)
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Guard: this migration REQUIRES the Supabase auth schema (auth.uid()). Unlike
-- 001/002 (which silently skip their auth-dependent parts on bare Postgres), the
-- RLS policy set is meaningless without sessions, so fail loudly and clearly if
-- applied to a bare database. The RLS suite runs against the local Supabase stack.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception
      '004_rls_policies requires the Supabase auth schema (auth.uid()). Apply against a Supabase project / local stack, not bare Postgres.';
  end if;
end
$$;

-- ============================================================================
-- HELPER PREDICATES
-- SECURITY DEFINER so a policy can consult profiles / client_assignments without
-- the caller holding direct access to those tables (and without RLS recursion).
-- STABLE, search_path pinned to public. Execute granted to `authenticated` only.
-- ============================================================================

-- Profile id for the currently-authenticated Supabase user.
create or replace function current_profile_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.id from profiles p where p.user_id = auth.uid();
$$;

-- Does the caller's profile hold the given primary role? (profiles.role)
create or replace function has_role(target app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.user_id = auth.uid()
      and p.role = target
  );
$$;

-- Benchmark Fox admin — sees and writes everything.
create or replace function is_bf_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select has_role('benchmark_fox_admin');
$$;

-- Benchmark Fox consultant — writes clients they are assigned to.
create or replace function is_bf_consultant()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select has_role('benchmark_fox_consultant');
$$;

-- Is the caller assigned to this client (ANY role)? Admins always pass. Drives
-- all READ access to per-client tables.
create or replace function is_assigned_to_client(target_client uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_bf_admin() or exists (
    select 1 from client_assignments ca
    where ca.client_id = target_client
      and ca.profile_id = current_profile_id()
  );
$$;

-- May the caller WRITE for this client? Admins (any client) + consultants who are
-- assigned to it. Client users (executive / it_owner / readonly) and evidence
-- uploaders are excluded — they are read-only on tenant tables. Drives all WRITE
-- access to per-client tables.
create or replace function can_write_client(target_client uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_bf_admin() or (
    is_bf_consultant() and exists (
      select 1 from client_assignments ca
      where ca.client_id = target_client
        and ca.profile_id = current_profile_id()
    )
  );
$$;

-- Execute granted to authenticated only (least privilege).
revoke execute on function current_profile_id()             from public;
revoke execute on function has_role(app_role)               from public;
revoke execute on function is_bf_admin()                    from public;
revoke execute on function is_bf_consultant()               from public;
revoke execute on function is_assigned_to_client(uuid)      from public;
revoke execute on function can_write_client(uuid)           from public;

grant execute on function current_profile_id()          to authenticated;
grant execute on function has_role(app_role)            to authenticated;
grant execute on function is_bf_admin()                 to authenticated;
grant execute on function is_bf_consultant()            to authenticated;
grant execute on function is_assigned_to_client(uuid)   to authenticated;
grant execute on function can_write_client(uuid)        to authenticated;

-- ============================================================================
-- REFERENCE DATA — readable by any authenticated user; writable by NOBODY via
-- anon/auth keys. The seed script (scripts/seed-supabase-reference-data.ts) uses
-- the service_role key, which bypasses RLS, so no write policy is required (and
-- granting one would weaken the boundary).
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'control_families', 'controls', 'source_references', 'control_source_references'
  ] loop
    execute format('drop policy if exists %1$s_read_all on %1$s;',     t);
    -- defensive: remove the draft''s admin-write policy if it was ever applied.
    execute format('drop policy if exists %1$s_admin_write on %1$s;',  t);
    execute format(
      'create policy %1$s_read_all on %1$s for select to authenticated using (true);',
      t);
  end loop;
end $$;

-- ============================================================================
-- ORGANIZATIONS — any authenticated BF user may read; only admins may modify.
-- ============================================================================
drop policy if exists organizations_read on organizations;
create policy organizations_read on organizations
  for select to authenticated using (true);

drop policy if exists organizations_admin_write on organizations;
create policy organizations_admin_write on organizations
  for all to authenticated using (is_bf_admin()) with check (is_bf_admin());

-- ============================================================================
-- PROFILES — 002 already created profiles_select_own (self SELECT) and granted
-- NO update policy so a user can never change their own role (privilege-
-- escalation guard). We KEEP that and only ADD admin read. User management
-- (creating/updating profiles, role promotion) stays a service_role / Task 07
-- concern — there is deliberately no write policy here.
-- ============================================================================
-- Remove draft policy names if they were ever applied (self-update would let a
-- user rewrite their own profiles.role — it must not exist).
drop policy if exists profiles_self_read   on profiles;
drop policy if exists profiles_self_update on profiles;
drop policy if exists profiles_admin_write on profiles;

drop policy if exists profiles_admin_read on profiles;
create policy profiles_admin_read on profiles
  for select to authenticated using (is_bf_admin());

-- ============================================================================
-- USER_ROLES & CLIENT_ASSIGNMENTS — a caller may read only their own rows;
-- admins read/manage all. (Least privilege: staff do not enumerate each other.)
-- ============================================================================
drop policy if exists user_roles_read on user_roles;
create policy user_roles_read on user_roles
  for select to authenticated
  using (profile_id = current_profile_id() or is_bf_admin());

drop policy if exists user_roles_admin_write on user_roles;
create policy user_roles_admin_write on user_roles
  for all to authenticated using (is_bf_admin()) with check (is_bf_admin());

drop policy if exists client_assignments_read on client_assignments;
create policy client_assignments_read on client_assignments
  for select to authenticated
  using (profile_id = current_profile_id() or is_bf_admin());

drop policy if exists client_assignments_admin_write on client_assignments;
create policy client_assignments_admin_write on client_assignments
  for all to authenticated using (is_bf_admin()) with check (is_bf_admin());

-- ============================================================================
-- CLIENTS — visible only to admins + assigned staff. No cross-client leakage.
-- ============================================================================
drop policy if exists clients_read on clients;
create policy clients_read on clients
  for select to authenticated
  using (deleted_at is null and is_assigned_to_client(id));

drop policy if exists clients_write on clients;
create policy clients_write on clients
  for all to authenticated
  using (can_write_client(id)) with check (can_write_client(id));

-- ============================================================================
-- PER-CLIENT TENANT TABLES
-- READ if assigned to the row's client; WRITE if can_write_client(). Read-only
-- roles (client users, evidence_uploader) fall through to SELECT-only because no
-- write policy matches them. WITH CHECK on every write blocks writing a row into
-- another client's tenancy.
--
-- SCOPE NOTE (column-level, deferred to Task 11 — client portal): RLS is
-- row-level, so an assigned CLIENT-role user (executive/it_owner/readonly_viewer)
-- can read ALL columns of their OWN client's rows, including internal fields such
-- as consultant_notes and Internal-classified poam_items. This is NOT
-- cross-client leakage (the catastrophic case this task prevents) — it only
-- affects what a client sees about their OWN engagement, and NO client-role users
-- are provisioned until the portal ships. Hiding internal columns from client
-- roles needs client-facing VIEWS / split read paths (a portal concern), so it is
-- intentionally built in Task 11, not here. Tracked: PROGRESS.md Task 11 + §11.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'client_control_assessments', 'intake_records', 'scope_records',
    'poam_items', 'tasks', 'reports'
  ] loop
    execute format('drop policy if exists %1$s_read on %1$s;', t);
    execute format(
      'create policy %1$s_read on %1$s for select to authenticated using (is_assigned_to_client(client_id));',
      t);
    execute format('drop policy if exists %1$s_write on %1$s;', t);
    execute format(
      'create policy %1$s_write on %1$s for all to authenticated using (can_write_client(client_id)) with check (can_write_client(client_id));',
      t);
  end loop;
end $$;

-- scope_assets — scoped through its parent scope_record's client.
drop policy if exists scope_assets_read on scope_assets;
create policy scope_assets_read on scope_assets
  for select to authenticated
  using (exists (
    select 1 from scope_records sr
    where sr.id = scope_assets.scope_record_id
      and is_assigned_to_client(sr.client_id)
  ));

drop policy if exists scope_assets_write on scope_assets;
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
-- EVIDENCE — assigned staff read; admins/consultants write. evidence_uploader
-- may INSERT and UPDATE evidence METADATA for assigned clients only, but cannot
-- write assessments/POA&Ms (those tables exclude it via can_write_client).
-- (Still METADATA + secure links only — enforced by the table shape in 001.)
-- ============================================================================
drop policy if exists evidence_read on evidence_items;
create policy evidence_read on evidence_items
  for select to authenticated using (is_assigned_to_client(client_id));

drop policy if exists evidence_write on evidence_items;
create policy evidence_write on evidence_items
  for all to authenticated
  using (can_write_client(client_id)) with check (can_write_client(client_id));

drop policy if exists evidence_uploader_insert on evidence_items;
create policy evidence_uploader_insert on evidence_items
  for insert to authenticated
  with check (has_role('evidence_uploader') and is_assigned_to_client(client_id));

drop policy if exists evidence_uploader_update on evidence_items;
create policy evidence_uploader_update on evidence_items
  for update to authenticated
  using (has_role('evidence_uploader') and is_assigned_to_client(client_id))
  with check (has_role('evidence_uploader') and is_assigned_to_client(client_id));

-- ============================================================================
-- AUDIT EVENTS — APPEND-ONLY accountability trail.
-- Assigned staff read their client's events (admins all). Authenticated callers
-- may INSERT only for a client they can access (or org-level rows with no
-- client_id). NO update/delete policy exists for any role, so the trail cannot
-- be altered or removed through anon/auth keys.
-- ============================================================================
drop policy if exists audit_read on audit_events;
create policy audit_read on audit_events
  for select to authenticated
  using (is_bf_admin() or (client_id is not null and is_assigned_to_client(client_id)));

drop policy if exists audit_insert on audit_events;
create policy audit_insert on audit_events
  for insert to authenticated
  with check (client_id is null or is_assigned_to_client(client_id));
-- (Intentionally NO update/delete policies — append-only.)

commit;
