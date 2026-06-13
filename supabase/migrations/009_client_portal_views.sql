-- ============================================================================
-- Benchmark Fox Readiness Portal — Client portal column hiding (009)
-- Target: Supabase / Postgres
--
-- Task 11 (Client portal, role-scoped). APPEND-ONLY: 001–008 are never edited.
--
-- WHAT THIS MIGRATION DOES
--   1. A COLUMN-RESTRICTED, client-facing view of client_control_assessments
--      that OMITS the internal-only columns (consultant_notes). The view is
--      `security_invoker = on`, so the 004 row-level RLS on the base table still
--      applies to the caller — a client-portal user reads ONLY their assigned
--      client's rows, AND only the non-internal columns. The app's client-portal
--      read path (supabaseRepository.getAssessments with includeInternal=false)
--      reads through THIS view, so the column hiding is enforced server-side, not
--      merely in the UI.
--   2. Closes the audit-diff residual flagged in 004/005: the data-change trigger
--      no longer writes internal-only column changes into a CLIENT-VISIBLE audit
--      action. Changes to internal columns are recorded under a SEPARATE internal
--      action (<entity>.internal_note) which 005's is_internal_audit_action +
--      audit_read already hide from client-role users. Staff still see both.
--
-- The internal-only column set here MIRRORS src/data/internalFields.ts
-- (INTERNAL_ONLY_ASSESSMENT_COLUMNS) and src/data/internalFields.test.ts asserts
-- the shape so the three stay in lock-step.
--
-- BOUNDARY NOTE (documented, not a regression): RLS + this view cover the app's
-- read path. Supabase exposes a single `authenticated` Postgres role, so a
-- determined client user COULD still read consultant_notes for their OWN client
-- by querying the base table directly with the anon key (cross-client reads stay
-- blocked by RLS — the catastrophic case). consultant_notes is internal Benchmark
-- Fox commentary, never CUI (CUI is banned product-wide). Fully closing the
-- base-table residual needs per-app-role DB roles (not available with one
-- `authenticated` role) or splitting internal notes into a staff-only table — a
-- follow-up tracked in PROGRESS.md. The portal app never reads that column.
--
-- Requires the Supabase auth schema + the 004/005 helpers; ordered after 008 by
-- filename. On bare Postgres 004 has already aborted (no auth.users), so the
-- audit helpers do not exist there — guarded below like 004/005.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Guard: meaningless without the Supabase auth schema (the RLS the view relies
-- on, and the audit helpers the trigger references).
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception
      '009_client_portal_views requires the Supabase auth schema. Apply against a Supabase project / local stack, not bare Postgres.';
  end if;
end
$$;

-- ============================================================================
-- 1. Column-restricted client view of the assessments table.
-- security_invoker = on  → the base table's RLS (004 client_control_assessments
-- _read: is_assigned_to_client) applies to the CALLER, so row isolation holds.
-- The view simply OMITS consultant_notes (the one internal-only column), so a
-- client-portal read can never retrieve it. (A SECURITY DEFINER view would run as
-- the owner and BYPASS RLS — security_invoker is essential here.)
-- ============================================================================
drop view if exists client_control_assessments_client;
create view client_control_assessments_client
  with (security_invoker = on) as
  select
    id,
    client_id,
    control_id,
    readiness_status,
    implementation_status,
    ssp_status,
    evidence_status,
    poam_status,
    risk_rating,
    owner_name,
    due_date,
    score_impact,
    client_notes,
    validation_method,
    ssp_statement,
    last_reviewed_at,
    reviewed_by,
    created_at,
    updated_at
    -- consultant_notes is INTENTIONALLY omitted (internal-only; see
    -- INTERNAL_ONLY_ASSESSMENT_COLUMNS in src/data/internalFields.ts).
  from client_control_assessments;

