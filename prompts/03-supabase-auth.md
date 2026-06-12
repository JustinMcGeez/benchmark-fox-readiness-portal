# Task 03 — Supabase Auth (real login, profiles, roles, protected routes)

> Repo-wide rules live in CLAUDE.md and apply on top of everything below.

TASK: Implement real authentication with Supabase Auth. The current login screen
is a non-functional prototype shell.

CONTEXT: supabase/migrations/001_initial_schema.sql already defines profiles and
an app_role enum ('benchmark_fox_admin', 'benchmark_fox_consultant',
'client_executive', 'client_it_owner', 'evidence_uploader', 'readonly_viewer').
src/lib/supabaseClient.ts is a config-gated client.

PART A — Database
1. Write a NEW migration supabase/migrations/002_auth_profiles.sql (never edit
   001). It must: add a trigger on auth.users INSERT that creates a profiles row
   (default role 'readonly_viewer' — least privilege; admins promote manually),
   add updated_at trigger to profiles if missing, and add a unique index on
   profiles.user_id.
2. Add a documented SQL snippet (in the migration as a comment block, not
   executed) showing how a Benchmark Fox admin promotes a user:
   update profiles set role='benchmark_fox_consultant' where user_id='…';

PART B — Frontend auth layer
3. Create src/auth/AuthProvider.tsx: wraps the app, exposes
   { session, profile, role, signInWithPassword, signInWithMagicLink, signOut,
   loading }. Subscribes to supabase.auth.onAuthStateChange. Fetches the
   caller's profiles row after sign-in. Handle the race where session exists
   but profile fetch is pending (loading state, not a crash).
4. Wire the Login screen (src/screens/core.tsx) to real auth: email+password
   sign-in AND a magic-link option. Show inline error states (wrong password,
   rate limited, unconfirmed email) using existing Field/Btn primitives. On
   success navigate to /dashboard. Keep the existing visual design exactly.
5. Implement the <ProtectedRoute> placeholder from the routing task: if no
   Supabase env vars → render children with a dismissible "Local Prototype
   mode — auth disabled" banner (demos must keep working). If env vars set and
   no session → redirect to /login (preserve intended destination, return
   after login). Add a role guard variant <RequireRole roles={[…]}> used later.
6. Add a user menu to Shell.tsx (existing style): signed-in email, role badge,
   Sign out. In Local Prototype mode show "Demo user".
7. Sessions: rely on supabase-js default persistence + auto-refresh; sign-out
   must clear ONLY auth state, never the bf_* demo data keys.

PART C — Tests
8. Unit-test AuthProvider with a mocked supabase client: sign-in success, sign-in
   failure, sign-out, profile fetch failure (degrades to signed-in-no-role with
   warning, not crash).
9. Playwright: in Local Prototype mode, app loads without auth and shows the
   banner. (Real-auth e2e is deferred until a test project exists — leave a
   skipped test stub with a TODO comment.)

SECURITY REQUIREMENTS
- Never log tokens. Never store tokens in localStorage manually (supabase-js
  handles it). No service_role anywhere. Auth errors shown to users must be
  generic enough not to confirm whether an email is registered.

ACCEPTANCE: typecheck/build/tests green; Local Prototype mode unchanged except
the banner; with env vars set, unauthenticated users cannot reach any route but
/login.
