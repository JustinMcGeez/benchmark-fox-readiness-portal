-- ============================================================================
-- Benchmark Fox Readiness Portal — Audit triggers + actor stamping (005)
-- Target: Supabase / Postgres
--
-- Task 06 (Real audit logging). APPEND-ONLY: 001–004 are never edited.
--
-- WHAT THIS MIGRATION DOES
--   1. Adds audit_events.actor_name — the actor's display name captured AT EVENT
--      TIME (names change; an audit trail should show who acted, as-of then).
--      It is also what lets NON-admins see who acted: profiles RLS (002/004)
--      hides other users' rows, so the name must travel with the audit row.
--   2. A BEFORE INSERT trigger (audit_set_actor) stamps user_id + actor_name on
--      EVERY audit row from the authenticated caller (auth.uid() -> profile).
--      service_role / system writes (auth.uid() null) record actor 'system'.
--      Authenticated callers cannot spoof the actor — the stamp overwrites any
--      client-supplied value. This is the single place actor identity is set,
--      for both data-change triggers and app-level events (src/lib/audit.ts).
--   3. AFTER INSERT/UPDATE triggers on assessments / intake / scope / evidence
--      that append an audit row with a compact {field:{old,new}} jsonb diff of
--      the CHANGED columns only. Triggers can't be bypassed by a buggy client —
--      that is why data-change capture lives in the database, not the app.
--   4. Refines the 004 audit_read policy so CLIENT-ROLE users never see
--      INTERNAL-only action types (defined in ONE place: is_internal_audit_action).
--      Row-level tenancy from 004 is unchanged; this only hides certain action
--      TYPES within a client a user is already allowed to see.
--
-- Requires the 004 helpers (current_profile_id, is_assigned_to_client, has_role)
-- and the Supabase auth schema. Ordered after 004 by filename, so on the local
-- stack / a real project those helpers already exist. On bare Postgres 004 has
-- already aborted (it raises without auth.users), so 005 never runs there.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Guard: like 004, this migration is meaningless without the auth schema.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception
      '005_audit_triggers requires the Supabase auth schema (auth.uid()). Apply against a Supabase project / local stack, not bare Postgres.';
  end if;
end
$$;

-- ============================================================================
-- 1. Denormalized actor name on the audit row.
-- ============================================================================
alter table audit_events add column if not exists actor_name text;

comment on column audit_events.actor_name is
  'Actor display name captured at event time (or ''system'' for service_role / '
  'unauthenticated writes). Denormalized so non-admins, who cannot read other '
  'profiles rows under RLS, can still see who acted.';

-- ============================================================================
-- 2. Actor stamping — BEFORE INSERT on audit_events.
-- SECURITY DEFINER so it can read profiles regardless of the caller's grants;
-- search_path pinned. Resolves the actor from auth.uid() and OVERWRITES any
-- caller-supplied user_id / actor_name (anti-spoof) for authenticated callers.
-- ============================================================================
create or replace function audit_set_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid := current_profile_id();
begin
  if v_pid is not null then
    -- Authenticated actor: trust the session, never the supplied columns.
    new.user_id := v_pid;
    select p.full_name into new.actor_name from profiles p where p.id = v_pid;
  end if;
  -- service_role / system writes (no authenticated profile) record 'system'.
  if new.actor_name is null then
    new.actor_name := 'system';
  end if;
  return new;
end;
$$;

revoke execute on function audit_set_actor() from public;

drop trigger if exists trg_audit_set_actor on audit_events;
create trigger trg_audit_set_actor
  before insert on audit_events
  for each row execute function audit_set_actor();

-- ============================================================================
-- 3. Data-change capture — AFTER INSERT/UPDATE on the four workflow tables.
-- One generic trigger builds the {field:{old,new}} diff. SECURITY DEFINER so
-- the audit row is ALWAYS written (RLS on audit_events cannot suppress it),
-- which is the whole point of doing this in the database.
-- ============================================================================
create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base    text;
  v_action  text;
  v_new     jsonb := to_jsonb(NEW);
  v_old     jsonb := case when tg_op = 'UPDATE' then to_jsonb(OLD) else '{}'::jsonb end;
  v_diff    jsonb := '{}'::jsonb;
  v_key     text;
  v_oldval  jsonb;
  v_newval  jsonb;
  -- Identity / bookkeeping / FK columns are never interesting in a diff.
  v_excluded text[] := array[
    'id', 'created_at', 'updated_at', 'deleted_at',
    'client_id', 'organization_id', 'control_id', 'scope_record_id',
    'last_reviewed_at', 'reviewed_by', 'uploaded_by', 'validated_by', 'generated_by'
  ];
