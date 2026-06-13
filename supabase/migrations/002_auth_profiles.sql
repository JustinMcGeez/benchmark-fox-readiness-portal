-- ============================================================================
-- Benchmark Fox Readiness Portal — auth ↔ profiles wiring (002)
-- Target: Supabase / Postgres
--
-- Task 03 (Supabase Auth). APPEND-ONLY: 001_initial_schema.sql is never edited.
-- This migration:
--   1. adds profiles.role (single primary app role, default 'readonly_viewer' —
--      least privilege; admins promote manually, see the comment block at the
--      bottom). user_roles (001) remains for future multi-role needs; the app's
--      auth layer reads profiles.role.
--   2. ensures a UNIQUE index exists on profiles.user_id (001 declared the
--      column UNIQUE; the guard below makes this migration safe either way).
--   3. ensures the updated_at trigger exists on profiles (001 created it; the
--      guard makes this idempotent).
--   4. creates handle_new_user() (AFTER INSERT on auth.users) and
--      handle_user_email_confirmed() (AFTER UPDATE, on email confirmation)
--      to auto-provision/link a profiles row for every new auth user, with
--      pre-provisioned (invite) profiles linked only via trusted paths.
--   5. adds a minimal RLS policy letting an authenticated user SELECT their
--      OWN profiles row. 001 enabled RLS on profiles with no policies, which
--      denies everything — without this single policy the app could never read
--      the caller's role after sign-in. SELECT-only and self-scoped: users
--      cannot read other profiles and cannot INSERT/UPDATE/DELETE (so they
--      cannot change their own role). The full RLS model lands in Task 05.
--
-- Like 001, everything touching the auth schema is guarded so this migration
-- also applies cleanly on bare Postgres (CI / local) where auth.* is absent.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. profiles.role — single primary application role.
--    Default 'readonly_viewer' = least privilege; promotion is a manual,
--    admin-only act (no self-service path anywhere in the app or policies).
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists role app_role not null default 'readonly_viewer';

