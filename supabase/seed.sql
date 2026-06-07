-- ============================================================================
-- Benchmark Fox Readiness Portal — Supabase seed (auto-run by `supabase db reset`)
--
-- Seeds GLOBAL REFERENCE DATA ONLY and installs a small validation helper.
-- This runs after the migrations in supabase/migrations/.
--
-- ----------------------------------------------------------------------------
-- !!  DATA SENSITIVITY — HARD MVP RULE  !!
--   * Do NOT store CUI (Controlled Unclassified Information).
--   * Do NOT store real client evidence FILES.
--   * evidence_items = METADATA + approved SECURE EXTERNAL LINKS only.
--   * reports        = METADATA + external links only.
--   * This seed inserts NON-SENSITIVE reference data only — never real clients,
--     evidence, POA&Ms, tasks, or reports.
-- ----------------------------------------------------------------------------
--
-- What this file seeds directly (small, stable, idempotent):
--   * organizations  — the Benchmark Fox internal org
--   * control_families — all 14 NIST SP 800-171 Rev. 2 families
--
-- The 110 controls, the source registry, and the control->source mapping are
-- generated from TypeScript and seeded separately by the npm script
-- `db:seed:refs` (scripts/seed-supabase-reference-data.ts) AFTER a
-- `supabase db reset`, so they always match the app's library.
-- ============================================================================

-- --- Benchmark Fox internal organization (idempotent on slug) ---------------
insert into organizations (name, slug, is_internal)
values ('Benchmark Fox', 'benchmark-fox', true)
on conflict (slug) do update
  set name = excluded.name,
      is_internal = excluded.is_internal;

-- --- The 14 NIST SP 800-171 Rev. 2 control families (idempotent on code) ----
insert into control_families (code, name, section, family_index) values
  ('AC', 'Access Control',                          '3.1',  '1'),
  ('AT', 'Awareness and Training',                  '3.2',  '2'),
  ('AU', 'Audit and Accountability',                '3.3',  '3'),
  ('CM', 'Configuration Management',                '3.4',  '4'),
  ('IA', 'Identification and Authentication',       '3.5',  '5'),
  ('IR', 'Incident Response',                        '3.6',  '6'),
  ('MA', 'Maintenance',                              '3.7',  '7'),
  ('MP', 'Media Protection',                         '3.8',  '8'),
  ('PS', 'Personnel Security',                       '3.9',  '9'),
  ('PE', 'Physical Protection',                      '3.10', '10'),
  ('RA', 'Risk Assessment',                          '3.11', '11'),
  ('CA', 'Security Assessment',                      '3.12', '12'),
  ('SC', 'System and Communications Protection',     '3.13', '13'),
  ('SI', 'System and Information Integrity',          '3.14', '14')
on conflict (code) do update
  set name = excluded.name,
      section = excluded.section,
      family_index = excluded.family_index;

-- ============================================================================
-- Validation helper: report RLS status of tenant tables.
-- Used by scripts/validate-supabase-schema.mjs (called over PostgREST as an
-- RPC). SECURITY DEFINER so it can read pg_catalog; STABLE; returns one row per
-- checked table. Safe — exposes only table name + a boolean.
-- ============================================================================
create or replace function public.tenant_rls_status()
returns table (table_name text, rls_enabled boolean)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select c.relname::text as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'organizations', 'clients', 'profiles', 'user_roles', 'client_assignments',
      'client_control_assessments', 'intake_records', 'scope_records',
      'scope_assets', 'evidence_items', 'poam_items', 'tasks', 'reports',
      'audit_events'
    )
  order by c.relname;
$$;