begin
  v_base := case tg_table_name
    when 'client_control_assessments' then 'assessment'
    when 'intake_records'             then 'intake'
    when 'scope_records'              then 'scope'
    when 'evidence_items'             then 'evidence'
    else tg_table_name
  end;

  -- Build the diff of CHANGED, meaningful columns.
  for v_key in select jsonb_object_keys(v_new) loop
    if v_key = any (v_excluded) then
      continue;
    end if;

    v_newval := v_new -> v_key;

    if tg_op = 'UPDATE' then
      v_oldval := v_old -> v_key;
      if v_oldval is not distinct from v_newval then
        continue;                          -- unchanged column
      end if;
    else
      v_oldval := 'null'::jsonb;           -- INSERT: no prior value
      if v_newval is null or v_newval = 'null'::jsonb then
        continue;                          -- empty column, nothing to record
      end if;
      if jsonb_typeof(v_newval) in ('array', 'object') then
        continue;                          -- skip noisy containers on create
      end if;
    end if;

    -- Keep rows small: collapse long free-text values to a marker (the change
    -- is recorded; the CUI-adjacent text itself is not copied into the trail).
    if (jsonb_typeof(v_newval) = 'string' and length(v_newval #>> '{}') > 500)
       or (jsonb_typeof(v_oldval) = 'string' and length(v_oldval #>> '{}') > 500) then
      if tg_op = 'UPDATE' then
        v_oldval := to_jsonb('[text changed]'::text);
      end if;
      v_newval := to_jsonb('[text changed]'::text);
    end if;

    v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('old', v_oldval, 'new', v_newval));
  end loop;

  -- Nothing meaningful changed (e.g. an idempotent upsert touched only
  -- updated_at) -> do not write a noise row.
  if v_diff = '{}'::jsonb then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_action := v_base || '.created';
  elsif v_base = 'evidence' and v_diff ? 'status' then
    v_action := 'evidence.status_changed';
  elsif v_base in ('intake', 'scope') then
    v_action := v_base || '.saved';
  else
    v_action := v_base || '.updated';
  end if;

  -- user_id / actor_name are filled by trg_audit_set_actor (BEFORE INSERT).
  insert into audit_events (client_id, action, entity_type, entity_id, new_value)
  values (
    (v_new ->> 'client_id')::uuid,
    v_action,
    tg_table_name,
    (v_new ->> 'id')::uuid,
    v_diff
  );

  return null;  -- AFTER trigger: return value is ignored.
end;
$$;

revoke execute on function audit_row_change() from public;

drop trigger if exists trg_audit_assessments on client_control_assessments;
create trigger trg_audit_assessments
  after insert or update on client_control_assessments
  for each row execute function audit_row_change();

drop trigger if exists trg_audit_intake on intake_records;
create trigger trg_audit_intake
  after insert or update on intake_records
  for each row execute function audit_row_change();

drop trigger if exists trg_audit_scope on scope_records;
create trigger trg_audit_scope
  after insert or update on scope_records
  for each row execute function audit_row_change();

drop trigger if exists trg_audit_evidence on evidence_items;
create trigger trg_audit_evidence
  after insert or update on evidence_items
  for each row execute function audit_row_change();

-- ============================================================================
-- 4. Internal-only action types + refined audit_read.
-- The SINGLE source of truth for which actions are internal to Benchmark Fox
-- and must be hidden from client-role users. Forward-looking: today's actions
-- are all client-relevant; this is the mechanism the client portal (Task 11)
-- relies on, enforced SERVER-SIDE in the policy (never client-side).
-- ============================================================================
create or replace function is_internal_audit_action(p_action text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_action like 'internal.%'
      or p_action in (
        'assessment.internal_note',
        'evidence.internal_note',
        'poam.internal_note'
      );
$$;

-- Benchmark Fox staff (admin or consultant) — see every action type.
create or replace function is_bf_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role('benchmark_fox_admin') or has_role('benchmark_fox_consultant');
$$;

revoke execute on function is_internal_audit_action(text) from public;
revoke execute on function is_bf_staff()                  from public;
grant execute on function is_internal_audit_action(text)  to authenticated;
grant execute on function is_bf_staff()                   to authenticated;

-- Supersede 004's audit_read: admins see all; assigned BF staff see all action
-- types for their clients; assigned client-role users see their client's rows
-- EXCEPT internal-only action types. (004 audit_insert is unchanged.)
--
-- SCOPE NOTE (column-level, deferred to Task 11 — client portal, same posture
-- as 004:265-273): this hides internal ACTION TYPES, but a diff for a
-- client-visible action (e.g. 'assessment.updated') can still carry a changed
-- INTERNAL field such as consultant_notes (short values pass through; only
-- >500-char free-text is collapsed to '[text changed]'). RLS is row-level, so
-- an assigned client-role user could read that field via their OWN client's
-- audit rows. This is NOT cross-client leakage and is NOT exploitable today: no
-- client-role users are provisioned until the portal ships. Task 11 must hide
-- internal columns from client roles (client-facing views / split read paths)
-- AND, for the audit log, either omit internal-field diffs for client roles or
-- tag them with an internal action type — before any client-role user goes live.
drop policy if exists audit_read on audit_events;
create policy audit_read on audit_events
  for select to authenticated
  using (
    is_bf_admin()
    or (
      client_id is not null
      and is_assigned_to_client(client_id)
      and (is_bf_staff() or not is_internal_audit_action(action))
    )
  );
-- (Still intentionally NO update/delete policies — the trail is append-only.)

commit;