comment on view client_control_assessments_client is
  'Client-portal read view of client_control_assessments. security_invoker=on so '
  'row RLS still scopes rows to the caller''s assigned client; omits internal-only '
  'columns (consultant_notes). Used by the app''s client-portal read path.';

-- The base table grants flow to authenticated; the view needs its own grant.
grant select on client_control_assessments_client to authenticated;

-- ============================================================================
-- 2. Keep internal-only column changes OUT of client-visible audit actions.
-- Supersedes 005's audit_row_change(): same diff/collapse/idempotence behavior,
-- but internal-only columns (consultant_notes) are split into a SEPARATE
-- <entity>.internal_note audit row (hidden from client roles by 005's
-- is_internal_audit_action + audit_read) instead of riding in the client-visible
-- <entity>.updated/.created diff. The internal column set mirrors
-- INTERNAL_ONLY_ASSESSMENT_COLUMNS in src/data/internalFields.ts.
-- ============================================================================
create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base      text;
  v_action    text;
  v_new       jsonb := to_jsonb(NEW);
  v_old       jsonb := case when tg_op = 'UPDATE' then to_jsonb(OLD) else '{}'::jsonb end;
  v_diff      jsonb := '{}'::jsonb;   -- client-visible changes
  v_internal  jsonb := '{}'::jsonb;   -- internal-only changes (consultant_notes, …)
  v_key       text;
  v_oldval    jsonb;
  v_newval    jsonb;
  -- Identity / bookkeeping / FK columns are never interesting in a diff.
  v_excluded text[] := array[
    'id', 'created_at', 'updated_at', 'deleted_at',
    'client_id', 'organization_id', 'control_id', 'scope_record_id',
    'last_reviewed_at', 'reviewed_by', 'uploaded_by', 'validated_by', 'generated_by'
  ];
  -- INTERNAL-only columns: recorded under an internal action, never in the
  -- client-visible diff. Mirrors src/data/internalFields.ts.
  v_internal_cols text[] := array['consultant_notes'];
begin
  v_base := case tg_table_name
    when 'client_control_assessments' then 'assessment'
    when 'intake_records'             then 'intake'
    when 'scope_records'              then 'scope'
    when 'evidence_items'             then 'evidence'
    else tg_table_name
  end;

  -- Build the diff of CHANGED, meaningful columns, splitting internal columns out.
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

    if v_key = any (v_internal_cols) then
      v_internal := v_internal || jsonb_build_object(v_key, jsonb_build_object('old', v_oldval, 'new', v_newval));
    else
      v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('old', v_oldval, 'new', v_newval));
    end if;
  end loop;

  -- Nothing meaningful changed -> no noise row (neither client nor internal).
  if v_diff = '{}'::jsonb and v_internal = '{}'::jsonb then
    return null;
  end if;

  -- Client-visible change row (if any non-internal column changed).
  if v_diff <> '{}'::jsonb then
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
  end if;

  -- Internal-only change row: hidden from client roles by is_internal_audit_action
  -- (005) + audit_read; staff still see it. Keeps internal commentary OUT of the
  -- client-visible diff while preserving staff accountability.
  if v_internal <> '{}'::jsonb then
    insert into audit_events (client_id, action, entity_type, entity_id, new_value)
    values (
      (v_new ->> 'client_id')::uuid,
      v_base || '.internal_note',
      tg_table_name,
      (v_new ->> 'id')::uuid,
      v_internal
    );
  end if;

  return null;  -- AFTER trigger: return value is ignored.
end;
$$;

revoke execute on function audit_row_change() from public;
-- (Triggers from 005 reference this function by name; the redefinition above
--  takes effect immediately. The trigger wiring is unchanged.)

-- Broaden 005's is_internal_audit_action so EVERY '<entity>.internal_note' action
-- (the rows the trigger above now emits) is hidden from client roles — not just
-- the three originally enumerated. audit_read (005) consults this predicate.
create or replace function is_internal_audit_action(p_action text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_action like 'internal.%'
      or p_action like '%.internal_note';
$$;

commit;