-- ----------------------------------------------------------------------------
-- 2. UNIQUE index on profiles.user_id.
--    001 declared `user_id uuid unique` (constraint profiles_user_id_key), so
--    this normally already exists; the guard avoids a wasteful duplicate index
--    while guaranteeing the invariant on databases where 001 ever diverged.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename  = 'profiles'
      and indexdef ilike 'create unique index%(user_id)%'
  ) then
    create unique index profiles_user_id_uidx on public.profiles (user_id);
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger on profiles (idempotent — 001 normally created it).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname  = 'trg_profiles_updated'
      and not tgisinternal
  ) then
    create trigger trg_profiles_updated
      before update on public.profiles
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- 4. Auto-provision a profiles row for every new auth user.
--    SECURITY DEFINER with a pinned search_path: the triggers fire as the auth
--    admin during signup, and profiles RLS must not block the insert.
--    Role is ALWAYS 'readonly_viewer' here — signup metadata can never choose
--    a role.
--
--    Pre-provisioned profiles (user_id IS NULL, created ahead of time by an
--    admin — possibly with an elevated role) are LINKED to the auth user ONLY
--    via trusted admin paths, never from a self-signup:
--      * at INSERT time when the row was created by the admin invite API
--        (invited_at set) or arrived already confirmed (admin createUser);
--      * at email-confirmation time, again only for invited users (mainly
--        covers invites that were issued before this migration deployed; on a
--        post-002 database an invite auto-creates a default profile at INSERT,
--        which an admin then promotes — see the bottom of this file).
--    A self-signup whose email matches a pending profile is NEVER linked and
--    gets NO profile row either (the app degrades that to signed-in-without-
--    role); an admin resolves it manually. Why: if linking happened on any
--    INSERT or any confirmation, an attacker could call the public signup
--    endpoint with an invitee's email + their own password and capture the
--    pre-provisioned profile (directly, or when the invitee clicks the
--    resulting confirmation mail). Email comparisons are case-insensitive
--    (Supabase lowercases new.email; a pre-provisioned profile may have been
--    typed in mixed case).
--
--    OPERATIONAL REQUIREMENT (Supabase dashboard): this portal is invite-only.
--    Disable public email signups (Authentication → Providers → Email) so
--    accounts can only be created by admins/invites; the guards above are
--    defense-in-depth on top of that setting, not a substitute for it.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.profiles
    where user_id is null and lower(email) = lower(new.email)
  ) then
    -- Trusted creation paths link immediately; an unverified self-signup
    -- waits for handle_user_email_confirmed() (see above).
    if new.invited_at is not null or new.email_confirmed_at is not null then
      update public.profiles
        set user_id = new.id
        where user_id is null and lower(email) = lower(new.email);
    end if;
    return new;
  end if;

  insert into public.profiles (user_id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    'readonly_viewer',     -- least privilege, never taken from user metadata
    'Active'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Runs when a user's email becomes confirmed: link the pending pre-provisioned
-- profile (invited users only — see the header above for why), or create the
-- default profile if the INSERT trigger deferred it.
create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Link only ADMIN-INVITED users: a confirmed self-signup matching a pending
  -- profile is the attack shape (invitee clicking an attacker-initiated
  -- confirmation mail), so it must never link. Skip if a profile already
  -- exists for this user (idempotency / pending row added after the fact).
  if new.invited_at is not null then
    update public.profiles
      set user_id = new.id
      where user_id is null
        and lower(email) = lower(new.email)
        and not exists (select 1 from public.profiles where user_id = new.id);
  end if;

  if not exists (select 1 from public.profiles where user_id = new.id) then
    -- Fail-safe: if an UNLINKED pending profile still holds this address, do
    -- not insert a default row — it could collide with profiles.email UNIQUE
    -- and would abort the user's email confirmation. Signed-in-without-a-
    -- profile degrades gracefully in the app; an admin resolves it manually.
    if not exists (
      select 1 from public.profiles
      where user_id is null and lower(email) = lower(new.email)
    ) then
      insert into public.profiles (user_id, email, full_name, role, status)
      values (
        new.id,
        new.email,
        coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
        'readonly_viewer',
        'Active'
      )
      on conflict (user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- The triggers themselves only exist where the Supabase auth schema does
-- (skipped on bare Postgres CI, same approach as the commented-out FK in 001).
do $$
begin
  if to_regclass('auth.users') is not null then
    if not exists (
      select 1 from pg_trigger
      where tgrelid = 'auth.users'::regclass
        and tgname  = 'trg_on_auth_user_created'
        and not tgisinternal
    ) then
      execute 'create trigger trg_on_auth_user_created
                 after insert on auth.users
                 for each row execute function public.handle_new_user()';
    end if;
    if not exists (
      select 1 from pg_trigger
      where tgrelid = 'auth.users'::regclass
        and tgname  = 'trg_on_auth_user_confirmed'
        and not tgisinternal
    ) then
      execute 'create trigger trg_on_auth_user_confirmed
                 after update on auth.users
                 for each row
                 when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
                 execute function public.handle_user_email_confirmed()';
    end if;
  else
    raise notice '002_auth_profiles: auth schema absent (bare Postgres) — skipping auth.users triggers and profiles RLS policy.';
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- 5. Minimal RLS: an authenticated user may read ONLY their own profile row.
--    No INSERT/UPDATE/DELETE policies exist, so users cannot create profiles
--    or change anything — including their own role (privilege escalation is
--    blocked at the database). Guarded like the trigger: auth.uid() only
--    exists on Supabase. Full tenant RLS arrives in Task 05.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('auth.users') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename  = 'profiles'
        and policyname = 'profiles_select_own'
    ) then
      execute 'create policy profiles_select_own on public.profiles
                 for select to authenticated
                 using (user_id = (select auth.uid()))';
    end if;
  end if;
end
$$;

commit;

-- ============================================================================
-- DOCUMENTATION ONLY — how a Benchmark Fox admin promotes a user (NOT executed)
-- ----------------------------------------------------------------------------
-- New users always start as 'readonly_viewer'. Promotion is manual and runs in
-- the Supabase SQL editor (or psql) with admin/service credentials — there is
-- intentionally no in-app or self-service path:
--
--   update profiles set role='benchmark_fox_consultant' where user_id='…';
--
--   -- other roles, same shape:
--   -- update profiles set role='benchmark_fox_admin'   where user_id='…';
--   -- update profiles set role='client_executive'      where user_id='…';
--   -- update profiles set role='client_it_owner'       where user_id='…';
--   -- update profiles set role='evidence_uploader'     where user_id='…';
--
-- Find the user_id first:
--   select user_id, email, role from profiles where email = 'person@example.com';
-- ============================================================================
